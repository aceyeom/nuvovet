# NuvoVet Frontend Architecture

## Product Overview

nuvovet is a veterinary software platform for companion animals (dogs and cats). The frontend is a mobile-first React/Vite app that presents the platform's product lines and runs the live DUR demo and the clinic workspace.

### Brand architecture

| Brand | Colour token | Status | What it is |
|-------|--------------|--------|-----------|
| **nuvovet** | `ink` (monochrome) | — | Master brand. The official wordmark (`NuvovetWordmark`, vectorised from `assets/branding/nuvovet_final.svg`). There is no pictorial mark. |
| **nuvo<span>DUR</span>** | `dur` (teal) | Live | Drug utilization review that docks on top of the clinic's existing EMR, surfaced through the **nuvoDUR island**. |
| **nuvo<span>Claim</span>** | `claims` (violet) | In development | Pet-insurance claims assembled from the visit record (marketing preview + waitlist only). The status reads "In development" / "개발 중" everywhere (`landing.claimsStatus`). |

Product names are set in type, never as icons or badges (`components/NuvovetLogo.jsx`):

- `ProductLockup` — bold "nuvo" + the product word in its colour ("nuvo**DUR**", "nuvo**Claim**"); sizes `xs`–`2xl`, `tone="dark"` for dark surfaces.
- `ProductName` — the same, inline inside running text (inherits size and weight).
- `BrandText` — colours every "nuvoDUR" / "nuvoClaim" inside a plain i18n string.

The favicon is a geometric "n" on an ink square with a teal rule.

---

## Design Philosophy

**Clinical, calm, colour with meaning.** One accent per product line; severity colours (red / amber / yellow / emerald) are reserved for clinical meaning.

**Type does the talking.** No pill chips with dots, no status pills, no icon tiles, no decorative icon sets. Structure comes from typography: `kicker` micro-labels (mono caps for Latin; Pretendard with tight tracking for Hangul, see `.kicker` in `index.css`), coloured severity words (CRITICAL / 심각), large tabular numbers, hairline rules, ruled lists and real tables. Status is written as a word ("AVAILABLE NOW", "PASS", "FLAG"). Typographic arrows (→) are the only glyphs.

**What is what.** Three visual layers are kept distinct everywhere:

| Layer | Look | Example |
|-------|------|---------|
| nuvovet (marketing / chrome) | Ink + product colours, Pretendard; the hero is a dark sci-fi stage | Landing, the dark bar above the demo |
| The clinic's EMR (simulated) | A classic Windows desktop app (`emr.*` tokens): title bar + window controls, menu bar, F-key toolbar, grey grid headers, label/value registration form, square corners, 12 px type | `/demo`, the hero capture |
| nuvoDUR | Near-black island (`island.*` tokens) docked across the EMR window's top edge, plus glowing outlines drawn *over* flagged EMR rows | Every alert / status |

The EMR never contains nuvoDUR elements; nuvoDUR is always an overlay (the island and the `.dur-row-overlay` boxes measured over grid rows).

**Mobile-first.** Every layout works on phones: the EMR collapses to a compact grid and a narrow registration form, the hero switches to a portrait capture with a one-line engine read-out.

**Motion.** Spring-based island morphs (CSS `linear()` spring with a cubic-bezier fallback) and blur crossfades; the hero adds a boot sequence, aurora, particles, a rolling grid floor and HUD instruments. Everything pauses off-screen; `prefers-reduced-motion` shows still frames with manually steppable chapters.

**Page canvas.** The landing page and the demo are dark, the clinic workspace is white. `usePageCanvas(color)` (`lib/usePageCanvas.js`) sets `--page-canvas` (the html/body background that shows on iOS over-scroll) and the `theme-color` meta while a route is mounted; an inline script in `index.html` sets the right value before the first paint, and the route loading screen (`RouteFallback` in `App.jsx`) matches the route it is loading, so nothing flashes white before the hero.

---

## User Flows

### 1. Landing Page (`/`)

