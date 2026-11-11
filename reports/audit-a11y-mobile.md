# Accessibility, contrast & mobile audit — `ai-pilot-v3/AI_Pilot.html`

**File audited:** `ai-pilot-v3/AI_Pilot.html` — 2,295,845 bytes, 15,901 lines.
Main stylesheet: `<style>` line 9 → `</style>` line 1542. Live markup: lines 1544–3304. Application script: 3305 → end.

**Method (static only — no browser, per sandbox constraint)**

* CSS and markup were read with targeted line reads / regex greps; **every selector and line number below was verified against the file**.
* Pages were **not** re-rendered. The Lead's headless-Chrome baseline figures (0 duplicate ids, 0 unnamed buttons/inputs, 2 unnamed `<svg>`, 1 heading jump, doc `scrollWidth == clientWidth` at 360–1440 px, 2-page print) are used only where marked *“Lead baseline”*.
* Contrast ratios computed with the WCAG 2.1 relative-luminance formula in PowerShell (`L = 0.2126R + 0.7152G + 0.0722B`, `(L1+0.05)/(L2+0.05)`); all ratios shown are computed, not estimated. Thresholds: **4.5:1** normal text, **3:1** large text (≥24 px regular / ≥18.66 px bold), UI boundaries & focus indicators (WCAG 1.4.11).

**Result: 30 findings — 6 high, 15 medium, 9 low.**

## Priority order (highest impact first)

| # | Sev | Finding | Anchor |
|---|-----|---------|--------|
| F1 | High | Every focus ring in the app is 1.76–2.29:1 (needs 3:1) — keyboard users cannot see focus | C1 |
| F2 | High | Interactive SVG node `.ri-box` is `role="button"` + `tabindex="0"` with **no** Enter/Space handler | K1 |
| F3 | High | Job Fit hero stacks its 3 step cards full-width: **≈374 px** of phone screen | M1 |
| F4 | High | 9–13 px secondary text at 2.41–3.86:1 | C2 |
| F5 | High | ~16 tap targets are 22–38 px, below the 44 px touch minimum | M2 |
| F6 | High | Printing the ExecutivePilot workspace prints white text on white paper (`.xp-hero`) | P1 |
| F7 | Med | 11–12.5 px helper text at 3.91–4.49:1 (28 pairs) | C3 |
| F8 | Med | All text-input boundaries are 1.35–1.46:1 (need 3:1) | C4 |
| F9 | Med | 4 of 6 `role="tablist"`s have no Arrow-key/roving-tabindex support | K4 |
| F10 | Med | `aria-modal="true"` on `#edModal` / `#xpModal` with no focus trap or inert background | K3 |

---

## A. Contrast (WCAG 1.4.3 / 1.4.11)

Passing baselines worth stating explicitly, so these are **not** “fixed” by mistake:

* `--muted: #637184` on `#ffffff` = **4.97:1**, on `--paper: #f6f8fb` = **4.67:1** → **passes** (line 10).
* The amber “horizon” notice `.notice` `#765c37` on `#fffdf8` = **6.15:1** (line 55) → **passes**. Every amber notice variant also passes: `.jr-notice` **8.01** (448–451), `.fit-notice` **6.43** (391), `.ws-notice` **6.51** (1109), `.ad-notice` **6.69** (741), `.career-warning` **6.95** (325).
* Coloured chips pass: `.chip` **6.53** (146), `.jr-chip` **6.19** (526), `.jr-chip-good` **6.35** (532), `.jr-chip-warn` **6.50** (531), `.jf-tag` **6.80** (1374), `.career-chip` **6.28** (359), `.ad-chip` **6.26** (845), `.demo-watermark` **5.63** (148), `.ed-badge` **5.86** (369).

### C1 — HIGH — every focus indicator fails 1.4.11 (3:1)

| Selector | Line | Ring | Colours | Ratio |
|---|---|---|---|---|
| `:focus-visible` (global) | 17 | 3 px | `#ed9a55` on `#ffffff` | **2.24** |
| `.searchfield input:focus` | 59 | 2 px | `#9accd0` on `#ffffff` | **1.76** |
| `#pilotPanel :is(button,input,select,textarea):focus-visible` | 382 | 3 px | `#dca043` on `#ffffff` | **2.29** |
| `#jobRadarPanel :is(button,input,select,textarea,summary,a):focus-visible` | 427 | 3 px | `#dca043` on `#ffffff` | **2.29** |
| `#workSamplePanel :is(input,select,textarea):focus-visible` + `button:focus-visible` | 1101 | 3 px | `#e0b25f` on `#ffffff` | **1.96** |
| `#jobFitPanel :is(button,input,select,textarea,a,[tabindex]):focus-visible` | 1245 | 3 px | `#e0a447` on `#ffffff` | **2.19** |
| `#fitPanel :is(input,select,textarea):focus-visible` | 390 | 3 px | `#e4b866` on `#ffffff` | **1.85** |
| `#admissPanel .ad-field input/select/textarea:focus` | 817 | 2 px | `#9accd0` on `#ffffff` | **1.76** |
| `.jf-svgbtn:focus rect.bar` (replacement stroke) | 1397 | 3 px stroke | `#e0a447` on `#ffffff` | **2.19** |

Every interactive control in the app inherits one of these rings, so this is the single highest-impact contrast defect. Two of them also replace the global ring below 3:1 (`#9accd0`) or remove it (`.jf-svgbtn`, see K2).

**Fix — old → new.** Append after the last focus rule (after line 1532) so all six workspace overrides pick it up:

