# FITeT Calculator

Calcolatore del punteggio di classifica FITeT (tennistavolo) per la stagione 2026/27. Inserisci i punti di partenza, le partite di campionato e i tornei giocati e ottieni il punteggio stimato, con il dettaglio di come è stato calcolato.

> Progetto non ufficiale, non affiliato alla FITeT. È una stima basata sulle tabelle di calcolo 2026/27 e va sempre confrontata con il punteggio ufficiale (l'app permette di inserirlo per verificare la differenza).

## Cosa fa

- **Partite di campionato:** punti base per serie (maschile, femminile, master, giovanile, paralimpici e coppe) più il bonus per vittoria inattesa (10% della differenza punti, massimo 120). Assegna 0 punti per assenza/rinuncia e per incontri tra sessi diversi.
- **Tornei:** limite dei tornei validi per gruppo di gare, punti partecipazione, vittorie nei gironi e piazzamento nel tabellone. Per gli Open applica alla colonna della Tabella 3 la percentuale del tabellone: la regola coincide con i risultati ufficiali 2026/27 confrontati, su tabelloni da 17-32 e 33-64 qualificati.
- **Altre regole:** protezione ITTF, fuori quadro (decurtazione del 5% a fine stagione per inattività) e stima della categoria.
- **Verifica:** confronta il calcolo con il punteggio ufficiale inserito dall'utente.
- **Dati in locale:** lo stato resta nel browser (`localStorage`), niente server e niente account.

## Stack

Next.js, React, TypeScript, Tailwind CSS, Vitest.

## Struttura

```
src/
├── app/page.tsx                         interfaccia
├── types/fitet.ts                       tipi del dominio
└── utils/
    ├── calculateFitetScore.ts           motore di calcolo (funzioni pure)
    └── __tests__/calculateFitetScore.test.ts
```

La logica di calcolo è separata dall'interfaccia ed è coperta da test, che includono l'esempio ufficiale FITeT per un Open 5 (62 punti).

## Avvio

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # test del motore di calcolo
npm run build    # build di produzione
```

Servono Node.js e npm.

## Limiti noti

- Le tabelle valgono per la stagione 2026/27 e sono scritte nel codice: a ogni nuova stagione vanno aggiornate.
- Non copre ogni caso del regolamento: usa il confronto con il punteggio ufficiale per scoprire le differenze.
