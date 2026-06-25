# Report tecnico — Sistema Timeline & Animazione (logo-bettona)

> Stato del codice analizzato su ramo `feat/kaleidoscope`. Riferimenti `file:riga`. Linguaggio: SvelteKit + Svelte 5 runes, TypeScript, paper.js.

## 0. Architettura in una frase

Esistono **due meccanismi di animazione paralleli che condividono un'unica testina temporale** (`animationState.progress` ∈ [0,1], il CTI):

- **A) Keyframe tracks** — sistema dichiarativo per-proprietà (`sampleParam` → `applyKeyframes`). Usato per kaleidoscope, config audio, wave per-anello.
- **B) Driver procedurali** — `runtime` con driver intercambiabili (`simple`/`audioBars`/`audioZones`/`dataSeries`) che ogni frame producono valori per-anello (es. il morphT del morph).

Entrambi sono pilotati dallo stesso loop `tick()` (`animation.svelte.ts:354`).

---

## 1. Data Structure dello Stato

### 1.1 Layers (livelli)
I livelli **non sono clip temporali**: sono semplici flag booleani globali.

```ts
// animation.svelte.ts:32
type AnimationLayer = 'simple' | 'audioBars' | 'audioZones' | 'dataSeries' | 'kaleidoscope';
type AnimationLayers = Record<AnimationLayer, boolean>;
```

Semantica dei layer (non uniforme — punto debole, vedi §4):
- `simple`, `audioBars`, `audioZones` → veri **driver** registrati nel runtime.
- `kaleidoscope` → **non è un driver**: fa solo da gate booleano su quali keyframe applicare (`applyKeyframes`, `animation.svelte.ts:308`).
- `dataSeries` → **placeholder**: il driver esiste ma non viene mai attivato (`setLayerEnabled` lo salta, `:453`).

`AnimationState` (`animation.svelte.ts:37-51`) contiene anche: `progress` (CTI), `durationSec`, `fps`, `loop`, `alternate`, `elapsedMs`, config audio/dataSeries, `audioSource`.

### 1.2 Proprietà animabili (AnimatableParam)
Interfaccia uniforme get/set con bounds — non contiene tempo, solo il "binding" al valore di stato:

```ts
// animatable-params.ts:8
type AnimatableParam = {
	id: string;        // es. 'kaleidoscope.globalRotation', 'audioBars.inputGain'
	label: string;
	min: number; max: number; step: number;
	get(): number;
	set(v: number): void;
};
```

Registri uniti da `getAllAnimatableParams()` (`animation.svelte.ts:281`): `KALEIDO_PARAMS` + `AUDIO_BARS_PARAMS` + `AUDIO_ZONES_PARAMS` + wave per-anello (ricostruiti a ogni chiamata da `composition.rings`, così seguono add/remove anelli senza indici stale). **Nota:** il `morphT` per-anello **non** è un AnimatableParam — è guidato solo dal driver `simple`, quindi non è keyframabile (vedi §4).

### 1.3 Keyframe e Track
```ts
// animation/keyframes.ts:1-15
type Interp = 'linear' | 'bezier' | 'hold';
type Handle = { dx: number; dy: number };      // bezier, normalizzato sullo span del segmento
type Keyframe = {
	id: string;
	time: number;        // NORMALIZZATO 0..1 (clamp01), NON secondi
	value: number;
	interp: Interp;
	handleOut: Handle;   // tangente uscente (verso il kf successivo)
	handleIn: Handle;    // tangente entrante (dal kf precedente)
};
type Track = { paramId: string; enabled: boolean; keyframes: Keyframe[] };
```

Esempio reale di un keyframe salvato (default easy-ease, `keyframes.svelte.ts:53` + `keyframes.ts:17-18`):
```json
{
  "id": "9b1c…-uuid",
  "time": 0.5,
  "value": 120,
  "interp": "linear",
  "handleOut": { "dx": 0.3333, "dy": 0 },
  "handleIn":  { "dx": -0.3333, "dy": 0 }
}
```

**Storage:** lo stato tracce è `{ tracks: Record<paramId, Track> }` (`keyframes.svelte.ts:20-22`), persistito in `localStorage` via rune-sync, chiave `'kaleidoscope-keyframes'` (`:17`, nome legacy) attraverso un `$effect.root` con diff su snapshot (`:106-125`). Solo i keyframe sono persistiti — non i layer né la config animazione.

**Punto chiave di design:** `time` è **normalizzato 0..1**, non in secondi → cambiare `durationSec` non rompe né rimappa i keyframe (la conversione a secondi è solo display: `time * durationSec`).

---

## 2. Motore di Animazione (Interpolazione)

### 2.1 Dove si calcola il valore corrente
File puro, senza stato: **`src/lib/animation/keyframes.ts`**. Funzione di ingresso `sampleTrack(track, t)` (`:81`), con `t` = progress del CTI ∈ [0,1].