```css
/* OLD: 6 different amber rings, all < 3:1 */
/* NEW: one verified ring — #0b5d6b = 7.52:1 on #fff, 7.07:1 on #f6f8fb */
:focus-visible,
.searchfield input:focus,
#pilotPanel :is(button,input,select,textarea):focus-visible,
.xp-overlay button:focus-visible,
#fitPanel input:focus-visible,#fitPanel textarea:focus-visible,#fitPanel select:focus-visible,
#jobRadarPanel :is(button,input,select,textarea,summary,a):focus-visible,
#workSamplePanel :is(input,select,textarea):focus-visible,#workSamplePanel button:focus-visible,
#jobFitPanel :is(button,input,select,textarea,a,[tabindex]):focus-visible,
#admissPanel .ad-field input:focus,
#admissPanel .ad-field select:focus,
#admissPanel .ad-field textarea:focus { outline: 3px solid #0b5d6b; outline-offset: 2px; }
.jf-svgbtn:focus{ outline: 3px solid #0b5d6b; outline-offset: 2px; }
.jf-svgbtn:focus rect.bar{ stroke: #0b5d6b; stroke-width: 3; }
```
(Do **not** use `#8a4b00`/`#e0a447`-type ambers for rings — 6.8:1 is fine but the existing ambers are 1.8–2.3:1.)

### C2 — HIGH — 9–13 px secondary text below 3.9:1 (needs 4.5:1)

| Selector | Line | Size | Colours | Ratio |
|---|---|---|---|---|
| `.jf-ev em` | 1359 | 12 px | `#9aa9b3` on `#ffffff` | **2.41** |
| `.nav-group-head small` | 1505 | 10 px | `#8a9ca5` on `#eef3f5` | **2.54** |
| `.qa-row input::placeholder` | 300 | 12 px | `#83939d` on `#ffffff` | **3.17** |
| `.mini-foot` | 235 | 9 px | `#77909e` on `#f8fbfc` | **3.22** |
| `.jr-jl span` | 558 | 10 px | `#7b909d` on `#fafcfd` | **3.23** |
| `.tip` | 119 | 12 px | `#798a98` on `#ffffff` | **3.56** |
| `.jf-item small` | 1286 | — | `#71889a` on `#ffffff` | **3.69** |
| `.qa-stage .stage-count` | 298 | 11 px | `#718897` on `#ffffff` | **3.70** |
| `.ad-record-foot` | 894 | 10 px | `#738797` on `#ffffff` | **3.72** |
| `.mini-metrics > div` | 246 | 9 px | `#758695` on `#ffffff` | **3.75** |
| `.recipes p` | 89 | 13 px | `#718191` on `#f6f8fb` | **3.76** |
| `.jr-prob-card small` | 630 | 10 px | `#6d8493` on `#f9fcfc` | **3.79** |
| `.jr-metric-note` | 543 | 10 px | `#6d8392` on `#f9fbfc` | **3.81** |
| `.ws-block .ws-why` | 1160 | 11 px italic | `#6c8494` on `#fbfdfe` | **3.84** |
| `.ri-src.estimate` | 1477 | 10 px | `#6a7c82` on `#eef1f2` | **3.84** |
| `.ws-qa-q small` | 1179 | 11 px | `#6b8493` on `#fcfdfe` | **3.86** |

**Fix — old → new** (one verified token replaces the failing greys; `#56697a` = **5.68:1** on `#ffffff`, **5.34:1** on `#f6f8fb`):

```css
/* OLD: #9aa9b3, #8a9ca5, #83939d, #77909e, #7b909d, #798a98, #71889a … */
/* NEW: #56697a for all micro-text and for ::placeholder */
.jf-ev em{color:#56697a}
.nav-group-head small{color:#56697a}
.qa-row input::placeholder{color:#666f7a}   /* 5.10:1 on #fff */
.mini-foot{color:#56697a}
.jr-jl span{color:#56697a}
.tip{color:#56697a}
.jf-item small,.qa-stage .stage-count,.ad-record-foot{color:#56697a}
.mini-metrics>div{color:#56697a}
.recipes p,.jr-prob-card small,.jr-metric-note,.ws-block .ws-why,
.ri-src.estimate,.ws-qa-q small{color:#56697a}
```
Affected background pairs were re-checked: `#56697a` on `#f9fcfc` = **5.51**, on `#eef1f2` = **5.00**, on `#fbfdfe` = **5.57**, on `#f8fbfc` = **5.46** — all pass.

### C3 — MEDIUM — 11–12.5 px helper text at 3.91–4.49:1 (needs 4.5:1)

| Selector | Line | Size | Colours | Ratio |
|---|---|---|---|---|
| `.dialog-kicker` | 104 | 11 px | `#64808c` on header gradient worst stop `#f2f8f9` | **3.91** |
| `.jf-kpi small` | 1328 | 11 px | `#6d8291` on `#fbfdfe` | **3.92** |
| `.jf-kpi span` | 1326 | 10.5 px | `#6b8191` on `#fbfdfe` | **3.98** |
| `.jr-comp-label small` | 619 | 10 px | `#6b8291` on `#ffffff` | **4.02** |
| `.sm-stage small` | 1443 | 10 px | `#6b8190` on `#ffffff` | **4.06** |
| `.jf-foot` | 1422 | 11.5 px | `#6b8190` on `#ffffff` | **4.06** |
| `.fit-eyebrow` | 391 | 10 px | `#27817f` on gradient worst stop `#e6f3f3` | **4.08** |
| `.ed-head p` | 369 | — | `#62788a` on gradient worst stop `#e9f4f5` | **4.09** |
| `.legend` | 151 | 11 px | `#6c8090` on `#ffffff` | **4.10** |
| `.viz-tile p` | 150 | 11 px | `#6b8190` on `#ffffff` | **4.06** |
| `.fit-help` | 392 | 11 px | `#678093` on `#ffffff` | **4.13** |
| `.career-paging` | 353 | 10 px | `#6c7f91` on `#ffffff` | **4.13** |
| `.fit-gauge-value span` | 392 | 10 px | `#648095` on `#ffffff` | **4.15** |
| `.jf-step small` | 1254 | 11.5 px | `#6a7f8f` on `#ffffff` | **4.16** |
| `.recipe p` | 93 | 12 px | `#6d7e8c` on `#ffffff` | **4.19** |
| `.jr-kicker` | 437 | 10 px | `#2c7d86` on gradient worst stop `#e7f2f3` | **4.19** |
| `.ad-layer-no` | 750 | 10 px | `#2f8794` on `#ffffff` | **4.19** |
| `.mini-tag` | 233 | 9 px | `#51808b` on `#f8fbfc` | **4.20** |
| `.source-item small` | 154 | — | `#677f8d` on `#ffffff` | **4.20** |
| `.jr-prob-card span` | 628 | 10 px | `#627d8e` on `#f9fcfc` | **4.20** |
| `.ws-card-tag` | 1119 | 10.5 px | `#5d7a8a` on `#f2f7f9` | **4.21** |
| `.jf-job small` | 1297 | 11.5 px | `#687e8e` on `#ffffff` | **4.23** |
| `.fit-gap-meta` | 393 | 10 px | `#617f8e` on `#ffffff` | **4.26** |
| `.ad-verdict-score span` | 843 | 10 px | `#5f7889` on worst verdict bg `#eef8f1` | **4.26** |
| `.ws-help` | 1127 | 11.5 px | `#657d8c` on `#ffffff` | **4.32** |
| `.ed-note` | 369 | 12 px | `#697c8b` on `#ffffff` | **4.32** |
| `.eyebrow` | 39 | 11 px | `#407a83` on hero gradient worst stop `#eaf4f4` | **4.33** |
| `.jr-metric-label` / `.fit-metrics span` | 541 / 392 | 10–11 px | `#60798c` on `#f9fbfc` | **4.39** |

