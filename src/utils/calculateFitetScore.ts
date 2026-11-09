import {
  BracketRoundIndex,
  ChampionshipSeriesConfig,
  ChampionshipSeriesId,
  IttfProtectionInput,
  MatchCalculated,
  PlayerScoreInput,
  ScoreBreakdown,
  TournamentConfig,
  TournamentResult,
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
 * Tornei Open: percentuale applicata alle colonne della Tabella 3 in base alla dimensione del
 * tabellone (livello massimo), in millesimi per evitare errori di virgola mobile.
 * L'Allegato Tecnico descrive un altro calcolo (livello raggiunto da ogni atleta), ma i risultati
 * ufficiali 2026/27 coincidono con questa regola: Open 5 e Open 6 su L6, Open 1 su L5.
 * Verificata solo su L5 e L6: gli altri livelli usano le percentuali dell'Allegato.
 */
export const OPEN_BRACKET_PER_MILLE: Record<number, number> = {
  1: 150,   // L1: fino a 2 qualificati (15%)
  2: 200,   // L2: 3-4 qualificati (20%)
  3: 350,   // L3: 5-8 qualificati (35%)
  4: 500,   // L4: 9-16 qualificati (50%)
  5: 750,   // L5: 17-32 qualificati (75%)
  6: 1000,  // L6: 33-64 qualificati (100%, tabellone di riferimento)
  7: 1250,  // L7: 65-128 qualificati (125%)
  8: 1375,  // L8: 129-256 qualificati (137,5%)
  9: 1500,  // L9: 257-512 qualificati (150%)
  10: 1750, // L10: 513-1024 qualificati (175%)
};

/**
 * Opzioni per la dimensione del tabellone nei Tornei Open (Livello Massimo Lmax)
 */
export const OPEN_BRACKET_SIZE_OPTIONS: { maxLevel: number; label: string }[] = [
  { maxLevel: 6, label: 'L6 — Tabellone 33–64 qualificati (32esimi - 100% Riferimento)' },
  { maxLevel: 7, label: 'L7 — Tabellone 65–128 qualificati (64esimi - 125%)' },
  { maxLevel: 8, label: 'L8 — Tabellone 129–256 qualificati (128esimi - 137,5%)' },
  { maxLevel: 9, label: 'L9 — Tabellone 257–512 qualificati (256esimi - 150%)' },
  { maxLevel: 10, label: 'L10 — Tabellone 513–1024 qualificati (512esimi - 175%)' },
  { maxLevel: 5, label: 'L5 — Tabellone 17–32 qualificati (16esimi - 75%)' },
  { maxLevel: 4, label: 'L4 — Tabellone 9–16 qualificati (Ottavi - 50%)' },
  { maxLevel: 3, label: 'L3 — Tabellone 5–8 qualificati (Quarti - 35%)' },
  { maxLevel: 2, label: 'L2 — Tabellone 3–4 qualificati (Semifinali - 20%)' },
  { maxLevel: 1, label: 'L1 — Tabellone fino a 2 qualificati (Finale - 15%)' },
];

/**
 * Punti di piazzamento di un Torneo Open: colonna della Tabella 3 per il turno raggiunto,
 * moltiplicata per la percentuale del tabellone. La metà si arrotonda per eccesso (262,5 -> 263).
 */
export function calculateOpenPlacementPoints(
  columnPoints: number,
  maxBracketLevel: number = 6
): number {
  const level = Math.max(1, Math.min(10, Math.trunc(maxBracketLevel)));
  return Math.round((columnPoints * OPEN_BRACKET_PER_MILLE[level]) / 1000);
}

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
  { value: 9, label: 'Duecentocinquantaseiesimi (257° - 512° posto)' },
  { value: 10, label: 'Cinquecentododicesimi (513° - 1024° posto)' },
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
  // Maschili
  A1_M: { id: 'A1_M', nome: 'Serie A/1 Maschile', settore: 'Maschile', baseWinPoints: 300 },
  A2_M: { id: 'A2_M', nome: 'Serie A/2 Maschile', settore: 'Maschile', baseWinPoints: 170 },
  B1_M: { id: 'B1_M', nome: 'Serie B/1 Maschile', settore: 'Maschile', baseWinPoints: 110 },
  B2_M: { id: 'B2_M', nome: 'Serie B/2 Maschile', settore: 'Maschile', baseWinPoints: 80 },
  C1_M: { id: 'C1_M', nome: 'Serie C/1 Maschile', settore: 'Maschile', baseWinPoints: 60 },
  C2_M: { id: 'C2_M', nome: 'Serie C/2 Regionale M.', settore: 'Maschile', baseWinPoints: 40 },
  D1_M: { id: 'D1_M', nome: 'Serie D/1 Regionale M.', settore: 'Maschile', baseWinPoints: 35 },
  D2_M: { id: 'D2_M', nome: 'Serie D/2 Regionale M.', settore: 'Maschile', baseWinPoints: 30 },
  D3_M: { id: 'D3_M', nome: 'Serie D/3 Regionale M.', settore: 'Maschile', baseWinPoints: 25 },
  D4_M: { id: 'D4_M', nome: 'Serie D/4 Regionale M.', settore: 'Maschile', baseWinPoints: 20 },
  // Femminili
  A1_F: { id: 'A1_F', nome: 'Serie A/1 Femminile', settore: 'Femminile', baseWinPoints: 280 },
  A2_F: { id: 'A2_F', nome: 'Serie A/2 Femminile', settore: 'Femminile', baseWinPoints: 140 },
  B_F: { id: 'B_F', nome: 'Serie B Femminile', settore: 'Femminile', baseWinPoints: 75 },
  C_F_N: { id: 'C_F_N', nome: 'Serie C Nazionale F.', settore: 'Femminile', baseWinPoints: 40 },
  C_F: { id: 'C_F', nome: 'Serie C Regionale F.', settore: 'Femminile', baseWinPoints: 25 },
  D1_F: { id: 'D1_F', nome: 'Serie D/1 Regionale F.', settore: 'Femminile', baseWinPoints: 14 },
  D2_F: { id: 'D2_F', nome: 'Serie D/2 Regionale F.', settore: 'Femminile', baseWinPoints: 10 },
  // Master
  MASTER_A1: { id: 'MASTER_A1', nome: 'Master A/1 Maschile', settore: 'Master', baseWinPoints: 70 },
  MASTER_A2: { id: 'MASTER_A2', nome: 'Master A/2 Maschile', settore: 'Master', baseWinPoints: 50 },
  MASTER_B: { id: 'MASTER_B', nome: 'Master B Maschile', settore: 'Master', baseWinPoints: 25 },
  MASTER_C_N: { id: 'MASTER_C_N', nome: 'Master C Nazionale M.', settore: 'Master', baseWinPoints: 14 },
  MASTER_C: { id: 'MASTER_C', nome: 'Master C Regionale M.', settore: 'Master', baseWinPoints: 10 },
  MASTER_A1_F: { id: 'MASTER_A1_F', nome: 'Master A/1 Femminile', settore: 'Master', baseWinPoints: 50 },
  MASTER_C_F: { id: 'MASTER_C_F', nome: 'Master C Regionale F.', settore: 'Master', baseWinPoints: 20 },
  // Paralimpici
  PARA_A1: { id: 'PARA_A1', nome: 'Paralimpici A/1', settore: 'Paralimpici', baseWinPoints: 20 },
  PARA_A2: { id: 'PARA_A2', nome: 'Paralimpici A/2', settore: 'Paralimpici', baseWinPoints: 10 },
  PARA_R: { id: 'PARA_R', nome: 'Paralimpici Regionale', settore: 'Paralimpici', baseWinPoints: 8 },
  // Giovanili
  CI_GIOV: { id: 'CI_GIOV', nome: 'Campionati Italiani Giovanili a Squadre', settore: 'Giovanile', baseWinPoints: 40 },
  COPPA_REGIONI: { id: 'COPPA_REGIONI', nome: 'Coppa delle Regioni', settore: 'Giovanile', baseWinPoints: 20 },
  GIOVANILI: { id: 'GIOVANILI', nome: 'Campionato Regionale Giovanile', settore: 'Giovanile', baseWinPoints: 15 },
  // Coppe e altre gare
  SUPERCOPPA: { id: 'SUPERCOPPA', nome: 'Supercoppa', settore: 'Altro', baseWinPoints: 100 },
  COPPA_ITALIA: { id: 'COPPA_ITALIA', nome: 'Coppa Italia', settore: 'Altro', baseWinPoints: 90 },
  COPPA_ITALIA_CCRR: { id: 'COPPA_ITALIA_CCRR', nome: 'Coppa Italia CC.RR.', settore: 'Altro', baseWinPoints: 15 },
  COPPA_REG: { id: 'COPPA_REG', nome: 'Coppa Regionale', settore: 'Altro', baseWinPoints: 10 },
  PROMOZIONALE: { id: 'PROMOZIONALE', nome: 'Promozionale', settore: 'Altro', baseWinPoints: 0 },
};