Pipeline di campionamento:
1. Ordina i keyframe per `time` (`sortKeyframes`).
2. 0 kf → `null` (la traccia non interviene, resta il valore statico dello slider). 1 kf → quel valore.
3. **Edge clamp:** sopra l'ultimo `time` → ultimo valore; sotto il primo → primo valore (nessuna estrapolazione). L'edge superiore è controllato per primo, così keyframe a tempo uguale risolvono al valore **successivo** (`:85-88`).
4. Trova il segmento `[a,b]` con `a.time ≤ t ≤ b.time` → `sampleSegment(a,b,t)`.

### 2.2 Tipi di interpolazione supportati
In `sampleSegment` (`keyframes.ts:73`), governati dall'`interp` del keyframe **a sinistra** del segmento:

- **`hold`** (step): `t ≥ b.time ? b.value : a.value` — costante fino al kf successivo.
- **`linear`**: `lerp(a.value, b.value, u)` con `u = (t-a.time)/span`.
- **`bezier`**: `sampleBezierSegment` (`:38`) — Bézier cubico in spazio (tempo, valore). I punti di controllo X/Y sono derivati dalle tangenti `handleOut` di `a` e `handleIn` di `b`, scalati sullo span. Poiché X non è lineare in `u`, risolve `X(u)=t` per **bisezione** (40 iterazioni, `:63-69`) sfruttando la monotonìa garantita dai clamp `outDx∈[0,1]`, `inDx∈[-1,0]`; poi valuta `Y(u)`. È il modello stile After Effects (handle = frazioni dello span).

Non esistono preset di easing nominati (easeInOut, ecc.): l'easing si esprime solo via handle Bézier. Default di un nuovo keyframe = `EASY_EASE` (`dx=±1/3, dy=0`).

### 2.3 Integrazione col clock / CTI
Loop rAF in `animation.svelte.ts`:
- `tick(nowMs)` (`:354`) accumula `logicalElapsedMs` → `getProgressFromElapsed` (`:333`) converte in `progress` con gestione `loop` (wrap) e `alternate` (onda triangolare), poi:
  - `runtime.tick()` → driver procedurali (B),
  - `applyKeyframes(progress)` (`:305`) → per ogni AnimatableParam fa `keyframes.sampleParam(id, progress)` e, se non `null`, `param.set(v)`,
  - aggiorna `animationState.progress`.
- **Scrubbing** (CTI manuale): `scrubTo(progress)` (`:318`) = `clamp01` + `applyKeyframes`. `refreshPreview()` (`:328`) ri-applica solo se in pausa.

`fps` è **solo display** (timecode `m:ss:ff`): il campionamento è continuo, non quantizzato a frame; lo snap a frame avviene solo nello scrub con Shift (`snapProgressToFps`, `timeline-geometry.ts:29`).

---

## 3. Logica della Timeline (UI)

Helper geometrici puri in **`timeline-geometry.ts`**: `xFromTime`/`timeFromX` (normalizzato↔px, con `clamp01`), `yFromValue`/`valueFromY` (asse valore del grafico), `snapProgressToFps`, `formatTimecode`/`parseTimecode` (`m:ss:ff`).

### 3.1 Drag della testina (CTI)
`TimelinePanel.svelte`:
- Handle del playhead: `onPlayheadPointerDown/Move/Up` (`:127-145`) usano pointer capture; `playheadTimeFromClientX` (`:121`) converte la X rispetto alla **colonna delle lane** (stessa colonna che misurano righello e tracce → registro coerente) via `timeFromX`, poi `scrubTo`. Shift → `snapProgressToFps`.
- Il righello stesso fa da area di scrub.
- Campo timecode editabile: `commitTime` → `parseTimecode(buffer, fps)` → clamp → `scrubTo` (salto-a-tempo).

### 3.2 Spostamento dei keyframe
Due viste:
- **Lane tracce** (`TimelineTrack.svelte`): diamanti trascinabili. `onDiamondDown/Move/Up` (`:46-70`) con pointer capture; il move chiama `keyframes.moveKeyframe(paramId, id, { time: timeFromX(...) })` — **solo orizzontale (tempo)**. Doppio click sulla lane → `addKeyframe` al punto X; bottone `+` → `addAtPlayhead` (al CTI).
- **Graph editor** (`KeyframeGraphEditor.svelte`): drag 2D. `onMove` (`:55`) con `dragKind='point'` → `moveKeyframe({ time, value })` (tempo+valore); con `dragKind='handle'` → `setKeyframeHandle(..., 'out', { dx, dy })` (tangente Bézier).