**Fix — old → new:** consolidate the light greys onto two verified tokens:
```css
/* OLD: #64808c #6d8291 #6b8191 #6b8291 #6b8190 #678093 #6c7f91 #648095 #6a7f8f #6d7e8c #51808b #677f8d #627d8e #5d7a8a #687e8e #617f8e #5f7889 #657d8c #697c8b #60798c */
/* NEW: #5d7080 (5.13:1 on #fff, 4.97:1 on #f9fcfc, 4.93:1 on #f8fbfc) for all of the above */
.dialog-kicker,.jf-kpi small,.jf-kpi span,.jr-comp-label small,.sm-stage small,
.jf-foot,.viz-tile p,.fit-help,.career-paging,.fit-gauge-value span,.jf-step small,
.recipe p,.ad-layer-no,.mini-tag,.source-item small,.jr-prob-card span,.jr-prob-card small,
.ws-card-tag,.jf-job small,.fit-gap-meta,.ad-verdict-score span,.ws-help,.ed-note,
.jr-metric-label,.fit-metrics span,.legend { color:#5d7080; }
/* gradient-area text: darken one step instead */
.eyebrow{color:#2f6b73}        /* 5.40:1 on #eaf4f4 */
.fit-eyebrow{color:#1f6b69}   /* 5.49:1 on #e6f3f3 */
.ed-head p{color:#526a7c}     /* 5.04:1 on #e9f4f5 */
.jr-kicker{color:#246b73}     /* 5.37:1 on #e7f2f3 */
```

### C4 — MEDIUM — form-control boundaries are 1.35–1.46:1 (WCAG 1.4.11 needs 3:1)

Every text field/select is white-on-white with only a hairline border as the component boundary:

| Rule | Line | Border colour | Ratio on `#ffffff` |
|---|---|---|---|
| `.field input/textarea/select` | 142 | `#ccdce3` | **1.41** |
| `.qa-row select/input` | 300 | `#cedfe6` | **1.37** |
| `.career-field input/textarea/select` | 320 | `#cbd8e2` | **1.45** |
| `#pilotPanel :is(input,select,textarea)` | 382 | `#c9d9e2` | **1.45** |
| `#fitPanel :is(input,select,textarea)` | 390 | `#cddbe4` | **1.41** |
| `#jobRadarPanel :is(input,select,textarea)` | 424 | `#c9d8e2` | **1.46** |
| `#admissPanel .ad-field input/select/textarea` | 814 | `#ccdce3` | **1.41** |
| `#workSamplePanel input/select/textarea` | 1096 | `#cbdbe4` | **1.42** |
| `.jf-paste textarea` | 1270 | `#cddbe3` | **1.42** |
| `.searchfield input` | 58 | `#d4dee5` | **1.37** |
| `.jf-filter` group border | 1343 | `#d3e0e6` | **1.35** |

**Fix — old → new** (`#76838c` = **3.89:1** on white, `#6f7d87` = 4.23:1):

```css
/* OLD */ .field input,.field textarea,.field select{border:1px solid #ccdce3}
/* NEW */ .field input,.field textarea,.field select{border:1px solid #76838c}

/* Apply the same one-line change to every row above, e.g. */
.qa-row select,.qa-row input{border-color:#76838c}
.career-field input,.career-field textarea,.career-field select{border-color:#76838c}
#pilotPanel :is(input,select,textarea),
#fitPanel :is(input,select,textarea),
#jobRadarPanel :is(input,select,textarea),
#admissPanel .ad-field :is(input,select,textarea),
#workSamplePanel :is(input,select,textarea),
.jf-paste textarea,
.searchfield input { border-color:#76838c; }
.jf-filter{border-color:#76838c}
```
This also fixes the 2-colour focus/border pairing problem in C1 (ring vs border no longer both low-contrast).

### C5 — MEDIUM — ExecutivePilot hero: grey/white text over the gradient's light stop

`.xp-hero` (line 382): `background:linear-gradient(115deg,#153a4b 0%,#27576b 68%,#398383);color:#fff`. `.xp-hero h1` is 31 px bold, so 3:1 applies and it passes; the small text does not:

| Selector | Line | Size | Colours | Ratio (worst stop `#398383`) |
|---|---|---|---|---|
| `.xp-kicker` | 382 | 11 px | `#c9e4e8` on `#398383` | **3.32** |
| `.xp-hero-side small` | 382 | 11 px | `#d3e9eb` on `#398383` | **3.50** |
| `.xp-hero p` | 382 | 14 px | `#e0eef3` on `#398383` | **3.73** |
| `.xp-hero-side strong` / `h1` | 382 | 21 / 31 px bold | `#ffffff` on `#398383` | 4.42 — passes large-text 3:1 |

**Fix — old → new:** darken only the last gradient stop (line 382). With `#2b6570`, white = **6.57:1**, `#e0eef3` = 5.53, `#c9e4e8` = 4.92, `#d3e9eb` = 5.20 — all pass without touching the copy colours:

