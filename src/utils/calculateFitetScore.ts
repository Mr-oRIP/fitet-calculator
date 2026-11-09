import {
  BracketRoundIndex,
  ChampionshipSeriesConfig,
  ChampionshipSeriesId,
  IttfProtectionInput,
  MatchCalculated,
  PlayerScoreInput,
  ScoreBreakdown,
  TournamentConfig,
  TournamentResultCalculated,
  VerificationResult,
} from '@/types/fitet';

/**
 * Helper per costruire il vettore degli 11 turni di tabellone
 */
const t = (...vals: number[]): number[] => {
  const arr = [...vals];
  while (arr.length < 11) arr.push(0);
  return arr.slice(0, 11);
};

/**
 * Percentuali ufficiali FITeT 2026/2027 per i livelli L0 - L10 dei Tornei Open (Tabella 4)
 * Il livello L6 rappresenta il 100% del valore nominale della gara.
 */
export const OPEN_LEVEL_MULTIPLIERS: Record<number, number> = {
  0: 0.05,   // L0: Eliminato al primo livello del tabellone (5%)
  1: 0.15,   // L1: 15%
  2: 0.20,   // L2: 20%
  3: 0.35,   // L3: 35%
  4: 0.50,   // L4: 50%
  5: 0.75,   // L5: 75%
  6: 1.00,   // L6: Tabellone di riferimento 33-64 qualificati (100%)
  7: 1.25,   // L7: 65-128 qualificati (125%)
  8: 1.375,  // L8: 129-256 qualificati (137,5%)
  9: 1.50,   // L9: 257-512 qualificati (150%)
  10: 1.75,  // L10: 513-1024 qualificati (175%)
};

/**
 * Opzioni per la dimensione del tabellone nei Tornei Open (Livello Massimo Lmax)
 */
export const OPEN_BRACKET_SIZE_OPTIONS: { maxLevel: number; label: string }[] = [
  { maxLevel: 6, label: 'L6 — Tabellone 33–64 qualificati (32esimi - 100% Riferimento)' },
  { maxLevel: 7, label: 'L7 — Tabellone 65–128 qualificati (64esimi - 125%)' },
  { maxLevel: 8, label: 'L8 — Tabellone 129–256 qualificati (128esimi - 137,5%)' },
  { maxLevel: 5, label: 'L5 — Tabellone 17–32 qualificati (16esimi - Max 75%)' },
  { maxLevel: 4, label: 'L4 — Tabellone 9–16 qualificati (Ottavi - Max 50%)' },
  { maxLevel: 3, label: 'L3 — Tabellone 5–8 qualificati (Quarti - Max 35%)' },
  { maxLevel: 2, label: 'L2 — Tabellone 3–4 qualificati (Semifinali - Max 20%)' },
  { maxLevel: 1, label: 'L1 — Tabellone fino a 2 qualificati (Finale - Max 15%)' },
];

/**
 * Calcola i punti di piazzamento per un Torneo Open in base a:
 * - nominalValue (es. Open 5 = 160)
 * - roundReached (0 = Vincitore, 1 = Finalista, 2 = SF, 3 = QF, 4 = Ottavi, 5 = 16esimi, 6 = 32esimi...)
 * - maxBracketLevel (L1..L10, default L6 = 6 per tabellone da 33-64 atleti)
 *
 * Logica: In un tabellone di livello massimo L_max (es. L6 = 6 turni totali dai 32esimi),
 * - Il Vincitore (roundReached = 0) ottiene il livello L_max (es. L6 -> 100%).
 * - Il Finalista (roundReached = 1) ha superato L_max - 1 turni -> ottiene L_{max - 1} (es. L5 -> 75%).
 * - Chi esce in Semifinale (roundReached = 2) ottiene L_{max - 2} (es. L4 -> 50%).
 * - ...
 * - Chi esce al primo turno del tabellone (roundReached >= L_max) ottiene L0 (5%).
 */
export function calculateOpenPlacementPoints(
  nominalValue: number,
  roundReached: BracketRoundIndex,
  maxBracketLevel: number = 6
): number {
  if (roundReached < 0) return 0; // Uscito nel girone

  const clampedMaxLevel = Math.max(1, Math.min(10, maxBracketLevel));
  // Se l'utente seleziona un turno più profondo della dimensione del tabellone (o il 1° turno), è L0
  const achievedLevel = Math.max(0, clampedMaxLevel - roundReached);
  const multiplier = OPEN_LEVEL_MULTIPLIERS[achievedLevel] ?? 0;

  return Math.round(nominalValue * multiplier);
}

/**
 * Genera l'array di default (riferito a L6) per un torneo Open dato il suo valore nominale
 */
