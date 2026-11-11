# Static logic audit — `ai-pilot-v3/AI_Pilot.html`

- **File:** `C:\Users\sawat\OneDrive\Documents\deepseek-harness\default-workspace\ai-pilot-v3\AI_Pilot.html` (2,295,845 bytes, 15,901 lines, single inline script from line 3305 to line 15897)
- **Auditor:** logic-auditor (shared task `task-1`)
- **Method:** read-only static analysis. No browser was launched (sandbox blocks Chromium IPC; Lead owns runtime testing). Every finding below was verified by reading the cited line and by parsing/measuring the referenced data in the source.
- **Scope:** every JavaScript module in the file was sampled; the specific areas called out by the task were checked systematically (HTML sinks, localStorage, state, math/CSV/date edge cases, regexes/dead code, hard-coded labels). Runtime-only behaviour (actual click/focus/interaction) is not asserted here.

**Finding count by severity: 1 high, 4 medium, 2 low (7 total).**

| ID | Severity | One-line summary |
|----|----------|------------------|
| F-01 | **high** | Demo trend chart splits observed/forecast at hard-coded year 2026 and ignores the selected analytics mode, so it draws a "synthetic forecast" line for data the app itself labels history/illustration. |
| F-02 | **medium** | Two category counts in the command-library nav are wrong (Learning 22 vs 20, Strategy 19 vs 15) because they are hard-coded in `GROUPS`. |
| F-03 | **medium** | Three user-facing places claim "111" slash commands; the library actually contains 105 (`COMMANDS.length`). |
| F-04 | **medium** | A demo tile's caption is hard-coded "Select for 2020–2030 data" although the horizon is user-configurable (2000–2050). |
| F-05 | **medium** | Scenario tab keeps stale probability numbers on screen after an invalid baseline/uplift is entered; only the note changes. |
| F-06 | **low** | Résumé/cover-letter length checks pass at thresholds that contradict the "target" range printed in the same row (400–1150 words vs "target 450–1,100"; 220–450 vs "target 250–420"). |
| F-07 | **low** | Dead code: eight defined functions (one an intentional empty stub) are never referenced anywhere in the file. |

---

## F-01 · HIGH — Demo chart invents a forecast segment and mislabels rows

**Symptom (reproducible):** Open the "Analyzer" workspace, keep the default horizon but set *Analytics depth* to **Historical descriptive only** (`forecastSelect = historical`), then click **Generate**. The chart tile "Historical & forecast lens" still renders a dashed orange line over 2026–2030 under a legend that reads "Synthetic forecast", while:

- the deterministic generator marks every one of those rows as `SYNTHETIC_ILLUSTRATION` / `SYNTHETIC_HISTORY` and sets `lower`/`upper` to `null` (line 3763);
- the governance text for the same analysis says *"Only descriptive comparisons; projections disabled."* (line 3785);
- the drill-down table shows the same rows as `SYNTHETIC_ILLUSTRATION` (line 3788).

A second, independent trigger: set **Last planning / forecast year** to any value before 2026 (e.g. 2020–2024; `yearEnd` allows 2020–2050, line 1687). `findIndex` returns `-1`, `Math.max(0, -1)` collapses the boundary to 0, so the **entire** series is drawn as the dashed "forecast" polyline and only the first year is drawn solid — for rows that are all `SYNTHETIC_HISTORY`.

The same unconditional 2026 split also affects a horizon starting at/after 2026: the first row (a forecast row) is additionally drawn in the solid "history" colour.

**Lines:** 3763 (row statuses), 3786 (`chartFromRows`), 3787 (legend), 3785 (governance text).

**Offending code (line 3786, single line in file):**

```js
const forecastI=rows.findIndex(r=>r.year>=2026);const fi=Math.max(0,forecastI);
const observed=rows.slice(0,fi+1)....join(' ');const fore=rows.slice(fi)....join(' ');
```

and line 3787:

```js
leg.innerHTML='<span><i style="background:#26778d"></i>Synthetic history</span><span><i style="background:#d78c54"></i>Synthetic forecast</span>';
```

**Minimal fix:**

1. Line 3786 — derive the split from the row classification instead of the year, and keep the observed segment to real history/illustration rows:

- old: `const forecastI=rows.findIndex(r=>r.year>=2026);const fi=Math.max(0,forecastI);const observed=rows.slice(0,fi+1).map((r,i)=>`${35+i*(290/Math.max(1,rows.length-1))},${116-(r.value-mn)/den*88}`).join(' ');const fore=rows.slice(fi).map((r,i)=>`${35+(i+fi)*(290/Math.max(1,rows.length-1))},${116-(r.value-mn)/den*88}`).join(' ');`
- new: `const firstF=rows.findIndex(r=>r.status==='SYNTHETIC_FORECAST');const obsN=firstF<0?rows.length:firstF;const observed=rows.slice(0,obsN).map((r,i)=>`${35+i*(290/Math.max(1,rows.length-1))},${116-(r.value-mn)/den*88}`).join(' ');const fore=firstF<0?'':rows.slice(firstF).map((r,i)=>`${35+(obsN+i)*(290/Math.max(1,rows.length-1))},${116-(r.value-mn)/den*88}`).join(' ');`

