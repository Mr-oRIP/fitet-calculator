import { Match, SavedState, TournamentResult } from '@/types/fitet';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const DEFAULT_SAVED_STATE: SavedState = {
  initialPoints: 5000,
  gender: 'M',
  isFuoriQuadro: false,
  matches: [],
  tournaments: [],
  ittfEnabled: false,
  ittfRank: 0,
  ittfSeniorPoints: 0,
};

/**
 * Legge un punteggio scritto all'italiana: 5420, 5420,25, 5.420 oppure 5.420,25.
 * Restituisce null se il testo è vuoto o non è un numero valido.
 */
export function parseOfficialScore(raw: string): number | null {
  const text = raw.replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) {
    return Number(text.replace(/\./g, '').replace(',', '.'));
  }
  if (/^\d+([.,]\d+)?$/.test(text)) {
    return Number(text.replace(',', '.'));
  }
  return null;
}

/** Converte il testo di un campo numerico: vuoto, negativo o non valido diventano 0. */
export function toNonNegativeNumber(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Gare unificate dall'Allegato Tecnico: i salvataggi con i vecchi id restano validi. */
const LEGACY_TOURNAMENT_IDS: Record<string, string> = { CP_5: 'CP', CP_6: 'CP' };

function isValidMatch(value: unknown): value is Match {
  const m = value as Partial<Match> | null;
  return (
    typeof m?.id === 'string' &&
    typeof m.seriesId === 'string' &&
    isFiniteNumber(m.myCurrentPoints) &&
    isFiniteNumber(m.opponentPoints) &&
    typeof m.isWalkoverOrUnplayed === 'boolean' &&
    typeof m.isDifferentGender === 'boolean'
  );
}

function isValidTournament(value: unknown): value is TournamentResult {
  const t = value as Partial<TournamentResult> | null;
  return (
    typeof t?.id === 'string' &&
    typeof t.tournamentId === 'string' &&
    Number.isInteger(t.roundReached) &&
    (t.roundReached as number) >= -1 &&
    (t.roundReached as number) <= 10 &&
    isFiniteNumber(t.groupWins) &&
    (t.bracketDepthLevels === undefined || isFiniteNumber(t.bracketDepthLevels))
  );
}

/**
 * Ricostruisce lo stato salvato: i campi mancanti tornano al valore predefinito
 * e le voci danneggiate vengono scartate, così l'interfaccia non può andare in errore.
 */
export function parseSavedState(raw: string | null): SavedState {
  if (!raw) return DEFAULT_SAVED_STATE;

  let parsed: Partial<Record<keyof SavedState, unknown>> | null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_SAVED_STATE;
  }
  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SAVED_STATE;

  const number = (value: unknown, fallback: number) =>
    isFiniteNumber(value) ? value : fallback;
  const boolean = (value: unknown, fallback: boolean) =>
    typeof value === 'boolean' ? value : fallback;
  const d = DEFAULT_SAVED_STATE;

  return {
    initialPoints: number(parsed.initialPoints, d.initialPoints),
    gender: parsed.gender === 'F' ? 'F' : 'M',
    isFuoriQuadro: boolean(parsed.isFuoriQuadro, d.isFuoriQuadro),
    matches: Array.isArray(parsed.matches) ? parsed.matches.filter(isValidMatch) : [],
    tournaments: Array.isArray(parsed.tournaments)
      ? parsed.tournaments.filter(isValidTournament).map((t) => ({
          ...t,
          tournamentId: LEGACY_TOURNAMENT_IDS[t.tournamentId] ?? t.tournamentId,
        }))
      : [],
    ittfEnabled: boolean(parsed.ittfEnabled, d.ittfEnabled),
    ittfRank: number(parsed.ittfRank, d.ittfRank),
    ittfSeniorPoints: number(parsed.ittfSeniorPoints, d.ittfSeniorPoints),
  };
}
