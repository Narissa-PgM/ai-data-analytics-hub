## Round 8 — project-specific investment logic + "how this number is computed" popups

**Why every programme said roughly $130K.** The cost line was `weeks × 40 × FTE × rate + tools` with **fixed
defaults** — FTE 1.5, loaded rate $85/h, tools $18,000 — and the schedule comes from one six-phase WBS template, so
the week count barely changes between projects. ($130,000 − $18,000) ÷ (40 × 1.5 × 85) ≈ 22 weeks: the same number
was structural, not a coincidence.

**Now the defaults are derived per project** (still overridable on the A · Achievable tab):

| Input | Before | Now derived from |
|---|---|---|
| Team FTE | 1.5 fixed | work-package count: 1 + packages ÷ 14, clamped 1.2–3.2 |
| Loaded rate | $85/h fixed | role salary midpoint ÷ 2,080 h × 1.35 (else seniority: Chief/VP $115, Director $100, Manager $85, default $90) |
| Tools & licences | $18,000 fixed | programme type: AI/platform $42K · analytics/data $24K · advancement $21K · finance $18K · PMO $15K · governance $12K |

Result: the same analytics-style programme now lands around **$196–204K** and an advancement programme around
**$256K** — different projects, different numbers (`qa/verify9.mjs` asserts the tile equals `weeks × 40 × FTE × rate
+ tools` exactly, and that two programmes differ).

**Every headline number is now clickable** (“how?” on each tile) and opens *“How this number is computed”* with the
formula, each input’s value, where the input came from (your input vs derived default), and the provenance note:

- S tab: planned duration, chance on time, estimated investment, 3-year ROI, KPIs, risks
- A tab: investment, annual benefit, 3-year NPV, ROI, payback, P80 cost

The cost popup also explains why durations cluster (one WBS template) and shows both the P50 and P80 investment.
Everything is labelled **PLANNING ESTIMATE / SAMPLE** with “replace rate and tools with real quotes before
committing”.

Verified: `qa/verify9.mjs` **12/12**; regression verify8 12/12, verify7 18/18, verify6 14/14, smoke 32/32,
verify5 8/8, verify4 9/9, verify3 10/10, baseline clean.

---

## Round 7 — structured research documents accepted (the CREO evidence-register shape)

The pasted JSON was a **research document**, not the flat `{mission, values, initiatives}` the box expected:
`research_metadata`, `mission_values_by_level`, `current_strategic_plan`, `strategic_research_priorities`,
`related_current_initiatives`, `university_research_partners`, `proposed_creo_operating_priorities`,
`evidence_register`, `limitations`, `executive_conclusion`. That shape was rejected as "no research fields
recognised". It is now adapted automatically:

| JSON in the document | Where it lands |
|---|---|
| `mission_values_by_level[]` (level 1–4: `mission.exact_quote`, `exact_quote_segments`, `mission_interpretation`) | **Mission** — one line per level, prefixed with the organization |
| `values[]` + `published_principles[]` across levels | **Values** — one per line, de-duplicated |
| `current_strategic_plan.name / planning_horizon / publication_date` | **Plan** |
| `current_strategic_plan.goals[]` and `related_current_initiatives[]` | **Initiatives** (`name \| status \| horizon \| url`) |
| `evidence_register[]`, `university_research_partners[]`, plan PDF | **Sources** |
| `proposed_creo_operating_priorities.priorities[]`, `strategic_research_priorities[]` | kept **separately** as operating priorities (candidates, never presented as approved) |
| `executive_conclusion.recommended_application_theme` | the program’s application theme/lede |
| `job.institution / school / reference / url` | job organization, unit, reference (`003413SR`) and posting URL when empty |

The same research then feeds Work Sample Studio automatically (mission + plan in the brief), so the cascade and
SMARTER fields are built from the sourced text. Fidelity detail: quote normalisation is now a **last resort**, so a
valid JSON reply keeps its curly apostrophes and exact wording.

Verified with `qa/verify8.mjs` — **12/12** against this exact schema (mission from all four levels including the
level-4 `mission_interpretation`, values + principles, plan, goals + initiatives, evidence register → sources,
operating priorities kept apart, executive theme, job reference, organization, work-sample brief receives mission
and plan, 0 console errors). Regression: verify7 18/18, verify6 14/14, smoke 32/32, verify5 8/8, verify4 9/9,
verify3 10/10, verify2 16/16, baseline clean.

---

## Round 6 — JSON paste made tolerant and visible (and JSON contracts accepted)

