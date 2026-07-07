# Design — Ring Editor Params (sezione "Anelli")

**Data:** 2026-07-07
**Branch:** `feat/ring-editor-params`
**Base:** `main` (HEAD `2f0fa6d`, "feat: curve to ring flow (#16)")

## Obiettivo

Riprogettare la sezione Editor come sezione **"Anelli"**: il posto dove si dà forma
al marchio. La **creazione** degli anelli resta compito della sezione Tracciati (già
fatta nella PR precedente). Questa PR riguarda **solo l'editing**.

Cuore della PR: separare i parametri per proprietà — dedicati al singolo anello vs
globali al marchio — con un solo override consentito.

### Fuori scope (non toccare)

- Cuciture temporanee segnalate in `.planning/codebase/`: morph editing, keyframe
  caleidoscopio. Vanno solo mantenute **compilanti** dopo lo spostamento di `copies`
  a globale (swap meccanico `ring.copies` → `composition.copies`), senza toccarne la
  logica.
- Distinzione sacra config/runtime: lavoriamo sulla **configurazione persistente**
  (raggio, copie, altezza, colore, incremento). Nessun tocco allo stato transitorio
  d'animazione (`wave`, `zoneDrive`, già stripped in persistenza).

## Modello dei parametri

| Parametro        | Ambito                       | Dove vive oggi        | Dove vive dopo             |
| ---------------- | ---------------------------- | --------------------- | -------------------------- |
| Forma (curva)    | Dedicato al singolo anello   | `Ring.templatePath`   | invariato                  |
| Colore           | Dedicato al singolo anello   | `Ring.color`          | invariato                  |
| Altezza          | Dedicato al singolo anello   | `Ring.ringHeight`     | invariato                  |
| Raggio base      | Globale (marchio)            | `Composition.baseRadius` | invariato               |
| Copie curva      | Globale (marchio)            | `Ring.copies` (per-anello) | **`Composition.copies`** |
| Incremento       | Globale + override per-anello| `Composition.ringIncrement` | globale invariato + **`Ring.incrementOverride`** |
| Nome             | Dedicato al singolo anello   | —                     | **`Ring.name`** (nuovo)    |

### Copie curva — globale, default 8

`copies` diventa **globale**. Default **8**: la simmetria a otto è l'identità del
marchio. L'utente può cambiarlo ma parte sempre da 8.

### Incremento — geometria cumulativa con override

Oggi il raggio è una spaziatura piatta:

```
radius(i) = baseRadius + ringIncrement * i
```

Con l'override diventa una **somma cumulativa**, dove l'incremento di un anello è la
distanza dall'anello precedente:

```
radius(0) = baseRadius                                   // anello più interno; increment ignorato
radius(i) = radius(i-1) + increment(i)   per i >= 1
increment(i) = ring[i].incrementOverride ?? composition.ringIncrement
```

Retrocompatibile: senza override, `increment(i)` è costante = globale, quindi
`radius(i) = baseRadius + globale * i` — identico a oggi.

L'anello **più interno (indice 0)** non ha anello precedente: il suo incremento non
ha effetto. Nella UI il blocco Incremento è **nascosto** su quell'anello.

### Nome

`Ring.name?: string`. Alla creazione (da Tracciati) nasce `"Anello N"` con N =
posizione al momento della creazione. L'utente può sovrascriverlo. Campo Nome
**vuoto** → l'header mostra il fallback posizionale `"Anello {index+1}"`.

## UI — sidebar riorganizzata

Ordine sezioni top→bottom:

```
┌─ EDITOR (sezione "Anelli") ──────────────────────────────┐
│  ▾ PARAMETRI GLOBALI                          [collapse] │
│      Raggio base   [  5  ]    Copie curva   [  8  ]      │
│                                                          │
│  ▾ ANELLI                                     [collapse] │
│    (nessun pulsante "nuovo anello" — si crea da Tracciati)│
│                                                          │
│  ⠿  Anello 1              [▸]        ⧉   🗑             │  ← collassato
│  ⠿  Anello 2              [▾]        ⧉   🗑             │  ← espanso ↓
│       Nome:  [ Anello 2                     ]           │
│       FORMA  [ RingCanvas editor ]                      │
│       [Salva in libreria] [Carica] [Import SVG]         │
│       Altezza   ▓▓▓▓▓░░░░░  0.12                        │
│       Colore    ■ #000000        (solo mode "manual")   │
│       Incremento  ☑ Override  [  3  ]  (usa globale 2)  │  ← nascosto su ring index 0
│                                                          │
│  ⠿  Anello 3              [▸]        ⧉   🗑             │
│                                                          │
│  ▸ COLORI                                     [collapse] │  ← ColorsSection invariato
└──────────────────────────────────────────────────────────┘
```

