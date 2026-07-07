# Design — Dal Tracciato all'Anello: applicare una curva a un anello

**Data:** 2026-07-07
**Stato:** approvato (design), pronto per implementation plan
**Relazione:** completa il collegamento curve → Editor lasciato **fuori scope** dal v2 di Tracciati (`2026-06-25-sezione-tracciati-v2-design.md`, sezione "Fuori scope"). Wira componenti e azioni già costruiti in anticipo (`addRingWithPath`, `ApplyToRingSheet`) ma finora non referenziati.

## Motivazione

Fino a ora Tracciati è una **libreria pura**: selezioni una curva, la vedi in preview, fine. Non c'è modo di portarla su un anello. Questa PR aggiunge quel ponte e, con esso, cambia **come nasce un anello**:

- L'app parte con **un solo anello** seminato sulla curva di default (non più una composizione vuota, né un marchio precostruito a più anelli).
- Da Tracciati, scelta una curva, l'utente decide se **sostituire** la curva di un anello esistente o **creare un nuovo anello** con quella curva.

Si cambia solo la **genesi geometrica** dell'anello (la sua `templatePath`). Non si tocca come l'anello viene animato: `wave`, `zoneDrive`, morph e curva secondaria restano invariati.

## Confine esplicito: primaria sì, secondaria mai (qui)

In Tracciati una curva si applica **sempre e solo alla curva primaria** (`templatePath`) dell'anello. Non esiste, in questa sezione, il concetto di "curva secondaria" né di "slot".

La curva secondaria è esclusivamente una nozione della **modalità morph in Animate**, che verrà gestita in una PR successiva. Sarà lì che l'utente sceglierà la curva target del morph — pescandola tra quelle di Tracciati o disegnandone una nuova — e sempre lì. Di conseguenza `ApplyToRingSheet` perde ogni UI relativa agli slot (primaria/secondaria/entrambe): applicare = sostituire la primaria, punto.

## Comportamento

### Stato iniziale (composizione di default)

`DEFAULT_COMPOSITION.rings` passa da `[]` a **un singolo anello** seminato sull'arco di default (lo stesso `templatePath` oggi definito da `DEFAULT_RING` in `composition.ts`), con `copies: 8`, `morphT: 0`, nessuna secondaria.