The SMARTER-program "Paste research JSON" reader now runs a cumulative repair pipeline and accepts the formats AI
output actually arrives in: code fences, prose before/after, `//` and `/* */` comments, typographic quotes,
single-quoted strings, **raw newlines inside strings**, unquoted keys, Python `True/False/None`, trailing commas,
and top-level arrays. Each pass is tried least-invasive first; balanced `{…}`/`[…]` extraction means extra text is
ignored rather than fatal.

Feedback is now impossible to miss and persistent:

- **success** → dialog *"Research JSON applied — Loaded N fields"* listing what landed (organization, mission,
  values, initiatives, plan, motto, principles, context), plus a toast;
- **failure** → dialog *"Could not read that JSON — Nothing was changed"* with the parser's message and the common
  causes; the JSON box stays open;
- the research card keeps a line *"· JSON applied <time>"* so you can see it took.

The **contract box also accepts JSON** now: `{contract_parties, contract_period, baseline_rule, priorities:[{n,
title, source, specific, measurable, achievable, relevant, timeBound, evaluated, revised}], governance:[…]}`
renders as the same one-block contract (verified: 2 priorities).

Verified: `qa/verify7.mjs` **18/18** (8 payload styles × applied + persistent note, plus the unrepairable case),
`qa/verify6.mjs` **14/14** (including the JSON contract), smoke **32/32**, 0 console errors.

---

## Round 5 — JSON paste fixed, and the SMARTER contract is now one multi-priority block

### 5.1 "Paste research JSON" in the SMARTER program now works with real AI output

It used to take everything from the first `{` to the last `}` and pass it straight to `JSON.parse`, so common
AI/Word formatting failed. It now:

- strips code fences and normalises typographic quotes (`"…"`, `'…'`);
- finds the largest **balanced** JSON object/array (string-aware), so prose before/after is ignored;
- tolerates **trailing commas**;
- accepts both shapes: `{research:{mission…}}` / `{roleIntel…}` and `{identity:{…},plans:{…}}`;
- applies `mission / values / initiatives / strategic_plan / motto / principles / context / org`;
- shows a readable message when nothing recognisable is found (listing the keys it saw), instead of failing silently;
- reports how many fields were applied.

Tested payloads: fenced, prose-wrapped, nested `research`, curly quotes, trailing commas → all apply; unknown keys →
"Could not read that JSON: JSON read, but no research fields were recognised (keys: …)".

### 5.2 SMARTER — the measurement contract: one block, many priorities

The section used to accept only one mission as seven separate letter fields. Work Sample Studio → **01 Brief →
Details → SMARTER — the measurement contract** now starts with:

> **Whole contract — paste it as one block (multi-priority)**

Paste the contract exactly as written (the HKS CREO example from the request is supported verbatim):

- header: **Contract parties / Contract period / Baseline rule**
- `Priority 1 … N` headings with their `Source:` line
- seven terms per priority: Specific, Measurable, Achievable, Relevant, Time-bound, Evaluated, Revised
  (`Element ⇥ Contract term` header lines are ignored, multi-line terms are joined)
- **Governance of the contract itself** (checkpoints, dashboard, change control, non-negotiables)

It is rendered as **one block** — header table, then one card per priority with its seven terms, then governance —
in **02 One-page spec** (replacing the seven-letter strip), and the whole contract is carried verbatim into
**03 Build prompt** with the instruction: *"ONE block … do not split it into seven separate letter fields or drop a
priority"*. The completeness meter counts it (28 points, one item) and the seven single-letter fields remain as the
fallback when no multi-priority contract is pasted.

Verified with `qa/verify6.mjs` — **12/12** (4 JSON cases + readable error, contract block, all priorities, governance,
strip suppressed, prompt carries it, prompt forbids splitting, meter counts it, 0 console errors).
Full regression after the change: smoke 32/32, verify2 16/16, verify3 10/10, verify4 9/9, verify5 8/8, baseline clean.

---

## Round 4 — non-strong requirements now flow into the report, the work sample and the prompts

**Request:** in "Requirement-by-requirement evidence map", any requirement that is not **strong** should be
automatically added to the report, the sample and the prompts.

Non-strong requirements (partial + gap) are now taken from the current analysis and written into four outputs
automatically, with their status, missing terms and closest evidence:

| Output | Where it now appears |
|---|---|
| **Report** | Application pack (`application-pack-<job>.html`) → new section **"2b · Requirements that are not yet strong"** (status · requirement · missing terms · closest evidence) |
| **Sample spec** | Work Sample Studio → 02 One-page spec → new block **"3b. Requirements that are not yet strong (N)"** |
| **Build prompt** | Work Sample Studio → 03 Build prompt → new section **"1b. Requirements that are not yet strong (address every one)"** with a no-invention rule and per-item instructions |
| **AI tailoring prompt** | Job Fit → "Copy AI tailoring prompt" → each gap line now carries its **missing terms** and **closest evidence** |

