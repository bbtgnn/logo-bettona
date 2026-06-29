# Design v2 — Tracciati come libreria nella sidebar + cornice globale

**Data:** 2026-06-25
**Stato:** approvato (design), pronto per implementation plan
**Relazione:** semplificazione del v1 (`2026-06-25-sezione-tracciati-design.md`). Sostituisce l'interazione a griglia del v1 con una libreria nella sidebar e introduce una nuova cornice globale (nav nella sidebar).

## Motivazione

Il v1 ha troppi passaggi (griglia → hover-card → popover → scelta Usa/Edita → sidebar di editing). Si semplifica: tutto avviene nella **sidebar**, il canvas mostra solo la **preview**, e Tracciati diventa una **libreria pura** di curve. Il collegamento curve→Editor (applicare una curva a un anello) è **fuori scope**, lo svilupperemo dopo.

## Cornice globale (tutte le sezioni)

Cambia la "cornice" condivisa da Tracciati, Editor e Animazione (opzione B concordata). Le funzionalità interne di Editor/Animazione **non si toccano**: cambia solo dove vive la navigazione e cosa contiene l'header.

- **Nav = segmented control a pillole** (stile Affinity): container scuro arrotondato con una pillola per sezione (icona + label); la sezione attiva è una pillola piena colorata, le altre sono in grigio muto. Posizionata **in cima alla sidebar** di ogni sezione.
- **Header ridotto**: resta il trigger della sidebar (a sinistra) e, a destra, **solo** lo switch lingua e il link About. La nav esce dall'header.
- Il segmented control è **un solo componente condiviso**, reso in cima al contenuto della sidebar sia nel layout `src/routes/(app)/+layout.svelte` (Editor/Animazione) sia nella pagina `src/routes/paths/+page.svelte`.

## Sezione Tracciati = libreria pura

Il canvas (area principale) mostra **solo la preview** della curva selezionata sull'anello. Niente griglia, niente contatore anelli, niente "Vai all'editor", niente applicazione ad anelli. La sidebar contiene due **accordion** (a tendina, apribili verso il basso):

### #1 — Curve di base
- Le 10 curve `builtin` esistenti, **permanenti**.
- Ogni voce: miniatura + nome; selezionabile → aggiorna la preview nel canvas.
- **Non editabili, non rinominabili, non eliminabili.**

### #2 — Curve personalizzate
- Parte **vuota**. In cima un bottone **"Crea curva"** che crea una nuova personalizzata partendo da un **arco semplice** (curva di seed predefinita).
- Ogni curva personalizzata è una riga **espandibile**. Espansa mostra:
  - **Nome** in un campo inline, che salva live (rinomina).
  - Icone **Duplica** e **Elimina** (l'elimina chiede una micro-conferma inline prima di rimuovere).
  - Un **sotto-accordion "Editor punti"** che ospita `RingCanvas` (lo stesso editor a nodi, **senza importa-SVG**); ogni modifica dei punti salva live sulla curva.
- Selezionare/espandere una personalizzata la rende l'elemento mostrato nel canvas.

### Comportamenti
- I due accordion di gruppo e i sotto-accordion "Editor punti" sono a **toggle indipendenti** (più di uno può restare aperto).
- La preview nel canvas si aggiorna **live** durante l'editing: il canvas legge la curva selezionata **per id** dalla libreria (non un oggetto catturato), così le modifiche immutabili di `updateEntryPath` si riflettono subito ed evitano il bug dello "stale path" già emerso nel v1.

## Modello dati

Si riusa la base del v1: `pathLibrary` (localStorage), `PathLibraryEntry`, `BUILTIN_CURVES`, `seedBuiltinCurves` (idempotente), `duplicateEntry`, `renameEntry`, `removeEntry`, `updateEntryPath`.

Nuovo:
- **`createCurveFromArc()`** (in `path-library.ts`): crea e salva una nuova entry utente (non builtin) con un path = arco di seed predefinito, nome di default tipo `Nuova curva N`, e la restituisce. L'arco di seed è una curva semplice nello stesso spazio di coordinate delle altre (definita come costante nel modulo).

Selezione:
- La pagina mantiene un `selectedId` (id di una curva, base o personalizzata) che pilota la preview. La curva selezionata si risolve **live** da `pathLibrary` per id.

## Componenti

- **Nuovo** `SidebarNav.svelte` — il segmented control a pillole con le 3 sezioni (icone phosphor: una per Tracciati, Editor, Animazione; finalizzate in implementazione). Reso in cima alla sidebar nei due layout.
- **Nuovo** `CurveListItem.svelte` (o equivalente) — riga di una curva nell'accordion: miniatura + nome; per le personalizzate aggiunge nome editabile, duplica, elimina-con-conferma, e il sotto-accordion "Editor punti" con `RingCanvas`.
- **Riscrittura** `src/routes/paths/+page.svelte` — sidebar con `SidebarNav` + due accordion (base/personalizzate) + bottone "Crea curva"; canvas con `RingPreview` della curva selezionata.
- **Modifica** `src/routes/(app)/+layout.svelte` — `SidebarNav` in cima alla sidebar; header ridotto a trigger + lang + About (rimozione di `WorkspaceNav` dall'header).
- **Riuso**: `RingCanvas` (editor punti), `RingPreview` (anello), `PathThumbnail` (miniature), shadcn `Collapsible`/`Sidebar`/`Button`/`Input`.

## Pulizia del v1 (rimozioni)

Componenti e UI del v1 ora superati, da rimuovere assieme ai loro test:
- `CurveCard.svelte` (hover-card + popover Usa/Edita) e relativo spec.
- `CurveEditorPanel.svelte` (focus editor con Annulla/Fatto che aggiungeva un anello) e relativo spec.
- Il componente shadcn **`popover`** se non risulta usato altrove dopo la rimozione (verificare con grep; rimuovere solo se orfano).
- Nella pagina: griglia, gruppi a card, contatore anelli (`tracciati-ring-count`), "Vai all'editor", flusso "Usa"/`addRingWithPath` (la funzione `addRingWithPath` **resta** in `composition.ts` per il porting futuro, ma non è più referenziata dalla pagina).

`WorkspaceNav.svelte` viene sostituito da `SidebarNav.svelte`; rimuoverlo se non più referenziato (e aggiornare/spostare i suoi test al nuovo componente).

## Fuori scope

- Collegamento curve → Editor (applicare una curva a un anello): sviluppato dopo.
- Funzionalità interne di Editor e Animazione: invariate (cambia solo la cornice).
- Importa-SVG: il nuovo editor non lo include (riusa `RingCanvas`); resta nell'Editor (`RingEditor`).

## Criteri di successo

- Tutte le sezioni mostrano la nav come segmented control a pillole in cima alla sidebar; l'header ha solo lang + About (oltre al trigger sidebar).
- Tracciati: canvas = preview della curva selezionata; sidebar con i due accordion.
- "Curve di base": 10 builtin permanenti, selezionabili, non modificabili.
- "Curve personalizzate": "Crea curva" genera una curva da arco; le personalizzate si rinominano, duplicano, eliminano (con conferma); l'editor punti vive nel sotto-accordion e salva live; la preview è live.
- Le builtin non sono mai modificabili/eliminabili in place.
- I componenti del v1 rimossi non lasciano riferimenti morti; suite e type-check verdi.