```css
/* OLD */ .xp-hero{background:linear-gradient(115deg,#153a4b 0%,#27576b 68%,#398383);color:#fff}
/* NEW */ .xp-hero{background:linear-gradient(115deg,#153a4b 0%,#27576b 68%,#2b6570);color:#fff}
```

### C6 — LOW — disabled states are unreadable (WCAG-exempt, still a usability defect)

`button:disabled{opacity:.5}` (line 16), `#jobRadarPanel .jr-btn:disabled{opacity:.55}` (496), `.jf-btn:disabled{opacity:.5}` (1274). Fading the *whole* element composites white label on a faded dark fill: for a primary button the effective pair is ≈ `#c5ccd4` on `#8b99a9` ≈ **1.5:1**. Disabled controls are exempt from 1.4.3, but users who cannot read the label cannot tell what is disabled.

```css
/* OLD */ button:disabled{cursor:not-allowed;opacity:.5}
/* NEW */ button:disabled{cursor:not-allowed;opacity:1;background:#f3f5f7;color:#5d7080;border-color:#a8b4bd}
/* and mirror with :disabled rules for .jr-btn / .jf-btn / .fit-btn instead of opacity */
```

### C7 — LOW — two borderline pairs at 4.45 / 4.50:1

* `.ri-src.you` **`#3c7a4f` on `#e5f2e8` = 4.45** (line 1477) — 0.05 under the threshold. Fix: `color:#2f6b46`.
* `.jf-band.wait` **`#5d7181` on `#eef2f5` = 4.50** (line 1299) — at the limit; antialiasing at 10 px will drop it. Fix: `color:#4e6273` (**5.62:1**).

---

## B. Keyboard & focus (WCAG 2.1.1, 2.4.3, 2.4.7)

Verified **passes** first (do not regress): the command dialog has ESC, a Tab trap, `inert` background and focus return (`openDialog` 3331, `closeDialog` 3333, trap 3353); the visual popup mirrors it (`openVisualPopup` 3735, `closeVisualPopup` 3736, trap 3738); `#jrRoleDialog` traps Tab (6352), focuses Close (6072) and restores the trigger (6346); `#jfDialog` is a native `<dialog>` with trigger restore (12526); `#fitDetail` is native with explicit restore (4397/4430); `#jfDrop` (`div role="button" tabindex="0"`, line 1617) has Enter/Space handling (12406); `.jf-job`, `.jf-svgbtn`, `.apx-drop` all have Enter/Space handlers (12521–12523).

### K1 — HIGH — `role="button"` SVG nodes cannot be activated by keyboard

`function ... return \`<g class="ri-box" data-ri="…" tabindex="0" role="button" aria-label="…">\`` — line **9522**. The only activation path is the delegated **click** handler (`const el = e.target.closest('[data-ri]')`, line 9662, exposed at 12464). No `keydown` handler covers `[data-ri]` (the jobFit root keydown at 12521 only handles `[data-jf-plan],[data-sm-risk],.jf-job`). These are the clickable “role & pay intelligence” chart nodes — a keyboard user can Tab to them but Enter/Space does nothing (WCAG 2.1.1 failure), and they also have `outline:none` with only a drop-shadow as focus cue (line 1475).

**Fix — old → new:**
```js
// OLD (line 12522)
const g = e.target.closest && e.target.closest('[data-jf-plan],[data-sm-risk],.jf-job');
// NEW
const g = e.target.closest && e.target.closest('[data-jf-plan],[data-sm-risk],.jf-job,[data-ri]');
```
```css
/* OLD (line 1475) */ .ri-box{cursor:pointer;outline:none}
/* NEW */
.ri-box{cursor:pointer}
.ri-box:focus-visible{outline:3px solid #0b5d6b;outline-offset:2px}
.ri-box:focus-visible rect:first-of-type{stroke:#0b5d6b;stroke-width:3}  /* SVG-safe ring */
```

### K2 — MEDIUM — `.jf-svgbtn` removes its focus ring and replaces it with a 2.19:1 stroke

Lines **1396–1397**: `.jf-svgbtn:focus{outline:none}` then `.jf-svgbtn:focus rect.bar{stroke:#e0a447;stroke-width:3}`. The element is a focusable `<g tabindex="0" role="button">` (e.g. 10057, 11585). The replacement stroke is `#e0a447` on white = **2.19:1**, below the 3:1 indicator minimum.

**Fix — old → new:**
```css
/* OLD */ .jf-svgbtn:focus{outline:none}
/* NEW */ .jf-svgbtn:focus{outline:3px solid #0b5d6b;outline-offset:2px}
/* keep the extra stroke only as a secondary cue: */
.jf-svgbtn:focus rect.bar{stroke:#0b5d6b;stroke-width:3}
```

### K3 — MEDIUM — `aria-modal="true"` dialogs with no focus containment

Two custom overlays are announced as modal but never trap focus or inert the page:

* `#edModal` — markup 3189 (`.ed-pop` → `role="dialog" aria-modal="true"`), open `edModal()` line 4063 focuses the Close button, close 4064 restores focus, ESC/backdrop at 4065–4066. **No Tab trap, no `inert`.**
* `#xpModal` — markup 3223 (`aria-hidden` correctly toggled), open 4298, close 4299, ESC/backdrop 4357. **No Tab trap, no `inert`.**

A screen-reader/keyboard user can Tab straight out of the “modal” into the page behind it, and the virtual cursor can read background content — the exact failure `aria-modal` is meant to prevent. The correct pattern already exists at 3331/3333 and 3353.

**Fix — old → new** (append after line 4357; same pattern for both overlays):
```js
const modals=[document.getElementById('edModal'),document.getElementById('xpModal')];
function modalOpen(){return modals.filter(m=>m.classList.contains('open')).pop()||null;}
document.addEventListener('keydown',e=>{
  const m=modalOpen(); if(!m) return;
  if(e.key==='Escape'){ (m.id==='edModal'?edModalClose:closeModal)(); return; }
  if(e.key!=='Tab') return;
  const f=[...m.querySelectorAll('button:not([disabled]),a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x=>x.getClientRects().length);
  if(!f.length) return;
  const i=f.indexOf(document.activeElement);
  if(!e.shiftKey && i===f.length-1){ e.preventDefault(); f[0].focus(); }
  if(e.shiftKey && i===0){ e.preventDefault(); f.at(-1).focus(); }
},true);
/* and in the two open/close functions mirror lines 3331/3333: */
// open:  document.getElementById('main').inert = true;
// close: document.getElementById('main').inert = false;
```