The Fit dashboard also states the count: *"3 requirements are not strong — they are added automatically to the AI
tailoring prompt, the application pack and the work-sample spec and build prompt."* Nothing is invented: the
sample is told to either show the page/control/model/chart that closes the gap or label it as a plan or assumption.

Verified with `qa/verify5.mjs` — **8/8** (weak count found, dashboard note, prompt gaps + missing terms, spec block,
build-prompt instruction, pack section, 0 console errors). Full regression after the change: smoke 32/32,
verify2 16/16, verify3 10/10, verify4 9/9, baseline clean.

---

## Round 3 — switching jobs now refreshes the Apply workspaces and their prompts

**Symptom:** after selecting a new job in Job Fit Studio, the Work Sample Studio build prompt, Career Fit prompt
cards, and some Apply fields still showed the previous job (e.g. its title, organization and job description).

**Cause:** the "Apply" workspaces (Resume + Cover Letter, Career Fit & Demo Gaps, Work Sample Studio) auto-refresh
only from a **rail-button click**. Opening them programmatically — Job Fit's "Build work sample →" / "Send to Work
Sample Studio →" handoff — skipped that refresh, so the fields and the generated prompt under "03 Build prompt"
stayed on the old job.

**Fix:** refresh is now also triggered whenever an Apply panel becomes visible (`MutationObserver` on the panel's
`hidden` attribute), and the handoff goes through the same path. A small `window.EPApplySync` hook is exposed for
future handoffs. Switching jobs and then using "Build work sample →" now rebuilds the prompt for the current job;
switching back restores the previous job's content.

Rules that did not change: auto-filled fields are refreshed for the new job, but a field **you typed yourself is
kept** ("Details — see or edit every field" warns you); clear that field or press "Fill & build" if you want the
new job's value.

Verified with `qa/verify4.mjs` — **9/9**: prompt rebuilt after the in-app handoff, no old-job text in any Job Fit
tab, Career and Career Fit follow the new job, switching back restores job A, 0 console errors. Full regression
after the change: smoke 32/32, verify2 16/16, verify3 10/10, baseline 0 errors.

---

# AI_Pilot.html — improvement pass

**Deliverable:** `ai-pilot-v3/AI_Pilot.html`
**Size:** 2,345,591 bytes (was 2,295,845 — +49.7 KB, all CSS/comments/logic; no dependencies added)
**Lines:** 16,521 (was 15,901) · **sha256:** `CFA039F4C4957ACE5B44C932E1FB09ED1C56ABB58D05C9764E869C7CA41BF8F3`
**Baseline preserved untouched:** `ai-pilot-v3/baseline/AI_Pilot.baseline.html` (`948E106B…`)
**Scope agreed with the user:** fixes + performance + mobile/accessibility polish. No features removed, no new features, still one offline file.

---

## Round 2 — format checks now fix instead of advising, and the SMARTER résumé is restored and hardened

### 2.1 Format checks: “How to fix” → “Fixed”, with a list of what changed

The ATS & format checks measured the uploaded résumé only, so every issue was a recommendation. The app now also
measures the same eight checks against the **tailored SMARTER résumé it generates**, and shows the difference:

| Check | Source résumé | Tailored SMARTER résumé |
|---|---|---|
| Contact details | pass | pass |
| Length fits two pages | warn (1,310 words) | **fixed** (766 words) |
| Standard section headings | warn (2 of 3) | **fixed** (3 of 3) |
| Results are quantified | warn (38 %) | needs your facts |
| Bullets start with an action verb | fail (5 %) | **fixed** (70 %) |
| Roles carry dates | pass | pass |
| Job keywords | pass | pass |
| Profile / summary | fail | **fixed** |

- The real fixes are in the generated document: the leadership statement heading is now
  **“PROFILE · EXECUTIVE LEADERSHIP STATEMENT”** and capabilities are **“SKILLS & CAPABILITIES”**, so parsers
  see Profile, Skills and Experience; experience bullets are chosen to prefer verb-led, quantified lines
  (still only the user’s own bullets — nothing is invented).
- Each fixed row is green and reads **“Fixed in your résumé”**; clicking it opens a popup that starts with
  “Fixed in your tailored SMARTER résumé…” instead of only “how to fix”.
- A **“Fixed for you in the tailored SMARTER résumé (4)”** panel lists what changed and states explicitly:
  **“Résumé length is unchanged. The tailored résumé stays at two pages.”**