1. **Nav** (`landing/SiteChrome.jsx`) — transparent over the hero, dark glass once scrolled. nuvovet wordmark, product links (nuvoDUR / nuvoClaim with its status), How it works, Live demo, language, Clinic sign-in, Request access; skip link to `#main`. On phones a "Menu" text button opens a full-screen sheet that explains every destination in one line.
2. **Hero** (`landing/Hero.jsx`, dark) — runs up behind the nav (`-mt-16 pt-16`). Kicker line, decrypting headline (scrambled glyphs resolve into the text without layout shift, `DecryptText` in `landing/motion.jsx`), subhead, a glowing conic-border CTA to the demo, request access, meta line; then `HeroShowcase` (below). Wide-but-short laptop screens (`lg-short` screen in `tailwind.config.js`: ≥1024 px wide, ≤940 px tall) get tighter spacing so the EMR monitor clears the fold.
3. **Sections** (`landing/Sections.jsx`):

| # | Section | Content |
|---|---------|---------|
| — | Stats (dark) | 877 Korean veterinary products · 10 interaction rules · 7 patient-context checks · 1 island |
| 01 | Product family | nuvoDUR and nuvoClaim side by side, each with its status, tagline, bullets and a small docked specimen |
| 02 | Island states (`#dur`, `#how`) | The island's states on a real EMR fragment: compact → checking → alert → expanded → resolved |
| 03 | Engines (dark) | Every check the engine runs, as a live table computed by `analyzeRegimen`, next to a working island |
| 04 | Coverage | The six-case drug pipeline as a ruled table (how unapproved, foreign and unknown drugs are handled) |
| 05 | nuvoClaim (`#claims`) | Preview: the EMR visit → an itemised claim statement (₩121,990) → a submission log; waitlist button |
| 06 | Demo band (dark) | Three steps and today's patient list; every row opens that patient's chart in the demo (`/demo?patient=<id>`) |
| 07 | Get started | Destinations (demo, clinic sign-in, request access) as large ruled rows |

Then a dark footer.

### 2. Live EMR demo (`/demo`)

A simulated clinic EMR with nuvoDUR docked on top. No login, no wizard:

- **nuvoDUR bar** (dark): back to nuvovet, nuvoDUR lockup, "Live demo", the patient's **Scenario** button (e.g. "Allergy flare — add Prednisolone →"), Guide, language, Full report, Request access. On phones the scenario sits on a second row.
- **EMR window** — a Windows desktop EMR: title bar (`Clinic EMR 4.2 | Demo Animal Hospital — Consult — Buddy (1548)`) with window controls, menu bar (파일(F) 편집(E) …), F-key toolbar (접수 F2 · 진료 F3 · 수납 F4 …), 진료대기 grid (time · patient · owner · status), 보호자 정보 panel (phone, address, visits, 미수금, 적립금, insurance), registration form with the patient's **real photo** (동물번호 · 동물이름 · 종 · 품종 "GOLDEN RETRIEVER/골든 리트리버" · 성별 · 나이 · 체중 · 생년월일 · 보호자 · 담당의 · 혈액형 · 동물등록번호 · 알레르기 · 주요질환), classic tabs (진료기록 · 처치/처방 · 검사결과 · 진료이력), status bar (준비 · 서버 · 진료실 · 사용자 · clock).
- **처치/처방** — visit strip (진료일자 · 구분 · 접수 · 담당의 · 주호소), 처방 검색 (results grid: 상품명 · 성분명 · 분류) with 자주 쓰는 처방 links, the TX/RX grid with the real column set (No · 폴더명 · 이름(Tx/Rx) · 단위 · 투여량 · 계산량 · 일수 · 횟수 · 경로 · 전체 · VAT · 금액 · 삭제; mid/compact column sets on tablets/phones), totals, 행 추가 / 행 삭제 / 이전 처방 불러오기 / 처방전 출력 / 저장 (F9), and 처방 메모 · 복약지도.
- **nuvoDUR island** docked across the window's top edge (centre of the title bar, which the EMR leaves empty). Flagged rows get a measured overlay box in the severity colour; the rows of the finding open in the island glow.
- **First-run guide** (3 spotlight steps: the grey window is the EMR → the black island on top is nuvoDUR → run the scenario). Stored in `localStorage` (`nuvovet-demo-guide-v3`), re-openable via "Guide".
- **Full report** opens `ResultsDisplay` in a sheet (`embedded` mode) including patient-context checks.
- **Deep link** — `/demo?patient=<id>` (e.g. `australian_shepherd`) opens straight on that chart; the landing page's patient list links here.