(An empty `points=""` polyline is valid SVG and draws nothing.)

2. Line 3787 — only render the forecast legend entry when a forecast row exists:

- old: `leg.innerHTML='<span><i style="background:#26778d"></i>Synthetic history</span><span><i style="background:#d78c54"></i>Synthetic forecast</span>';`
- new: `leg.innerHTML='<span><i style="background:#26778d"></i>Synthetic history</span>'+(a.rows.some(r=>r.status==='SYNTHETIC_FORECAST')?'<span><i style="background:#d78c54"></i>Synthetic forecast</span>':'');`

After this the chart, its legend and the drill-down table all report the same classification in all three analytics modes and for any horizon.

---

## F-02 · MEDIUM — Command-library category counts disagree with the actual data

**Symptom:** On page load the left rail shows **Learning · 22** and **Strategy · 19**. Clicking those rows renders *"20 of 105 shown"* / *"15 of 105 shown"* in `#resultCount`, and the filtered cards number 20 / 15. The other four groups match exactly (research 15, analytics 20, writing 15, projects 20).

**Lines:** 3309 (hard-coded `count` fields), 3325 (usage `String(g.count)`).

**Offending code (line 3309, single-line JSON array; excerpts):**

```js
{"id": "learning", "title": "Learning & Study", ..., "count": 22}, {"id": "research", ..., "count": 15}, ...
{"id": "strategy", "title": "Strategy & Executive Decisions", ..., "count": 19}];
```

**Evidence:** parsing line 3310's `COMMANDS` array yields exactly 105 entries with group totals `analytics=20, learning=20, projects=20, research=15, strategy=15, writing=15`; line 3327 (`updateCounts`) uses `COMMANDS.length`, so the total is right and only these two group labels are stale.

**Minimal fix (line 3309):**
- old: `"count": 22}` for `learning` → new: `"count": 20}`
- old: `"count": 19}` for `strategy` → new: `"count": 15}`

(Alternative, preferable: drop the stored `count` field and compute it in `updateNav` from `COMMANDS.filter(c=>c.group===g.id).length`.)

---

## F-03 · MEDIUM — User-facing "111 commands" claims; actual library is 105

**Symptom:** the page's search field invites *"Search 111 commands…"*, the `<meta name="description">` advertises "111 AI slash commands", and **Export CSV** downloads `AI_Slash_Commands_111.csv` — yet the library header, `#resultCount` and the nav (all computed from `COMMANDS.length`) say 105. A user who exports and cross-checks the file gets a filename that claims 111 rows.

**Lines:** 7 (meta), 1661 (search placeholder), 3338 (`saveFile` filename). Note: the static `111` in `<strong id="totalNumber">111</strong>` (line 1657) is overwritten on load by `updateCounts()` and is therefore *not* a live defect.

**Offending code:**

```html
Line 1661: <input id="search" type="search" placeholder="Search 111 commands, functions, or deliverables…" ...>
Line 3338: saveFile('AI_Slash_Commands_111.csv','\ufeff'+rows.map(r=>r.map(q).join(',')).join('\r\n'),'text/csv;charset=utf-8');
```

**Evidence:** parsing the array on line 3310 gives `COMMANDS.length === 105` (105 unique names, groups as in F-02); no other code adds to `COMMANDS`.

**Minimal fix:**
- line 3338 old `'AI_Slash_Commands_111.csv'` → new `'AI_Slash_Commands_' + COMMANDS.length + '.csv'`
- line 1661 old `placeholder="Search 111 commands, functions, or deliverables…"` → new `placeholder="Search 105 commands, functions, or deliverables…"` (or generic: `Search commands, functions, or deliverables…`)
- line 7 old `content="111 AI slash commands, ...` → new `content="105 AI slash commands, ...`

---

## F-04 · MEDIUM — Demo tile caption hard-codes years that the form overrides

**Symptom:** the analyzer form exposes **First historical year** (min 2000, max 2030) and **Last planning / forecast year** (min 2020, max 2050), and `brief()` clamps and forwards those values (line 3762). But the first demo tile's description is a fixed string: *"Select for 2020–2030 data, assumptions and evidence"*. A user who sets 2024–2040 sees a tile caption that describes a dataset that was not generated.

**Line:** 3787 (`const specs=[...]` inside `drawDemo`).

**Offending code:**

```js
const specs=[['Historical & forecast lens','Select for 2020–2030 data, assumptions and evidence',0],
```