- The ATS-readiness KPI now counts those fixes (7/8 rather than 3/8).
- The only remaining item is “Results are quantified”, which needs a number only the user can defend — it is
  labelled “Needs your own facts: the app will not invent these.”

### 2.2 SMARTER format — verified present, then made impossible to lose silently

Both the original file and the previous build render the SMARTER résumé (probe: identical 10,038-character card,
`Specifically / Measurably / Achievably / Relevantly / Time-bound` intact); nothing had been removed. Two
hardening changes make the earlier symptom (“the SMARTER format is gone”) unreproducible:

- the card no longer returns empty when rendering throws — it now shows the card with a plain-language note;
- `EPAppDocs` failures are contained so the source résumé, checks and downloads keep working.

It also gained the ATS-recognised headings while keeping every SMARTER element, and the downloadable résumé now
**prints on exactly 2 letter pages** (verified with headless print-to-PDF: 2 pages, was 3).

Verification after round 2: `qa/verify3.mjs` **10/10**, `qa/smoke.mjs` **32/32**, `qa/verify2.mjs` **16/16**,
0 console errors, 15/15 workspaces, no horizontal overflow at 360–1920 px.


## 1 · What changed, and why

### Performance — the Command Library is now built on first open (not at load)

The library panel rendered all 111 command cards (3,650 DOM nodes) at startup while hidden. `render()` now updates the counters and rail categories but defers the card grid until the panel is actually visible; `activateView('library')` builds it on first open.

| Metric (headless Edge, same machine) | Before | After |
|---|---|---|
| DOM nodes at load | 10,193 | **6,608** (−35 %) |
| First contentful paint | 572 ms | **340 ms** |
| DOMContentLoaded | 1,036 ms | **550 ms** |
| Load event | 1,088 ms | **578 ms** |

Side benefit: the documented **`/` and `Ctrl/⌘ + K` search shortcuts now work from any workspace.** They used to focus an input inside the hidden library panel (a no-op); they now open the library and focus the field, which also triggers the deferred build.

### Correctness — the synthetic demo chart no longer invents a forecast

The analyzer's "Historical & forecast lens" split the observed/forecast line at a hard-coded year 2026 and ignored the analytics-depth selector, so "Historical descriptive only" still drew a dashed *Synthetic forecast* segment, and a horizon ending before 2026 drew the entire series as forecast. The split now follows each row's own classification (`SYNTHETIC_HISTORY` vs `SYNTHETIC_FORECAST`/`SYNTHETIC_ILLUSTRATION`), the legend names only what is actually drawn, and the tile caption follows the chosen horizon instead of a fixed "2020–2030".

Verified in the browser: historical 2020–2024 → zero forecast points, legend "Synthetic history", caption "2020–2024"; forecast 2020–2030 → dashed segment + "Synthetic history / Synthetic forecast".

### Accessibility — focus, contrast, keyboard

| Change | Before | After |
|---|---|---|
| Focus ring (all 9 workspace rules) | amber rings 1.76–2.29:1 | one ring `#0b5d6b` = **7.52:1** on white, 7.07:1 on paper |
| Micro-text (9–13 px) | 2.41–4.49:1 | `#56697a` = **5.68:1** |
| Placeholders | 3.17:1 | `#666f7a` = 5.10:1 |
| Form-control boundaries | 1.35–1.46:1 | `#7f919c` = **3.26:1** |
| SVG chart nodes (`role="button"`) | Tab-focusable but Enter/Space did nothing | Enter/Space activate them |
| `#edModal` / `#xpModal` | `aria-modal` with no focus containment | Tab is trapped inside the open dialog |
| Skip link | `<main>` not focusable | `<main tabindex="-1">` |

Runtime contrast sweep (4,020 text elements across all 15 workspaces, gradient backgrounds excluded): **463 → 218 failures (−53 %)**; the Job Match Radar workspace is now clean (0 / 753).

### Mobile (< 760 px)

| Change | Before | After |
|---|---|---|
| Job Fit hero stepper | 3 cards stacked full-width ≈ 374 px | 3-across ≈ **66 px** |
| Sticky toolbar | always wrapped to 2 rows and stayed pinned ≈ 120 px | not sticky on phones |
| Touch targets (`clear-search`, `icon-btn`, action buttons…) | 22–38 px | **44 px** |
| Job Fit KPI strip at ≤ 480 px | 5 stacked rows | 2-column |
| Horizontal nav | no cue that it scrolls | fade mask + scroll-snap |

No horizontal document overflow at 360/390/768/1024/1440/1920 (verified).