const openTurniL6 = (nominal: number): number[] =>
  t(
    Math.round(nominal * 1.0),  // 0: Vincitore (L6 - 100%)
    Math.round(nominal * 0.75), // 1: Finalista (L5 - 75%)
    Math.round(nominal * 0.50), // 2: Semifinale (L4 - 50%)
    Math.round(nominal * 0.35), // 3: Quarti (L3 - 35%)
    Math.round(nominal * 0.20), // 4: Ottavi (L2 - 20%)
    Math.round(nominal * 0.15), // 5: 16esimi (L1 - 15%)
    Math.round(nominal * 0.05), // 6: 32esimi / Eliminato 1° livello (L0 - 5%)
    0, 0, 0, 0
  );

/**
 * Etichette leggibili per i turni del tabellone ad eliminazione diretta
 */
export const BRACKET_ROUND_LABELS: { value: BracketRoundIndex; label: string }[] = [
  { value: -1, label: 'Uscito nel Girone (Solo Partecipazione + Vittorie Girone)' },
  { value: 0, label: '1° Classificato (Vincitore)' },
  { value: 1, label: '2° Classificato (Finalista)' },
  { value: 2, label: 'Semifinale (3° - 4° posto)' },
  { value: 3, label: 'Quarti di Finale (5° - 8° posto)' },
  { value: 4, label: 'Ottavi di Finale (9° - 16° posto)' },
  { value: 5, label: 'Sedicesimi di Finale (17° - 32° posto)' },
  { value: 6, label: 'Trentaduesimi di Finale (33° - 64° posto)' },
  { value: 7, label: 'Sessantaquattresimi (65° - 128° posto)' },
  { value: 8, label: 'Centoventottesimi (129° - 256° posto)' },
];

/**
 * Art. 2.1 Regolamento Classifiche: Preset per nuovi tesserati senza storico
 */
export const NEW_PLAYER_PRESETS: { label: string; points: number }[] = [
  { label: 'Nuovo tesserato assoluto (Punti provvisori)', points: 100 },
  { label: 'Serie C/1 Maschile (Senza storico)', points: 7000 },
  { label: 'Serie B/1, B/2 Maschile e B Femminile', points: 8700 },
  { label: 'Serie A/2 Maschile / Femminile', points: 11300 },
  { label: 'Serie A/1 (Oltre pos. 150 ITTF o lista squadra)', points: 12200 },
  { label: 'Serie A/1 (Pos. 101 - 150 ITTF)', points: 12600 },
  { label: 'Serie A/1 (Pos. 51 - 100 ITTF)', points: 13000 },
  { label: 'Serie A/1 (Pos. 1 - 50 ITTF)', points: 13500 },
];

/**
 * Art. 2.3 Regolamento Classifiche: Configurazione Campionati a Squadre (Tabella 1 e Tabella 2)
 */
export const UNEXPECTED_WIN_BONUS_RATE = 0.10; // 10% della differenza punti
export const UNEXPECTED_WIN_MAX_BONUS = 120;   // Massimo 120 punti bonus

export const TEAM_SERIES_CATALOG: Record<ChampionshipSeriesId, ChampionshipSeriesConfig> = {
  // Nazionali Maschili (Valori Ufficiali Tabella 1 FITeT 2026/2027)
  A1_M: { id: 'A1_M', nome: 'Serie A/1 Maschile', settore: 'Maschile', baseWinPoints: 300 },
  A2_M: { id: 'A2_M', nome: 'Serie A/2 Maschile', settore: 'Maschile', baseWinPoints: 170 },
  B1_M: { id: 'B1_M', nome: 'Serie B/1 Maschile', settore: 'Maschile', baseWinPoints: 110 },
  B2_M: { id: 'B2_M', nome: 'Serie B/2 Maschile', settore: 'Maschile', baseWinPoints: 80 },
  C1_M: { id: 'C1_M', nome: 'Serie C/1 Maschile', settore: 'Maschile', baseWinPoints: 60 },
  // Regionali Maschili (Valori Ufficiali Tabella 1 FITeT 2026/2027)
  C2_M: { id: 'C2_M', nome: 'Serie C/2 Regionale M.', settore: 'Maschile', baseWinPoints: 40 },
  D1_M: { id: 'D1_M', nome: 'Serie D/1 Regionale M.', settore: 'Maschile', baseWinPoints: 35 },
  D2_M: { id: 'D2_M', nome: 'Serie D/2 Regionale M.', settore: 'Maschile', baseWinPoints: 30 },
  D3_M: { id: 'D3_M', nome: 'Serie D/3 Regionale M.', settore: 'Maschile', baseWinPoints: 25 },
  D4_M: { id: 'D4_M', nome: 'Serie D/4 Provinciale/Reg. M.', settore: 'Maschile', baseWinPoints: 20 },
  // Femminili
  A1_F: { id: 'A1_F', nome: 'Serie A/1 Femminile', settore: 'Femminile', baseWinPoints: 300 },
  A2_F: { id: 'A2_F', nome: 'Serie A/2 Femminile', settore: 'Femminile', baseWinPoints: 170 },
  B_F:  { id: 'B_F',  nome: 'Serie B Femminile', settore: 'Femminile', baseWinPoints: 110 },
  C_F:  { id: 'C_F',  nome: 'Serie C Regionale F.', settore: 'Femminile', baseWinPoints: 40 },
  D1_F: { id: 'D1_F', nome: 'Serie D/1 Regionale F.', settore: 'Femminile', baseWinPoints: 35 },
  D2_F: { id: 'D2_F', nome: 'Serie D/2 Regionale F.', settore: 'Femminile', baseWinPoints: 30 },
  // Master e Giovanili
  MASTER_A1: { id: 'MASTER_A1', nome: 'Serie A/1 Master', settore: 'Master', baseWinPoints: 40 },
  MASTER_A2: { id: 'MASTER_A2', nome: 'Serie A/2 Master', settore: 'Master', baseWinPoints: 35 },
  MASTER_B:  { id: 'MASTER_B',  nome: 'Serie B Master', settore: 'Master', baseWinPoints: 30 },
  MASTER_C:  { id: 'MASTER_C',  nome: 'Serie C Regionale Master', settore: 'Master', baseWinPoints: 20 },
  GIOVANILI: { id: 'GIOVANILI', nome: 'Campionato a Squadre Giovanile', settore: 'Giovanile', baseWinPoints: 20 },
};