### K4 — MEDIUM — 4 of 6 tab lists have no Arrow-key navigation / roving tabindex

Correct implementations (reuse these): `#adTabs` — roving `tabindex` 0/-1 on 2099–2101, Arrow/Home/End handler 7840–7863, `aria-controls` 2099–2101, `role="tabpanel"` + `aria-labelledby` 2104/2234/2626. `#wsTabs` — listener 8995–9013, roving `tabindex` set in 8989, panels 2912/3083/3099/3113.

| Tab list | Markup | Click handler | Arrow keys | Roving tabindex | `aria-controls` |
|---|---|---|---|---|---|
| `#outputTabs` | 1706–1710 | 3793 | **no** | **no** (4 tabs in Tab order) | yes |
| `#cTabs` | 1768–1775 | 4012 | **no** | **no** | **no** |
| `#xpTabs` | 3194–3199 | 4342 | **no** | **no** | **no** |
| `#fitTabs` | 3231–3236 | 4425 | **no** | **no** | **no** |

**Fix — old → new:** for each list, set `tabindex="-1"` on the inactive tabs in markup (e.g. line 1708–1710, 1770–1775, 3196–3199, 3233–3236) and add the 7840–7863 handler with the list's own ids; or, if you do not want the full tab pattern, replace `role="tab"` with `aria-pressed` toggle buttons. Minimum viable JS (drop-in, works for any list that follows the `data-*` + `role="tab"` convention):
```js
[['#outputTabs','[role=tab]'],['#cTabs','[role=tab]'],['#xpTabs','[role=tab]'],['#fitTabs','[role=tab]']].forEach(([sel,q])=>{
  const list=document.querySelector(sel); if(!list) return;
  list.addEventListener('keydown',ev=>{
    const tabs=[...list.querySelectorAll(q)]; const i=tabs.indexOf(document.activeElement); if(i<0) return;
    let n=i;
    if(ev.key==='ArrowRight') n=(i+1)%tabs.length;
    else if(ev.key==='ArrowLeft') n=(i-1+tabs.length)%tabs.length;
    else if(ev.key==='Home') n=0;
    else if(ev.key==='End') n=tabs.length-1;
    else return;
    ev.preventDefault(); tabs.forEach((t,k)=>{t.tabIndex=k===n?0:-1;}); tabs[n].focus(); tabs[n].click();
  });
});
```

### K5 — LOW — skip link target is not focusable (`<main id="main">`, line 1600)

Skip link is correct (`<a class="skip" href="#main">Skip to main content</a>` line 1545, revealed by `.skip:focus{top:12px}` 18–19), but `<main>` has no `tabindex`, so in some engines the anchor moves the scroll position without moving focus and the next Tab starts from the top again.

**Fix:** line 1600 `<main id="main">` → `<main id="main" tabindex="-1">`; add `main:focus{outline:none}` (or `main:focus-visible{outline:3px solid #0b5d6b}`).

### K6 — LOW — live region on the result count fires on every keystroke

Line 1665: `<span id="resultCount" aria-live="polite">111 shown</span>` is re-written by the search render path on each input. Screen-reader users hear the count after every character, interrupting typing feedback.

**Fix — old → new:** announce on settle instead of per key:
```html
<!-- OLD --> <span id="resultCount" aria-live="polite">111 shown</span>
<!-- NEW --> <span id="resultCount">111 shown</span><span id="resultCountStatus" class="visually-hidden" role="status" aria-live="polite"></span>
```
(and write to `#resultCountStatus` from a 400 ms debounce). Keep `#jfTray`/`#jfToast`/`#jrRankStatus` live regions as they are — they are correctly scoped to non-interactive text.

---

## C. ARIA correctness

Checked programmatically over the **live markup only** (1544–3304): **65 `aria-labelledby`, 6 `aria-describedby`, 16 `aria-controls` references — all 87 targets resolve, 0 dangling.** `aria-current` is maintained by `activateView()` (3731) and `aria-expanded` by the nav-group toggle (12542). So the ARIA defects are structural, not reference typos.

### A1 — MEDIUM — `#cTabs` uses tab roles with no tabpanel relationship

Lines 1768–1777: `role="tablist"` with 7 `role="tab"` buttons (`aria-selected` only, no `aria-controls`, no roving `tabindex`), and the content is a single reused `<div id="cOutput" class="career-output-box">` with no `role="tabpanel"` / `aria-labelledby`. A screen reader announces “tab” and then finds no associated panel.

**Fix — old → new** — either complete the pattern:
```html
<!-- OLD (1769) --> <button class="career-tab active" data-ctab="fit" role="tab" aria-selected="true">ATS + Hiring</button>
<!-- NEW --> <button class="career-tab active" data-ctab="fit" role="tab" aria-selected="true" aria-controls="cOutput" tabindex="0">ATS + Hiring</button>
<!-- 1770–1775: same but tabindex="-1"; and 1777: -->
<!-- OLD --> <div id="cOutput" class="career-output-box">
<!-- NEW --> <div id="cOutput" class="career-output-box" role="tabpanel" aria-labelledby="cTabActive" tabindex="0">
```
…or drop the tab pattern (simplest, since one panel serves all 7 buttons): remove `role="tablist"`/`role="tab"`/`aria-selected` and use `aria-pressed="true|false"` on the buttons.

### A2 — MEDIUM — `#xpTabs` and `#fitTabs` tabs point at nothing

