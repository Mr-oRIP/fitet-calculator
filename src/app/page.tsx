'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BracketRoundIndex,
  ChampionshipSeriesId,
  Gender,
  Match,
  TournamentResult,
} from '@/types/fitet';
import {
  BRACKET_ROUND_LABELS,
  calculateFitetScore,
  calculateOpenPlacementPoints,
  calculateSingleMatchScore,
  NEW_PLAYER_PRESETS,
  OPEN_BRACKET_SIZE_OPTIONS,
  TEAM_SERIES_CATALOG,
  TOURNAMENT_CATALOG,
  verifyOfficialScore,
} from '@/utils/calculateFitetScore';

const STORAGE_KEY = 'fitet_score_calculator_2026_v1';

function parseOfficialScore(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (trimmed === '') return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  return num;
}

export default function FitetCalculatorPage() {
  // Stato Giocatore
  const [initialPoints, setInitialPoints] = useState<number>(5000);
  const [gender, setGender] = useState<Gender>('M');
  const [isFuoriQuadro, setIsFuoriQuadro] = useState<boolean>(false);
  const [ittfEnabled, setIttfEnabled] = useState<boolean>(false);
  const [ittfRank, setIttfRank] = useState<number>(0);
  const [ittfSeniorPoints, setIttfSeniorPoints] = useState<number>(0);

  // Liste Attività
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<TournamentResult[]>([]);

  // Form Nuova Partita Campionato a Squadre
  const [selectedSeries, setSelectedSeries] = useState<ChampionshipSeriesId>('C2_M');
  const [opponentPoints, setOpponentPoints] = useState<number>(5200);
  const [isWalkover, setIsWalkover] = useState<boolean>(false);
  const [isDifferentGender, setIsDifferentGender] = useState<boolean>(false);
  const [matchNote, setMatchNote] = useState<string>('');

  // Form Nuovo Torneo Individuale
  const [selectedTournament, setSelectedTournament] = useState<string>('OPEN4');
  const [roundReached, setRoundReached] = useState<BracketRoundIndex>(3); // Quarti
  const [groupWins, setGroupWins] = useState<number>(2);
  const [bracketDepth, setBracketDepth] = useState<number>(6); // Default L6 (100%)

  // Stato Modalità Verifica Fine Mese
  const [officialScoreInput, setOfficialScoreInput] = useState<string>('');

  // Caricamento da localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.initialPoints === 'number') setInitialPoints(parsed.initialPoints);
        if (parsed.gender) setGender(parsed.gender);
        if (typeof parsed.isFuoriQuadro === 'boolean') setIsFuoriQuadro(parsed.isFuoriQuadro);
        if (Array.isArray(parsed.matches)) setMatches(parsed.matches);
        if (Array.isArray(parsed.tournaments)) setTournaments(parsed.tournaments);
      }
    } catch (e) {
      console.error('Errore lettura localStorage:', e);
    }
  }, []);

  // Salvataggio automatico su localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          initialPoints,
          gender,
          isFuoriQuadro,
          matches,
          tournaments,
        })
      );
    } catch (e) {
      console.error('Errore salvataggio localStorage:', e);
    }
  }, [initialPoints, gender, isFuoriQuadro, matches, tournaments]);

  // Calcolo Principale (Puro & Reattivo)
  const breakdown = useMemo(() => {
    return calculateFitetScore({
      initialPoints,
      gender,
      isFuoriQuadro,
      matches,
      tournaments,
      ittfProtection: {
        enabled: ittfEnabled,
        ittfRank,
        ittfSeniorPoints,
      },
    });
  }, [
    initialPoints,
    gender,
    isFuoriQuadro,
    matches,
    tournaments,
    ittfEnabled,
    ittfRank,
    ittfSeniorPoints,
  ]);

  // Anteprima live partita squadre nel form
  const matchPreview = useMemo(() => {
    return calculateSingleMatchScore(
      selectedSeries,
      initialPoints,
      opponentPoints,
      isWalkover,
      isDifferentGender
    );
  }, [selectedSeries, initialPoints, opponentPoints, isWalkover, isDifferentGender]);

  // Anteprima live torneo nel form
  const currentTournamentConfig = TOURNAMENT_CATALOG[selectedTournament];
  const tournamentPreview = useMemo(() => {
    if (!currentTournamentConfig) return { part: 0, piazz: 0, gir: 0, tot: 0 };
    const wins = Math.min(groupWins, currentTournamentConfig.maxVit);
    const gir = wins * currentTournamentConfig.ptsVit;
    const part = currentTournamentConfig.girq;
    let piazz = 0;
    if (roundReached >= 0) {
      if (currentTournamentConfig.open && currentTournamentConfig.nominalValue) {
        piazz = calculateOpenPlacementPoints(
          currentTournamentConfig.nominalValue,
          roundReached,
          bracketDepth
        );
      } else {
        piazz = currentTournamentConfig.turni[roundReached] ?? 0;
      }
    }
    return { part, piazz, gir, tot: part + piazz + gir };
  }, [currentTournamentConfig, roundReached, groupWins, bracketDepth]);

  // Verifica punteggio ufficiale
  const verification = useMemo(() => {
    const num = parseOfficialScore(officialScoreInput);
    if (num === null) return null;
    return verifyOfficialScore(breakdown.projectedFinalPoints, num, breakdown);
  }, [officialScoreInput, breakdown]);

  // Handlers
  const handleAddMatch = (e: React.FormEvent) => {
    e.preventDefault();
    const newMatch: Match = {
      id: crypto.randomUUID(),
      seriesId: selectedSeries,
      myCurrentPoints: initialPoints,
      opponentPoints: Number(opponentPoints) || 0,
      isWalkoverOrUnplayed: isWalkover,
      isDifferentGender,
      note: matchNote.trim() || undefined,
    };
    setMatches((prev) => [...prev, newMatch]);
    setMatchNote('');
  };

  const handleRemoveMatch = (id: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== id));
  };

  const handleAddTournament = (e: React.FormEvent) => {
    e.preventDefault();
    const newTr: TournamentResult = {
      id: crypto.randomUUID(),
      tournamentId: selectedTournament,
      roundReached,
      groupWins: Math.min(groupWins, currentTournamentConfig?.maxVit ?? 4),
      bracketDepthLevels: currentTournamentConfig?.open ? bracketDepth : undefined,
    };
    setTournaments((prev) => [...prev, newTr]);
  };

  const handleRemoveTournament = (id: string) => {
    setTournaments((prev) => prev.filter((t) => t.id !== id));
  };

  const handleResetAll = () => {
    if (window.confirm('Vuoi azzerare tutti i dati inseriti?')) {
      setMatches([]);
      setTournaments([]);
      setInitialPoints(5000);
      setIsFuoriQuadro(false);
      setIttfEnabled(false);
      setIttfRank(0);
      setIttfSeniorPoints(0);
      setOfficialScoreInput('');
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Header */}
      <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="inline-block bg-blue-500/30 border border-blue-400/40 text-blue-100 text-xs font-semibold px-2.5 py-0.5 rounded-full mb-1.5">
              NUOVO ALGORITMO MERITO 2025/2026 - 2026/2027
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Calcolatore Classifica FITeT Live
            </h1>
            <p className="text-blue-200 text-sm mt-0.5">
              Simulazione in tempo reale senza perdita punti per sconfitta (Art. 2.2 Reg. Classifiche)
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetAll}
            className="self-start sm:self-auto bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold px-3.5 py-2 rounded-lg transition"
          >
            Azzera Tutti i Dati Salvati
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-6 space-y-6">
        {/* DASHBOARD RIASSUNTIVA LIVE */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Punti Iniziali
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">
              {breakdown.initialPoints.toLocaleString('it-IT')}
            </p>
            <p className="text-xs text-slate-500 mt-1">{breakdown.estimatedCategory}</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-sky-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
              + Campionati a Squadre
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-sky-600 mt-1">
              +{breakdown.teamMatchesPoints.toLocaleString('it-IT')}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {matches.length} {matches.length === 1 ? 'vittoria inserita' : 'vittorie inserite'}
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-emerald-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              + Tornei Individuali
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1">
              +{breakdown.totalTournamentPoints.toLocaleString('it-IT')}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Piazz: +{breakdown.tournamentParticipationAndPlacementPoints} | Gironi: +
              {breakdown.tournamentGroupWinPoints}
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl p-4 shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
              Punteggio Proiettato Finale
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl sm:text-3xl font-extrabold">
                {breakdown.projectedFinalPoints.toLocaleString('it-IT')}
              </p>
              <span className="text-xs font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 px-2 py-0.5 rounded-full">
                +{breakdown.netVariation.toLocaleString('it-IT')} pt
              </span>
            </div>
            <p className="text-xs text-blue-100 mt-1">
              {ittfEnabled && breakdown.ittfProtectionPoints > 0
                ? `Incl. +${breakdown.ittfProtectionPoints} pt Protezione ITTF`
                : 'Nessuna penalità per sconfitte'}
            </p>
          </div>
        </section>

        {/* CARD 1: DATI INIZIALI ATLETA */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-indigo-600 p-5">
          <h2 className="text-lg font-bold text-indigo-950 mb-4">
            1. Profilo e Punteggio Iniziale Atleta (Art. 2.1 & 2.6)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Punteggio Attuale / Iniziale
              </label>
              <input
                type="number"
                value={initialPoints}
                onChange={(e) => setInitialPoints(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Preset Nuovi Tesserati (Art. 2.1)
              </label>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) setInitialPoints(Number(e.target.value));
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">-- Imposta da tabella federale --</option>
                {NEW_PLAYER_PRESETS.map((p) => (
                  <option key={p.points} value={p.points}>
                    {p.label} ({p.points.toLocaleString('it-IT')} pt)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Settore Classifica (Art. 1.5)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setGender('M')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition ${
                    gender === 'M'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-700 border-slate-300'
                  }`}
                >
                  Maschile
                </button>
                <button
                  type="button"
                  onClick={() => setGender('F')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition ${
                    gender === 'F'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-700 border-slate-300'
                  }`}
                >
                  Femminile
                </button>
              </div>
            </div>
          </div>

          {/* Opzioni Avanzate: Fuori Quadro & Protezione ITTF */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-6">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isFuoriQuadro}
                onChange={(e) => setIsFuoriQuadro(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              Atleta attualmente Fuori Quadro (F.Q. - Art. 1.4 / 2.7)
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={ittfEnabled}
                onChange={(e) => setIttfEnabled(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              Applica Protezione Classifica ITTF Top 300 (Art. 2.6)
            </label>
          </div>

          {ittfEnabled && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-indigo-50/60 p-3 rounded-lg border border-indigo-100">
              <div>
                <label className="block text-xs font-semibold text-indigo-900 mb-1">
                  Posizione Ranking ITTF (1 - 300)
                </label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={ittfRank || ''}
                  onChange={(e) => setIttfRank(Number(e.target.value))}
                  placeholder="Es. 85"
                  className="w-full rounded-lg border border-indigo-200 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-indigo-900 mb-1">
                  Punti Ranking ITTF Senior
                </label>
                <input
                  type="number"
                  min={0}
                  value={ittfSeniorPoints || ''}
                  onChange={(e) => setIttfSeniorPoints(Number(e.target.value))}
                  placeholder="Es. 250"
                  className="w-full rounded-lg border border-indigo-200 px-3 py-1.5 text-sm"
                />
              </div>
            </div>
          )}
        </section>

        {/* GRIGLIA CALCOLATORI: SQUADRE & TORNEI */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CARD 2: CAMPIONATI A SQUADRE */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-sky-600 p-5 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-sky-900 mb-1">
                2. Vittorie Campionati a Squadre (Art. 2.3)
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Valore fisso di serie + bonus vittoria inattesa (10% della differenza se batti chi ha
                più punti, max 120 pt).
              </p>

              <form onSubmit={handleAddMatch} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Serie Campionato
                    </label>
                    <select
                      value={selectedSeries}
                      onChange={(e) => setSelectedSeries(e.target.value as ChampionshipSeriesId)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    >
                      {Object.values(TEAM_SERIES_CATALOG).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome} (Base: {s.baseWinPoints} pt)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Punti Avversario Battuto
                    </label>
                    <input
                      type="number"
                      value={opponentPoints}
                      onChange={(e) => setOpponentPoints(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Nome Avversario / Nota (Opzionale)
                  </label>
                  <input
                    type="text"
                    value={matchNote}
                    onChange={(e) => setMatchNote(e.target.value)}
                    placeholder="Es. Mario Rossi (3ª giornata andata)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isWalkover}
                      onChange={(e) => setIsWalkover(e.target.checked)}
                      className="rounded text-sky-600"
                    />
                    Vittoria per rinuncia / assenza (0 pt)
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDifferentGender}
                      onChange={(e) => setIsDifferentGender(e.target.checked)}
                      className="rounded text-sky-600"
                    />
                    Avversario di sesso diverso (0 pt)
                  </label>
                </div>

                {/* Anteprima Live Partita */}
                <div className="bg-sky-50 border border-sky-200 text-sky-900 px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between">
                  <span>
                    Anteprima vittoria: Base <strong>+{matchPreview.basePoints}</strong> pt | Bonus
                    Inattesa <strong>+{matchPreview.unexpectedBonus}</strong> pt
                  </span>
                  <span className="text-sm font-extrabold text-sky-700">
                    Totale: +{matchPreview.totalPoints} pt
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 rounded-lg text-sm transition shadow-sm"
                >
                  + Aggiungi Vittoria in Campionato
                </button>
              </form>

              {/* Tabella Partite Inserite */}
              {breakdown.calculatedMatches.length > 0 && (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-y border-slate-200">
                        <th className="py-2 px-2 text-left">Serie / Avversario</th>
                        <th className="py-2 px-2 text-right">Pt Avv.</th>
                        <th className="py-2 px-2 text-right">Base</th>
                        <th className="py-2 px-2 text-right">Bonus</th>
                        <th className="py-2 px-2 text-right">Totale</th>
                        <th className="py-2 px-2 text-center">Az.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {breakdown.calculatedMatches.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-2 px-2 font-medium">
                            <div>{m.seriesName}</div>
                            {m.note && <div className="text-[11px] text-slate-500">{m.note}</div>}
                            {(m.isWalkoverOrUnplayed || m.isDifferentGender) && (
                              <span className="inline-block text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                                Non valida ai fini punti (Art. 2.3)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {m.opponentPoints.toLocaleString('it-IT')}
                          </td>
                          <td className="py-2 px-2 text-right">+{m.basePoints}</td>
                          <td className="py-2 px-2 text-right">+{m.unexpectedBonus}</td>
                          <td className="py-2 px-2 text-right font-bold text-sky-700">
                            +{m.totalPoints}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveMatch(m.id)}
                              className="bg-rose-500 hover:bg-rose-600 text-white px-2 py-1 rounded text-[11px] font-bold"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* CARD 3: TORNEI INDIVIDUALI */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-emerald-600 p-5 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-emerald-900 mb-1">
                3. Risultati Tornei Individuali (Art. 2.4 & 2.5)
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Partecipazione + Piazzamento tabellone (entro il limite di tornei validi) + Vittorie
                nei gironi.
              </p>

              <form onSubmit={handleAddTournament} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Tipologia Torneo Ufficiale
                  </label>
                  <select
                    value={selectedTournament}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedTournament(newId);
                      const maxV = TOURNAMENT_CATALOG[newId]?.maxVit ?? 4;
                      if (groupWins > maxV) setGroupWins(maxV);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {Object.values(TOURNAMENT_CATALOG).map((tc) => (
                      <option key={tc.id} value={tc.id}>
                        {tc.nome} (Max validi: {tc.validi} | Gir: +{tc.ptsVit} pt/vit)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Piazzamento Tabellone Principale
                    </label>
                    <select
                      value={roundReached}
                      onChange={(e) => setRoundReached(Number(e.target.value) as BracketRoundIndex)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {BRACKET_ROUND_LABELS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Vittorie nel Girone (Max {currentTournamentConfig?.maxVit ?? 4})
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={currentTournamentConfig?.maxVit ?? 4}
                      value={groupWins}
                      onChange={(e) => setGroupWins(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {currentTournamentConfig?.open && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Dimensione Tabellone Open (Livello Massimo L1–L8 - Tabella 4)
                    </label>
                    <select
                      value={bracketDepth}
                      onChange={(e) => setBracketDepth(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {OPEN_BRACKET_SIZE_OPTIONS.map((opt) => (
                        <option key={opt.maxLevel} value={opt.maxLevel}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Anteprima Live Torneo */}
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between">
                  <span>
                    Part.: <strong>+{tournamentPreview.part}</strong> | Piazz.:{' '}
                    <strong>+{tournamentPreview.piazz}</strong> | Gir.:{' '}
                    <strong>+{tournamentPreview.gir}</strong>
                  </span>
                  <span className="text-sm font-extrabold text-emerald-700">
                    Totale: +{tournamentPreview.tot} pt
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-sm transition shadow-sm"
                >
                  + Aggiungi Risultato Torneo
                </button>
              </form>

              {/* Tabella Tornei Inseriti (Struttura fedele al prototipo HTML) */}
              {breakdown.calculatedTournaments.length > 0 && (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-y border-slate-200">
                        <th className="py-2 px-2 text-left">Torneo</th>
                        <th className="py-2 px-2 text-right">Part.</th>
                        <th className="py-2 px-2 text-right">Piazz.</th>
                        <th className="py-2 px-2 text-right">Gir.</th>
                        <th className="py-2 px-2 text-right">Totale</th>
                        <th className="py-2 px-2 text-center">Azione</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {breakdown.calculatedTournaments.map((tr) => (
                        <tr key={tr.id} className="hover:bg-slate-50">
                          <td className="py-2 px-2 font-medium">
                            <div>{tr.tournamentName}</div>
                            {!tr.isCountedInValidLimit && (
                              <span className="inline-block text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded mt-0.5">
                                Oltre limite validi: conta solo Girone (+{tr.groupWinPoints})
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {tr.isCountedInValidLimit ? `+${tr.participationPoints}` : '0'}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {tr.isCountedInValidLimit ? `+${tr.placementPoints}` : '0'}
                          </td>
                          <td className="py-2 px-2 text-right">+{tr.groupWinPoints}</td>
                          <td className="py-2 px-2 text-right font-bold text-emerald-700">
                            +{tr.effectiveTotalPoints}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveTournament(tr.id)}
                              className="bg-rose-500 hover:bg-rose-600 text-white px-2 py-1 rounded text-[11px] font-bold"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* CARD 4: MODALITÀ VERIFICA FINE MESE */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-amber-500 p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                4. Modalità &ldquo;Verifica&rdquo; Emissione Ufficiale Fine Mese
              </h2>
              <p className="text-xs text-slate-500">
                Inserisci il punteggio ufficiale pubblicato sul Portale Risultati FITeT per
                verificare eventuali scostamenti con il calcolo proiettato (
                <strong>{breakdown.projectedFinalPoints.toLocaleString('it-IT')} pt</strong>).
              </p>
            </div>

            <div className="w-full md:w-64">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Punteggio Ufficiale FITeT Uscito
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={officialScoreInput}
                onChange={(e) => setOfficialScoreInput(e.target.value)}
                placeholder="Es. 5420,25"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {verification && (
            <div
              className={`mt-4 p-4 rounded-xl border ${
                verification.status === 'EXACT'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : verification.status === 'MINOR_DIFF'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-sm font-bold">
                  Discrepanza Rilevata:{' '}
                  {verification.discrepancy > 0
                    ? `+${verification.discrepancy.toLocaleString('it-IT')}`
                    : verification.discrepancy.toLocaleString('it-IT')}{' '}
                  punti
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/70">
                  Ufficiale: {verification.officialPoints.toLocaleString('it-IT')} pt vs Proiettato:{' '}
                  {verification.projectedPoints.toLocaleString('it-IT')} pt
                </span>
              </div>
              <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                {verification.possibleReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}