/**
 * Art. 2.4 & 2.5 Regolamento Classifiche: Catalogo Tornei Individuali (Tabella 3 & Tabella 4)
 */
export const TOURNAMENT_CATALOG: Record<string, TournamentConfig> = {
  // Tornei Nazionali Top
  TOP_1: { nome: 'Torneo Nazionale Top 1', id: 'TOP_1', validi: 1, girq: 15, ptsVit: 20, open: false, maxVit: 3, turni: t(500, 400, 320, 256, 205, 164, 0, 0, 0, 0, 0) },
  TOP_2: { nome: 'Torneo Nazionale Top 2', id: 'TOP_2', validi: 1, girq: 12, ptsVit: 20, open: false, maxVit: 3, turni: t(420, 336, 269, 215, 172, 138, 110, 88, 0, 0, 0) },
  TOP_3: { nome: 'Torneo Nazionale Top 3', id: 'TOP_3', validi: 1, girq: 10, ptsVit: 20, open: false, maxVit: 3, turni: t(360, 288, 230, 184, 147, 118, 94, 75, 60, 0, 0) },
  TOP_4: { nome: 'Torneo Nazionale Top 4', id: 'TOP_4', validi: 1, girq: 8, ptsVit: 20, open: false, maxVit: 3, turni: t(320, 256, 205, 164, 131, 105, 84, 67, 54, 43, 0) },
  TOP_5: { nome: 'Torneo Nazionale Top 5', id: 'TOP_5', validi: 1, girq: 6, ptsVit: 20, open: false, maxVit: 3, turni: t(280, 224, 179, 143, 115, 92, 73, 59, 47, 38, 0) },
  TOP_6M: { nome: 'Torneo Top 6 M', id: 'TOP_6M', validi: 1, girq: 5, ptsVit: 20, open: false, maxVit: 3, turni: t(250, 200, 160, 128, 102, 82, 66, 52, 42, 34, 0) },

  // Campionati Italiani di Categoria (Aggiornati con valori guida 2026/2027)
  CI_ASS: { nome: 'Campionati Italiani Assoluti (1ª-2ª)', id: 'CI_ASS', validi: 1, girq: 30, ptsVit: 20, open: false, maxVit: 3, turni: t(900, 720, 576, 461, 369, 295, 236, 0, 0, 0, 0) },
  CI_2: { nome: 'Campionati Italiani 2ª Cat.', id: 'CI_2', validi: 1, girq: 25, ptsVit: 20, open: false, maxVit: 3, turni: t(750, 600, 480, 384, 307, 246, 197, 157, 0, 0, 0) },
  CI_3: { nome: 'Campionati Italiani 3ª Cat.', id: 'CI_3', validi: 1, girq: 22, ptsVit: 20, open: false, maxVit: 3, turni: t(650, 520, 416, 333, 266, 213, 170, 136, 109, 0, 0) },
  CI_4: { nome: 'Campionati Italiani 4ª Cat.', id: 'CI_4', validi: 1, girq: 18, ptsVit: 20, open: false, maxVit: 3, turni: t(550, 440, 352, 282, 225, 180, 144, 115, 92, 74, 0) },
  CI_5: { nome: 'Campionati Italiani 5ª Cat.', id: 'CI_5', validi: 1, girq: 15, ptsVit: 20, open: false, maxVit: 3, turni: t(450, 360, 288, 230, 184, 147, 118, 94, 75, 60, 0) },
  CI_6: { nome: 'Campionati Italiani 6ª Cat.', id: 'CI_6', validi: 1, girq: 12, ptsVit: 20, open: false, maxVit: 3, turni: t(380, 304, 243, 195, 156, 125, 100, 80, 64, 51, 0) },

  // Tornei Open (validi: 6, ptsVit: 15, calcolo dinamico L0-L10 su nominalValue)
  OPEN1: { nome: 'Torneo Open 1 (Fascia 1–500)', id: 'OPEN1', validi: 6, girq: 20, ptsVit: 15, open: true, nominalValue: 350, maxVit: 4, turni: openTurniL6(350) },
  OPEN2: { nome: 'Torneo Open 2 (Fascia 121–1500)', id: 'OPEN2', validi: 6, girq: 16, ptsVit: 15, open: true, nominalValue: 300, maxVit: 4, turni: openTurniL6(300) },
  OPEN3: { nome: 'Torneo Open 3 (Fascia 451–2500)', id: 'OPEN3', validi: 6, girq: 13, ptsVit: 15, open: true, nominalValue: 240, maxVit: 4, turni: openTurniL6(240) },
  OPEN4: { nome: 'Torneo Open 4 (Fascia 1201–4000)', id: 'OPEN4', validi: 6, girq: 10, ptsVit: 15, open: true, nominalValue: 190, maxVit: 4, turni: openTurniL6(190) },
  OPEN5: { nome: 'Torneo Open 5 (Fascia 2001–6000)', id: 'OPEN5', validi: 6, girq: 8, ptsVit: 15, open: true, nominalValue: 160, maxVit: 4, turni: openTurniL6(160) },
  OPEN6: { nome: 'Torneo Open 6 (Da pos. 3801)', id: 'OPEN6', validi: 6, girq: 6, ptsVit: 15, open: true, nominalValue: 140, maxVit: 4, turni: openTurniL6(140) },
  OPEN7: { nome: 'Torneo Open 7 (Da pos. 5001)', id: 'OPEN7', validi: 6, girq: 5, ptsVit: 15, open: true, nominalValue: 120, maxVit: 4, turni: openTurniL6(120) },
  OPEN8: { nome: 'Torneo Open 8 (Da pos. 6201)', id: 'OPEN8', validi: 6, girq: 4, ptsVit: 15, open: true, nominalValue: 100, maxVit: 4, turni: openTurniL6(100) },

  // Campionati Regionali (validi: 1, ptsVit: 10)
  CR_ASS: { nome: 'Campionati Regionali Assoluti (1ª-2ª)', id: 'CR_ASS', validi: 1, girq: 10, ptsVit: 10, open: false, maxVit: 3, turni: t(250, 200, 160, 128, 102, 82, 66, 0, 0, 0, 0) },
  CR_3: { nome: 'Campionati Regionali 3ª Cat.', id: 'CR_3', validi: 1, girq: 7, ptsVit: 10, open: false, maxVit: 3, turni: t(180, 144, 115, 92, 74, 59, 44, 0, 0, 0, 0) },
  CR_4: { nome: 'Campionati Regionali 4ª Cat.', id: 'CR_4', validi: 1, girq: 5, ptsVit: 10, open: false, maxVit: 4, turni: t(140, 112, 90, 72, 57, 46, 34, 0, 0, 0, 0) },
  CR_5: { nome: 'Campionati Regionali 5ª Cat.', id: 'CR_5', validi: 1, girq: 4, ptsVit: 10, open: false, maxVit: 4, turni: t(100, 80, 64, 51, 41, 33, 25, 0, 0, 0, 0) },
  CR_6: { nome: 'Campionati Regionali 6ª Cat.', id: 'CR_6', validi: 1, girq: 3, ptsVit: 10, open: false, maxVit: 4, turni: t(90, 72, 58, 46, 37, 29, 22, 0, 0, 0, 0) },
  CR_G_U21: { nome: 'Campionati Regionali giovanili - U21', id: 'CR_G_U21', validi: 1, girq: 4, ptsVit: 10, open: false, maxVit: 3, turni: t(120, 96, 77, 61, 49, 39, 29, 0, 0, 0, 0) },
  CR_G_U19: { nome: 'Campionati Regionali giovanili - U19', id: 'CR_G_U19', validi: 1, girq: 4, ptsVit: 10, open: false, maxVit: 3, turni: t(105, 84, 67, 54, 43, 34, 26, 0, 0, 0, 0) },
  CR_G_U17: { nome: 'Campionati Regionali giovanili - U17', id: 'CR_G_U17', validi: 1, girq: 3, ptsVit: 10, open: false, maxVit: 3, turni: t(90, 72, 58, 46, 37, 29, 22, 0, 0, 0, 0) },
  CR_G_U15: { nome: 'Campionati Regionali giovanili - U15', id: 'CR_G_U15', validi: 1, girq: 3, ptsVit: 10, open: false, maxVit: 3, turni: t(80, 64, 51, 41, 33, 26, 20, 0, 0, 0, 0) },
  CR_G_U13: { nome: 'Campionati Regionali giovanili - U13', id: 'CR_G_U13', validi: 1, girq: 2, ptsVit: 10, open: false, maxVit: 3, turni: t(70, 56, 45, 36, 29, 23, 17, 0, 0, 0, 0) },
  CR_G_U11: { nome: 'Campionati Regionali giovanili - U11', id: 'CR_G_U11', validi: 1, girq: 2, ptsVit: 10, open: false, maxVit: 3, turni: t(60, 48, 38, 31, 25, 20, 15, 0, 0, 0, 0) },
  CR_PARA: { nome: 'Campionati Regionali paralimpici - classi 1-11', id: 'CR_PARA', validi: 1, girq: 2, ptsVit: 10, open: false, maxVit: 3, turni: t(60, 48, 38, 31, 25, 20, 15, 0, 0, 0, 0) },
  CR_PARA_G: { nome: 'Campionati Regionali paralimpici - giov/esord.', id: 'CR_PARA_G', validi: 1, girq: 1, ptsVit: 10, open: false, maxVit: 3, turni: t(27, 21, 17, 14, 11, 9, 7, 0, 0, 0, 0) },
  CR_MASTER: { nome: 'Campionati Regionali Master', id: 'CR_MASTER', validi: 1, girq: 3, ptsVit: 10, open: false, maxVit: 3, turni: t(90, 72, 58, 46, 37, 29, 22, 0, 0, 0, 0) },

  // Tornei Regionali Predeterminati (validi: 3)
  TRP_ASS: { nome: 'Torneo Reg. Predeterminato Assoluto (1ª-2ª)', id: 'TRP_ASS', validi: 3, girq: 8, ptsVit: 10, open: false, maxVit: 3, turni: t(125, 100, 80, 64, 51, 41, 33, 26, 0, 0, 0) },
  TRP_3: { nome: 'Torneo Reg. Predeterminato 3ª Cat.', id: 'TRP_3', validi: 3, girq: 6, ptsVit: 10, open: false, maxVit: 3, turni: t(90, 72, 58, 46, 37, 29, 24, 19, 0, 0, 0) },
  TRP_4: { nome: 'Torneo Reg. Predeterminato 4ª Cat.', id: 'TRP_4', validi: 3, girq: 4, ptsVit: 10, open: false, maxVit: 4, turni: t(70, 56, 45, 36, 29, 23, 18, 15, 0, 0, 0) },
  TRP_5: { nome: 'Torneo Reg. Predeterminato 5ª Cat.', id: 'TRP_5', validi: 3, girq: 3, ptsVit: 10, open: false, maxVit: 4, turni: t(50, 40, 32, 26, 20, 16, 13, 10, 0, 0, 0) },
  TRP_6: { nome: 'Torneo Reg. Predeterminato 6ª Cat.', id: 'TRP_6', validi: 3, girq: 2, ptsVit: 10, open: false, maxVit: 4, turni: t(45, 36, 29, 23, 18, 15, 12, 9, 0, 0, 0) },
  TRP_G_U21: { nome: 'Torneo Reg. Predeterminato Giov. - U21 / Fascia 1', id: 'TRP_G_U21', validi: 3, girq: 3, ptsVit: 10, open: false, maxVit: 3, turni: t(75, 60, 48, 38, 31, 25, 20, 16, 0, 0, 0) },
  TRP_G_U19: { nome: 'Torneo Reg. Predeterminato Giov. - U19 / Fascia 2', id: 'TRP_G_U19', validi: 3, girq: 3, ptsVit: 10, open: false, maxVit: 3, turni: t(66, 53, 42, 34, 27, 22, 17, 14, 0, 0, 0) },
  TRP_G_U17: { nome: 'Torneo Reg. Predeterminato Giov. - U17 / Fascia 3', id: 'TRP_G_U17', validi: 3, girq: 2, ptsVit: 10, open: false, maxVit: 3, turni: t(56, 45, 36, 29, 23, 18, 15, 12, 0, 0, 0) },
  TRP_G_U15: { nome: 'Torneo Reg. Predeterminato Giov. - U15 / Fascia 4', id: 'TRP_G_U15', validi: 3, girq: 2, ptsVit: 10, open: false, maxVit: 3, turni: t(50, 40, 32, 26, 20, 16, 13, 10, 0, 0, 0) },
  TRP_G_U13: { nome: 'Torneo Reg. Predeterminato Giov. - U13 / Fascia 5', id: 'TRP_G_U13', validi: 3, girq: 1, ptsVit: 10, open: false, maxVit: 3, turni: t(44, 35, 28, 22, 18, 14, 11, 9, 0, 0, 0) },
  TRP_G_U11: { nome: 'Torneo Reg. Predeterminato Giov. - U11 / Fascia 6', id: 'TRP_G_U11', validi: 3, girq: 1, ptsVit: 10, open: false, maxVit: 3, turni: t(38, 30, 24, 19, 15, 12, 10, 8, 0, 0, 0) },
  TRP_PARA: { nome: 'Torneo Reg. Paralimpico - classi 1-11', id: 'TRP_PARA', validi: 3, girq: 2, ptsVit: 10, open: false, maxVit: 3, turni: t(45, 36, 29, 23, 18, 15, 12, 0, 0, 0, 0) },

  // Tornei Regionali Ordinari e Campionati Provinciali (Guida 2026/2027)
  TRO_4: { nome: 'Torneo Regionale Ordinario 4ª Cat.', id: 'TRO_4', validi: 3, girq: 4, ptsVit: 10, open: false, maxVit: 4, turni: t(35, 28, 22, 18, 14, 11, 9, 0, 0, 0, 0) },
  TRO_5: { nome: 'Torneo Regionale Ordinario 5ª Cat.', id: 'TRO_5', validi: 3, girq: 3, ptsVit: 10, open: false, maxVit: 4, turni: t(25, 20, 16, 13, 10, 8, 6, 0, 0, 0, 0) },
  TRO_6: { nome: 'Torneo Regionale Ordinario 6ª Cat.', id: 'TRO_6', validi: 3, girq: 2, ptsVit: 10, open: false, maxVit: 4, turni: t(22, 18, 14, 11, 9, 7, 5, 0, 0, 0, 0) },
  CP_5: { nome: 'Campionati Provinciali 5ª Cat.', id: 'CP_5', validi: 1, girq: 1, ptsVit: 10, open: false, maxVit: 4, turni: t(10, 8, 6, 5, 4, 3, 0, 0, 0, 0, 0) },
  CP_6: { nome: 'Campionati Provinciali 6ª Cat.', id: 'CP_6', validi: 1, girq: 1, ptsVit: 10, open: false, maxVit: 4, turni: t(9, 7, 5, 4, 3, 2, 0, 0, 0, 0, 0) },

  COPPA_REG_GIOV: { nome: 'Coppa delle Regioni giovanile', id: 'COPPA_REG_GIOV', validi: 1, girq: 2, ptsVit: 10, open: false, maxVit: 3, turni: t(80, 64, 51, 41, 33, 26, 21, 0, 0, 0, 0) },
};