**Minimal fix (line 3787):**
- old: `['Historical & forecast lens','Select for 2020–2030 data, assumptions and evidence',0]`
- new: ``['Historical & forecast lens','Select for '+a.start+'–'+a.end+' data, assumptions and evidence',0]``

(`a.start`/`a.end` are in scope — `drawDemo(a)` and `a.rows` are already used on the same line.)

---

## F-05 · MEDIUM — Scenario tab keeps stale probability figures after invalid input

**Symptom:** In the **Fit & Gap Optimizer** → Scenario tab, enter a valid baseline (e.g. 50) so the three metrics show `50.0%`, etc. Then change the baseline to `150` (or the uplift to `60`). The note correctly changes to "Enter baseline 0–100% and uplift 0–50 percentage points.", but `#fitCurrentProb`, `#fitFutureProb` and `#fitDeltaProb` keep showing the previous 50-based numbers. The panel therefore presents out-of-date percentages next to an error message.

**Line:** 4420 (`renderScenario`). The early-return branch updates only `fitScenarioNote`:

```js
if(!Number.isFinite(p0)||p0<0||p0>100||!Number.isFinite(max)||max<0||max>50){
  $('fitScenarioNote').textContent='Enter baseline 0–100% and uplift 0–50 percentage points.';return}
```

**Minimal fix (line 4420, same branch):**
- old: `{$('fitScenarioNote').textContent='Enter baseline 0–100% and uplift 0–50 percentage points.';return}`
- new: `{['fitCurrentProb','fitFutureProb','fitDeltaProb'].forEach(id=>$(id).textContent='—');$('fitScenarioNote').textContent='Enter baseline 0–100% and uplift 0–50 percentage points.';return}`

---

## F-06 · LOW — Length-check pass bands contradict the target range printed in the same row

**Symptom:** In Job Fit Studio → résumé ATS checks, the row for a 1,120-word résumé reads *"1,120 words (target 450–1,100)"* while its status is a green **pass**, because the pass test uses 400–1,150. Likewise a 230-word cover letter reads *"230 words (target 250–420)"* and passes, because the pass test uses 220–450. The user cannot tell whether the printed target or the colour is authoritative, and the score is computed from the range that contradicts the text.

**Lines:** 11499 and 11521.

**Offending code:**

```js
// line 11499
s(words >= 400 && words <= 1150, words >= 250 && words <= 1500), detail: words + ' words (target 450–1,100)'
// line 11521
s(words >= 220 && words <= 450, words >= 150 && words <= 600), detail: words + ' words (target 250–420)'
```

**Minimal fix (align the pass thresholds with the printed target):**
- line 11499 old `s(words >= 400 && words <= 1150, words >= 250 && words <= 1500)` → new `s(words >= 450 && words <= 1100, words >= 250 && words <= 1500)`
- line 11521 old `s(words >= 220 && words <= 450, words >= 150 && words <= 600)` → new `s(words >= 250 && words <= 420, words >= 150 && words <= 600)`

(If the wider bands are intentional, update the printed strings instead — but exactly one of the two must change.)

---

## F-07 · LOW — Dead code: functions defined and never referenced

**Symptom:** none directly user-visible; these are unreachable paths/maintenance hazards and one is an intentional blank stub that would silently render nothing if ever wired up.

**Verified single-occurrence definitions (the name appears exactly once in the whole file, i.e. only at its definition):**

| Line | Code | Note |
|------|------|------|
| 8367 | `function ensureHtml(value, fallback) { ... }` | helper never called |
| 11932 | `function rsOpenItems(job) {` | never called |
| 14365 | `function covMatrix() { return ''; }` | empty stub, never called |
| 14642 | `function msHtmlDoc(bs, is, sj) {` | never called |
| 15134 | `function routeCard(p) {` | never called |
| 15138 | `function routeBar(p) {` | never called |
| 15148 | `function pStart() {` | never called |
| 15158 | `function pChange() {` | never called |

**Minimal fix:** delete the eight definitions (and, for `covMatrix`, either delete it or implement it if a coverage matrix was intended). Nothing else references them, so removal cannot change behaviour.

---

## Category coverage