Mutazioni di stato in `keyframes.svelte.ts`: `addKeyframe`/`moveKeyframe`/`deleteKeyframe`/`setKeyframeInterp`/`setKeyframeHandle`/`upsertKeyframeAtTime`, tutte con `clamp01` sul tempo e `resort` per mantenere l'ordine.

### 3.3 Ridimensionamento / taglio (trimming) dei livelli
**Non esiste.** Nessun concetto di clip, in/out point, offset, o range temporale per-layer o per-traccia. Ricerca esplicita: nessun `trim/clipStart/clipEnd/inPoint/outPoint/timeRange` nel dominio timeline. Conseguenze:
- ogni traccia copre sempre l'intero 0..1;
- la durata è unica e globale (`durationSec`);
- i layer si accendono/spengono ma non si possono accorciare, spostare nel tempo o spezzare in più clip.

È il **limite architetturale principale** rispetto a una timeline NLE/AE.

---

## 4. Punti di forza e limiti

### Punti di forza
- **Separazione netta dei livelli**: math pura e testata (`keyframes.ts`, `timeline-geometry.ts`) ↔ stato reattivo (`keyframes.svelte.ts`) ↔ orchestrazione (`animation.svelte.ts`) ↔ driver (`runtime.ts` + driver singoli). Ogni file ha una responsabilità.
- **Modello driver a plugin**: `registerDriver`/`setActive`/`tick` (`runtime.ts`) estensibile, con lifecycle `init`/`dispose` ben definito.
- **Tempo normalizzato 0..1**: disaccoppia i keyframe dalla durata; cambiare `durationSec` non li corrompe.
- **Bézier corretto stile AE**: handle come frazioni dello span + solve monotono di `X(u)=t` per bisezione (no artefatti di parametrizzazione).
- **Edge handling esplicito** (clamp ai bordi, regola tempi-uguali→valore successivo) documentato e testato.
- **Persistenza keyframe** automatica con diff su snapshot (no scritture inutili).

### Limiti attuali
1. **Nessun trimming/clipping/offset temporale** di layer o tracce (vedi §3.3). Niente in/out point, niente clip multipli, niente ripetizioni locali.
2. **Layer eterogenei**: `simple/audioBars/audioZones` sono driver, `kaleidoscope` è solo un gate, `dataSeries` è un placeholder mai attivato. Il concetto di "layer" non è uniforme.
3. **`morphT` non keyframabile**: il morph per-anello è guidato solo dal driver `simple` (rampa lineare 0→1); non è esposto come AnimatableParam, quindi non si può curvare/keyframare come gli altri parametri. Possibile fonte di confusione.
4. **Handle Bézier parziale**: la UI grafica trascina solo l'handle **out** (`KeyframeGraphEditor onMove → 'out'`); `handleIn` esiste nel modello ma non è editabile indipendentemente → controllo di easing asimmetrico.
5. **Drag in lane solo sul tempo**: il valore si modifica solo nel graph editor. Nessun multi-select, box-select, copy/paste, o snap dei keyframe a griglia/CTI.
6. **fps solo cosmetico**: campionamento continuo, non quantizzato a frame (snap solo con Shift in scrub). Nessun rendering frame-accurate garantito dal motore di sampling.
7. **Nessun undo/redo** sulle modifiche keyframe.
8. **Persistenza limitata**: solo i keyframe (chiave legacy `kaleidoscope-keyframes`); config layer/animazione non persistite.

---

## 5. File di riferimento (mappa rapida)

| Area | File | Ruolo |
|---|---|---|
| Math interpolazione (pura) | `src/lib/animation/keyframes.ts` | `sampleTrack`/`sampleSegment`/`sampleBezierSegment`, tipi `Keyframe`/`Track`/`Interp` |
| Geometria timeline (pura) | `src/lib/animation/timeline-geometry.ts` | `timeFromX`/`xFromTime`, `valueFromY`/`yFromValue`, `snapProgressToFps`, `format/parseTimecode` |
| Stato tracce + persistenza | `src/lib/state/keyframes.svelte.ts` | CRUD keyframe, `sampleParam`, localStorage |
| Orchestrazione + clock | `src/lib/state/animation.svelte.ts` | `tick`/`scrubTo`/`applyKeyframes`/`getProgressFromElapsed`, layer, registri param |
| Runtime driver | `src/lib/state/animation-drivers/runtime.ts` + `*-driver.ts` | modello a plugin, `simple/audioBars/audioZones/dataSeries` |
| Registri proprietà | `src/lib/state/animatable-params.ts`, `kaleidoscope-params.ts` | `AnimatableParam` get/set/bounds |
| UI testina/tracce/grafico | `TimelinePanel.svelte`, `TimelineTrack.svelte`, `TimelineRuler.svelte`, `KeyframeGraphEditor.svelte` | drag CTI, drag keyframe, editor curve |