/**
 * Art. 2.6 Regolamento Classifiche: Calcolo Protezione Classifica ITTF (Posizioni 1 - 300)
 */
export function calculateIttfProtectionPoints(input: IttfProtectionInput): number {
  if (!input.enabled || input.ittfRank <= 0 || input.ittfRank > 300) {
    return 0;
  }

  let rankBonus = 0;
  if (input.ittfRank <= 25) rankBonus = 1000;
  else if (input.ittfRank <= 50) rankBonus = 900;
  else if (input.ittfRank <= 75) rankBonus = 700;
  else if (input.ittfRank <= 100) rankBonus = 500;
  else if (input.ittfRank <= 150) rankBonus = 350;
  else if (input.ittfRank <= 200) rankBonus = 240;
  else if (input.ittfRank <= 300) rankBonus = 160;

  return Math.max(0, input.ittfSeniorPoints) + rankBonus;
}

/**
 * Art. 2.4 Regolamento Classifiche: Correzione a blocchi per tornei con piazzamento completo (es. Top / Giovanili)
 */
export function applyBlockSmoothingForExactPosition(
  position: number,
  interpolatedScoresByPos: Record<number, number>
): number {
  const raw = interpolatedScoresByPos[position] ?? 0;
  if (position < 5) return raw;

  const offset = position - 5;
  const indexInBlock = offset % 4;
  const blockStartPos = position - indexInBlock;

  if (indexInBlock === 1 || indexInBlock === 2) {
    const posA = blockStartPos + 1;
    const posB = blockStartPos + 2;
    const scoreA = interpolatedScoresByPos[posA] ?? raw;
    const scoreB = interpolatedScoresByPos[posB] ?? raw;
    return Math.round((scoreA + scoreB) / 2);
  }

  return raw;
}

