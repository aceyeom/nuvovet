# NuvoVet Frontend Architecture

## Product Overview

nuvovet is a veterinary software platform for companion animals (dogs and cats). The frontend is a mobile-first React/Vite app that presents the platform's product lines and runs the live DUR demo and the clinic workspace.

### Brand architecture

| Brand | Colour token | Status | What it is |
|-------|--------------|--------|-----------|
| **nuvovet** | `ink` (monochrome) | — | Master brand. Dog mark + wordmark, vectorised from `assets/branding/nuvovet_final.svg`. |
| **nuvovet DUR** | `dur` (teal) | Live | Drug Utilization Review that runs on top of the clinic's existing EMR, surfaced through the **DUR island**. |
| **nuvovet Claims** | `claims` (violet) | Coming soon | Pet-insurance claims assembled from the visit record (marketing preview + waitlist only). |

Lockups are rendered by `ProductLockup` (`components/NuvovetLogo.jsx`): the master wordmark stays ink, the product word carries the product colour ("nuvovet **DUR**", "nuvovet **Claims**"). `ProductGlyph` provides the squircle product icons; `ProductTag` the compact colour-coded chips.

---

## Design Philosophy

**Clinical, calm, colour with meaning.** Neutral ink on white/`#f7f8fa`, one accent per product line. Severity colours (red / amber / yellow / emerald) are reserved for clinical meaning and never reused as brand colours.

**What is what.** Three visual layers are kept distinct everywhere:

| Layer | Look | Example |
|-------|------|---------|
| nuvovet (marketing / chrome) | Ink + product colours, Pretendard, generous radius | Landing, product bar above the demo |
| The clinic's EMR (simulated) | Neutral greys + classic EMR blue (`emr.*` tokens), dense tables | `/demo` workspace, hero capture |
| nuvovet DUR island | Near-black capsule (`island.*` tokens) floating on top of the EMR | Every alert / status |

**Severity = visual weight.** Critical findings dominate; minor ones compress to a single line.

**Mobile-first.** Every layout is designed for phones first. The hero capture switches to a portrait "mobile EMR" frame on phones so an expanded island always fits.

**Motion with restraint.** Spring-based island morphs (CSS `linear()` spring with a cubic-bezier fallback), blur crossfades, scroll reveals. `prefers-reduced-motion` disables animation globally; the hero then shows a static frame with manually steppable chapters.

---

## User Flows

### 1. Landing Page (`/`)

1. **Nav** — product links colour-coded by sub-brand (nuvovet DUR · Live, nuvovet Claims · Soon), How it works, Live demo, Clinic sign-in, primary "Try the live demo". The mobile menu explains every destination in one line (demo = no login, clinic sign-in = access code, request access = credentials).
2. **Hero** — headline + subhead + CTAs, then `HeroShowcase`: a scripted capture of nuvovet DUR on a clinic EMR (see below), labelled "Your clinic's EMR" and "nuvovet DUR — the layer on top".
3. **Stats + evidence line** (877+ products, 10 rules, 8 engines, 2 species).
4. **Product family** — nuvovet DUR (live) and nuvovet Claims (coming soon) cards.
5. **nuvovet DUR** — 01 How the island works (glance / alert / expand), 02 What every scan checks (five engines bento), 03 Every drug, every source (six-case pipeline + severity scale).
6. **nuvovet Claims** — preview built from the same visit record the hero ends on, waitlist CTA.
7. **Demo band**, final CTA, footer.

### 2. Live EMR demo (`/demo`)

A simulated clinic EMR with nuvovet DUR docked on top. No login, no wizard:

- **Product bar** (nuvovet chrome): "nuvovet DUR · Live demo", guide, language, full report, request access.
- **EMR window** (simulated third-party product): title bar with the island in the centre, menu bar, today's waiting list (7 patients with per-patient DUR status), patient banner (동물번호, 동물등록번호, owner, DOB, blood type, vet, insurance, allergy / condition badges), tabs: Visit note (SOAP + vitals), Tx/Rx, Labs (reference intervals, H/L flags, range bars), History (past visits with DUR outcome).
- **Tx/Rx** mirrors Korean EMR fields: 구분 · 처치/처방명 · 단위 · 투여량 · 계산량 (dose × weight) · 일수 · 횟수 · 경로 · 금액, plus TX lines (진찰/검사/처치) and a VAT/total footer. Doses and days are editable inline; drug search uses the local formulary; each patient has a dashed "Try this" chip that triggers the case's teaching point.
- **First-run guide** (3 spotlight steps: this is the EMR → the black island is nuvovet DUR → try it). Stored in `localStorage` (`nuvovet-demo-guide-v2`), re-openable via "Guide".
- **Full report** opens `ResultsDisplay` in a sheet (`embedded` mode) including patient-context checks.

