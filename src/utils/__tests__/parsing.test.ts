import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SAVED_STATE,
  parseOfficialScore,
  parseSavedState,
  toNonNegativeNumber,
} from '@/utils/parsing';

describe('parseOfficialScore', () => {
  it.each([
    ['5420', 5420],
    ['5420,25', 5420.25],
    ['5.420', 5420],
    ['5.420,25', 5420.25],
    ['12.345.678', 12345678],
    [' 5 420 ', 5420],
    ['5.42', 5.42],
  ])('dovrebbe leggere %s come %d', (raw, expected) => {
    expect(parseOfficialScore(raw)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '5.4.2', '-100', '5,420,25'])('dovrebbe rifiutare "%s"', (raw) => {
    expect(parseOfficialScore(raw)).toBeNull();
  });
});

describe('toNonNegativeNumber', () => {
  it('dovrebbe portare a 0 i valori vuoti, negativi o non validi', () => {
    expect(toNonNegativeNumber('')).toBe(0);
    expect(toNonNegativeNumber('-5')).toBe(0);
    expect(toNonNegativeNumber('abc')).toBe(0);
    expect(toNonNegativeNumber('12.5')).toBe(12.5);
  });
});

describe('parseSavedState', () => {
  const match = {
    id: 'm',
    seriesId: 'C2_M',
    myCurrentPoints: 5000,
    opponentPoints: 5200,
    isWalkoverOrUnplayed: false,
    isDifferentGender: false,
  };
  const tournament = { id: 't', tournamentId: 'OPEN5', roundReached: 2, groupWins: 1 };

  it.each([null, '', 'non json', '42', 'null'])('dovrebbe usare i predefiniti con %s', (raw) => {
    expect(parseSavedState(raw)).toEqual(DEFAULT_SAVED_STATE);
  });

  it('dovrebbe leggere i salvataggi precedenti, privi dei campi ITTF', () => {
    const state = parseSavedState(
      JSON.stringify({ initialPoints: 7777, gender: 'F', isFuoriQuadro: true, matches: [match], tournaments: [tournament] })
    );
    expect(state).toEqual({
      ...DEFAULT_SAVED_STATE,
      initialPoints: 7777,
      gender: 'F',
      isFuoriQuadro: true,
      matches: [match],
      tournaments: [tournament],
    });
  });

  it('dovrebbe conservare i dati ITTF', () => {
    const state = parseSavedState(
      JSON.stringify({ ittfEnabled: true, ittfRank: 85, ittfSeniorPoints: 250 })
    );
    expect(state.ittfEnabled).toBe(true);
    expect(state.ittfRank).toBe(85);
    expect(state.ittfSeniorPoints).toBe(250);
  });

  it('dovrebbe scartare solo le voci danneggiate', () => {
    const state = parseSavedState(
      JSON.stringify({
        gender: 'X',
        matches: [match, { id: 'rotta', seriesId: 'C2_M' }, null],
        tournaments: [tournament, { ...tournament, roundReached: 99 }],
      })
    );
    expect(state.gender).toBe('M');
    expect(state.matches).toEqual([match]);
    expect(state.tournaments).toEqual([tournament]);
  });
});

describe('parseSavedState: gare unificate', () => {
  it('dovrebbe convertire i vecchi Campionati Provinciali nella voce unica', () => {
    const saved = JSON.stringify({
      tournaments: [
        { id: 'a', tournamentId: 'CP_5', roundReached: 0, groupWins: 1 },
        { id: 'b', tournamentId: 'CP_6', roundReached: 0, groupWins: 1 },
        { id: 'c', tournamentId: 'OPEN5', roundReached: 0, groupWins: 1 },
      ],
    });
    expect(parseSavedState(saved).tournaments.map((t) => t.tournamentId)).toEqual(['CP', 'CP', 'OPEN5']);
  });
});