### Azioni per anello (header collassato)

- **⠿ Trascina** — riordina (già esistente, `reorderRings`).
- **⧉ Duplica** — clona forma + colore + altezza + `incrementOverride` + nome, con
  **nuovo id**, inserito **subito dopo** l'originale.
- **🗑 Elimina** — già esistente (`removeRing`).

### Controllo override incremento (checkbox + numero)

```
☐ Override            → l'anello usa il globale (mostrato tra parentesi)
☑ Override  [  3  ]   → l'anello usa 3
```

Deselezionare la checkbox riporta `incrementOverride` a `null` (eredita globale).

## Componenti toccati

| File | Modifica |
| ---- | -------- |
| `src/lib/types.ts` | `Ring`: aggiungi `name?`, `incrementOverride?`, **rimuovi** `copies`. `Composition`: aggiungi `copies`. |
| `src/lib/state/default.ts` | `DEFAULT_COMPOSITION.copies = 8`. |
| `src/lib/state/composition.ts` | `DEFAULT_RING`/`addRingWithPath`: rimuovi `copies`, aggiungi `name`. Nuove funzioni: `setCopies`, `renameRing`, `duplicateRing`, `setRingIncrementOverride`. |
| `src/lib/state/composition-persistence.svelte.ts` | `normalizeComposition`: backfill `copies = c.copies ?? c.rings?.[0]?.copies ?? 8`; drop `copies` dai ring. |
| `src/lib/geometry/render-pipeline.ts` | raggio cumulativo (helper `computeRingRadii`); guardia `copies` da `composition.copies`. |
| `src/lib/geometry/bend.ts` | legge `composition.copies` (passato come parametro) invece di `ring.copies`. |
| `src/lib/components/SettingsSection.svelte` | aggiungi input **Copie curva** (globale). |
| `src/lib/components/RingEditor.svelte` | campo Nome; blocco Incremento (override); azione Duplica; **rimuovi** input Copies per-anello. |
| `src/routes/(app)/editor/+page.svelte` | **rimuovi** bottone `addRing`; empty-state resta. |
| Seams (`RingMorphConfigItem`, `RingWaveConfigItem`, `RingZoneConfigItem`, `RingMorphPreview`, `RingPreview`, `ApplyToRingSheet`, `LibraryPickerSheet`, `paths/+page.svelte`) | swap meccanico `ring.copies` → `composition.copies`. Nessun tocco alla logica. |

## Data flow

Config persistente (`composition`, localStorage) → geometria (`render-pipeline` →
`bend`) → canvas. `copies` e `baseRadius`/`ringIncrement` vengono letti da
`composition`; `incrementOverride`/`name` da ogni `Ring`. Nessun nuovo stato runtime.

## Testing

- **Geometria (node):** `computeRingRadii` — cumulativo senza override == formula
  piatta; override sposta sé e successivi; ring 0 sempre a `baseRadius`.
- **Stato (node):** `duplicateRing` (id nuovo, posizione, campi clonati);
  `renameRing`; `setRingIncrementOverride` (set + clear→null); `setCopies` globale;
  migrazione `normalizeComposition` (backfill copies, idempotente).
- **UI (browser `.svelte.spec.ts`):** blocco Incremento nascosto su ring 0; checkbox
  override toggle; nessun bottone "nuovo anello" nella sezione.
- Suite esistente resta verde dopo lo spostamento di `copies`.

## Rischi / note

- **Migrazione `copies`:** compositi salvati hanno `ring.copies` per-anello. Il
  backfill prende il primo ring (o 8). Se un utente aveva copie disuniformi tra anelli,
  collassano al valore globale — accettato: copies è per definizione globale ora.
- **Rischio visivo:** il raggio cumulativo è retrocompatibile a override nulli, ma va
  fatto un **check visivo** (`/editor` + canvas) dopo il cambio geometria.
- `src/lib/paraglide` è gitignored (rigenerato da `npm run paraglide`); nuove chiavi
  `m.*` (nome, copie, incremento override, duplica) vanno aggiunte alle sorgenti
  messaggi e rigenerate.
