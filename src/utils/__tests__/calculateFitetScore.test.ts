import { describe, it, expect } from 'vitest';
import {
  calculateFitetScore,
  calculateIttfProtectionPoints,
  calculateOpenPlacementPoints,
  calculateTournamentEntryPoints,
  applyBlockSmoothingForExactPosition,
  estimatePlayerCategory,
  getSelectableRounds,
  OPEN_BRACKET_SIZE_OPTIONS,
  TEAM_SERIES_CATALOG,
  TOURNAMENT_CATALOG,
  verifyOfficialScore,
} from '@/utils/calculateFitetScore';
import { PlayerScoreInput, Match, TournamentResult } from '@/types/fitet';

function createBaseInput(overrides?: Partial<PlayerScoreInput>): PlayerScoreInput {
  return {
    initialPoints: 5000,
    gender: 'M',
    isFuoriQuadro: false,
    matches: [],
    tournaments: [],
    ittfProtection: {
      enabled: false,
      ittfRank: 0,
      ittfSeniorPoints: 0,
    },
    ...overrides,
  };
}

describe('Motore di Calcolo Classifiche FITeT 2026/2027 (calculateFitetScore)', () => {
  /**
   * SUITE 1: CAMPIONATI A SQUADRE - PUNTI BASE UFFICIALI E BONUS VITTORIA INATTESA (Art. 2.3)
   */
  describe('1. Vittoria in Campionato: Base Ufficiale + Bonus Inattesa (10%) + Cap 120 pt', () => {
    it('1.1 dovrebbe assegnare solo i punti base ufficiali (es. 40 pt in C2, 30 pt in D2) se l’avversario ha meno punti', () => {
      const matchC2: Match = {
        id: 'match-c2-standard',
        seriesId: 'C2_M', // Base ufficiale: 40 pt
        myCurrentPoints: 5000,
        opponentPoints: 4500,
        isWalkoverOrUnplayed: false,
        isDifferentGender: false,
      };

      const result = calculateFitetScore(
        createBaseInput({
          initialPoints: 5000,
          matches: [matchC2],
        })
      );

      expect(result.calculatedMatches[0].basePoints).toBe(40);
      expect(result.calculatedMatches[0].unexpectedBonus).toBe(0);
      expect(result.calculatedMatches[0].totalPoints).toBe(40);
      expect(result.projectedFinalPoints).toBe(5040);
    });

    it('1.2 dovrebbe calcolare il bonus vittoria inattesa pari al 10% della differenza punti (es. A2 base 170 + 80 bonus = 250 pt)', () => {
      const match: Match = {
        id: 'match-upset-linear',
        seriesId: 'A2_M', // Base ufficiale: 170 pt
        myCurrentPoints: 10000,
        opponentPoints: 10800, // Differenza: +800 pt -> Bonus 10% = 80 pt
        isWalkoverOrUnplayed: false,
        isDifferentGender: false,
      };

      const result = calculateFitetScore(
        createBaseInput({
          initialPoints: 10000,
          matches: [match],
        })
      );

      expect(result.calculatedMatches[0].basePoints).toBe(170);
      expect(result.calculatedMatches[0].unexpectedBonus).toBe(80);
      expect(result.calculatedMatches[0].totalPoints).toBe(250);
      expect(result.projectedFinalPoints).toBe(10250);
    });

    it('1.3 dovrebbe bloccare il bonus vittoria inattesa al tetto massimo di 120 punti (es. D1 base 35 + 120 cap = 155 pt)', () => {
      const match: Match = {
        id: 'match-upset-capped',
        seriesId: 'D1_M', // Base ufficiale: 35 pt
        myCurrentPoints: 5000,
        opponentPoints: 6500, // Differenza: +1500 pt -> 10% sarebbe 150, limitato a 120 pt
        isWalkoverOrUnplayed: false,
        isDifferentGender: false,
      };

      const result = calculateFitetScore(
        createBaseInput({
          initialPoints: 5000,
          matches: [match],
        })
      );

      expect(result.calculatedMatches[0].basePoints).toBe(35);
      expect(result.calculatedMatches[0].unexpectedBonus).toBe(120);
      expect(result.calculatedMatches[0].totalPoints).toBe(155);
      expect(result.projectedFinalPoints).toBe(5155);
    });
  });

  /**
   * SUITE 2: ECCEZIONI CAMPIONATO A SQUADRE (Art. 2.3)
   */
  describe('2. Eccezioni Campionato: Assenza/Rinuncia e Sesso Diverso', () => {
    it('2.1 dovrebbe restituire 0 punti totali se la partita è vinta per assenza o rinuncia (walkover)', () => {
      const walkoverMatch: Match = {
        id: 'match-walkover',
        seriesId: 'A2_M',
        myCurrentPoints: 5000,
        opponentPoints: 12000,
        isWalkoverOrUnplayed: true,
        isDifferentGender: false,
      };

      const result = calculateFitetScore(
        createBaseInput({
          initialPoints: 5000,
          matches: [walkoverMatch],
        })
      );

      expect(result.calculatedMatches[0].totalPoints).toBe(0);
      expect(result.teamMatchesPoints).toBe(0);
      expect(result.projectedFinalPoints).toBe(5000);
    });

    it('2.2 dovrebbe restituire 0 punti totali in caso di incontro tra atleti di sesso diverso', () => {
      const mixedGenderMatch: Match = {
        id: 'match-mixed-gender',
        seriesId: 'C1_M',
        myCurrentPoints: 6000,
        opponentPoints: 7500,
        isWalkoverOrUnplayed: false,
        isDifferentGender: true,
      };

      const result = calculateFitetScore(
        createBaseInput({
          initialPoints: 6000,
          matches: [mixedGenderMatch],
        })
      );

      expect(result.calculatedMatches[0].totalPoints).toBe(0);
      expect(result.teamMatchesPoints).toBe(0);
      expect(result.projectedFinalPoints).toBe(6000);
    });
  });

  /**
   * SUITE 3: LIMITE TORNEI VALIDI PER TIPOLOGIA (Art. 2.4 & Art. 2.5)
   */
  describe('3. Limite Tornei Validi: Taglio eccedenza piazzamenti e mantenimento vittorie gironi', () => {
    it('3.1 inserendo 4 tornei TRP_4 (validi: 2), deve prendere i 2 migliori piazzamenti e mantenere i punti girone di tutti e 4', () => {
      const tournaments: TournamentResult[] = [
        { id: 'trp4-girone', tournamentId: 'TRP_4', roundReached: -1, groupWins: 2 }, // 4 pt, scartato
        { id: 'trp4-quarti', tournamentId: 'TRP_4', roundReached: 3, groupWins: 2 },  // 4 + 36 = 40 pt
        { id: 'trp4-ottavi', tournamentId: 'TRP_4', roundReached: 4, groupWins: 2 },  // 4 + 29 = 33 pt, scartato
        { id: 'trp4-semi', tournamentId: 'TRP_4', roundReached: 2, groupWins: 2 },    // 4 + 45 = 49 pt
      ];

      const result = calculateFitetScore(createBaseInput({ initialPoints: 5000, tournaments }));

      const discarded = result.calculatedTournaments.find((t) => t.id === 'trp4-ottavi');
      expect(discarded?.isCountedInValidLimit).toBe(false);
      expect(discarded?.effectiveTotalPoints).toBe(20);

      expect(result.tournamentParticipationAndPlacementPoints).toBe(89);
      expect(result.tournamentGroupWinPoints).toBe(80);
      expect(result.projectedFinalPoints).toBe(5169);
    });

    const entries = (...ids: string[]): TournamentResult[] =>
      ids.map((tournamentId, i) => ({ id: `gara-${i}`, tournamentId, roundReached: 0, groupWins: 0 }));
    const countedIn = (...ids: string[]) =>
      calculateFitetScore(createBaseInput({ tournaments: entries(...ids) })).calculatedTournaments.filter(
        (t) => t.isCountedInValidLimit
      ).length;

    it.each([
      ['6 Open in totale, anche di fasce diverse', ['OPEN1', 'OPEN2', 'OPEN3', 'OPEN4', 'OPEN5', 'OPEN6', 'OPEN7'], 6],
      ['2 Top in totale', ['TOP_1', 'TOP_2', 'TOP_3'], 2],
      ['2 Predeterminati di categoria', ['TRP_3', 'TRP_4', 'TRP_5'], 2],
      ['3 Predeterminati giovanili', ['TRP_G_U21', 'TRP_G_U19', 'TRP_G_U17', 'TRP_G_U15'], 3],
      ['4 Ordinari', ['TRO_ASS', 'TRO_3', 'TRO_4', 'TRO_5', 'TRO_6'], 4],
      ['1 Campionato Italiano di categoria', ['CI_3', 'CI_4'], 1],
      ['gruppi diversi non si sommano al limite', ['OPEN1', 'TOP_1', 'CI_3', 'CI_G_U21', 'CR_3'], 5],
    ])('3.2 limite condiviso: %s', (_label, ids, expected) => {
      expect(countedIn(...ids)).toBe(expected);
    });

    it('3.3 nel limite condiviso restano i punteggi più alti', () => {
      const result = calculateFitetScore(
        createBaseInput({ tournaments: entries('TOP_5', 'TOP_1', 'TOP_3') })
      );
      const counted = result.calculatedTournaments.filter((t) => t.isCountedInValidLimit);
      expect(counted.map((t) => t.tournamentId).sort()).toEqual(['TOP_1', 'TOP_3']);
    });

    it('3.4 ogni gruppo dovrebbe avere il limite della Tabella 3', () => {
      const expected: Record<string, number> = {
        CI_CAT: 1, CI_GIOV: 1, CI_PARA: 1, CI_MASTER: 1, TN_GIOV: 3, TN_PARA: 2, TN_MASTER: 2,
        TOP: 2, COPPA_REG: 1, OPEN: 6, CR_CAT: 1, CR_GIOV: 1, CR_PARA: 1, CR_MASTER: 1,
        TRP_CAT: 2, TRP_GIOV: 3, TR_PARA: 2, TR_MASTER: 2, TRO: 4, CP: 1,
      };
      const actual = Object.fromEntries(
        Object.values(TOURNAMENT_CATALOG).map((c) => [c.gruppoValidi, c.validi])
      );
      expect(actual).toEqual(expected);
    });
  });

  /**
   * SUITE 4: TORNEI OPEN E SCALA LIVELLI L0-L10 (Art. 2.4 Tabella 4)
   */
  describe('4. Profondità Tabellone Open (Livelli L0-L10 su Valore Nominale)', () => {
    it('4.1 dovrebbe replicare il risultato ufficiale di un Open 5 con tabellone L6: semifinale = 102 + 8, vittoria a parte', () => {
      const result = calculateFitetScore(
        createBaseInput({
          initialPoints: 3000,
          tournaments: [
            { id: 'open5-ufficiale', tournamentId: 'OPEN5', roundReached: 2, groupWins: 1, bracketDepthLevels: 6 },
          ],
        })
      );

      const calc = result.calculatedTournaments[0];
      expect(calc.participationPoints).toBe(8);
      expect(calc.placementPoints).toBe(102);
      expect(calc.rawPlacementAndParticipation).toBe(110);
      expect(calc.groupWinPoints).toBe(15);
      expect(calc.effectiveTotalPoints).toBe(125);
    });

    it.each([
      ['vincitore', 0, 146],
      ['finalista', 1, 118],
    ] as const)('4.1b dovrebbe replicare il risultato ufficiale di un Open 6 con tabellone L6: %s', (_label, roundReached, placement) => {
      const [calc] = calculateFitetScore(
        createBaseInput({
          tournaments: [
            { id: 'open6-ufficiale', tournamentId: 'OPEN6', roundReached, groupWins: 2, bracketDepthLevels: 6 },
          ],
        })
      ).calculatedTournaments;

      expect(calc.rawPlacementAndParticipation).toBe(placement);
      expect(calc.groupWinPoints).toBe(30);
    });

    it.each([
      ['vincitore', 0, 2, 283],
      ['finalista', 1, 3, 230],
      ['semifinalista', 2, 2, 188],
    ] as const)('4.2 dovrebbe replicare il risultato ufficiale di un Open 1 con tabellone L5: %s', (_label, roundReached, groupWins, placement) => {
      const [calc] = calculateFitetScore(
        createBaseInput({
          tournaments: [
            { id: 'open1-ufficiale', tournamentId: 'OPEN1', roundReached, groupWins, bracketDepthLevels: 5 },
          ],
        })
      ).calculatedTournaments;

      expect(calc.rawPlacementAndParticipation).toBe(placement);
      expect(calc.groupWinPoints).toBe(groupWins * 15);
    });

    it('4.3 la dimensione del tabellone dovrebbe scalare la colonna della Tabella 3', () => {
      const placement = (bracketDepthLevels: number) =>
        calculateTournamentEntryPoints(TOURNAMENT_CATALOG.OPEN4, {
          roundReached: 4,
          groupWins: 0,
          bracketDepthLevels,
        }).placementPoints;

      expect(placement(6)).toBe(78);
      expect(placement(5)).toBe(59); // 78 x 75% = 58,5
      expect(placement(7)).toBe(98); // 78 x 125% = 97,5
    });
  });

  /**
   * SUITE 5: PASSAGGIO E GESTIONE FUORI QUADRO (Art. 1.4 & Art. 2.7)
   */
  describe('5. Fuori Quadro (F.Q.): Decurtazione 5% a fine stagione per inattività', () => {
    it('5.1 dovrebbe decurtare del 5% il classificato senza incontri disputati (Art. 2.7)', () => {
      const inactiveResult = calculateFitetScore(createBaseInput({ initialPoints: 5000 }));

      expect(inactiveResult.projectedFinalPoints).toBe(5000);
      expect(inactiveResult.fuoriQuadroEndSeasonProjection).toBe(4750);
    });

    it('5.1b dovrebbe considerare inattivo anche chi ha solo partite non disputate', () => {
      const result = calculateFitetScore(
        createBaseInput({
          matches: [
            {
              id: 'm-walkover',
              seriesId: 'C2_M',
              myCurrentPoints: 5000,
              opponentPoints: 4500,
              isWalkoverOrUnplayed: true,
              isDifferentGender: false,
            },
          ],
        })
      );

      expect(result.fuoriQuadroEndSeasonProjection).toBe(4750);
    });

    it('5.1c non dovrebbe stimare il punteggio di chi è già F.Q. e resta inattivo (Art. 2.7 a-c)', () => {
      const result = calculateFitetScore(
        createBaseInput({ initialPoints: 5000, isFuoriQuadro: true })
      );

      expect(result.fuoriQuadroEndSeasonProjection).toBeNull();
    });

    it('5.2 non dovrebbe applicare alcuna decurtazione del 5% se l’atleta F.Q. disputa almeno una partita o un torneo', () => {
      const activeResult = calculateFitetScore(
        createBaseInput({
          initialPoints: 5000,
          isFuoriQuadro: true,
          matches: [
            {
              id: 'm-valid',
              seriesId: 'C2_M', // +40 pt ufficiali
              myCurrentPoints: 5000,
              opponentPoints: 4500,
              isWalkoverOrUnplayed: false,
              isDifferentGender: false,
            },
          ],
        })
      );

      expect(activeResult.projectedFinalPoints).toBe(5040);
      expect(activeResult.fuoriQuadroEndSeasonProjection).toBe(5040);
    });
  });
});
describe('6. Punti per vittoria nei gironi (Art. 2.5)', () => {
  const FIVE_POINTS = /^(CR_G_|CR_PARA|CR_MASTER|TRP_G_|TRP_PARA|TR_MASTER)/;

  it('6.1 dovrebbe assegnare 5 pt alle gare regionali giovanili, master e paralimpiche', () => {
    const ids = Object.keys(TOURNAMENT_CATALOG).filter((id) => FIVE_POINTS.test(id));
    expect(ids).toHaveLength(18);
    ids.forEach((id) => expect(TOURNAMENT_CATALOG[id].ptsVit).toBe(5));
  });

  it('6.2 dovrebbe assegnare 20 pt a Top e Italiani, 15 agli Open, 10 alle regionali di categoria', () => {
    expect(TOURNAMENT_CATALOG.TOP_1.ptsVit).toBe(20);
    expect(TOURNAMENT_CATALOG.CI_3.ptsVit).toBe(20);
    expect(TOURNAMENT_CATALOG.CI_G_U21.ptsVit).toBe(10);
    expect(TOURNAMENT_CATALOG.TN_MASTER.ptsVit).toBe(10);
    expect(TOURNAMENT_CATALOG.COPPA_REG_GIOV.ptsVit).toBe(20);
    expect(TOURNAMENT_CATALOG.OPEN5.ptsVit).toBe(15);
    expect(TOURNAMENT_CATALOG.CR_3.ptsVit).toBe(10);
    expect(TOURNAMENT_CATALOG.TRP_4.ptsVit).toBe(10);
    expect(TOURNAMENT_CATALOG.TRO_5.ptsVit).toBe(10);
    expect(TOURNAMENT_CATALOG.CP.ptsVit).toBe(10);
  });

  it('6.3 dovrebbe limitare le vittorie al massimo del girone e ignorare i valori negativi', () => {
    const config = TOURNAMENT_CATALOG.OPEN5;
    const entry = { roundReached: -1 as const };
    expect(calculateTournamentEntryPoints(config, { ...entry, groupWins: 99 }).groupWinPoints).toBe(75);
    expect(calculateTournamentEntryPoints(config, { ...entry, groupWins: -2 }).groupWinPoints).toBe(0);
  });
});