Questo tocca solo lo **stato fresco**: un utente con `localStorage` già popolato mantiene i propri anelli (il seed è il valore iniziale prima dell'idratazione da `localStorage`).

### Flusso di applicazione (Tracciati)

```
TRACCIATI (/paths)
  sidebar: lista curve (base + mie)      main: RingPreview curva selezionata
                                               [ Usa questa curva ]  ← entry point
                                                      │ click
                                                      ▼
  SHEET (destra) — "Applica <nome curva>"
    Scegli il bersaglio:
      ( ) Anello 1        [RingPreview: curva, copie/raggio di Anello 1]
      (●) Anello 2        [RingPreview: curva, copie/raggio di Anello 2]
      ( ) + Nuovo anello  [RingPreview: curva, copie/raggio default]
                                              [ Annulla ]  [ Applica ]
                                                      │ confirm
             ┌────────────────────────────────────────┴─────────────────────┐
   bersaglio = Anello N                              bersaglio = Nuovo
   updateRingPathVariant(N,'primary',curva)          addRingWithPath(curva)
   → SOSTITUISCE templatePath di N                   → APPENDE nuovo anello
     (copies/colore/altezza invariati)                 (curva primaria, morphT 0)
             └────────────────────────────────────────┬─────────────────────┘
                                                       ▼
                 sheet si chiude; utente resta su /paths; anello aggiornato/creato
```

- **Entry point:** un solo bottone `Usa questa curva` sotto la `RingPreview` grande nell'area principale di `/paths`. Nessun bottone per-riga nella sidebar (coerente con la scelta v2 di togliere i per-riga).
- **Bersagli:** radio-list. Una voce per anello esistente (etichetta `Ring {index}` via `m.editor_ring_label`), più una voce finale `+ Nuovo anello`.
- **Preview per bersaglio:** ogni riga mostra una `RingPreview` della **curva scelta** renderizzata con le impostazioni **reali** del bersaglio — per un anello esistente le sue `copies` (e `baseRadius`/`ringIncrement` della composizione); per `+ Nuovo anello`, i default (`copies: 8`). Così la decisione si prende vedendo il risultato vero.
- **Conferma:** `Applica` esegue l'azione sul bersaglio selezionato, chiude lo sheet, lascia l'utente su `/paths`.
- **Post-condizione:** nessuna navigazione automatica, nessun toast richiesto.

## Azioni di stato (già esistenti, da wirare)

Entrambe vivono già in `src/lib/state/composition.ts` e sono i confini di mutazione sanciti:

- **Nuovo anello:** `addRingWithPath(path)` — appende un anello con `path` come primaria, `secondaryTemplatePath: null`, `morphT: 0`, `copies: 8`. (Firma già presente; il parametro `secondaryPath` opzionale resta ma **non** viene usato da questo flusso.)
- **Sostituzione su esistente:** `updateRingPathVariant(index, 'primary', clonePath(curva))` — sostituisce la `templatePath` dell'anello, preservando `copies`/`color`/`ringHeight`. Ritorna `{ ok: true } | { ok: false, reason }`; in questo flusso, applicare una primaria non fallisce mai (il ramo `primary` non rigetta), quindi l'errore non ha una UI dedicata — se `ok` è `false` per un `index` fuori range, si ignora senza mutare.

Nessuna nuova azione di stato è necessaria.

## Componenti

### Modifica — `src/lib/components/ApplyToRingSheet.svelte`

Da "dropdown anello + radio slot" a "radio-list bersagli con preview":

- **Props:** `open` (bindable), `entry: PathLibraryEntry | null`, `rings: Ring[]`, `onapply: (target: ApplyTarget) => void`.
- **Nuovo tipo** `ApplyTarget = { kind: 'existing'; index: number } | { kind: 'new' }` (definito nel componente o in `state/path-library.ts` accanto ad `ApplySlot`).
- **Rimozione:** `slot`/`slotRaw`/`ApplySlot`, la `<fieldset>` degli slot, e il vecchio `<select>` degli anelli.
- **UI:** una radio-list. Prima N righe (una per `rings[i]`, keyed su `ring.id`), poi una riga `+ Nuovo anello`. Selezione di default: prima riga esistente se ci sono anelli, altrimenti `new`. Ogni riga ospita una `RingPreview` piccola (es. `size={72}`) della curva `entry` con:
  - per un anello esistente: `copies={ring.copies}`;
  - per `+ Nuovo anello`: `copies` di default (8);
  - in entrambi i casi `baseRadius`/`ringIncrement` dalla composizione (letti come oggi da `LibraryPickerSheet` via `import { composition }`, oppure passati come prop per testabilità — vedi Test).
- **Guardia stale:** come oggi, se il bersaglio selezionato è un `index` fuori range dopo che `rings` si è ristretto sotto lo sheet aperto, `confirm` non chiama `onapply`.
- **Reset alla chiusura:** al passaggio `open → false`, la selezione torna al default.
- **Testid:** mantenere/adeguare testid stabili (`apply-confirm`; nuovi per le righe bersaglio, es. `apply-target-existing-{i}`, `apply-target-new`).

### Modifica — `src/routes/paths/+page.svelte`

- Importa `ApplyToRingSheet`, `composition` (già importato), e le azioni `updateRingPathVariant`, `addRingWithPath` da `$lib/state/composition`.
- Stato locale `applyOpen = $state(false)`.
- Sotto la `RingPreview` grande (dentro `tracciati-preview`), un `Button` **"Usa questa curva"** (`data-testid="tracciati-apply"`), abilitato quando `selected` non è null, che apre lo sheet.
- Handler `onapply(target)`:
  - `target.kind === 'new'` → `addRingWithPath(selected.path)`;
  - `target.kind === 'existing'` → `updateRingPathVariant(target.index, 'primary', selected.path)` (clonando il path; `updateRingPathVariant` già clona sul ramo di reseed, ma passiamo una copia per non condividere riferimenti con la libreria).
- `ApplyToRingSheet` reso con `bind:open={applyOpen}`, `entry={selected}`, `rings={composition.rings}`, `onapply`.

### Modifica — `src/lib/state/default.ts`

- `rings: []` → `rings: [ { id: '<id-fisso>', copies: 8, color: '#000000', templatePath: <arco default>, secondaryTemplatePath: null, morphT: 0, ringHeight: 0.12 } ]`.
- L'arco di default oggi è duplicato nel letterale `DEFAULT_RING` in `composition.ts`. Estrarlo in una costante condivisa (es. `DEFAULT_RING_PATH` esportata da `default.ts` o da un piccolo modulo geometrie) e riusarla sia in `DEFAULT_COMPOSITION` sia in `DEFAULT_RING`, per non tenere due copie che divergono. L'`id` del ring seed è un letterale stabile (es. `'ring-default'`); `ensureRingIds` comunque lo lascerebbe passare.

### Riuso — `RingPreview.svelte`

Nessuna modifica. Usato as-is nello sheet per le preview per-bersaglio (accetta già `path`, `copies`, `baseRadius`, `ringIncrement`, `size`).

### Invariato — `LibraryPickerSheet.svelte`

Resta il flusso inverso "carica dalla libreria" dentro `RingEditor` (Editor). Non toccato.

## i18n

`messages/{en,it}.json`:

- **Aggiorna** `apply_title` / `apply_desc` per riflettere "scegli bersaglio" senza slot (es. title "Applica curva", desc "Scegli l'anello da aggiornare o crea un nuovo anello.").
- **Nuova** chiave `apply_target_new` (es. "Nuovo anello" / "New ring").
- **Nuova** chiave per l'etichetta del bottone in Tracciati, es. `tracciati_apply` ("Usa questa curva" / "Use this curve").
- **Rimuovi** le chiavi diventate orfane dopo il taglio degli slot (`slot_primary`/`slot_secondary`/`slot_both`, `common_slot`) **solo se** un grep conferma che non sono più usate altrove (LibraryPickerSheet le usa ancora → probabilmente **restano**; verificare, rimuovere solo gli orfani reali).

## Test

- **`ApplyToRingSheet.svelte.spec.ts` (riscrittura):**
  - elenca una riga per anello + la riga `+ Nuovo anello`;
  - `confirm` su un anello esistente chiama `onapply({ kind: 'existing', index })` con l'indice scelto;
  - `confirm` su `+ Nuovo anello` chiama `onapply({ kind: 'new' })`;
  - non chiama `onapply` se l'`index` esistente selezionato va fuori range dopo che `rings` si restringe (guardia stale, adattata dall'attuale test);
  - ogni riga rende una `RingPreview` (presenza del canvas/preview per riga).
  - Per testabilità senza dipendere dal singleton `composition`, valutare di passare `baseRadius`/`ringIncrement` come prop dello sheet (default dalla composizione) — decisione dell'implementazione, purché i test restino deterministici.
