import { describe, it, expect } from 'vitest';
import { calculateFitetScore } from '@/utils/calculateFitetScore';
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
    it('3.1 inserendo 4 tornei TRP_4 (validi: 3), deve prendere i 3 migliori piazzamenti e mantenere i punti girone di tutti e 4', () => {
      const tournaments: TournamentResult[] = [
        {
          id: 'trp4-peggiore-uscito-girone',
          tournamentId: 'TRP_4',
          roundReached: -1, // Part: 4 + Piazz: 0 = 4 pt (Scartato dai 3 validi)
          groupWins: 2,     // 2 * 10 = 20 pt (Mantenuto)
        },
        {
          id: 'trp4-quarti',
          tournamentId: 'TRP_4',
          roundReached: 3,  // Part: 4 + Piazz: 36 = 40 pt (Valido #2)
          groupWins: 2,
        },
        {
          id: 'trp4-ottavi',
          tournamentId: 'TRP_4',
          roundReached: 4,  // Part: 4 + Piazz: 29 = 33 pt (Valido #3)
          groupWins: 2,
        },
        {
          id: 'trp4-semifinale',
          tournamentId: 'TRP_4',
          roundReached: 2,  // Part: 4 + Piazz: 45 = 49 pt (Valido #1)
          groupWins: 2,
        },
      ];

      const result = calculateFitetScore(
        createBaseInput({
          initialPoints: 5000,
          tournaments,
        })
      );

      const discardedTournament = result.calculatedTournaments.find(
        (t) => t.id === 'trp4-peggiore-uscito-girone'
      );
      expect(discardedTournament?.isCountedInValidLimit).toBe(false);
      expect(discardedTournament?.effectiveTotalPoints).toBe(20);

      expect(result.tournamentParticipationAndPlacementPoints).toBe(122);
      expect(result.tournamentGroupWinPoints).toBe(80);
      expect(result.totalTournamentPoints).toBe(202);
      expect(result.projectedFinalPoints).toBe(5202);
    });
  });

  /**
   * SUITE 4: TORNEI OPEN E SCALA LIVELLI L0-L10 (Art. 2.4 Tabella 4)
   */
  describe('4. Profondità Tabellone Open (Livelli L0-L10 su Valore Nominale)', () => {
    it('4.1 dovrebbe replicare esattamente l’esempio ufficiale FITeT per Open 5 (8 part + 30 girone + 24 L1 = 62 pt)', () => {
      // Esempio guida FITeT: Open 5 (valore nominale 160, part. 8, girone 15x2 = 30).
      // In un tabellone di riferimento L6 (32esimi), chi supera 1 turno ed esce ai 16esimi (roundReached = 5)
      // raggiunge il livello L1 (6 - 5 = 1 -> 15% di 160 = 24 pt). Totale = 8 + 30 + 24 = 62 pt.
      const open5Example = calculateFitetScore(
        createBaseInput({
          initialPoints: 3000,
          tournaments: [
            {
              id: 'open5-esempio-guida',
              tournamentId: 'OPEN5',
              roundReached: 5, // 16esimi (1 turno superato in tabellone da 64 L6 -> L1)
              groupWins: 2,    // 2 * 15 = 30 pt
              bracketDepthLevels: 6, // L6 (100%)
            },
          ],
        })
      );

      const calc = open5Example.calculatedTournaments[0];
      expect(calc.participationPoints).toBe(8);
      expect(calc.groupWinPoints).toBe(30);
      expect(calc.placementPoints).toBe(24); // L1 = 15% di 160 = 24
      expect(calc.effectiveTotalPoints).toBe(62);
    });

    it('4.2 dovrebbe ridurre i punti a parità di turno raggiunto se il tabellone Open ha un livello massimo inferiore (es. L4 vs L6)', () => {
      // Open 4 (Valore nominale = 190, partecipazione = 10)
      // Caso A: Tabellone L6 (da 64), esce agli Ottavi (roundReached = 4) -> Livello L2 (20% di 190 = 38 pt)
      const open4L6 = calculateFitetScore(
        createBaseInput({
          tournaments: [
            {
              id: 'open4-l6',
              tournamentId: 'OPEN4',
              roundReached: 4,
              groupWins: 0,
              bracketDepthLevels: 6,
            },
          ],
        })
      );

      // Caso B: Tabellone ridotto L4 (da 16, parte dagli Ottavi), esce agli Ottavi (roundReached = 4) -> Livello L0 (5% di 190 = 10 pt)
      const open4L4 = calculateFitetScore(
        createBaseInput({
          tournaments: [
            {
              id: 'open4-l4',
              tournamentId: 'OPEN4',
              roundReached: 4,
              groupWins: 0,
              bracketDepthLevels: 4,
            },
          ],
        })
      );

      expect(open4L6.calculatedTournaments[0].placementPoints).toBe(38);
      expect(open4L4.calculatedTournaments[0].placementPoints).toBe(10);
      expect(open4L4.calculatedTournaments[0].placementPoints).toBeLessThan(
        open4L6.calculatedTournaments[0].placementPoints
      );
    });
  });

  /**
   * SUITE 5: PASSAGGIO E GESTIONE FUORI QUADRO (Art. 1.4 & Art. 2.7)
   */
  describe('5. Fuori Quadro (F.Q.): Decurtazione 5% a fine stagione per inattività', () => {
    it('5.1 dovrebbe decurtare del 5% la proiezione di fine anno se l’atleta ha 0 attività (o solo walkover)', () => {
      const inactiveResult = calculateFitetScore(
        createBaseInput({
          initialPoints: 5000,
          isFuoriQuadro: true,
        })
      );

      expect(inactiveResult.projectedFinalPoints).toBe(5000);
      expect(inactiveResult.fuoriQuadroEndSeasonProjection).toBe(4750);
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