/**
 * Art. 2.3 Regolamento Classifiche: Calcolo singola vittoria in Campionato a Squadre
 */
export function calculateSingleMatchScore(
  seriesId: ChampionshipSeriesId,
  myCurrentPoints: number,
  opponentPoints: number,
  isWalkoverOrUnplayed: boolean,
  isDifferentGender: boolean
): { basePoints: number; unexpectedBonus: number; totalPoints: number } {
  if (isWalkoverOrUnplayed || isDifferentGender) {
    return { basePoints: 0, unexpectedBonus: 0, totalPoints: 0 };
  }

  const series = TEAM_SERIES_CATALOG[seriesId];
  const basePoints = series ? series.baseWinPoints : 0;

  let unexpectedBonus = 0;
  if (opponentPoints > myCurrentPoints) {
    const diff = opponentPoints - myCurrentPoints;
    unexpectedBonus = Math.min(
      UNEXPECTED_WIN_MAX_BONUS,
      Math.round(diff * UNEXPECTED_WIN_BONUS_RATE)
    );
  }

  return {
    basePoints,
    unexpectedBonus,
    totalPoints: basePoints + unexpectedBonus,
  };
}

/**
 * Calcolo complessivo della classifica FITeT (Art. 2.2)
 */
export function calculateFitetScore(input: PlayerScoreInput): ScoreBreakdown {
  // 1. Calcolo Partite Campionati a Squadre (Art. 2.3)
  const calculatedMatches: MatchCalculated[] = input.matches.map((m) => {
    const seriesName = TEAM_SERIES_CATALOG[m.seriesId]?.nome ?? m.seriesId;
    const { basePoints, unexpectedBonus, totalPoints } = calculateSingleMatchScore(
      m.seriesId,
      m.myCurrentPoints,
      m.opponentPoints,
      m.isWalkoverOrUnplayed,
      m.isDifferentGender
    );

    return {
      ...m,
      seriesName,
      basePoints,
      unexpectedBonus,
      totalPoints,
    };
  });

  const teamMatchesPoints = calculatedMatches.reduce((acc, m) => acc + m.totalPoints, 0);

  // 2. Pre-calcolo Tornei Individuali (Art. 2.4 & Art. 2.5)
  const prelimTournaments: TournamentResultCalculated[] = input.tournaments.map((tr) => {
    const config = TOURNAMENT_CATALOG[tr.tournamentId];
    if (!config || tr.isConsolation) {
      return {
        ...tr,
        tournamentName: config?.nome ?? tr.tournamentId,
        participationPoints: 0,
        placementPoints: 0,
        groupWinPoints: 0,
        rawPlacementAndParticipation: 0,
        isCountedInValidLimit: false,
        effectiveTotalPoints: 0,
      };
    }

    const cappedWins = Math.max(0, Math.min(tr.groupWins, config.maxVit));
    const groupWinPoints = cappedWins * config.ptsVit;

    // Punti di partecipazione al girone
    const participationPoints = config.girq;

    // Punti di piazzamento nel tabellone ad eliminazione diretta
    let placementPoints = 0;
    if (tr.roundReached >= 0) {
      if (config.open && config.nominalValue) {
        // Calcolo ufficiale Tabella 4 Open (L0 - L10, default L6 = 6)
        const maxLevel = tr.bracketDepthLevels ?? 6;
        placementPoints = calculateOpenPlacementPoints(
          config.nominalValue,
          tr.roundReached,
          maxLevel
        );
      } else {
        placementPoints = config.turni[tr.roundReached] ?? 0;
      }
    }

    const rawPlacementAndParticipation = participationPoints + placementPoints;

    return {
      ...tr,
      tournamentName: config.nome,
      participationPoints,
      placementPoints,
      groupWinPoints,
      rawPlacementAndParticipation,
      isCountedInValidLimit: true,
      effectiveTotalPoints: rawPlacementAndParticipation + groupWinPoints,
    };
  });

  // 3. Applicazione del limite di tornei 'validi' per tipologia (Art. 2.4)
  const groupedByType: Record<string, TournamentResultCalculated[]> = {};
  for (const item of prelimTournaments) {
    if (!groupedByType[item.tournamentId]) {
      groupedByType[item.tournamentId] = [];
    }
    groupedByType[item.tournamentId].push(item);
  }

  const validPlacementIds = new Set<string>();
  for (const [tournamentId, list] of Object.entries(groupedByType)) {
    const maxValid = TOURNAMENT_CATALOG[tournamentId]?.validi ?? 1;
    const sorted = [...list].sort(
      (a, b) => b.rawPlacementAndParticipation - a.rawPlacementAndParticipation
    );
    sorted.slice(0, maxValid).forEach((item) => validPlacementIds.add(item.id));
  }

  const calculatedTournaments: TournamentResultCalculated[] = prelimTournaments.map((item) => {
    const isCounted = validPlacementIds.has(item.id) && !item.isConsolation;
    const effectivePlacement = isCounted ? item.rawPlacementAndParticipation : 0;
    return {
      ...item,
      isCountedInValidLimit: isCounted,
      effectiveTotalPoints: effectivePlacement + item.groupWinPoints,
    };
  });

  const tournamentParticipationAndPlacementPoints = calculatedTournaments.reduce(
    (acc, tr) => acc + (tr.isCountedInValidLimit ? tr.rawPlacementAndParticipation : 0),
    0
  );

  const tournamentGroupWinPoints = calculatedTournaments.reduce(
    (acc, tr) => acc + tr.groupWinPoints,
    0
  );

  const totalTournamentPoints =
    tournamentParticipationAndPlacementPoints + tournamentGroupWinPoints;

  // 4. Protezione Classifica ITTF (Art. 2.6)
  const ittfProtectionPoints = calculateIttfProtectionPoints(input.ittfProtection);

  // 5. Somma Finale (Art. 2.2)
  const projectedFinalPoints =
    input.initialPoints +
    teamMatchesPoints +
    totalTournamentPoints +
    ittfProtectionPoints;

  const netVariation = projectedFinalPoints - input.initialPoints;

  // 6. Proiezione Fuori Quadro di fine stagione (Art. 2.7: decurtazione 5% se 0 attività)
  const hasPlayedAnyActivity =
    input.matches.some((m) => !m.isWalkoverOrUnplayed) || input.tournaments.length > 0;
  const fuoriQuadroEndSeasonProjection = hasPlayedAnyActivity
    ? projectedFinalPoints
    : Math.round(input.initialPoints * 0.95);

  return {
    initialPoints: input.initialPoints,
    teamMatchesPoints,
    tournamentParticipationAndPlacementPoints,
    tournamentGroupWinPoints,
    totalTournamentPoints,
    ittfProtectionPoints,
    projectedFinalPoints,
    netVariation,
    fuoriQuadroEndSeasonProjection,
    estimatedCategory: estimatePlayerCategory(projectedFinalPoints, input.gender, input.isFuoriQuadro),
    calculatedMatches,
    calculatedTournaments,
  };
}