### 3. Clinic workspace (`/system`)

Access-code protected (`vetdur2025`). Split sign-in screen explains the workspace vs. the public demo. After sign-in: three numbered cards — 1 Patient, 2 Prescription, 3 Run DUR — then the analysis screen and the report. Drug search hits the FastAPI backend and falls back to the local formulary when it is unreachable.

### 4. Request access / Claims waitlist (Modal)

`RequestAccessModal` takes `product` (`'dur'` | `'claims'`) and posts it to Formspree with the request so leads can be routed per product line.

---

## nuvovet DUR Island

`components/dur/` — the Dynamic-Island-style overlay that sits on top of the EMR.

| File | Role |
|------|------|
| `DurIsland.jsx` | Presentational island. Views: `compact` (pill), `summary` (all clear), `list` (all findings), `expanded` (one finding with why + fix). Measures its content, animates width/height/radius with the spring curve, crossfades content with blur. `role="region"`, Escape closes. |
| `findings.js` | `analyzeRegimen()` — runs `durEngine` and adds patient-context findings: species hardstop / no species dose, charted allergies, drug–disease contraindications (CKD, MDR1, cardiomyopathy…), MDR1 status in herding breeds, dose outside the species range, cumulative renal load with elevated creatinine (same thresholds as `OrganLoadIndicator`). Each finding carries a one-tap `resolution` (`replace` / `remove` / `dose` / `add` / `ack`). |
| `describe.js` | Localised copy for findings and resolutions (`t.island.*`). Pure functions shared by the hero and the demo. |
| `useDurMonitor.js` | Live behaviour for the demo: re-screens on every chart change (short "checking" beat), auto-expands only for findings that are new since the last screen, auto-collapses after ~9 s unless hovered, remembers acknowledgements per patient, applies resolutions via a callback. |

Island states: idle/clear (teal mark / green check) → checking (spinner + shimmer) → alert glance (severity dot, drug pair, +N) → expanded card (severity chip, title, drugs, why, suggested fix, Replace/Stop/Adjust · Acknowledge · Full report, citation) → applied/reviewed flash.

---

## Hero showcase (`components/landing/HeroShowcase.jsx`)

A scripted ~14 s loop built from the real EMR components and the real engine (the alert text is what `analyzeRegimen` returns for Buddy + prednisolone):

| Chapter | Beat |
|---------|------|
| 01 Prescribe | Cursor types "Predn…" in the Rx search and adds prednisolone to Buddy's NSAID regimen |
| 02 Check | Island screens the new line |
| 03 Alert | Island expands: NSAID + corticosteroid; conflicting rows highlight |
| 04 Resolve | "Replace" swaps meloxicam → gabapentin; island settles to "3 meds · No issues" |

The EMR is rendered at a fixed design size and scaled to fit (portrait variant on phones); the island is rendered unscaled on top so it stays legible. The clickable chapter scrubber jumps the timeline; play/pause is available; playback pauses off-screen and on hidden tabs; the scroll-linked tilt settles the frame flat as the page scrolls.

---

## Results Page

The DUR report is the core deliverable. It is structured for clinical decision-making:

### Patient-context checks
When opened from the live demo, the report also lists the island's patient-context findings (allergy, drug–disease, dose range, species, organ load). The summary band's overall severity is the maximum of pairwise interactions and these findings, so the banner never says "None" above a critical finding.

### Summary Band
Full-width card at the top combining:
- Overall severity indicator with icon
- Drug count and interaction count
- **Severity breakdown chips:** Red "2 Critical", amber "1 Moderate", gray "1 Minor"
- **Confidence score** with a prominent labeled progress bar — not a footer afterthought

### Interaction Cards — Three-Zone Layout

Each interaction card has three visually distinct zones:

1. **Zone 1 — Header:** Drug pair in bold + drug class chips (small pill badges like "NSAID", "Corticosteroid"). Severity badge and rule name.
2. **Zone 2 — Mechanism:** Readable body text explaining the pharmacological interaction.
3. **Zone 3 — Action Box:** Visually distinct tinted box with:
   - Specific, dosable clinical recommendation
   - **Alternative drug suggestion** (for Critical interactions) — a named drug with dose, not "consider alternatives"
   - Example: "Consider Gabapentin 10 mg/kg PO TID for non-serotonergic pain management."