* `#xpTabs` (3194–3199): tabs with no `aria-controls`; panels are `<div class="xp-panel" id="xp-budget" hidden>` etc. (e.g. 3217) with no `role="tabpanel"` / `aria-labelledby`. `switchTab()` only toggles `hidden` and `aria-selected` (4339).
* `#fitTabs` (3231–3236): tabs with no `aria-controls`; pages are `<div class="fit-page" id="fit-score">` (3238) with no `role="tabpanel"` / `aria-labelledby`; toggle in 4425.

**Fix — old → new:** add `aria-controls` to each tab (`xp-plan`, `xp-budget`, `xp-calendar`, `xp-discovery`, `xp-handoff`; `fit-score`, `fit-gaps`, `fit-evidence`, `fit-scenario`, `fit-exports`) and add `role="tabpanel" aria-labelledby="<tab id>" tabindex="0"` to each panel — or, as with A1, drop `role="tab"` and use `aria-pressed`. (Match the already-correct `#adTabs` pattern at 2098–2104.)

### A3 — LOW — `aria-live` wraps interactive controls

Line 3301: `<div class="builder" id="builder" aria-live="polite">` contains `<strong id="builderTitle">` **and** `<div class="builder-actions">` with buttons. A live region must not contain focusable controls (it causes duplicate announcements and unreliable focus). Same shape is worth avoiding in any future toast with buttons.

**Fix — old → new:**
```html
<!-- OLD --> <div class="builder" id="builder" aria-live="polite">
<!-- NEW --> <div class="builder" id="builder">
              <strong id="builderTitle" role="status" aria-live="polite">0 selected commands</strong>
```

### A4 — LOW — 15 `<h1>` + 1 heading jump (Lead baseline); static order is clean

Static heading census over live markup: **115 headings — 15 `h1`, 82 `h2`, 18 `h3`, 0 `h4`–`h6`; zero heading-level jumps** (verified by walking the tags in document order). The jump in the Lead's runtime audit therefore comes from JS-rendered content (e.g. `<h4>` inside `.jf-pgrp`, line 1381, or an `<h3>` inserted above an `<h2>`). The 15 `h1`s are one per workspace panel, 14 of which are inside `hidden` sections, so they are not exposed to AT; still, the cheapest durable fix is one `h1` per page.

**Fix:** in each workspace panel other than the default, change the panel title `h1` → `h2` (lines 1656, 1671, 1676, 1720, 1742, 1785, 1789, 1798, 2088, 2891, 3133, 3160, 3193, 3227) and keep only `#jfTitle` (1606) as `h1`; then re-run the heading-order check on each workspace.

---

## D. Mobile / responsive (< 760 px)

Verified **good** responsive behaviour (keep): `.jf-req` hides two columns below 760 px (`@media(max-width:760px)` line 1425); `.qa-row` collapses to one column (305); `.ad-dl-row` stacks (914); `.ri-grid` uses `minmax(min(100%,640px),1fr)` (1469); `.jf-hero/.jf-intake/.jf-empty` collapse at 980 (1424); `main` uses `min-height:100dvh` + safe-area padding (172, 216); `prefers-reduced-motion` blocks exist (126, 703, 1086, 1186, 1427); the viewport meta (line 5) does **not** disable pinch-zoom.

### M1 — HIGH — Job Fit hero step cards consume ≈374 px of a 390 px phone

`.jf-steps` is a 3-column grid (line 1250) and the ≤760 px override collapses it to a **single column** (line 1425: `.jf-steps{grid-template-columns:1fr}`), so the three cards stack at full width. Measured from the CSS: each `.jf-step` = 14 px top + 30 px number badge + 8 px margin + ~20 px label + 3 px + ~31 px two-line `small` + 12 px bottom ≈ **118 px**; ×3 + 2×10 px gap ≈ **374 px**, i.e. ~44 % of a 390×844 viewport before any content. Markup: `<ol class="jf-steps" id="jfSteps">` with 3 `<li class="jf-step">` at lines 1609–1612.

**Fix — old → new** (line 1425):
```css
/* OLD */ .jf-steps{grid-template-columns:1fr}
/* NEW: compact 3-across stepper — ≈195px total instead of ≈374px */
.jf-steps{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.jf-step{padding:8px 8px 7px}
.jf-step b{width:24px;height:24px;font-size:12px;margin-bottom:5px}
.jf-step span{font-size:13px}
.jf-step small{display:none}      /* the step titles already carry the meaning */
```
If the three-across layout is not wanted, keep `1fr` but add `.jf-step small{display:none}` and `.jf-step{padding:8px 10px}` — that alone removes ~100 px.

### M2 — HIGH — ~16 touch targets are 22–38 px (44 px recommended; WCAG 2.5.8 = 24 px minimum)

| Selector | Line | Declared size | Effective height/width |
|---|---|---|---|
| `.clear-search` | 61 | `width:31px;height:31px` | 31 px |
| `.icon-btn` | 80 | `min-width:32px;min-height:30px` | 30–32 px |
| `.tiny` | 144 | `min-height:28px` | 28 px |
| `.output-tab` | 144 | `padding:8px 12px;font-size:12px` | ≈33 px |
| `.career-tab` | 327 | `padding:7px 10px` | ≈30 px |
| `.fit-gap-actions button` | 393 | `min-height:31px` | 31 px |
| `.jr-btn` | 491 | `min-height:36px` | 36 px |
| `.jr-icon-btn` | 501 | `width:34px;height:34px` | 34 px |
| `.jr-role-actions .jr-btn` | 560 | `min-height:32px` | 32 px |
| `.nav` (mobile) | 124 | `padding:8px 10px` | ≈35 px |
| `.ad-sheet-mode-btn` | 942 | `min-height:36px` | 36 px |
| `.ws-qa-controls select` | 1181 | `min-height:34px` | 34 px |
| `.jf-btn` | 1272 | `min-height:36px` | 36 px |
| `.jf-x` (remove chip) | 1288 | `padding:2px 5px;font-size:16px` | ≈22 px |
| `.jf-tab` | 1319 | `padding:9px 12px 8px` | ≈35 px |
| `.jf-filter button` | 1344 | `padding:6px 11px` | ≈28 px |