describe('7. Protezione della classifica ITTF (Art. 2.6)', () => {
  it.each([
    [1, 1000],
    [25, 1000],
    [26, 900],
    [50, 900],
    [75, 700],
    [100, 500],
    [150, 350],
    [200, 240],
    [201, 160],
    [300, 160],
  ])('7.1 posizione %i: punti ITTF più %i', (ittfRank, bonus) => {
    expect(
      calculateIttfProtectionPoints({ enabled: true, ittfRank, ittfSeniorPoints: 500 })
    ).toBe(500 + bonus);
  });

  it('7.2 non dovrebbe assegnare punti oltre la posizione 300 o se non attiva', () => {
    expect(calculateIttfProtectionPoints({ enabled: true, ittfRank: 301, ittfSeniorPoints: 500 })).toBe(0);
    expect(calculateIttfProtectionPoints({ enabled: false, ittfRank: 10, ittfSeniorPoints: 500 })).toBe(0);
  });

  it('7.3 dovrebbe sommare la protezione al punteggio', () => {
    const result = calculateFitetScore(
      createBaseInput({ ittfProtection: { enabled: true, ittfRank: 10, ittfSeniorPoints: 500 } })
    );
    expect(result.projectedFinalPoints).toBe(6500);
  });
});

describe('8. Tornei: consolazione, uscita nel girone e turni selezionabili', () => {
  const entry = (overrides: Partial<TournamentResult>): TournamentResult => ({
    id: 'gara',
    tournamentId: 'OPEN5',
    roundReached: 2,
    groupWins: 2,
    ...overrides,
  });

  it('8.1 non dovrebbe assegnare punti alla consolazione (Art. 2.4 e 2.5)', () => {
    const result = calculateFitetScore(
      createBaseInput({ tournaments: [entry({ isConsolation: true })] })
    );
    expect(result.totalTournamentPoints).toBe(0);
  });

  it('8.2 chi esce nel girone dovrebbe avere partecipazione e vittorie, senza piazzamento', () => {
    const [calc] = calculateFitetScore(
      createBaseInput({ tournaments: [entry({ roundReached: -1 })] })
    ).calculatedTournaments;
    expect(calc.placementPoints).toBe(0);
    expect(calc.effectiveTotalPoints).toBe(38);
  });

  it('8.3 un torneo inesistente non dovrebbe assegnare punti', () => {
    const result = calculateFitetScore(
      createBaseInput({ tournaments: [entry({ tournamentId: 'NON_ESISTE' })] })
    );
    expect(result.totalTournamentPoints).toBe(0);
  });

  it('8.4a chi esce al primo turno di un tabellone L6 dovrebbe ricevere la colonna F32', () => {
    const points = calculateTournamentEntryPoints(TOURNAMENT_CATALOG.OPEN5, {
      roundReached: 6,
      groupWins: 0,
      bracketDepthLevels: 6,
    });
    expect(points.placementPoints).toBe(39);
  });

  it.each([
    [1, 24],
    [2, 32],
    [3, 56],
    [4, 80],
    [5, 120],
    [6, 160],
    [7, 200],
    [8, 220],
    [9, 240],
    [10, 280],
  ])('8.4b una colonna da 160 su tabellone L%i dovrebbe valere %i pt', (level, points) => {
    expect(calculateOpenPlacementPoints(160, level)).toBe(points);
  });

  it('8.5 negli Open dovrebbe proporre solo i turni compatibili col tabellone', () => {
    const values = (level: number) =>
      getSelectableRounds(TOURNAMENT_CATALOG.OPEN5, level).map((r) => r.value);
    expect(values(2)).toEqual([-1, 0, 1, 2]);
    expect(values(6)).toEqual([-1, 0, 1, 2, 3, 4, 5, 6]);
    expect(getSelectableRounds(TOURNAMENT_CATALOG.TOP_1, 2).length).toBeGreaterThan(4);
    expect(values(10)).toContain(10);
    expect(getSelectableRounds(TOURNAMENT_CATALOG.TOP_4, 6).map((r) => r.value)).toContain(9);
    expect(getSelectableRounds(TOURNAMENT_CATALOG.TOP_4, 6).map((r) => r.value)).not.toContain(10);
  });

  it('8.6 correzione a blocchi: 6ª e 7ª posizione ricevono la media (Art. 2.4)', () => {
    const scores = { 5: 100, 6: 90, 7: 81, 8: 70 };
    expect(applyBlockSmoothingForExactPosition(5, scores)).toBe(100);
    expect(applyBlockSmoothingForExactPosition(6, scores)).toBe(86);
    expect(applyBlockSmoothingForExactPosition(7, scores)).toBe(86);
    expect(applyBlockSmoothingForExactPosition(8, scores)).toBe(70);
  });

  it('8.7 ogni voce del catalogo dovrebbe avere 11 turni con punti non crescenti', () => {
    for (const [key, config] of Object.entries(TOURNAMENT_CATALOG)) {
      expect(config.id).toBe(key);
      expect(config.turni).toHaveLength(11);
      config.turni.slice(1).forEach((points, i) => {
        expect(points).toBeLessThanOrEqual(config.turni[i]);
      });
    }
  });
});