/**
 * Tabella 3, colonna 'validi': la cella è unita su più righe, quindi il limite è condiviso
 * da tutte le gare dello stesso gruppo (es. 6 Open in totale, non 6 per fascia).
 */
const V = {
  CI_CAT: { gruppoValidi: 'CI_CAT', validi: 1 },
  CI_GIOV: { gruppoValidi: 'CI_GIOV', validi: 1 },
  CI_PARA: { gruppoValidi: 'CI_PARA', validi: 1 },
  CI_MASTER: { gruppoValidi: 'CI_MASTER', validi: 1 },
  TN_GIOV: { gruppoValidi: 'TN_GIOV', validi: 3 },
  TN_PARA: { gruppoValidi: 'TN_PARA', validi: 2 },
  TN_MASTER: { gruppoValidi: 'TN_MASTER', validi: 2 },
  TOP: { gruppoValidi: 'TOP', validi: 2 },
  COPPA_REG: { gruppoValidi: 'COPPA_REG', validi: 1 },
  OPEN: { gruppoValidi: 'OPEN', validi: 6 },
  CR_CAT: { gruppoValidi: 'CR_CAT', validi: 1 },
  CR_GIOV: { gruppoValidi: 'CR_GIOV', validi: 1 },
  CR_PARA: { gruppoValidi: 'CR_PARA', validi: 1 },
  CR_MASTER: { gruppoValidi: 'CR_MASTER', validi: 1 },
  TRP_CAT: { gruppoValidi: 'TRP_CAT', validi: 2 },
  TRP_GIOV: { gruppoValidi: 'TRP_GIOV', validi: 3 },
  TR_PARA: { gruppoValidi: 'TR_PARA', validi: 2 },
  TR_MASTER: { gruppoValidi: 'TR_MASTER', validi: 2 },
  TRO: { gruppoValidi: 'TRO', validi: 4 },
  CP: { gruppoValidi: 'CP', validi: 1 },
} as const;

