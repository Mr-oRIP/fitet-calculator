export type Gender = 'M' | 'F';

export type ChampionshipSeriesId =
  | 'A1_M' | 'A2_M' | 'B1_M' | 'B2_M' | 'C1_M'
  | 'C2_M' | 'D1_M' | 'D2_M' | 'D3_M' | 'D4_M'
  | 'A1_F' | 'A2_F' | 'B_F' | 'C_F' | 'D1_F' | 'D2_F'
  | 'MASTER_A1' | 'MASTER_A2' | 'MASTER_B' | 'MASTER_C'
  | 'GIOVANILI';

export interface ChampionshipSeriesConfig {
  id: ChampionshipSeriesId;
  nome: string;
  settore: 'Maschile' | 'Femminile' | 'Master' | 'Giovanile';
  baseWinPoints: number;
}

export interface Match {
  id: string;
  seriesId: ChampionshipSeriesId;
  myCurrentPoints: number;
  opponentPoints: number;
  isWalkoverOrUnplayed: boolean; // Art. 2.3: 0 punti se assenza/rinuncia
  isDifferentGender: boolean;    // Art. 2.3: 0 punti tra sesso diverso
  note?: string;
}

export interface MatchCalculated extends Match {
  seriesName: string;
  basePoints: number;
  unexpectedBonus: number;
  totalPoints: number;
}

export type BracketRoundIndex =
  | -1 // Uscito nel girone (solo partecipazione + vittorie girone)
  | 0  // 1° Classificato (Vincitore)
  | 1  // 2° Classificato (Finalista)
  | 2  // Semifinale (3°-4°)
  | 3  // Quarti (5°-8°)
  | 4  // Ottavi (9°-16°)
  | 5  // 16esimi (17°-32°)
  | 6  // 32esimi (33°-64°)
  | 7  // 64esimi (65°-128°)
  | 8  // 128esimi (129°-256°)
  | 9  // 256esimi (257°-512°)
  | 10; // 512esimi (513°-1024°)

export interface TournamentConfig {
  id: string;
  nome: string;
  validi: number;            // Art. 2.4: Limite massimo tornei validi per questa tipologia
  girq: number;              // Punti di partecipazione
  ptsVit: 20 | 15 | 10 | 5;  // Art. 2.5: Punti per ogni vittoria nel girone
  open: boolean;             // Se true, usa il calcolo percentuale L0-L10 sul valore nominale
  nominalValue?: number;     // Valore nominale L6 (100%) per i Tornei Open (es. Open 5 = 160)
  maxVit: number;            // Massimo vittorie possibili nel girone
  turni: number[];           // Array di 11 posizioni: [1°, 2°, SF, QF, R16, R32, R64, R128, R256, R512, Prel]
}

export interface TournamentResult {
  id: string;
  tournamentId: string;
  roundReached: BracketRoundIndex;
  groupWins: number;
  /**
   * Livello massimo del tabellone ad eliminazione diretta per i Tornei Open (da 1 = L1 a 10 = L10).
   * Default: 6 (L6 = Tabellone di riferimento da 33-64 qualificati = 100% del valore nominale).
   */
  bracketDepthLevels?: number;
  isConsolation?: boolean; // Art. 2.4 e 2.5: 0 punti per consolazione
  customName?: string;
}

export interface TournamentResultCalculated extends TournamentResult {
  tournamentName: string;
  participationPoints: number;
  placementPoints: number;
  groupWinPoints: number;
  rawPlacementAndParticipation: number;
  isCountedInValidLimit: boolean; // True se rientra nei migliori N 'validi' (Art. 2.4)
  effectiveTotalPoints: number;
}

export interface IttfProtectionInput {
  enabled: boolean;
  ittfRank: number;        // 1 - 300 (Art. 2.6)
  ittfSeniorPoints: number;
}

export interface PlayerScoreInput {
  initialPoints: number;
  gender: Gender;
  isFuoriQuadro: boolean;
  matches: Match[];
  tournaments: TournamentResult[];
  ittfProtection: IttfProtectionInput;
}

export interface ScoreBreakdown {
  initialPoints: number;
  teamMatchesPoints: number;
  tournamentParticipationAndPlacementPoints: number;
  tournamentGroupWinPoints: number;
  totalTournamentPoints: number;
  ittfProtectionPoints: number;
  projectedFinalPoints: number;
  netVariation: number;
  fuoriQuadroEndSeasonProjection: number; // Art. 2.7 (-5% se 0 attività)
  estimatedCategory: string;
  calculatedMatches: MatchCalculated[];
  calculatedTournaments: TournamentResultCalculated[];
}

export interface VerificationResult {
  projectedPoints: number;
  officialPoints: number;
  discrepancy: number; // official - projected
  status: 'EXACT' | 'MINOR_DIFF' | 'SIGNIFICANT_DIFF';
  possibleReasons: string[];
}