describe('9. Categoria stimata e verifica del punteggio ufficiale', () => {
  it('9.1 F.Q. fino a 2500 pt: 6ª maschile e 5ª femminile (Art. 2.7)', () => {
    expect(estimatePlayerCategory(2500, 'M', true)).toContain('6ª');
    expect(estimatePlayerCategory(2500, 'F', true)).toContain('5ª');
  });

  it.each([
    [0, 'EXACT'],
    [25, 'MINOR_DIFF'],
    [-25, 'MINOR_DIFF'],
    [26, 'SIGNIFICANT_DIFF'],
    [-26, 'SIGNIFICANT_DIFF'],
  ] as const)('9.2 scostamento di %i: %s', (delta, status) => {
    const breakdown = calculateFitetScore(createBaseInput());
    expect(verifyOfficialScore(5000, 5000 + delta, breakdown).status).toBe(status);
  });
});

describe('10. Allegato Tecnico 2026/27', () => {
  it('10.1 Tabella 1: punti base di tutti i campionati', () => {
    const points = Object.fromEntries(
      Object.values(TEAM_SERIES_CATALOG).map((s) => [s.id, s.baseWinPoints])
    );
    expect(points).toEqual({
      A1_M: 300, A2_M: 170, B1_M: 110, B2_M: 80, C1_M: 60, C2_M: 40, D1_M: 35, D2_M: 30, D3_M: 25, D4_M: 20,
      A1_F: 280, A2_F: 140, B_F: 75, C_F_N: 40, C_F: 25, D1_F: 14, D2_F: 10,
      MASTER_A1: 70, MASTER_A2: 50, MASTER_B: 25, MASTER_C_N: 14, MASTER_C: 10, MASTER_A1_F: 50, MASTER_C_F: 20,
      PARA_A1: 20, PARA_A2: 10, PARA_R: 8,
      CI_GIOV: 40, COPPA_REGIONI: 20, GIOVANILI: 15,
      SUPERCOPPA: 100, COPPA_ITALIA: 90, COPPA_ITALIA_CCRR: 15, COPPA_REG: 10, PROMOZIONALE: 0,
    });
  });

  it.each([
    ['TOP_1', 25, [1300, 1040, 832, 666, 532, 320, 0, 0, 0, 0]],
    ['TOP_4', 10, [400, 320, 256, 205, 164, 131, 105, 84, 67, 54]],
    ['CI_ASS', 60, [2800, 2240, 1792, 1434, 1147, 918, 0, 0, 0, 0]],
    ['CI_5', 15, [450, 360, 288, 230, 184, 147, 118, 94, 80, 68]],
    ['CI_G_U21', 15, [400, 320, 256, 205, 164, 131, 0, 0, 0, 0]],
    ['TN_MASTER', 8, [250, 200, 160, 128, 102, 82, 66, 52, 0, 0]],
    ['TRP_PARA', 1, [38, 30, 24, 19, 15, 12, 0, 0, 0, 0]],
    ['TR_MASTER', 1, [60, 48, 38, 31, 25, 20, 16, 13, 0, 0]],
    ['TRO_ASS', 8, [63, 50, 40, 32, 26, 20, 16, 13, 0, 0]],
    ['TRO_6', 2, [23, 10, 8, 6, 5, 4, 3, 2, 0, 0]],
    ['CP', 1, [10, 8, 6, 5, 4, 3, 2, 1, 0, 0]],
    ['OPEN1', 20, [350, 280, 224, 179, 143, 115, 86, 65, 48, 0]],
    ['OPEN2', 16, [300, 240, 192, 154, 123, 98, 74, 55, 41, 0]],
    ['OPEN3', 13, [240, 192, 154, 123, 98, 79, 59, 44, 33, 0]],
    ['OPEN4', 10, [190, 152, 122, 97, 78, 62, 47, 35, 26, 0]],
    ['OPEN5', 8, [160, 128, 102, 82, 66, 52, 39, 29, 22, 0]],
    ['OPEN6', 6, [140, 112, 90, 72, 57, 46, 34, 26, 19, 0]],
    ['OPEN7', 5, [120, 96, 77, 61, 49, 39, 29, 22, 17, 0]],
    ['OPEN8', 4, [100, 80, 64, 51, 41, 33, 25, 18, 14, 0]],
  ] as const)('10.2 Tabella 3: %s', (id, girq, turni) => {
    expect(TOURNAMENT_CATALOG[id].girq).toBe(girq);
    expect(TOURNAMENT_CATALOG[id].turni.slice(0, 10)).toEqual([...turni]);
  });

  it.each([
    [350, 5, 263],
    [190, 5, 143],
    [190, 7, 238],
  ])('10.3 %i punti su tabellone L%i: la metà si arrotonda per eccesso (%i)', (column, level, expected) => {
    expect(calculateOpenPlacementPoints(column, level)).toBe(expected);
  });

  it('10.4 il menu dei tabelloni dovrebbe offrire tutti i livelli da L1 a L10', () => {
    expect(OPEN_BRACKET_SIZE_OPTIONS.map((o) => o.maxLevel).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });
});

describe('12. Verifica con tornei Open', () => {
  it('12.1 dovrebbe avvisare che la regola degli Open è verificata solo su alcuni tabelloni', () => {
    const breakdown = calculateFitetScore(
      createBaseInput({
        tournaments: [{ id: 'a', tournamentId: 'OPEN5', roundReached: 2, groupWins: 0 }],
      })
    );
    const reasons = verifyOfficialScore(5110, 5150, breakdown).possibleReasons.join(' ');
    expect(reasons).toContain('percentuale del tabellone');
  });
});