/**
 * Art. 2.4 & 2.5: Catalogo Tornei Individuali (Allegato Tecnico 2026/27, Tabella 3).
 * maxVit non è nell'Allegato: limita solo il valore inseribile nel modulo.
 */
export const TOURNAMENT_CATALOG: Record<string, TournamentConfig> = {

  // Campionati Italiani di Categoria
  CI_ASS: { nome: 'Campionati Italiani 1ª Cat.', id: 'CI_ASS', ...V.CI_CAT, girq: 60, ptsVit: 20, open: false, maxVit: 3, turni: t(2800, 2240, 1792, 1434, 1147, 918) },
  CI_2: { nome: 'Campionati Italiani 2ª Cat.', id: 'CI_2', ...V.CI_CAT, girq: 40, ptsVit: 20, open: false, maxVit: 3, turni: t(1600, 1280, 1024, 819, 655, 524, 419) },
  CI_3: { nome: 'Campionati Italiani 3ª Cat.', id: 'CI_3', ...V.CI_CAT, girq: 30, ptsVit: 20, open: false, maxVit: 3, turni: t(1000, 800, 640, 512, 410, 328, 262, 190) },
  CI_4: { nome: 'Campionati Italiani 4ª Cat.', id: 'CI_4', ...V.CI_CAT, girq: 20, ptsVit: 20, open: false, maxVit: 3, turni: t(600, 480, 384, 307, 246, 197, 157, 126, 107, 75) },
  CI_5: { nome: 'Campionati Italiani 5ª Cat.', id: 'CI_5', ...V.CI_CAT, girq: 15, ptsVit: 20, open: false, maxVit: 3, turni: t(450, 360, 288, 230, 184, 147, 118, 94, 80, 68) },
  CI_6: { nome: 'Campionati Italiani 6ª Cat.', id: 'CI_6', ...V.CI_CAT, girq: 10, ptsVit: 20, open: false, maxVit: 3, turni: t(350, 280, 224, 179, 143, 115, 92, 73, 62, 53) },

  // Campionati Italiani giovanili, paralimpici e master
  CI_G_U21: { nome: 'Campionati Italiani giovanili - U21', id: 'CI_G_U21', ...V.CI_GIOV, girq: 15, ptsVit: 10, open: false, maxVit: 3, turni: t(400, 320, 256, 205, 164, 131) },
  CI_G_U19: { nome: 'Campionati Italiani giovanili - U19', id: 'CI_G_U19', ...V.CI_GIOV, girq: 15, ptsVit: 10, open: false, maxVit: 3, turni: t(350, 280, 224, 179, 143, 115) },
  CI_G_U17: { nome: 'Campionati Italiani giovanili - U17', id: 'CI_G_U17', ...V.CI_GIOV, girq: 15, ptsVit: 10, open: false, maxVit: 3, turni: t(300, 240, 192, 154, 123, 98) },
  CI_G_U15: { nome: 'Campionati Italiani giovanili - U15', id: 'CI_G_U15', ...V.CI_GIOV, girq: 15, ptsVit: 10, open: false, maxVit: 3, turni: t(250, 200, 160, 128, 102, 82) },
  CI_G_U13: { nome: 'Campionati Italiani giovanili - U13', id: 'CI_G_U13', ...V.CI_GIOV, girq: 15, ptsVit: 10, open: false, maxVit: 3, turni: t(220, 176, 141, 113, 90, 72) },
  CI_G_U11: { nome: 'Campionati Italiani giovanili - U11', id: 'CI_G_U11', ...V.CI_GIOV, girq: 15, ptsVit: 10, open: false, maxVit: 3, turni: t(200, 160, 128, 102, 82, 66) },
  CI_PARA: { nome: 'Campionati Italiani paralimpici - classi 1-11', id: 'CI_PARA', ...V.CI_PARA, girq: 5, ptsVit: 10, open: false, maxVit: 3, turni: t(180, 144, 115, 92, 74, 59) },
  CI_PARA_G: { nome: 'Campionati Italiani paralimpici - giov/esord.', id: 'CI_PARA_G', ...V.CI_PARA, girq: 5, ptsVit: 10, open: false, maxVit: 3, turni: t(80, 64, 51, 41, 33, 26) },
  CI_MASTER: { nome: 'Campionati Italiani Master', id: 'CI_MASTER', ...V.CI_MASTER, girq: 15, ptsVit: 10, open: false, maxVit: 3, turni: t(350, 280, 224, 179, 143, 115, 92, 73) },

  // Tornei Nazionali giovanili, paralimpici e master
  TN_G_U21: { nome: 'Torneo Nazionale giovanile - U21', id: 'TN_G_U21', ...V.TN_GIOV, girq: 10, ptsVit: 10, open: false, maxVit: 3, turni: t(180, 144, 115, 92, 74, 59, 47, 38) },
  TN_G_U19: { nome: 'Torneo Nazionale giovanile - U19', id: 'TN_G_U19', ...V.TN_GIOV, girq: 10, ptsVit: 10, open: false, maxVit: 3, turni: t(160, 128, 102, 82, 66, 52, 42, 34) },
  TN_G_U17: { nome: 'Torneo Nazionale giovanile - U17', id: 'TN_G_U17', ...V.TN_GIOV, girq: 8, ptsVit: 10, open: false, maxVit: 3, turni: t(140, 112, 90, 72, 57, 46, 37, 29) },
  TN_G_U15: { nome: 'Torneo Nazionale giovanile - U15', id: 'TN_G_U15', ...V.TN_GIOV, girq: 8, ptsVit: 10, open: false, maxVit: 3, turni: t(120, 96, 77, 61, 49, 39, 31, 25) },
  TN_G_U13: { nome: 'Torneo Nazionale giovanile - U13', id: 'TN_G_U13', ...V.TN_GIOV, girq: 6, ptsVit: 10, open: false, maxVit: 3, turni: t(110, 88, 70, 56, 45, 36, 29, 23) },
  TN_G_U11: { nome: 'Torneo Nazionale giovanile - U11', id: 'TN_G_U11', ...V.TN_GIOV, girq: 6, ptsVit: 10, open: false, maxVit: 3, turni: t(100, 80, 64, 51, 41, 33, 26, 21) },
  TN_PARA: { nome: 'Torneo Nazionale paralimpico - classi 1-11', id: 'TN_PARA', ...V.TN_PARA, girq: 4, ptsVit: 10, open: false, maxVit: 3, turni: t(90, 72, 58, 46, 37, 29, 24, 19) },
  TN_PARA_G: { nome: 'Torneo Nazionale paralimpico - giov/esord.', id: 'TN_PARA_G', ...V.TN_PARA, girq: 4, ptsVit: 10, open: false, maxVit: 3, turni: t(40, 32, 26, 20, 16, 13, 10, 8) },
  TN_MASTER: { nome: 'Torneo Nazionale Master', id: 'TN_MASTER', ...V.TN_MASTER, girq: 8, ptsVit: 10, open: false, maxVit: 3, turni: t(250, 200, 160, 128, 102, 82, 66, 52) },

  // Tornei Nazionali Top
  TOP_1: { nome: 'Torneo Top 1 (1-32 M | 1-24 F)', id: 'TOP_1', ...V.TOP, girq: 25, ptsVit: 20, open: false, maxVit: 3, turni: t(1300, 1040, 832, 666, 532, 320) },
  TOP_2: { nome: 'Torneo Top 2 (1-120 M | 1-50 F)', id: 'TOP_2', ...V.TOP, girq: 20, ptsVit: 20, open: false, maxVit: 3, turni: t(800, 640, 512, 410, 328, 262, 210, 168) },
  TOP_3: { nome: 'Torneo Top 3 (121-452 M | 51-200 F)', id: 'TOP_3', ...V.TOP, girq: 14, ptsVit: 20, open: false, maxVit: 3, turni: t(550, 440, 352, 282, 225, 180, 144, 115, 92) },
  TOP_4: { nome: 'Torneo Top 4 (453-2000 M | 201-400 F)', id: 'TOP_4', ...V.TOP, girq: 10, ptsVit: 20, open: false, maxVit: 3, turni: t(400, 320, 256, 205, 164, 131, 105, 84, 67, 54) },
  TOP_5: { nome: 'Torneo Top 5 (2001-5000 M | da 401 F)', id: 'TOP_5', ...V.TOP, girq: 8, ptsVit: 20, open: false, maxVit: 3, turni: t(300, 240, 192, 154, 123, 98, 79, 63, 50, 40) },
  TOP_6M: { nome: 'Torneo Top 6 M (da 5000 M)', id: 'TOP_6M', ...V.TOP, girq: 5, ptsVit: 20, open: false, maxVit: 3, turni: t(250, 200, 160, 128, 102, 82, 66, 52, 42, 34) },
  COPPA_REG_GIOV: { nome: 'Coppa delle Regioni giovanile', id: 'COPPA_REG_GIOV', ...V.COPPA_REG, girq: 2, ptsVit: 20, open: false, maxVit: 3, turni: t(80, 64, 51, 41, 33, 26, 21) },

  // Tornei Open: vedi OPEN_BRACKET_PER_MILLE. Con al massimo 6 iscritti si gioca il girone unico: fino a 5 vittorie
  OPEN1: { nome: 'Torneo Open 1 (1-500 M | 1-50 F)', id: 'OPEN1', ...V.OPEN, girq: 20, ptsVit: 15, open: true, maxVit: 5, turni: t(350, 280, 224, 179, 143, 115, 86, 65, 48) },
  OPEN2: { nome: 'Torneo Open 2 (121-1500 M | 9-100 F)', id: 'OPEN2', ...V.OPEN, girq: 16, ptsVit: 15, open: true, maxVit: 5, turni: t(300, 240, 192, 154, 123, 98, 74, 55, 41) },
  OPEN3: { nome: 'Torneo Open 3 (451-2500 M | 26-200 F)', id: 'OPEN3', ...V.OPEN, girq: 13, ptsVit: 15, open: true, maxVit: 5, turni: t(240, 192, 154, 123, 98, 79, 59, 44, 33) },
  OPEN4: { nome: 'Torneo Open 4 (1201-4000 M | 91-300 F)', id: 'OPEN4', ...V.OPEN, girq: 10, ptsVit: 15, open: true, maxVit: 5, turni: t(190, 152, 122, 97, 78, 62, 47, 35, 26) },
  OPEN5: { nome: 'Torneo Open 5 (2001-6000 M | 151-500 F)', id: 'OPEN5', ...V.OPEN, girq: 8, ptsVit: 15, open: true, maxVit: 5, turni: t(160, 128, 102, 82, 66, 52, 39, 29, 22) },
  OPEN6: { nome: 'Torneo Open 6 (da 3801 M | da 231 F)', id: 'OPEN6', ...V.OPEN, girq: 6, ptsVit: 15, open: true, maxVit: 5, turni: t(140, 112, 90, 72, 57, 46, 34, 26, 19) },
  OPEN7: { nome: 'Torneo Open 7 (da 5001 M | da 351 F)', id: 'OPEN7', ...V.OPEN, girq: 5, ptsVit: 15, open: true, maxVit: 5, turni: t(120, 96, 77, 61, 49, 39, 29, 22, 17) },
  OPEN8: { nome: 'Torneo Open 8 (da 6201 M | da 451 F)', id: 'OPEN8', ...V.OPEN, girq: 4, ptsVit: 15, open: true, maxVit: 5, turni: t(100, 80, 64, 51, 41, 33, 25, 18, 14) },

  // Campionati Regionali
  CR_ASS: { nome: 'Campionati Regionali Assoluti (1ª-2ª)', id: 'CR_ASS', ...V.CR_CAT, girq: 10, ptsVit: 10, open: false, maxVit: 3, turni: t(250, 200, 160, 128, 102, 82, 61) },
  CR_3: { nome: 'Campionati Regionali 3ª Cat.', id: 'CR_3', ...V.CR_CAT, girq: 7, ptsVit: 10, open: false, maxVit: 3, turni: t(180, 144, 115, 92, 74, 59, 44) },
  CR_4: { nome: 'Campionati Regionali 4ª Cat.', id: 'CR_4', ...V.CR_CAT, girq: 5, ptsVit: 10, open: false, maxVit: 4, turni: t(140, 112, 90, 72, 57, 46, 34) },
  CR_5: { nome: 'Campionati Regionali 5ª Cat.', id: 'CR_5', ...V.CR_CAT, girq: 4, ptsVit: 10, open: false, maxVit: 4, turni: t(100, 80, 64, 51, 41, 33, 25) },
  CR_6: { nome: 'Campionati Regionali 6ª Cat.', id: 'CR_6', ...V.CR_CAT, girq: 3, ptsVit: 10, open: false, maxVit: 4, turni: t(90, 72, 58, 46, 37, 29, 22) },
  CR_G_U21: { nome: 'Campionati Regionali giovanili - U21', id: 'CR_G_U21', ...V.CR_GIOV, girq: 4, ptsVit: 5, open: false, maxVit: 3, turni: t(120, 96, 77, 61, 49, 39, 29) },
  CR_G_U19: { nome: 'Campionati Regionali giovanili - U19', id: 'CR_G_U19', ...V.CR_GIOV, girq: 4, ptsVit: 5, open: false, maxVit: 3, turni: t(105, 84, 67, 54, 43, 34, 26) },
  CR_G_U17: { nome: 'Campionati Regionali giovanili - U17', id: 'CR_G_U17', ...V.CR_GIOV, girq: 3, ptsVit: 5, open: false, maxVit: 3, turni: t(90, 72, 58, 46, 37, 29, 22) },
  CR_G_U15: { nome: 'Campionati Regionali giovanili - U15', id: 'CR_G_U15', ...V.CR_GIOV, girq: 3, ptsVit: 5, open: false, maxVit: 3, turni: t(80, 64, 51, 41, 33, 26, 20) },
  CR_G_U13: { nome: 'Campionati Regionali giovanili - U13', id: 'CR_G_U13', ...V.CR_GIOV, girq: 2, ptsVit: 5, open: false, maxVit: 3, turni: t(70, 56, 45, 36, 29, 23, 17) },
  CR_G_U11: { nome: 'Campionati Regionali giovanili - U11', id: 'CR_G_U11', ...V.CR_GIOV, girq: 2, ptsVit: 5, open: false, maxVit: 3, turni: t(60, 48, 38, 31, 25, 20, 15) },
  CR_PARA: { nome: 'Campionati Regionali paralimpici - classi 1-11', id: 'CR_PARA', ...V.CR_PARA, girq: 2, ptsVit: 5, open: false, maxVit: 3, turni: t(60, 48, 38, 31, 25, 20, 15) },
  CR_PARA_G: { nome: 'Campionati Regionali paralimpici - giov/esord.', id: 'CR_PARA_G', ...V.CR_PARA, girq: 1, ptsVit: 5, open: false, maxVit: 3, turni: t(27, 21, 17, 14, 11, 9, 7) },
  CR_MASTER: { nome: 'Campionati Regionali Master', id: 'CR_MASTER', ...V.CR_MASTER, girq: 2, ptsVit: 5, open: false, maxVit: 3, turni: t(90, 72, 58, 46, 37, 29, 22) },

  // Tornei Regionali Predeterminati
  TRP_ASS: { nome: 'Torneo Reg. Predeterminato Assoluto (1ª-2ª)', id: 'TRP_ASS', ...V.TRP_CAT, girq: 8, ptsVit: 10, open: false, maxVit: 3, turni: t(125, 100, 80, 64, 51, 41, 33, 26) },
  TRP_3: { nome: 'Torneo Reg. Predeterminato 3ª Cat.', id: 'TRP_3', ...V.TRP_CAT, girq: 6, ptsVit: 10, open: false, maxVit: 3, turni: t(90, 72, 58, 46, 37, 29, 24, 19) },
  TRP_4: { nome: 'Torneo Reg. Predeterminato 4ª Cat.', id: 'TRP_4', ...V.TRP_CAT, girq: 4, ptsVit: 10, open: false, maxVit: 4, turni: t(70, 56, 45, 36, 29, 23, 18, 15) },
  TRP_5: { nome: 'Torneo Reg. Predeterminato 5ª Cat.', id: 'TRP_5', ...V.TRP_CAT, girq: 3, ptsVit: 10, open: false, maxVit: 4, turni: t(50, 40, 32, 26, 20, 16, 13, 10) },
  TRP_6: { nome: 'Torneo Reg. Predeterminato 6ª Cat.', id: 'TRP_6', ...V.TRP_CAT, girq: 2, ptsVit: 10, open: false, maxVit: 4, turni: t(45, 36, 29, 23, 18, 15, 12, 9) },
  TRP_G_U21: { nome: 'Torneo Reg. Predeterminato Giov. - U21 / Fascia 1', id: 'TRP_G_U21', ...V.TRP_GIOV, girq: 3, ptsVit: 5, open: false, maxVit: 3, turni: t(75, 60, 48, 38, 31, 25, 20, 16) },
  TRP_G_U19: { nome: 'Torneo Reg. Predeterminato Giov. - U19 / Fascia 2', id: 'TRP_G_U19', ...V.TRP_GIOV, girq: 3, ptsVit: 5, open: false, maxVit: 3, turni: t(66, 53, 42, 34, 27, 22, 17, 14) },
  TRP_G_U17: { nome: 'Torneo Reg. Predeterminato Giov. - U17 / Fascia 3', id: 'TRP_G_U17', ...V.TRP_GIOV, girq: 2, ptsVit: 5, open: false, maxVit: 3, turni: t(56, 45, 36, 29, 23, 18, 15, 12) },
  TRP_G_U15: { nome: 'Torneo Reg. Predeterminato Giov. - U15 / Fascia 4', id: 'TRP_G_U15', ...V.TRP_GIOV, girq: 2, ptsVit: 5, open: false, maxVit: 3, turni: t(50, 40, 32, 26, 20, 16, 13, 10) },
  TRP_G_U13: { nome: 'Torneo Reg. Predeterminato Giov. - U13 / Fascia 5', id: 'TRP_G_U13', ...V.TRP_GIOV, girq: 1, ptsVit: 5, open: false, maxVit: 3, turni: t(44, 35, 28, 22, 18, 14, 11, 9) },
  TRP_G_U11: { nome: 'Torneo Reg. Predeterminato Giov. - U11 / Fascia 6', id: 'TRP_G_U11', ...V.TRP_GIOV, girq: 1, ptsVit: 5, open: false, maxVit: 3, turni: t(38, 30, 24, 19, 15, 12, 10, 8) },
  TRP_PARA: { nome: 'Torneo Reg. Paralimpico - classi 1-11', id: 'TRP_PARA', ...V.TR_PARA, girq: 1, ptsVit: 5, open: false, maxVit: 3, turni: t(38, 30, 24, 19, 15, 12) },
  TRP_PARA_G: { nome: 'Torneo Reg. Paralimpico - giov/esord.', id: 'TRP_PARA_G', ...V.TR_PARA, girq: 1, ptsVit: 5, open: false, maxVit: 3, turni: t(17, 13, 11, 9, 7, 5, 4, 3) },
  TR_MASTER: { nome: 'Torneo Regionale Master', id: 'TR_MASTER', ...V.TR_MASTER, girq: 1, ptsVit: 5, open: false, maxVit: 3, turni: t(60, 48, 38, 31, 25, 20, 16, 13) },

  // Tornei Regionali Ordinari e Campionati Provinciali
  TRO_ASS: { nome: 'Torneo Regionale Ordinario Assoluto (1ª-2ª)', id: 'TRO_ASS', ...V.TRO, girq: 8, ptsVit: 10, open: false, maxVit: 3, turni: t(63, 50, 40, 32, 26, 20, 16, 13) },
  TRO_3: { nome: 'Torneo Regionale Ordinario 3ª Cat.', id: 'TRO_3', ...V.TRO, girq: 6, ptsVit: 10, open: false, maxVit: 3, turni: t(45, 36, 29, 23, 18, 15, 12, 9) },
  TRO_4: { nome: 'Torneo Regionale Ordinario 4ª Cat.', id: 'TRO_4', ...V.TRO, girq: 4, ptsVit: 10, open: false, maxVit: 4, turni: t(35, 28, 22, 18, 14, 11, 9, 7) },
  TRO_5: { nome: 'Torneo Regionale Ordinario 5ª Cat.', id: 'TRO_5', ...V.TRO, girq: 3, ptsVit: 10, open: false, maxVit: 4, turni: t(25, 20, 16, 13, 10, 8, 7, 5) },
  // Valori riportati alla lettera dall'Allegato: il salto da 23 a 10 sembra un refuso
  TRO_6: { nome: 'Torneo Regionale Ordinario 6ª Cat.', id: 'TRO_6', ...V.TRO, girq: 2, ptsVit: 10, open: false, maxVit: 4, turni: t(23, 10, 8, 6, 5, 4, 3, 2) },
  CP: { nome: 'Campionati Provinciali', id: 'CP', ...V.CP, girq: 1, ptsVit: 10, open: false, maxVit: 4, turni: t(10, 8, 6, 5, 4, 3, 2, 1) },
};

