# Design — Ristrutturazione sezione Tracciati

**Data:** 2026-06-25
**Stato:** approvato (design), pronto per implementation plan
**Scope:** solo la sezione Tracciati (`/paths`). Editor e Animazione restano invariati in questo intervento.

## Contesto e motivazione

Il tool si è evoluto introducendo molte dinamiche che possono disorientare. Si rivede la UI per sezioni, partendo dai **Tracciati**.

Oggi la sezione Tracciati (`src/routes/paths/+page.svelte`) è una "libreria" nascosta di preset: una sidebar a sinistra elenca i tracciati salvati, il click ne mostra un'anteprima grande al centro e un bottone "Applica all'anello". Il concetto di curva `builtin` (protetta da rinomina/cancellazione) esiste già nel codice (`PathLibraryEntry.builtin`), ma **nessuna curva default è popolata**: `pathLibrary` parte vuoto.

Il pannello di editing dei punti riusabile è `RingCanvas` (montato dentro `RingEditor`). L'**importa-SVG** vive nel wrapper `RingEditor`/`RingMorphConfigItem`, non in `RingCanvas`.

## Obiettivo

Trasformare i Tracciati nella **prima schermata** che l'utente vede: il punto di partenza dove sceglie le curve da cui nasce il logo. Da libreria passiva a costruttore esplicito.

## Flusso utente

1. **Atterraggio** su Tracciati con logo **vuoto** (zero anelli).
2. **Griglia** centrale a tutta larghezza con due gruppi:
   - **Curve di default** — 10 curve protette (`builtin`).
   - **Le mie curve** — varianti dell'utente, rinominabili e cancellabili.
3. **Hover** su una card → hover-card flottante con anteprima della curva **montata sull'anello**.
4. **Click** su una card → popover ancorato alla card: anteprima + due bottoni **"Usa"** e **"Edita"**.
5. **Ramo "Usa"** → aggiunge un anello con quella curva (default intatta). L'utente **resta in Tracciati**; un contatore mostra "N anelli". Può continuare a scegliere curve. Un bottone **"Vai all'editor"** porta alla sezione Editor quando il set è pronto.
6. **Ramo "Edita"**:
   - La curva default viene **duplicata**; la copia nasce **subito** come card salvata in "Le mie curve" (l'originale resta intatta).
   - Si apre la **sidebar editor a sinistra**: pannello a punti (`RingCanvas`), **senza importa-SVG**, più campo nome della curva.
   - Al **centro** (dove stava la griglia) compare l'**anteprima live** della curva sull'anello, aggiornata durante l'editing.
   - Le modifiche si **salvano live** sulla card.
   - **"Annulla"/indietro** → ritorno alla griglia; la card resta (anche a metà), cancellabile in seguito. Nessuno stato transitorio non committato.
   - **"Fatto"** → aggiunge un anello con la curva editata e ritorna alla griglia (stesso esito del ramo "Usa").

## Decisioni di layout (validate con mockup)

- **Griglia + anteprima:** griglia a tutta larghezza, anteprima su **hover-card flottante** (non palco fisso).
- **Scelta Usa/Edita:** **popover ancorato** alla card cliccata (non dialog centrale).
- **Editing:** sidebar editor a sinistra in **focus**; al posto della griglia, **anteprima live al centro** (non semplice oscuramento della griglia).
- **Uscita dall'editing:** la copia è persistita dalla creazione; "Annulla" non scarta nulla, la bozza resta in "Le mie curve".

## Modello dati

Si riusa `pathLibrary` (`src/lib/state/path-library.ts`, persistito in localStorage) e `PathLibraryEntry`:

- Le **10 curve default** sono entry con `builtin: true`, derivate dalle 4 curve presenti in `default.ts` (`ring-default-0..3`, ciascuna con `templatePath` + `secondaryTemplatePath`) più **6 variazioni** (scala, rotazione, ampiezza onda, marcatura delle punte).
- **Seeding idempotente:** alla prima apertura (e se mancano) le 10 builtin vengono inserite nella libreria; non vengono duplicate se già presenti. Le entry utente non vengono toccate.
- Le **varianti utente** sono entry normali (`builtin` assente/false), già coperte da `saveEntry`/`renameEntry`/`removeEntry`.
- Editare una default **duplica sempre** in una nuova entry utente; le `builtin` non si modificano in place.

## Componenti coinvolti

- `src/routes/paths/+page.svelte` — riscrittura del layout: da sidebar-lista a griglia + interazioni hover/popover; gestione dei due rami e della sidebar di editing.
- `RingCanvas` — riusato come editor a punti (nessuna modifica di funzione; usato senza il contorno di importa-SVG).
- `RingPreview` / `PathThumbnail` — riusati per anteprima sull'anello e miniature delle card.
- `path-library.ts` — aggiunta del seeding delle 10 builtin + helper per duplicare una default in entry utente.
- `WorkspaceNav` + routing — Tracciati diventa la voce/route di atterraggio.

## Effetti a catena noti

1. **Logo vuoto all'avvio.** Oggi `DEFAULT_COMPOSITION` nasce con 4 anelli. Renderla vuota tocca uno stato **condiviso** con Editor e Animazione: anche quelle sezioni partiranno senza anelli. È coerente col nuovo flusso (gli anelli si creano dai Tracciati), ma va gestito con attenzione e verificato contro i test esistenti di composizione/editor/animazione.
2. **Seeding delle default.** Le 10 curve vanno generate una volta e ripristinate se mancano, senza intaccare le curve dell'utente.

## Fuori scope

- Sezioni Editor e Animazione (incluso l'importa-SVG nel loro `RingEditor`): invariate.
- Rimozione globale dell'importa-SVG: il nuovo editor dei Tracciati semplicemente non lo include (riusa `RingCanvas`, che non lo ha).

## Criteri di successo

- All'apertura il tool mostra i Tracciati come prima schermata, con 10 curve default in griglia e logo vuoto.
- Hover mostra l'anteprima sull'anello; click offre Usa/Edita.
- "Usa" aggiunge un anello e aggiorna il contatore restando in Tracciati; "Vai all'editor" naviga all'Editor.
- "Edita" duplica la default, apre la sidebar a punti con anteprima live, salva live; "Annulla" conserva la bozza; "Fatto" aggiunge l'anello.
- Le curve default non sono mai modificabili/cancellabili in place.
- I test esistenti restano verdi o vengono aggiornati coerentemente all'avvio "logo vuoto".