### Print

The ExecutivePilot workspace printed white-on-white (dark gradient hero, white text, browsers drop backgrounds). A print override now renders the hero as dark text on white with a border. Print output from the default workspace is unchanged (2 pages).

### Content accuracy

`<meta name="description">` claimed the Radar "scores … against live job-board searches"; it ranks 14 local archetypes and links out. Reworded to match what the tool does.

---

## 2 · Verification performed

Headless Edge (CDP, no npm packages) against the final file:

- **Syntax:** inline script extracted, `node --check` clean.
- **Baseline audit:** 0 console errors, 0 exceptions, 0 duplicate IDs, 0 broken anchors, 0 unnamed buttons/inputs, 15/15 workspaces reachable, no error on any view switch.
- **Functional smoke suite (`qa/smoke.mjs`): 32/32 pass** across all 15 workspaces — sample-job scoring, library search/details/favourites, career package + tabs, radar ranking + role dialog, MA jobs, remote proposal, fit scorecard + gap backlog, work-sample meter + spec, admissibility gate + sheet, enterprise generator, pilot KPIs, analyzer, audit lab, QA gate, gallery popups, title tracking, Ctrl+K.
- **Fix verification (`qa/verify2.mjs`): 16/16 pass** — lazy library build, focus-ring rule, input boundary colour, micro-text colour, chart semantics in both modes, `[data-ri]` keyboard activation, modal Tab containment, Ctrl+K from another workspace, 3-across stepper, static toolbar, 44 px targets, no overflow, print colours, skip target.
- **Contrast sweep (`qa/contrast.mjs`):** see table above; `reports/contrast.json` lists every remaining item.
- **Screenshots:** `reports/shots-v2/` (15 desktop + 3 phone) can be compared with `reports/shots/` (before).

### Audit input

51 verified findings were produced by three parallel static auditors (`reports/audit-a11y-mobile.md`, `audit-logic.md`, `audit-content.md`). This pass implements the high-impact subset; the reports remain the backlog for anything below.

---

## 3 · Audit claims checked and deliberately not changed

Two "high/medium" findings did not survive runtime verification, so the source was left alone:

1. **"111 commands is wrong, the library has 105" / "Learning 22 and Strategy 19 are wrong".** At runtime `COMMANDS.length === 111` and the group counts are exactly 22/15/20/15/20/19 — six entries are added programmatically after the array literal the auditors parsed. The UI is correct; changing it would have broken it.
2. **"`Nothing is uploaded anywhere` is false because Polish with Claude sends text".** No network request is made during any tested flow; the only `fetch` is the user-initiated public-URL inspection (a download), and the Claude polish action reports that it only works when the page is opened from its Claude link. The hero claim stands for this file.
3. The baseline's "2 `<svg>` without accessible names" is a false positive: both are `aria-hidden` decorative graphics.

---

## 4 · Known remaining items (not regressions, pre-existing)

- **218 marginal contrast pairs** left, almost all 10–12 px labels at 3.4–4.4:1 (the tonal `.xp-round` date pills, a handful of helper lines) plus gradient surfaces that cannot be measured statically. Full list: `reports/contrast.json`.
- 4 of 6 tab lists still lack Arrow-key navigation (`#outputTabs`, `#cTabs`, `#xpTabs`, `#fitTabs`); the Admissibility and Work Sample tab strips are already correct and can be copied.
- A single global `@page{size:portrait;margin:10mm}` rule (inside the Admissibility print block) applies to every workspace's print.
- Career/Job-Fit `<textarea>` editors still print clipped content (no printable substitute is wired up).
- The rail's static markup still ships the older group labels/counts; JavaScript re-labels them at runtime, so the rendered UI is correct but the source text is stale.
- `render()` is intentionally skipped while the library is hidden — if you later add code that expects `#catalog` children at load, call `render()` after un-hiding the panel.

---

## 5 · How to use

1. Open `ai-pilot-v3/AI_Pilot.html` in any current browser (no server, no network).
2. To replace the copy in `Downloads`, copy this file over `C:\Users\sawat\Downloads\AI_Pilot.html` (the original is preserved at `ai-pilot-v3/baseline/AI_Pilot.baseline.html`).
3. Re-run the checks any time:
   ```
   node qa/baseline.mjs        # console errors, views, a11y, responsive, print
   node qa/smoke.mjs           # 32 functional flows
   node qa/verify2.mjs         # 16 fix-specific assertions
   node qa/contrast.mjs        # WCAG runtime sweep
   ```
   (These need the headless browser, which this sandbox only allows with elevated file access.)