- **Seed default:** un test che verifica `DEFAULT_COMPOSITION.rings.length === 1` e che la sua `templatePath` è l'arco default con `morphT: 0`, `secondaryTemplatePath: null`.
- **`paths/+page.svelte`:** se esiste già copertura e2e/unit della pagina, aggiungere che il bottone "Usa questa curva" apre lo sheet; l'apply su "nuovo" incrementa `composition.rings`, l'apply su esistente ne sostituisce la `templatePath` senza cambiarne `copies`.
- Suite verde: `npm run test:unit -- --run`, `npm run check`, `npm run lint`.

## Fuori scope

- **Morph / curva secondaria / target del morph:** interamente Animate, PR successiva.
- **LibraryPickerSheet e flusso Editor "carica dalla libreria":** invariati.
- **Kaleidoscopio, editing morph (`RingMorphConfigItem`, `createRingMorphTarget`):** cuciture temporanee, non toccate.
- **Navigazione o toast post-apply:** nessuno.

## Criteri di successo

- Da stato fresco l'app apre con **un** anello sull'arco default (non zero, non quattro).
- In Tracciati, selezionata una curva, "Usa questa curva" apre lo sheet dei bersagli.
- Lo sheet elenca gli anelli esistenti + "Nuovo anello", ciascuno con una preview alle impostazioni reali del bersaglio.
- Applica su esistente **sostituisce** la sola primaria (copies/colore/altezza invariati); applica su nuovo **appende** un anello con quella primaria.
- Nessun riferimento a slot/secondaria compare in Tracciati; `wave`/`zoneDrive`/morph seam non toccati.
- Nessun riferimento morto dopo il taglio degli slot in `ApplyToRingSheet`; type-check, lint e suite verdi.