/**
 * Art. 2.4 & 2.5: punti di una singola gara, prima del limite di tornei validi.
 * Usata sia dal calcolo complessivo sia dall'anteprima nel form.
 */
export function calculateTournamentEntryPoints(
  config: TournamentConfig,
  entry: Pick<TournamentResult, 'roundReached' | 'groupWins' | 'bracketDepthLevels'>
): { participationPoints: number; placementPoints: number; groupWinPoints: number } {
  const cappedWins = Math.max(0, Math.min(Math.trunc(entry.groupWins), config.maxVit));

  let placementPoints = 0;
  if (entry.roundReached >= 0) {
    const columnPoints = config.turni[entry.roundReached] ?? 0;
    placementPoints = config.open
      ? calculateOpenPlacementPoints(columnPoints, entry.bracketDepthLevels ?? 6)
      : columnPoints;
  }

  return {
    participationPoints: config.girq,
    placementPoints,
    groupWinPoints: cappedWins * config.ptsVit,
  };
}

/**
 * Turni selezionabili: in un Open non si può uscire prima del primo turno del tabellone.
 */
export function getSelectableRounds(
  config: TournamentConfig | undefined,
  maxBracketLevel: number
): { value: BracketRoundIndex; label: string }[] {
  // Le gare non Open arrivano al massimo alla colonna F256 della Tabella 3
  if (!config?.open) return BRACKET_ROUND_LABELS.filter((round) => round.value <= 9);
  return BRACKET_ROUND_LABELS.filter((round) => round.value <= maxBracketLevel);
}

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

    const { participationPoints, placementPoints, groupWinPoints } =
      calculateTournamentEntryPoints(config, tr);

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

  // 3. Applicazione del limite di tornei 'validi' per gruppo di gare (Art. 2.4, Tabella 3)
  const groupedByLimit: Record<string, TournamentResultCalculated[]> = {};
  for (const item of prelimTournaments) {
    if (!item.isCountedInValidLimit) continue;
    const group = TOURNAMENT_CATALOG[item.tournamentId].gruppoValidi;
    (groupedByLimit[group] ??= []).push(item);
  }

  const validPlacementIds = new Set<string>();
  for (const list of Object.values(groupedByLimit)) {
    const maxValid = TOURNAMENT_CATALOG[list[0].tournamentId].validi;
    const sorted = [...list].sort(
      (a, b) => b.rawPlacementAndParticipation - a.rawPlacementAndParticipation
    );
    sorted.slice(0, maxValid).forEach((item) => validPlacementIds.add(item.id));
  }

  const calculatedTournaments: TournamentResultCalculated[] = prelimTournaments.map((item) => {
    const isCounted = validPlacementIds.has(item.id);
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

  // 6. Proiezione di fine stagione (Art. 2.7): il classificato senza incontri passa F.Q. con -5%.
  // Chi è già F.Q. e resta inattivo segue le regole a), b), c), non calcolabili da qui: null.
  const hasPlayedAnyActivity =
    input.matches.some((m) => !m.isWalkoverOrUnplayed) || input.tournaments.length > 0;
  let fuoriQuadroEndSeasonProjection: number | null = projectedFinalPoints;
  if (!hasPlayedAnyActivity) {
    fuoriQuadroEndSeasonProjection = input.isFuoriQuadro
      ? null
      : Math.round(input.initialPoints * 0.95);
  }

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
    } else {
      possibleReasons.push(
        'Art. 2.3: Il punteggio di un avversario battuto in campionato era superiore a quello stimato nella classifica antecedente la partita, generando un bonus vittoria inattesa maggiore.'
      );
    }

    if (breakdown.calculatedTournaments.some((tr) => TOURNAMENT_CATALOG[tr.tournamentId]?.open)) {
      possibleReasons.push(
        'Tornei Open: il piazzamento usa la colonna della Tabella 3 per la percentuale del tabellone, regola confrontata con risultati ufficiali solo per tabelloni da 17-32 e 33-64 qualificati. Con tabelloni di altre dimensioni i punti potrebbero essere diversi.'
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