### 3. Clinic workspace (`/system`)

Access-code protected (`vetdur2025`; remembered for the tab in `sessionStorage` under `nuvovet-workspace-auth`). The gate is a dark panel beside the sign-in form. After sign-in: a two-column review (patient + prescription on the left, a readiness readout on the right; a sticky run bar on phones), then the analysis screen and the report. Drug search hits the FastAPI backend and falls back to the local formulary when it is unreachable. `/patients` lists saved profiles (table on desktop, ruled list on phones) and preloads one into `/system`.

### 4. Request access / nuvoClaim waitlist (Modal)

`RequestAccessModal` takes `product` (`'dur'` | `'claims'`) and posts it to Formspree with the request so leads can be routed per product line.

---

## nuvoDUR Island

`components/dur/` — the Dynamic-Island-style overlay that sits on top of the EMR.

| File | Role |
|------|------|
| `DurIsland.jsx` | Presentational island. Views: `compact` (pill), `summary` (all clear), `list` (all findings), `expanded` (one finding with why + fix). Measures its content, animates width/height/radius with the spring curve, crossfades content with blur; a severity halo (breathing for critical) sits outside the clipped surface. `role="region"`, Escape closes. |
| `findings.js` | `analyzeRegimen()` — runs `durEngine` and adds patient-context findings: species hardstop / no species dose, charted allergies, drug–disease contraindications (CKD, MDR1, cardiomyopathy…), MDR1 status in herding breeds, dose outside the species range, cumulative renal load with elevated creatinine. Each finding carries a one-tap `resolution` (`replace` / `remove` / `dose` / `add` / `ack`). |
| `describe.js` | Localised copy for findings and resolutions (`t.island.*`), including `kindLabel`. Pure functions shared by the hero and the demo. |
| `useDurMonitor.js` | Live behaviour for the demo: re-screens on every chart change (short "checking" beat), auto-expands only for findings that are new since the last screen, auto-collapses after ~9 s unless hovered, remembers acknowledgements per patient, applies resolutions via a callback. |

Island language (no dots, no icons):

| State | Compact pill |
|-------|--------------|
| idle / clear | `nuvoDUR │ No issues · 3 meds` ("No issues" in green) |
| checking | `nuvoDUR │ Screening 3 meds…` + a sliding scanner segment |
| alert | `CRITICAL │ Meloxicam + Prednisolone +1` (severity word in colour, red halo) |
| reviewed / applied | `nuvoDUR │ Applied · Meloxicam → Gabapentin` |

Expanded card: severity word + kind ("CRITICAL │ Drug interaction"), ← 1/2 → and Close as text buttons, title, drugs joined by ×, the why, a teal-ruled **Suggested fix** block, Replace / Acknowledge buttons, Full report →, citation in mono.

---

## Hero showcase (`components/landing/HeroShowcase.jsx`)

A scripted capture built from the real EMR components and the real engine (the alert text is what `analyzeRegimen` returns for Buddy + prednisolone).

**Standby** — until it boots, the monitor shows a dim terminal prompt (`nuvoDUR overlay · standby_`) and a resting phosphor line where the power-on line will ignite.

**Boot sequence** (once, when the top 40% of the EMR window is in view — on most laptops that is on load, on shorter screens after a short scroll): a CRT power-on line → the window opens onto a boot log (`[ OK ] Clinic EMR 4.2 · session restored`, `nuvoDUR · overlay attached`, formulary, rules, patient context, `> Monitoring prescriptions_`) with a progress line → a bright edge wipes the log away revealing the EMR with an RGB-split glitch → the island drops in and docks with a shockwave ring while the HUD instruments plug in. The camera rises from a 20° tilt as it boots.

**Loop** (15 s, four chapters, per-chapter camera angles):

| Chapter | Beat |
|---------|------|
| 01 Prescribe | Cursor types "Predn…" in 처방 검색 and adds prednisolone to Buddy's NSAID regimen |
| 02 Scan | A beam sweeps the EMR; every instrument reads SCANNING; circuit traces flow |
| 03 Alert | Red shockwave + window pulse; island expands (NSAID + corticosteroid); flagged rows glow; DDI matrix, organ load (GI 88) and evidence panels FLAG |
| 04 Resolve | "Replace" swaps meloxicam → gabapentin; a green wave washes the window; all instruments PASS; island settles to "No issues · 3 meds" |