1. **Unsafe `innerHTML` / `insertAdjacentHTML` — no finding.** `insertAdjacentHTML` is never used (0 occurrences). All 120 `innerHTML` references (plus the 4 `outerHTML` ones) were reviewed with the surrounding function: user-originated strings are passed through `EP_SHARED.escapeHtml` (`esc`/`E`/`escape`/`carEsc`/`edEsc`) or through `textContent`; the only unescaped interpolations are numbers and literals (e.g. `fitPct`, `item.rank`, chart coordinates). No reproducible string-injection sink was found in the reviewed paths. (Automated checks: no unescaped `.value`/localStorage-restored value in `innerHTML`; attribute interpolations in `href`/`src` are escaped everywhere checked.)
2. **localStorage — no blocker-level finding.** All 38 storage call sites were enumerated. Every `JSON.parse` that reads localStorage is inside `try/catch` (lines 3318, 3875, 3998, 4256, 5057, 7311, 8426, 8820, 9764, 11204, 11206, 12540, 12712, 13529, 15447, 15580, 15805). Every `setItem` is inside a `try/catch` or has a visible fallback (3320, 3876, 3999, 4257, 5065, 7301, 8420, 8824, 9765, 11200, 12544, 12713, 13533, 15176, 15448, 15581, 15813); a quota failure cannot break a render. All 20 persisted keys are distinct strings (`executivepilot_v1`, `ep_*` families, `slash-library-favorites-v1`, `ws_theme`); no cross-workspace key collision found. Version fields exist (`executivepilot_v1`, `ep_jobfit_v1`, `ep_worksample_v1`) but no migration code is needed while keys stay at v1 — noted as a maintenance risk only.
3. **State bugs (disabled/enabled, stale render, listener loss, duplicate ids) — one finding (F-05).** Static checks: no duplicate `id` in the static document (655 ids, 0 duplicates); all 404 literal `$()`/`getById()`/`byId()` id references resolve to an existing element or to an id emitted by a template string; all `label[for]`, `aria-controls`, `aria-labelledby`, `aria-describedby` targets resolve; re-rendered lists (`renderBudget`, `renderGaps`, `renderWhatIf`, `renderPipeline`, `renderQa`, `renderResults`) re-bind their listeners after `replaceChildren()`/`innerHTML`. F-05 is the only stale-value defect found in a rendered panel.
4. **Edge cases (empty inputs, NaN/Infinity, div-by-zero, parseInt radix, dates, CSV quoting, filenames) — two findings (F-06 and, for stated numeric targets, F-02/F-03).** `parseInt` is given radix 10 or 16 everywhere it parses digits/hex (lines 3583, 9416, 9458, 11469). CSV writers quote correctly: `exportCsv` (3338), `csv` (4405), `csvCell`/`shortlistCsv`/`pipelineCsv` (5530/5534/6012), `fitExportCSV` (4430) and the tracker CSV (12509) all double internal `"` and wrap every cell, and prepend a BOM. Download filenames that embed user text are slugged (`slug()` 15337, 8337) or fixed. Date handling uses explicit local/tz-safe construction in the reviewed paths (`todayIso`, `parseDate`, `isoPlusWeeks`, `computeSchedule`); no off-by-one month index bug was reproduced. Division-by-zero is guarded in the reviewed math (`(mx-mn)||1`, denominators all `|| 1` / `Math.max(1, …)`); no NaN/Infinity output path could be reproduced from UI input.
5. **Broken regexes / undefined references / swallowed errors / dead code — one finding (F-07).** All 20 `window.EP*` module globals that are referenced are also assigned; no non-existent DOM id or unassigned module global was found. No regex literal with the `g` flag is used with `.test()` in a loop (the only global-flag data regexes are consumed via `.match()`, and `DIMS` resets `lastIndex`). Dead code is listed in F-07. Intentional `catch { /* ignore */ }` blocks are labelled as such and do not hide state-changing failures in the reviewed flows.
6. **Hard-coded label/count vs data — three findings (F-02, F-03, F-04).** Additional consistency checks passed: Fit criteria weights total 100 (guard at line 4385 would throw otherwise); all 5 `RECIPES` reference commands that exist in `COMMANDS`; every `COMMANDS.group` exists in `GROUPS`; `STAGES` shares total 100; all 15 `activateView` panel/button ids exist; "12 complete, reusable engineering prompts" matches the 12-entry `promptsFor` list; the observed-vs-partial thresholds printed in the UI (58%/34%, line 11739) match the code.

## Verification notes / limitations

- Line numbers were confirmed by reading the cited lines in the file (via targeted `read`/excerpt printing), not by memory.
- `COMMANDS` (line 3310) and `GROUPS` (line 3309) were parsed out of the source with `ConvertFrom-Json` and counted; the resulting counts (105 total; learning 20, research 15, analytics 20, writing 15, projects 20, strategy 15) are the basis for F-02/F-03.
- Cross-checks executed over the whole file: duplicate-id scan, referenced-id vs defined-id scan, `label[for]`/ARIA-target scan, `window.EP*` referenced-vs-assigned scan, never-referenced-function scan (single-pass token count), `data-*` selector vs emitter scan, `innerHTML`/`insertAdjacentHTML` inventory, `localStorage` inventory, CSV writer review.
- Not verified here (needs a browser, which this sandbox blocks): real click/focus/interaction behaviour, disabled-state timing, scroll/focus restoration, and rendered layout. Those belong to the Lead's runtime pass.