**Fix — old → new** (one mobile block; append near the other `@media (max-width:760px)` rules):
```css
@media (max-width:760px){
  .icon-btn,.clear-search,.jr-icon-btn,.jf-x{ min-width:44px; min-height:44px; }
  .nav,.output-tab,.career-tab,.fit-tab,.ad-tab,.ws-tab,.xp-tab,.jf-tab,
  .jf-filter button,.tiny,.fit-gap-actions button,.jr-role-actions .jr-btn,
  .jr-btn,.jf-btn,.ws-btn,.ad-sheet-mode-btn,.ws-qa-controls select{ min-height:44px; }
  .jf-x{ padding:0; }
}
```

### M3 — MEDIUM — Role/pay diagrams force a 560 px horizontal scroll at ≤640 px

Line 1471: `@media (max-width:640px){.ri-panel{overflow-x:auto;…}.ri-org,.ri-pay{min-width:560px}…}`. On a 390 px phone the org chart and pay chart are 1.44× the viewport, so the right-hand labels are off-screen with **no visual affordance** that the panel scrolls (no fade, no scrollbar on touch).

**Fix — old → new:**
```css
/* OLD */ @media (max-width:640px){.ri-panel{overflow-x:auto}.ri-org,.ri-pay{min-width:560px}}
/* NEW: smaller minimum + an explicit affordance */
@media (max-width:640px){
  .ri-panel{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
  .ri-org,.ri-pay{min-width:480px}
  .ri-panel::after{content:'Swipe to see the full chart →';display:block;font-size:11px;color:#56697a;margin-top:4px}
}
```

### M4 — MEDIUM — mobile navigation is a horizontal scroller with no affordance

At ≤760 px `.rail` becomes static and `.navlist`/`.primary-nav` become `display:flex;overflow-x:auto` with `.nav{min-width:max-content}` (line 124) and are re-declared at 162 and 215; group headings are unwrapped with `display:contents` at 1514. In a 390 px viewport only ~3 of 15 workspace buttons are visible, `scrollbar-width:thin` is invisible on iOS/Android, and there is no “more” cue — the hidden workspaces are effectively undiscoverable by touch users.

**Fix — old → new** (add after line 215):
```css
@media (max-width:760px){
  .rail .navlist,.rail .primary-nav{
    -webkit-mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 40px),transparent 100%);
            mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 40px),transparent 100%);
    scroll-snap-type:x proximity;
  }
  .rail .nav,.rail .view-toggle{ scroll-snap-align:start; }
  .rail .navlist::after{ content:'→'; }   /* or a dedicated “More workspaces” button */
}
```
(An explicit `<select>`/`<details>` workspace switcher is the more robust fix for 15 items.)

### M5 — MEDIUM — sticky toolbar is ≈120 px tall on a phone

`.toolbar{position:sticky;top:0;z-index:11;padding:10px 0 12px;gap:10px;flex-wrap:wrap}` (line 56), `.toolbar .btn{min-height:44px}` (62), and the mobile block keeps it sticky with `.toolbar{top:0}` (124). Markup (1660–1664) = `.searchfield{flex:1 1 270px}` + two `.btn`s. At 360 px of content width, 270 + 10 + ~125 px (“☆ Favorites 0”) overflows, so the toolbar always wraps to **two rows** (44 + 10 + 44 + 22 padding ≈ **120 px**) and stays pinned over the content while scrolling.

**Fix — old → new** (line 124):
```css
/* OLD */ @media(max-width:760px){ … .toolbar{top:0} … }
/* NEW */
@media (max-width:760px){
  .toolbar{ position:static; padding:8px 0 10px; }  /* reclaims ~120px of sticky height */
  .toolbar .btn{ min-height:40px; padding:7px 10px; }
  .searchfield{ flex:1 1 100%; }
}
```

### M6 — MEDIUM — Job Fit KPI strip stacks 5 cards at ≤480 px

Line 1426: `@media(max-width:480px){.jf-kpis{grid-template-columns:1fr}}` — the five KPIs (line 1322 `.jf-kpis{grid-template-columns:repeat(5,…)}` → 3 at 1200 → 2 at 760 → 1 at 480) become five full-width cards ≈ 5×76 px ≈ 380 px of extra scroll for five numbers.

**Fix — old → new:**
```css
/* OLD */ @media(max-width:480px){.jf-kpis{grid-template-columns:1fr}}
/* NEW */ @media(max-width:480px){.jf-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.jf-kpi small{display:none}}
```

### M7 — LOW — enterprise tables force a 550 px scroll at ≤550 px

Line 378: `@media(max-width:550px){ … .ed-table{min-width:550px} }` — 1.4× a 390 px viewport, inside `.ed-table-wrap` (which does scroll, line 369/373), but again with no affordance. Fix: reduce to 460 px and add the same `::after` swipe hint used in M3, or set `.ed-table{min-width:0}` with `.ed-table td{overflow-wrap:anywhere}`.

### M8 — LOW — ExecutivePilot hero hides its summary numbers below 650 px

Line 383: `@media(max-width:650px){ … .xp-hero-side{display:none} … }` — the aside (`.xp-hero-side{flex:0 0 160px}`, line 382) carrying the “strong/small” summary figures is removed entirely on phones, not reflowed. Fix:
```css
/* OLD */ .xp-hero-side{display:none}
/* NEW */ .xp-hero-side{display:flex;flex:1 1 100%;gap:14px;align-items:center;margin-top:8px;text-align:left}
```

---

## E. Print

Verified **good** print behaviour (keep): per-workspace print blocks exist and are thoughtful for Job Radar (688–701 — hides hero aside, notice, actions, filters, role actions, note, pipe form, pipeline; forces B/W card borders), Work Sample (1187–1212 — prints only the spec panel, hides controls, sets 7 pt-ish type and `break-inside:avoid`), Admissibility (980–1083 — including a dedicated `body.ad-sheet-print` host-shell neutralisation), Job Fit (1428), QA (307), Analyzer (164). Global rules (127) hide the rail/toolbar/builder/overlays and force 4-column cards. 2-page output (Lead baseline) is consistent with this.

### P1 — HIGH — printing ExecutivePilot prints white-on-white