### Drug Timeline Strip
Each interaction card includes a 24-hour pharmacokinetic timeline:
- Horizontal bar chart showing drug concentration windows
- Peak marked with a colored indicator and time label
- Half-life labeled at the trough
- Graceful fallback: "PK timeline data not available" for drugs without data
- All demo breed profile drugs have complete PK data

### Literature References
One-tap expandable section with:
- **Plain English summary** — e.g., "A 2012 JAVMA study found that concurrent NSAID use in dogs increased GI bleeding risk by 4.3x."
- Full academic citations below

### Acknowledgment Flow
- Each interaction has an "Acknowledged" button (never "Override")
- Framing: "you've reviewed this" — not "you're ignoring a warning"
- Acknowledged cards become visually muted (reduced opacity)
- Never language that implies the doctor is wrong

### Species Badge
Drug flag cards with species-specific warnings show a 🐕/🐈 badge with colored border, visible before expanding.

### Drug Advisory Flags
Per-drug cards showing: source (Korean vet, off-label, foreign, unknown), species warnings, MDR1 sensitivity, narrow therapeutic index.

### Scan Summary Card
Clean single-card summary after all results:
- Patient name, species, date
- Drugs screened, interactions found, severity breakdown
- Acknowledgment status (X of Y reviewed)
- Formatted cleanly enough to screenshot for a patient file

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

28 curated drugs in `drugDatabase.js` for the demo and API fallback. The backend serves 641 drugs loaded from JSONL files. Both use the same frontend Drug contract (see `docs/backend_frontend_connection.md`).

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

| Patient | Case focus | Current Rx | "Try this" | nuvovet DUR result |
|---------|-----------|-----------|-----------|--------------------|
| Buddy · Golden Retriever | NSAID + steroid | Meloxicam, Omeprazole | + Prednisolone | Critical — replace meloxicam → gabapentin |
| Max · Shetland Sheepdog | MDR1 · renal · allergy | Prednisolone, Metronidazole, Enalapril | + Ivermectin (or Amoxicillin) | Critical MDR1 → selamectin; penicillin allergy; renal load |
| Coco · French Bulldog | CYP3A4 inhibition | Prednisolone, Amoxicillin, Ketoconazole | + Cyclosporine | Moderate ×2 — reduce substrate dose 50% |
| Oscar · Dachshund | Serotonin syndrome | Meloxicam, Gabapentin, Tramadol | + Trazodone | Critical — stop tramadol |
| Mochi · Korean Shorthair | Renal load · drug–disease | Methimazole, Amlodipine, Maropitant | + Meloxicam | Critical renal load; meloxicam in CKD |
| Luna · Persian | QT stacking · cardiac | Enalapril, Furosemide, Pimobendan | + Enrofloxacin | Critical QT — replace with amoxicillin |
| Nabi · Siamese | Serotonin syndrome | Gabapentin, Trazodone, Meloxicam | + Tramadol | Critical — stop tramadol |

`data/emrCatalog.js` maps formulary ids to EMR product names, KRW prices and default regimens, and computes 계산량 / 전체 / 금액 per line.

---

## Loading Experience

6-step sequential animation with optimized timing (~2.9s total, down from ~4.8s):

| Step | Duration | Description |
|------|----------|-------------|
| Initial delay | 200ms | — |
| Resolve drug identifiers | 350ms | Database lookup |
| Query Korean Veterinary DB | 450ms | 877 products |
| CYP enzyme interaction analysis | 400ms | Enzyme profiling |
| Pairwise DDI screening | 500ms | Interaction matrix |
| Species-specific dose verification | 350ms | Dose/weight check |
| Cross-reference literature | 400ms | PMC, Plumb's, BSAVA |
| Final transition | 250ms | — |

Visual progress bar at the bottom tracks completion percentage. Uses `useRef` for the `onComplete` callback to avoid stale closure issues.

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

### Search Modes

1. **Text search** — type-ahead matching against drug name, generic name, Korean name, and drug class from both `drugDatabase.js` and `drugSearchData.js` catalogs.
2. **Category browsing** — when search text is empty, shows the full `DRUG_SEARCH_CATALOG` filtered by active class and route. Organized by `CLASS_GROUPS` (11 categories).

### Filter UI