/**
 * Stima indicativa della Categoria in base alle soglie punti e all'Art. 1.5 / Art. 2.7
 */
export function estimatePlayerCategory(
  points: number,
  gender: 'M' | 'F',
  isFuoriQuadro: boolean
): string {
  if (isFuoriQuadro && points <= 2500) {
    return gender === 'M' ? '6ª Categoria (F.Q. ≤ 2500 pt)' : '5ª Categoria (F.Q. ≤ 2500 pt)';
  }

  if (gender === 'M') {
    if (points >= 12200) return '1ª / 2ª Categoria Alta';
    if (points >= 10000) return '2ª Categoria';
    if (points >= 8200) return '3ª Categoria';
    if (points >= 5500) return '4ª Categoria';
    if (points >= 2800) return '5ª Categoria';
    return '6ª Categoria';
  } else {
    if (points >= 11500) return '1ª Categoria';
    if (points >= 9200) return '2ª Categoria';
    if (points >= 7000) return '3ª Categoria';
    if (points >= 4500) return '4ª Categoria';
    return '5ª Categoria';
  }
}

/**
 * Modalità "Verifica" Fine Mese: Analisi discrepanza tra Punteggio Ufficiale e Proiettato
 */
export function verifyOfficialScore(
  projectedPoints: number,
  officialPoints: number,
  breakdown: ScoreBreakdown
): VerificationResult {
  const discrepancy = officialPoints - projectedPoints;
  const absDiff = Math.abs(discrepancy);

  let status: VerificationResult['status'] = 'EXACT';
  if (absDiff > 0 && absDiff <= 25) status = 'MINOR_DIFF';
  else if (absDiff > 25) status = 'SIGNIFICANT_DIFF';

  const possibleReasons: string[] = [];

  if (absDiff === 0) {
    possibleReasons.push(
      'Il calcolo proiettato coincide al 100% con la classifica ufficiale emessa dalla FITeT.'
    );
  } else {
    if (discrepancy < 0) {
      possibleReasons.push(
        'Art. 1.2 & 2.2: Uno o più referti di campionato o tornei potrebbero essere stati caricati nel portale risultati dopo il giorno antecedente la data di emissione (verranno conteggiati nella prossima emissione).'
      );
      possibleReasons.push(
        'Art. 2.4 (Declassamento fascia Torneo Open/Regionale): Nei tornei Open servono almeno 16 partecipanti italiani in fascia (o 8 della categoria nei tornei regionali). Se non raggiunti, la gara assegna i punti della fascia inferiore.'
      );
      possibleReasons.push(
        'Art. 2.4 (Livello Tabellone Open L0-L10): Verifica il numero di qualificati al tabellone principale (riferimento 100% = L6 con 33-64 qualificati).'
      );
    } else {
      possibleReasons.push(
        'Art. 2.4 (Bye nel tabellone Open): Il bye al primo turno viene considerato come turno superato e può alzare di un gradino il livello L raggiunto (es. da L0 a L1).'
      );
      possibleReasons.push(
        'Art. 2.3: Il punteggio di un avversario battuto in campionato era superiore a quello stimato nella classifica antecedente la partita, generando un bonus vittoria inattesa maggiore.'
      );
    }

    if (breakdown.calculatedTournaments.length > 1) {
      possibleReasons.push(
        'Art. 2.4: Se hai disputato più gare nello stesso torneo, ricorda che il sistema federale conteggia esclusivamente il singolo miglior piazzamento ottenuto nella manifestazione.'
      );
    }
  }

  return {
    projectedPoints,
    officialPoints,
    discrepancy,
    status,
    possibleReasons,
  };
}