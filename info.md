# logo-bettona — Panoramica progetto

Editor interattivo per loghi a forma di anello. Compone più anelli concentrici, ciascuno con un percorso (path) ripetuto in più copie radiali, palette colore configurabili e animazioni che fanno transitare ogni anello tra due forme.

Documento pensato per **designer** (cosa fa, come si usa) e per **sviluppatori** (stack, architettura, dove vivono le cose).

---

## 1. Cos'è in una frase

App web client-only (SvelteKit) dove l'utente costruisce un logo circolare configurando anelli, colori, forme e animazioni; il preview vive in un canvas Paper.js aggiornato in tempo reale a ogni modifica.

URL produzione: deploy statico su GitHub Pages (output `build/`, adapter `@sveltejs/adapter-static`).

---

## 2. Avvio rapido

```sh
bun install
bun run dev          # dev server (Vite)
bun run build        # build statica in build/
bun run preview      # serve build/
bun run test:unit    # Vitest (node + browser)
bun run test:e2e     # Playwright
bun run check        # svelte-check + tsc strict
bun run lint         # prettier + eslint
```

Requisiti: Bun + Chromium (per test browser/E2E).

---

## 3. Per designer

### 3.1 Modello visivo

- **Composition** = la scena. Contiene un raggio base, un incremento per ogni anello aggiuntivo, una lista di **anelli (rings)** e le palette disponibili.
- **Ring** = un anello concentrico. Definito da:
  - **templatePath**: la forma base, una piccola curva che viene ripetuta `copies` volte attorno al centro.
  - **secondaryTemplatePath** (opzionale): seconda forma per il morphing.
  - **copies**: quante volte la forma viene ripetuta in giro (es. 8).
  - **color**: il colore di riempimento.
  - **ringHeight**: spessore relativo dell'anello.
  - **morphT** ∈ [0, 1]: posizione corrente tra primary (0) e secondary (1).
- **Palette**:
  - **Monochrome**: due colori (main + bg).
  - **Full palette**: lista di colori applicata ciclicamente agli anelli.
  - **Manual**: ogni anello mantiene il suo colore.

### 3.2 Flusso d'uso (interfaccia)

L'app ha una **sidebar a sinistra** + **preview canvas a destra**. La sidebar è ordinata seguendo il workflow:

1. **Settings** — raggio base, incremento tra anelli, viewport.
2. **Animation** — Play / Pause, durata, loop, alternate, scelta del driver (semplice/audio/data).
3. **Colors** — modalità colore (Monochrome / Full / Manual) + editor palette.
4. **Ring editors** — un editor per anello con: forma primaria, forma secondaria, copies, height, color, slider del morph.

Modifiche → la preview si aggiorna immediatamente. Lo stato persiste in `localStorage` (vedi §4.4): se ricarichi la pagina, il lavoro è ancora lì.

C'è una pagina **/about** statica con descrizione del prodotto e una hero animata.

### 3.3 Animazioni — driver disponibili

Tre modalità di animazione (driver), tutte interpolano `morphT` per ogni anello che ha sia primary che secondary:

| Driver | Comportamento |
|--------|---------------|
| **Simple** | Sweep continuo tra primary↔secondary su tutti gli anelli compatibili. Loop / alternate configurabili. Driver di default. |
| **Audio Bars** | Reattivo all'audio del microfono. Bande di frequenza guidano il morph di ciascun anello (smoothing, minHz, maxHz configurabili). |
| **Data Series** | Sequenza di valori (uno per anello) riprodotta nel tempo, utile per data-driven loops. |

Branch corrente: `feat/add-audioreactive` — driver audio in sviluppo attivo.

### 3.4 Cosa NON fa (ancora)

- Nessun export PNG/SVG dalla UI (solo preview live).
- Nessun account/cloud sync — tutto locale, in `localStorage`.
- Nessun preset built-in oltre alla composition di default.

---

## 4. Per sviluppatori

### 4.1 Stack

| Layer | Tecnologia |
|-------|-----------|
| Linguaggio | TypeScript strict + Svelte 5 (runes) |
| Framework | SvelteKit `^2.50` + adapter-static |
| Build/dev | Vite `^7`, Bun (pkg manager) |
| Stile | Tailwind CSS v4 (`@tailwindcss/vite`), shadcn-svelte |
| Geometria/render | `paper` ^0.12 (Paper.js) |
| Animazione | `animejs` ^4.3 (timeline simple driver) |
| Persistenza | `rune-sync` (`lsSync` su localStorage) |
| UI primitives | `bits-ui`, `phosphor-svelte` |
| Test | Vitest (node + browser via `@vitest/browser-playwright`), Playwright E2E |