Collapsible filter bar with two chip rows:
- **Class filter:** All, NSAID, Corticosteroid, Antibiotic, Antifungal, Antiemetic, Cardiac, Diuretic, Anxiolytic/Sedative, Anticonvulsant, GI Protectant
- **Route filter:** All, PO (Oral), SC (Subcutaneous), IV (Intravenous), Topical

Filters are pill-shaped chips with active state styling. All labels are translated via `t.drugClasses` and `t.routes`.

### Doctor Workflow Optimization

- Browse mode shows all available drugs organized by category, matching how doctors think about prescribing (by drug class, then route)
- Drug names display Korean names when `lang === 'ko'`
- Unknown drug flow with active ingredient entry for off-formulary medications
- Pre-populated drug lists from breed profiles in demo mode

---

## Typography System

Self-hosted fonts (no font CDN at runtime), imported in `main.jsx`:

| Font | Package | Usage |
|------|---------|-------|
| Pretendard Variable | `pretendard` (dynamic subset) | All UI text, Korean and Latin |
| Instrument Serif (italic) | `@fontsource/instrument-serif` | English headline accent ("caught.") |
| Geist Mono Variable | `@fontsource-variable/geist-mono` | Clinical numbers, codes, citations |

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
- **Lucide React** for icons
- **Self-hosted fonts** — Pretendard, Instrument Serif, Geist Mono (npm packages)
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
├── App.jsx                          # Router (lazy routes): /, /demo, /system, /patients
├── main.jsx                         # Font imports + root render
├── index.css                        # Tokens (spring easing), surfaces, island motion, reduced motion
│
├── pages/
│   ├── Landing.jsx                  # Platform page: hero + DUR / Claims sections
│   ├── Demo.jsx                     # Live simulated EMR with the DUR island + guide + report sheet
│   ├── FullSystem.jsx               # Clinic workspace (API-backed search)
│   └── Patients.jsx                 # Saved patient profiles (localStorage)
│
├── components/
│   ├── NuvovetLogo.jsx              # Dog mark, wordmark, ProductLockup / ProductGlyph / ProductTag
│   ├── dur/
│   │   ├── DurIsland.jsx            # Morphing island overlay
│   │   ├── findings.js              # Engine + patient-context findings, resolutions
│   │   ├── describe.js              # Localised finding copy
│   │   └── useDurMonitor.js         # Live island behaviour for the demo
│   ├── emr/
│   │   └── EmrUI.jsx                # Simulated EMR: chrome, waiting list, banner, tabs, Rx table/search, SOAP, labs, history
│   ├── landing/
│   │   ├── HeroShowcase.jsx         # Scripted EMR + island capture with chapter scrubber
│   │   ├── SiteChrome.jsx           # Site nav (incl. mobile menu) + footer
│   │   └── Sections.jsx             # Stats, product family, island states, engines, coverage, Claims, demo band, CTA
│   ├── ResultsDisplay.jsx           # DUR report (embedded mode, context checks)
│   ├── DrugInput.jsx                # Workspace drug search (backend → local fallback)
│   ├── OrganLoadIndicator.jsx       # Renal/hepatic burden (exports getOrganLoads / getRenalRisk)
│   ├── AnalysisScreen.jsx           # Loading animation (6 steps)
│   ├── ConfidenceProvenance.jsx     # Confidence score + source breakdown
│   ├── DrugTimeline.jsx             # SVG pharmacokinetic timeline
│   ├── ScanExportPDF.jsx            # Printable scan export
│   ├── SeverityBadge.jsx
│   ├── EMRImportModal.jsx           # Screenshot → patient import (workspace)
│   ├── MolecularBackground.jsx      # Animated SVG background (analysis screen)
│   └── RequestAccessModal.jsx       # Access request / Claims waitlist (product-aware)
│
├── data/
│   ├── drugDatabase.js              # 28 curated drugs (demo + fallback)
│   ├── breedProfiles.js             # 7 demo patients with EMR detail + scenarios
│   ├── emrCatalog.js                # EMR product names, prices, line maths
│   └── emrSchema.js                 # EMR enums and dose helpers
│
├── utils/
│   ├── durEngine.js                 # Client-side DUR rule engine
│   └── speciesHardstops.js          # Species toxicity hardstops
│
├── lib/
│   ├── api.js                       # Async API client for FastAPI backend
│   └── patientStorage.ts            # localStorage patient profiles
│
└── i18n/
    ├── index.jsx                    # I18nProvider, useI18n, LangToggle
    ├── en.js
    └── ko.js                        # Primary language
```