**HUD instruments** (≥1180 px, either side of the window, wired to the island by circuit traces): 01 DDI matrix, 02 CYP450 load, 03 Species · breed, 04 Dose (dose × weight = mg against the range), 05 Organ load (renal / hepatic / GI), 06 Evidence (the finding's citation). Phones get a one-line read-out instead.

**Backdrop** (`HeroBackdrop.jsx`): aurora mesh (four light sources on separate clocks), a canvas particle field with data streaks, rotating HUD rings, a perspective grid floor rolling toward the viewer, scanlines, a refresh band, grain and vignette, with scroll parallax.

Telemetry line (LIVE CAPTURE · simulated EMR · `T+00:04.21` timecode written straight to the DOM · CH 02/04), a chapter scrubber (progress hairlines, jump to any chapter, Pause/Play as text). Everything pauses off-screen and on hidden tabs; reduced motion shows a static chapter-3 frame.

---

## Patient photos (`data/patientPhotos.js`)

Real photographs from Unsplash (Unsplash License — free for commercial use; photographers credited in the module and in alt text), matched to each breed and hotlinked from the Unsplash CDN with `crop=entropy` square crops. `PatientPhoto` falls back to a plain initial box if an image cannot load.

| Patient | Breed | Photographer |
|---------|-------|--------------|
| Buddy | Golden Retriever | Richard Brutyo |
| Max | Australian Shepherd | Joakim Nådell |
| Coco | French Bulldog | speckfechta |
| Oscar | Dachshund | Kevin Jackson |
| Mochi | Korean Shorthair (tabby) | Jae Park |
| Luna | Persian | Rana Sawalha |
| Nabi | Siamese | Alex Meier |

---

## Results Page

The nuvoDUR report (`ResultsDisplay.jsx`) is set like a lab report — no chips, badges or icons:

- **Masthead** — nuvoDUR lockup, report number, timestamp, patient line; Print / PDF export (`ScanExportPDF.jsx`, printable nuvoDUR report).
- **Verdict** — the overall severity as a large coloured word (CRITICAL / 심각) with the counts beside it. The overall severity is the maximum of pairwise interactions and the island's patient-context findings, so it never reads "None" above a critical finding.
- **Findings** — ruled entries, each with a short vertical rule in its severity hue: severity word, rule name in mono, drug pair, drug classes. Expanding shows the mechanism, a ruled **suggested action** (a named alternative with a dose for critical interactions), the 24-hour PK timeline (`DrugTimeline.jsx`) and the literature (plain-language summary first, citations below).
- **Review** — "Mark as reviewed" / "Note" per finding (never "Override"); reviewed entries are muted and a counter shows X of Y reviewed.
- **Patient-context checks** — when opened from the demo, the island's findings (allergy, drug–disease, dose range, species, organ load) follow as their own ruled list.
- **Advisories** — per-drug notes (source: Korean veterinary / off-label / foreign / unverified, MDR1 sensitivity, narrow therapeutic index, species notes), written as words.
- **Side column** (desktop; after the findings on phones) — patient data, organ load (`OrganLoadIndicator.jsx`) and confidence with its source breakdown (`ConfidenceProvenance.jsx`).

`SeverityBadge.jsx` exports the shared severity vocabulary: `SEVERITY_TONE`, `severityKey`, `severityTone`, `severityWord` and the `SeverityBadge` word itself.

---

## Drug Pipeline — Six Cases

1. **Korean Approved Veterinary Drugs** — Full profiles, maximum confidence
2. **Human Drugs Used Off-Label** — Off-label advisory, confidence -5%
3. **Foreign Drugs** — Foreign drug badge, confidence -8%
4. **Unknown Drugs** — Prompts for active ingredient, confidence -25%, "Insufficient Data" labels
5. **Multi-Drug Combinations** — N×(N-1)/2 pairwise checks
6. **Species-Specific Adjustments** — Per-species dosing, pharmacokinetic differences, breed flags

---

## DUR Interaction Engine — 10 Rules

| Rule | Severity | Example | Alternative Suggestion |
|------|----------|---------|----------------------|
| Duplicate NSAID | Critical | Meloxicam + Carprofen | Gabapentin 10 mg/kg PO TID |
| NSAID + Corticosteroid GI Risk | Critical | Meloxicam + Prednisolone | Prednisolone alone + Omeprazole |
| Serotonin Syndrome Risk | Critical | Tramadol + Trazodone | Gabapentin 10 mg/kg PO TID |
| QT Prolongation Stacking | Critical | Digoxin + Enrofloxacin | Amoxicillin if spectrum allows |
| Electrolyte-Mediated DDI | Critical | Furosemide + Digoxin | Spironolactone + K+ supplementation |
| CYP3A4 Inhibition | Moderate | Ketoconazole + Cyclosporine | Fluconazole or 50% dose reduction |
| CYP2D6 Inhibition | Moderate | Fluoxetine + Tramadol | Gabapentin (non-CYP2D6) |
| Renal Elimination Stacking | Moderate | Amoxicillin + Gabapentin | Hepatically-cleared alternative |
| Bleeding Risk Stacking | Moderate | Meloxicam + Dexamethasone | Gabapentin + gastroprotection |
| CYP Enzyme Induction | Minor | Phenobarbital + Prednisolone | TDM and dose adjustment |

Each interaction includes: mechanism, clinical recommendation, alternative suggestion, plain-English literature summary, and academic citations.

---

## Drug Database — Pharmacokinetic Data

26 curated drugs in `drugDatabase.js` for the demo and API fallback. The backend serves 641 drugs loaded from JSONL files. Both use the same frontend Drug contract (see `docs/backend_frontend_connection.md`).

Key fields:

**Core fields:** Active substance, drug class, Korean name, CYP enzyme profiles, risk flags, renal elimination, species notes, contraindications, dose/route/frequency, doseRange, organBurden, washoutPeriodDays.

**PK parameters (`pk` sub-object):**
- `halfLife` (hours) — drug elimination half-life
- `timeToPeak` (hours) — time to peak plasma concentration
- `bioavailability` (0-1) — fraction absorbed
- `proteinBinding` (0-1) — plasma protein binding
- `primaryElimination` — `'hepatic' | 'renal' | 'mixed'`

These fields power the Drug Timeline feature and match the JSONL → Drug contract served by the backend.

---

## Demo Patients (`data/breedProfiles.js`)

Seven cases in today's appointment order. Each carries Korean-EMR registration fields, bilingual SOAP / complaint / history, labs with species reference intervals (status is derived from the interval), weight trend, priced Tx lines and an Rx list, plus a **scenario** that triggers its teaching point:

| Patient | Case focus | Current Rx | "Try this" | nuvoDUR result |
|---------|-----------|-----------|-----------|--------------------|
| Buddy · Golden Retriever | NSAID + steroid | Meloxicam, Omeprazole | + Prednisolone | Critical — replace meloxicam → gabapentin |
| Max · Australian Shepherd | MDR1 · renal · allergy | Prednisolone, Metronidazole, Enalapril | + Ivermectin (or Amoxicillin) | Critical MDR1 → selamectin; penicillin allergy; renal load |
| Coco · French Bulldog | CYP3A4 inhibition | Prednisolone, Amoxicillin, Ketoconazole | + Cyclosporine | Moderate ×2 — reduce substrate dose 50% |
| Oscar · Dachshund | Serotonin syndrome | Meloxicam, Gabapentin, Tramadol | + Trazodone | Critical — stop tramadol |
| Mochi · Korean Shorthair | Renal load · drug–disease | Methimazole, Amlodipine, Maropitant | + Meloxicam | Critical renal load; meloxicam in CKD |
| Luna · Persian | QT stacking · cardiac | Enalapril, Furosemide, Pimobendan | + Enrofloxacin | Critical QT — replace with amoxicillin |
| Nabi · Siamese | Serotonin syndrome | Gabapentin, Trazodone, Meloxicam | + Tramadol | Critical — stop tramadol |

`data/emrCatalog.js` maps formulary ids to EMR product names, KRW prices and default regimens, and computes 계산량 / 전체 / 금액 per line.

---

## Loading Experience

**Route loading** — `RouteFallback` (`App.jsx`): the nuvoDUR lockup and a sweeping hairline, on the canvas of the route being loaded (dark for `/` and `/demo`).

**Analysis screen** (`AnalysisScreen.jsx`, workspace) — a typographic readout between "Run DUR check" and the report, ~2.9 s end to end. Six engine steps as a ruled list, each with a status word (queued / running / done), a hairline progress rule and a chart that draws itself underneath:

| Step | Duration |
|------|----------|
| Lead-in | 200 ms |
| Resolve drug identifiers | 350 ms |
| Query the Korean veterinary formulary (877 products) | 450 ms |
| CYP enzyme interaction analysis | 400 ms |
| Pairwise DDI screening | 500 ms |
| Species-specific dose verification | 350 ms |
| Cross-reference literature (PMC, Plumb's, BSAVA) | 400 ms |
| Hand-off | 250 ms |

Uses a `useRef` for the `onComplete` callback to avoid stale closures.

---

## Internationalization (i18n)

### Architecture

React Context-based system (`I18nProvider`) with no external dependencies. Files:

```
src/i18n/
├── index.jsx    # Provider, useI18n hook, LangToggle component
├── en.js        # English translations (~250 keys)
└── ko.js        # Korean translations (~250 keys)
```

### Hook API

```jsx
const { t, lang, setLang, toggleLang } = useI18n();
```

- `t` — translation object, accessed as `t.demo.step1`, `t.results.title`, etc.
- `lang` — current language code (`'ko'` or `'en'`)
- `setLang(code)` — set language explicitly
- `toggleLang()` — toggle between ko/en

### LangToggle Component

Segmented control (`한 | EN`, `aria-pressed`) that fits in any navbar.

### Design Decisions

- **Default language: Korean (`ko`)**. Korean veterinarians are the primary users. The Korean translation is the most complete and clinically accurate.
- **localStorage persistence** under key `nuvovet-lang`. Sets `document.documentElement.lang` for accessibility.
- **No library dependency** — React Context is sufficient for two languages with static translation objects.
- **Medical terminology**: Korean translations use proper clinical terms (e.g., `혈중농도-시간곡선하면적` for AUC, `최고혈중농도 도달시간` for Tmax, `치료역` for therapeutic window).

### Translation Key Namespaces

| Namespace | Coverage |
|-----------|----------|
| Global | `appName`, `back`, `close`, `search`, `loading`, etc. |
| `species` | Dog/cat labels in both forms |
| `nav` | Site navigation + one-line descriptions of each destination |
| `landing` | Hero, chapters, product family (DUR / Claims), island states, engines, pipeline, Claims preview, demo band, CTA, footer |
| `demoX` | Live demo product bar, guide steps, toasts |
| `emr` | Simulated EMR: menu, waiting list, banner fields, tabs, Tx/Rx columns, SOAP, labs, history, status bar |
| `island` | DUR island UI strings, severities, per-rule titles/summaries/actions, patient-context finding copy, resolutions, Korean clinical terms |
| `drugInput` | Search, route filters, drug class labels (workspace) |
| `analysis` | Analysis screen steps |
| `results` | Report: summary band, interaction cards, context checks, acknowledgment, scan summary |
| `pk` | Pharmacokinetic chart labels and annotations |
| `drugClasses`, `routes` | Class and route labels |
| `requestAccess` | Access / waitlist modal |
| `fullSystem` | Clinic workspace sign-in, numbered sections, form fields |

## Drug Timeline — Clinical PK Visualization

### Pharmacokinetic Model

One-compartment Bateman equation with first-order absorption:

```
C(t) = F × (ka / (ka - ke)) × (e^(-ke·t) - e^(-ka·t))
```

Where:
- `F` = bioavailability
- `ka` = absorption rate constant (derived from Tmax)
- `ke` = elimination rate constant (`ln(2) / t½`)

### Multi-Dose Superposition

For BID/TID dosing schedules, concentrations are calculated by summing contributions from each dose administration time:

```
C_total(t) = Σ C_single(t - t_dose_i)  for all t_dose_i ≤ t
```

### Clinical Annotations

- **Cmax** — peak concentration marker (dot + label)
- **Tmax** — time to peak annotation
- **Cmin** — trough concentration at end of dosing interval
- **Therapeutic window** — green shaded band between `therapMin` and `therapMax`
- **Dose arrows** — vertical markers at each administration time

### PK Parameter Table

Rendered below the chart showing: Drug name, t½, Tmax, F%, and dosing schedule for each drug in the interaction pair.

### Visual Design

- SVG-based rendering (no external chart library)
- Drug A: solid slate-800 line with gradient fill
- Drug B: dashed indigo line with gradient fill
- Y-axis: `Cp (relative)` / `Cp (상대 농도)` with percentage ticks
- X-axis: 0–24h with 4h interval markers
- Gradient fills (SVG `linearGradient`) under concentration curves
- Graceful fallback message when PK data is unavailable

---

## Drug Search & Prescription Input

`DrugInput.jsx` (clinic workspace) is an ARIA combobox:

- **Search** — debounced (300 ms); the FastAPI backend first (`searchFn={searchDrugsApi}`), the curated local formulary (`searchDrugs()` in `drugDatabase.js`, ranked by `lib/commonDrugs.ts`) when the backend is unreachable. Matches English, generic and Korean names.
- **Results** — a listbox (↑/↓, Enter, Escape) showing the Korean name in Korean, plus the source as a word when it matters (off-label human drug, foreign drug, unverified).
- **Unknown drugs** — the last option adds what was typed as an unverified drug (`createUnknownDrug`), so off-formulary medications still get screened with lower confidence.
- **Prescription table** — drug, optional dose (mg/kg) and the total for the patient's weight; when a dose is entered, the organ-load figures scale to it.

In the demo, prescriptions are entered in the simulated EMR's 처방 검색 instead (`RxSearch` in `emr/EmrUI.jsx`), with 자주 쓰는 처방 shortcuts.

---

## Typography System

Self-hosted fonts (no font CDN at runtime), imported in `main.jsx`:

| Font | Package | Usage |
|------|---------|-------|
| Pretendard Variable | `pretendard` (dynamic subset) | All UI text, Korean and Latin |
| Geist Mono Variable | `@fontsource-variable/geist-mono` | Clinical numbers, codes, citations, `kicker` labels (Latin) |

`.kicker` (`index.css`) is the micro-label used instead of chips: mono caps with wide tracking for Latin, and under `:lang(ko)` Pretendard bold with tight tracking (Geist Mono has no Hangul).

Legacy utility classes (`typo-page-title`, `typo-section-header`, `typo-body`, `typo-label`, `typo-drug-name`, `typo-score`) remain for the report components. `tnum` enables tabular figures. Korean text uses `word-break: keep-all`.

---

## Print Optimization

CSS `@media print` styles for clinical report output:
- Hidden navigation, backgrounds, and interactive elements
- `print-color-adjust: exact` for severity color preservation
- Clean layout optimized for A4/Letter paper

---

## Technical Stack

- **React 18** with functional components and hooks
- **Vite 5** for build tooling
- **Tailwind CSS 3** for styling (no component library)
- **React Router v7** for client-side routing
- **No icon library** — typography, hairlines and the → glyph only
- **Self-hosted fonts** — Pretendard, Geist Mono (npm packages)
- **Route-level code splitting** — `React.lazy` per page with a branded fallback
- **Formspree** for lead capture form submission
- **Vercel** for deployment (SPA rewrites configured)

No external UI framework, animation library or state management library. No chart library — PK visualizations and brand marks use pure SVG. The DUR engine runs client-side (`durEngine.js`) for sub-100ms response times in both demo and full system modes.

---

## Backend Connection

The `/system` route connects to a FastAPI backend. See `docs/backend_frontend_connection.md` for the full API contract.

```
Browser (React/Vite)
  ├── /demo route    → local static data only (drugDatabase.js, breedProfiles.js)
  └── /system route  → backend API (lib/api.js → FastAPI)
        ├── Drug search    → GET /api/drugs/search?q=&species=&limit=
        ├── Drug lookup    → GET /api/drugs/{id}
        └── DUR analysis   → POST /api/dur/analyze (optional mirror)

FastAPI (backend/main.py)
  └── Loads 641 drugs from backend/data/converted/**/*.jsonl at startup
  └── Maps JSONL schema → frontend Drug contract on every request
```

### API Client (`src/lib/api.js`)

All backend requests go through `apiFetch()`, which:
- Reads `VITE_API_URL` (default: `http://localhost:8000`)
- Wraps every call in `try/catch` — returns `null` on network failure
- Logs warnings in dev mode only

### Fallback Behavior

- `DrugInput.jsx` falls back to local `searchDrugs()` from `drugDatabase.js` if the API throws
- DUR analysis always runs client-side via `durEngine.js` regardless of backend availability
- `/demo` never calls the backend

---

## File Tree (`src/`)

```
src/
├── App.jsx                          # Router (lazy routes): /, /demo, /system, /patients; route-aware loading screen
├── main.jsx                         # Font imports + root render
├── index.css                        # Tokens (spring easing), surfaces, island motion, reduced motion
│
├── pages/
│   ├── Landing.jsx                  # Platform page: hero + DUR / Claims sections
│   ├── Demo.jsx                     # Simulated EMR with the nuvoDUR island, scenario, guide, report sheet
│   ├── FullSystem.jsx               # Clinic workspace (API-backed search)
│   └── Patients.jsx                 # Saved patient profiles (localStorage)
│
├── components/
│   ├── NuvovetLogo.jsx              # Wordmark, ProductLockup / ProductName / BrandText
│   ├── dur/
│   │   ├── DurIsland.jsx            # Morphing island overlay
│   │   ├── findings.js              # Engine + patient-context findings, resolutions
│   │   ├── describe.js              # Localised finding copy
│   │   └── useDurMonitor.js         # Live island behaviour for the demo
│   ├── emr/
│   │   └── EmrUI.jsx                # Simulated Windows EMR: title/menu/toolbar/status bars, waiting list, client panel,
│   │                                #   registration form + photo, tabs, visit strip, Rx search, TX/RX grid (+ nuvoDUR overlay), memo, SOAP, labs, history
│   ├── landing/
│   │   ├── Hero.jsx                 # Dark hero: decrypting headline, CTAs, showcase
│   │   ├── HeroBackdrop.jsx         # Aurora, particle canvas, HUD rings, grid floor, scanlines
│   │   ├── HeroShowcase.jsx         # Boot sequence + scripted EMR/island capture, HUD instruments, chapter scrubber
│   │   ├── motion.jsx               # usePrefersReducedMotion, DecryptText
│   │   ├── SiteChrome.jsx           # Site nav (incl. mobile menu) + footer
│   │   └── Sections.jsx             # Stats, product family, island states, engines, coverage, Claims, demo band, CTA
│   ├── ResultsDisplay.jsx           # DUR report (embedded mode, context checks)
│   ├── DrugInput.jsx                # Workspace drug search (backend → local fallback)
│   ├── OrganLoadIndicator.jsx       # Renal/hepatic burden (exports getOrganLoads / getRenalRisk)
│   ├── AnalysisScreen.jsx           # Scan readout (6 ruled steps, status words)
│   ├── ConfidenceProvenance.jsx     # Confidence score + source breakdown
│   ├── DrugTimeline.jsx             # SVG pharmacokinetic timeline
│   ├── ScanExportPDF.jsx            # Printable scan export
│   ├── SeverityBadge.jsx            # Severity vocabulary + the severity word
│   ├── Layout/Header.jsx            # WorkspaceHeader, FormularyStatus (/system, /patients)
│   ├── EMRImportModal.jsx           # Screenshot → patient import (workspace)
│   ├── MolecularBackground.jsx      # Animated SVG background (analysis screen)
│   └── RequestAccessModal.jsx       # Access request / Claims waitlist (product-aware)
│
├── data/
│   ├── drugDatabase.js              # 26 curated drugs (demo + fallback)
│   ├── breedProfiles.js             # 7 demo patients with EMR detail + scenarios
│   ├── emrCatalog.js                # EMR product names, prices, line maths
│   ├── patientPhotos.js             # Unsplash patient photos + credits
│   └── emrSchema.js                 # EMR enums and dose helpers
│
├── utils/
│   ├── durEngine.js                 # Client-side DUR rule engine
│   └── speciesHardstops.js          # Species toxicity hardstops
│
├── lib/
│   ├── api.js                       # Async API client for FastAPI backend
│   ├── commonDrugs.ts               # Search ranking boost for common Korean clinic drugs
│   ├── usePageCanvas.js             # Per-route page background + theme-color
│   └── patientStorage.ts            # localStorage patient profiles
│
└── i18n/
    ├── index.jsx                    # I18nProvider, useI18n, LangToggle
    ├── en.js
    └── ko.js                        # Primary language
```