Tipo deploy: SPA statica, `ssr = false`, `prerender = true` (`src/routes/+layout.ts`).

### 4.2 Struttura cartelle

```
src/
├── app.d.ts                       # tipi ambient SvelteKit
├── app.html
├── lib/
│   ├── types.ts                   # Composition, Ring, Path, palette types
│   ├── color/apply.ts             # applicazione modalità colore agli anelli
│   ├── state/
│   │   ├── composition.ts         # source of truth: composition, colorMode, uiState (lsSync)
│   │   ├── animation.ts           # re-export
│   │   ├── animation.svelte.ts    # controller playback (anime.js)
│   │   └── animation-drivers/
│   │       ├── runtime.ts         # registry + tick loop dei driver
│   │       ├── types.ts           # AnimationDriverType
│   │       ├── simple-driver.ts   # sweep continuo
│   │       ├── audio-bars-driver.ts
│   │       └── data-series-driver.ts
│   ├── geometry/
│   │   ├── path-morph.ts          # validatePathCompatibility, interpolatePath
│   │   ├── bend.ts                # bend radiale di un segmento
│   │   ├── compose.ts             # facade legacy
│   │   ├── svg-import.ts          # import SVG → Path
│   │   └── render-pipeline.ts     # createRenderPipeline().render() → Paper.js
│   ├── components/
│   │   ├── Sidebar.svelte         # ordine sezioni
│   │   ├── SettingsSection.svelte
│   │   ├── AnimationSection.svelte
│   │   ├── ColorsSection.svelte
│   │   ├── MonochromePaletteEditor.svelte
│   │   ├── FullPaletteEditor.svelte
│   │   ├── RingEditor.svelte
│   │   ├── RingCanvas.svelte      # editor singolo ring
│   │   ├── PreviewCanvas.svelte   # canvas principale
│   │   └── AboutHeroRing.svelte
│   └── shadcn/                    # primitives (sidebar, button, ...)
└── routes/
    ├── +layout.svelte / +layout.ts
    ├── +page.svelte               # editor (Sidebar + PreviewCanvas)
    ├── about/+page.svelte
    ├── demo/                      # demo route
    └── experiments/               # sandbox Paper.js
```

### 4.3 Architettura a layer

```
┌─────────────────────────────────────────────┐
│ routes/+page.svelte (shell)                 │
│   └── Sidebar  ─┐         ┌── PreviewCanvas │
└──────────────────│─────────│──────────────────┘
                   │         │
        ┌──────────▼─┐  ┌────▼──────────────┐
        │ feature    │  │ render-pipeline   │
        │ components │  │ (Paper.js)        │
        └──────┬─────┘  └────▲──────────────┘
               │             │ legge composition
       ┌───────▼──────┐      │
       │ state layer  │──────┘
       │ composition  │
       │ animation    │
       │ drivers      │
       └──────────────┘
```

**Flusso dati per il playback animazione:**

1. Utente preme Play in `AnimationSection.svelte`.
2. Il controller in `state/animation.svelte.ts` (o un driver registrato nel runtime) calcola, ad ogni tick, un valore `t ∈ [0,1]` per ogni anello target.
3. Il valore viene scritto via `setRingMorphT(index, t)` in `state/composition.ts`.
4. `composition` è reattivo (Svelte runes + `lsSync`) → `PreviewCanvas.svelte` ha un `$effect` su `composition`.
5. L'effect chiama `renderPipeline.render(composition)`.
6. La pipeline, per ogni anello: se primary+secondary sono compatibili, calcola `interpolatePath(primary, secondary, morphT)`, poi `buildRingPath()` ripete la forma radialmente, applica il bend, riempie con Paper.js.

**Regole di compatibilità path:**

- `validatePathCompatibility` esige stessa sequenza di comandi (`cmds`) e stesso numero di coordinate (`crds`).
- `updateRingPathVariant` rifiuta scritture incompatibili con `{ ok: false, reason }` invece di corrompere lo stato.
- In render, se la compatibilità fallisce, si fa fallback al primary e si emette un warning in `RenderResult.warnings`.

### 4.4 Stato

**Persistente** (in localStorage via `rune-sync`):

- `composition` (rings, palettes, raggio/increment).
- `colorMode` (modalità + palette index).
- `uiState` (panels aperti/chiusi, ecc).