`.xp-hero{background:linear-gradient(115deg,#153a4b 0%,#27576b 68%,#398383);color:#fff}` (line 382), used by `<header class="xp-hero">` line 3193. **No `@media print` rule anywhere targets `.xp-hero` or `#pilotPanel`** (print blocks are only at 36, 127, 164, 220, 307, 394, 688, 980, 1187, 1428; none mention `xp-`). Browsers omit background graphics by default, so the white `h1 “ExecutivePilot AI”`, the white/grey lede paragraph and the `.xp-kicker` print as **white text on white paper**.

**Fix — old → new** (append to the global print block at line 127):
```css
@media print{
  .xp-hero{ background:#fff!important; color:#111!important; border:1px solid #bbb; border-radius:8px; padding:12px; }
  .xp-hero h1,.xp-hero p,.xp-kicker,.xp-hero-side strong,.xp-hero-side small{ color:#111!important; }
}
```

### P2 — MEDIUM — one panel's `@page` rule changes every workspace's print margins

Line **981**: `@page{size:portrait;margin:10mm}` sits inside `#admissPanel`'s print block, but `@page` is not scoped by selectors — it is the only `@page` rule in the file (verified) and therefore applies to **all** printing from the app. Printing Job Fit, Work Sample or the Library silently gets portrait/10 mm instead of the browser default.

**Fix — old → new:** remove the global rule and use a named page applied only to the sheet:

```css
/* OLD (981) */ @page{size:portrait;margin:10mm}
/* NEW */
@page{ size:Letter; margin:12mm; }
@page admiss-sheet{ size:portrait; margin:10mm; }
@media print{ #admissPanel.ad-sheet-active #adSheet{ page:admiss-sheet; } }
```

### P3 — MEDIUM — textarea editors print clipped content

The Career résumé/cover-letter deliverable and the Job Fit editors are `<textarea>`s: `.career-editor{min-height:350px;…}` (line 337) and `.jf-editor{min-height:420px;…}` (line 1376). Textareas print as fixed-height scroll boxes in Chrome/Edge/Firefox — anything below the visible 350/420 px is silently dropped, and no print rule hides them in favour of a printable rendering.

**Fix — old → new** (add to the global print block, line 127):
```css
@media print{
  .career-editor,.jf-editor{ display:none!important; }
  .career-output-box,.career-print-sheet,.jf-ready{ display:block!important; }
}
```

### P4 — MEDIUM — Work Sample print typography is 6.9–7.6 pt

Lines 1192, 1202, 1204: `#workSamplePanel{font-size:7.6pt}`, `.ws-block p{font-size:7.1pt}`, `.ws-block table{font-size:6.9pt}`. Print text below ~8 pt is at/below the legibility floor and will fail on office printers.

**Fix — old → new:**
```css
/* OLD */ #workSamplePanel{font-size:7.6pt}  .ws-block p{font-size:7.1pt}  .ws-block table{font-size:6.9pt}
/* NEW */ #workSamplePanel{font-size:9pt}    .ws-block p{font-size:8.5pt}  .ws-block table{font-size:8pt}
```
(If the one-page constraint breaks, drop `.ws-why` (already hidden, 1203) and tighten `padding` before shrinking type further.)

### P5 — LOW — the only `.notice` in the app is suppressed when printing

Line 127 hides `.notice` in print (`… .notice, …display:none!important`). The single `.notice` in live markup (line 1659) is the “How these work — these are custom prompt shortcuts, not native AI commands” caveat on the Library worksheet. Printed library pages therefore lose their only qualifier.

**Fix:** remove `.notice` from the hide list on line 127 and give it print styling: `@media print{.notice{border:1px solid #bbb;background:#fff;color:#111;font-size:9pt}}`.

---

## F. Verified non-issues / corrections

1. **“2 `<svg>` without aria-label/role=img/title” is a false positive.** In live markup every SVG is either labelled or deliberately decorative: line 1618 `.jf-drop-icon` (decorative upload glyph inside `<div aria-hidden="true">`), line 3050 `<svg viewBox="0 0 160 96" aria-hidden="true">`, line 3259 `#fitRing` (`role="img" aria-label="Weighted portfolio coverage"`). The Lead's query counted the two `aria-hidden` ones; no change needed. If keeping them out of the count matters, add `role="presentation"` to line 1618's `<svg>`.
2. **ARIA reference integrity is clean** — 65/6/16 `labelledby/describedby/controls` refs, 0 missing (scripted check over lines 1544–3304).
3. **Dynamic ARIA state is maintained** — `aria-current="page"` per workspace button in `activateView()` (3731) and `aria-expanded` on nav groups (12542). The rail's `[aria-current="page"]` styling (29) therefore does activate.
4. **Tab patterns that are correct and should be copied:** `#adTabs` (2098–2104 markup + 7840–7863 keys + roving tabindex) and `#wsTabs` (2905–2912 + 8995–9013).
5. **Modal patterns that are correct:** `#overlay` (inert background 3331, trap 3353, restore 3333) and `#visualPopup` (3735/3736/3738). Use these as the template for K3.
6. **Reduced motion is handled** (`@media(prefers-reduced-motion:reduce)` at 126 globally, plus 703, 1086, 1186, 1427) and `html{scroll-behavior:smooth}` (12) is reset at 170.
7. **Zoom is not blocked** — viewport meta (5) has no `maximum-scale`/`user-scalable=no`.

## G. Reproduce / re-verify

```powershell
# contrast for any pair: ratio(fg,bg) with the WCAG 2.1 formula
# selector existence: grep the cited line; every line number in this report was read from the file
Select-String -Path 'ai-pilot-v3\AI_Pilot.html' -Pattern ':focus-visible\{outline:3px solid #ed9a55'   # -> line 17
Select-String -Path 'ai-pilot-v3\AI_Pilot.html' -Pattern '@page\{size:portrait'                        # -> line 981
```

*Limits:* static analysis only (browser blocked by sandbox); contrast for gradient backgrounds is quoted against the **worst** gradient stop; runtime-only facts (heading jump, 2 SVGs, 2-page print) are attributed to the Lead's baseline and not re-derived here.