**Effimero** (solo runtime, modulo singleton):

- `animationState` in `state/animation.svelte.ts`: `isPlaying`, `progress`, parametri timeline.
- istanze `anime` interne al controller.
- runtime driver in `state/animation-drivers/runtime.ts`: mappa `mode → driver`, lifecycle `init/dispose`.

### 4.5 Animation drivers — contratto

Tutti i driver implementano:

```ts
type AnimationDriver = {
  init: () => void;
  dispose: () => void;
  frame: (nowMs: number) => Record<number /* ringIndex */, number /* t */>;
};
```

`runtime.tick(nowMs)` chiama `frame()` del driver attivo e applica i valori via `setRingMorphT` (clamp su [0,1]). Cambio modalità (`setMode`) dispose il precedente e init il nuovo.

### 4.6 Render pipeline

`createRenderPipeline(scopeOrCanvas)` ritorna `{ render(composition), dispose() }`.

- `render` ricostruisce la scena ad ogni chiamata (no caching incrementale).
- Restituisce `RenderResult` con `warnings` per anelli skippati o fallback morph.
- `dispose` è attualmente no-op (vedi §5).

### 4.7 Test

- Co-locati con i sorgenti, suffissi `*.spec.ts` / `*.svelte.spec.ts`.
- Due progetti Vitest: **node** (logica pura) + **browser** (componenti Svelte, Paper.js).
- E2E Playwright su `bun run build && bun run preview` — vedi `playwright.config.ts`, `src/routes/about/about-nav.e2e.ts`.
- Aree coperte: composition CRUD, path-morph compatibility, render pipeline warnings, animation controller stale-composition safety, driver runtime registry, AnimationSection wiring.

---

## 5. Stato attuale & limitazioni note

Riepilogo dai documenti `.planning/codebase/CONCERNS.md`:

- **Render `dispose()` no-op** — non rilascia risorse Paper.js. Da implementare o documentare come intenzionale.
- **Tick anim = full redraw** — ogni frame chiama `render()` sull'intera composition. Possibili miglioramenti: batching per rAF, redraw parziale, memoization su `t` quantizzati.
- **`clamp01` duplicato** in `state/animation.svelte.ts`, `state/composition.ts`, `geometry/path-morph.ts` — centralizzare.
- **Warnings non visibili** — `RenderResult.warnings` viene ignorato dalla UI (no banner / dev tool).
- **CI deploy non blocca su test** — `.github/workflows/deploy.yml` non esegue `test:unit` / `test:e2e`.
- **Compatibilità path strict** — qualsiasi differenza di struttura tra primary e secondary blocca il morph; l'UI non spiega perché.

Branch attivo: `feat/add-audioreactive` — integrazione driver audio.

---

## 6. Dove guardare per approfondire

- Architettura dettagliata: [`.planning/codebase/ARCHITECTURE.md`](.planning/codebase/ARCHITECTURE.md)
- Stack: [`.planning/codebase/STACK.md`](.planning/codebase/STACK.md)
- Struttura: [`.planning/codebase/STRUCTURE.md`](.planning/codebase/STRUCTURE.md)
- Convenzioni: [`.planning/codebase/CONVENTIONS.md`](.planning/codebase/CONVENTIONS.md)
- Debiti tecnici: [`.planning/codebase/CONCERNS.md`](.planning/codebase/CONCERNS.md)
- Test: [`.planning/codebase/TESTING.md`](.planning/codebase/TESTING.md)
- Integrazioni: [`.planning/codebase/INTEGRATIONS.md`](.planning/codebase/INTEGRATIONS.md)
- Spec e plan delle feature: [`docs/superpowers/specs/`](docs/superpowers/specs/) e [`docs/superpowers/plans/`](docs/superpowers/plans/)
- Istruzioni agente: [`CLAUDE.md`](CLAUDE.md), [`AGENTS.md`](AGENTS.md)

---

## 7. Glossario rapido

- **Ring** — anello concentrico. Una `templatePath` ripetuta `copies` volte radialmente.
- **Morph / morphT** — interpolazione tra primary e secondary path di un anello. `t = 0` → primary, `t = 1` → secondary.
- **Driver** — strategia che decide il valore `t` per ogni anello a ogni frame (simple / audio / dataSeries).
- **Composition** — l'intera scena editabile (rings + palette + parametri globali).
- **Bend** — trasformazione che curva un segmento lungo un arco circolare per chiudere l'anello.
- **Render pipeline** — `composition → Paper.js scene` (deterministica, no side-effect su stato).
