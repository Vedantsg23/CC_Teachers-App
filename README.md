# CCE नोंदवही — सातत्यपूर्ण सर्वंकष मूल्यमापन

**शिक्षकांसाठी मराठी CCE डिजिटल नोंदवही** — an offline-first Progressive Web App for Maharashtra primary-school teachers to keep the complete Continuous and Comprehensive Evaluation (CCE) record of a class for **सन 2026-27**: students, आकारिक/संकलित marks, वर्णनात्मक नोंदी, attendance, progress cards, results and the शाळा सोडल्याचा दाखला — with professional Marathi PDFs, on a phone or a computer, with or without internet.

> **शिक्षकांसाठी थोडक्यात:** पहिल्यांदा उघडल्यावर शाळेची माहिती व दोन शिक्षकांचे पासवर्ड ठेवा → आपल्या खात्याने लॉगिन करा → विद्यार्थी जोडा → आकारिक व संकलित गुण भरा (टाइप करताच जतन होतात) → वर्णनात्मक नोंदी ड्रॉपडाऊनमधून निवडा → उपस्थिती भरा → “अहवाल / PDF” मधून प्रगती कार्ड, निकाल पत्रक इ. PDF तयार करा, प्रिंट करा किंवा WhatsApp वर शेअर करा. एकदा उघडल्यानंतर ॲप इंटरनेटशिवायही चालते. आठवड्यातून एकदा **सेटिंग्ज → डेटा बॅकअप** घ्या.

---

## Contents

1. [Features](#features)
2. [Technology stack](#technology-stack)
3. [Installation & development](#installation--development)
4. [Production build](#production-build)
5. [Testing](#testing)
6. [PWA & offline architecture](#pwa--offline-architecture)
7. [Database / storage](#database--storage)
8. [Teacher login architecture & security](#teacher-login-architecture--security)
9. [Calculations, grades and results](#calculations-grades-and-results)
10. [PDF generation](#pdf-generation)
11. [Reports](#reports)
12. [How-to: teachers, subjects, grading, backup](#how-to)
13. [Deployment](#deployment)
14. [Project structure](#project-structure)
15. [Licences and credits](#licences-and-credits)

---

## Features

Everything a class teacher needs for the CCE register, entirely in Marathi (Devanagari):

| Area | What it does |
| --- | --- |
| **प्राथमिक मांडणी (first-time setup)** | School name, UDISE, तालुका, जिल्हा, मुख्याध्यापक; a मुख्याध्यापक/प्रशासक (`admin`) account; **two teacher accounts — `teacher7` (इयत्ता सातवी, तुकडी ब) and `teacher5` (इयत्ता पाचवी)** with passwords chosen at setup; optional demo data. |
| **लॉगिन** | Separate login per teacher, works offline after first load, optional “या उपकरणावर लॉगिन ठेवा”, throttling after 5 wrong attempts. |
| **डॅशबोर्ड** | नमस्कार, class/division/year, एकूण विद्यार्थी, मुलगे, मुली, आज उपस्थित/अनुपस्थित, progress bars (मूल्यमापन पूर्णता, वर्णनात्मक नोंदी, प्रगती कार्ड तयार, निकाल तयार) and the numbered work sequence. |
| **विद्यार्थी माहिती / यादी** | Add, edit, view, delete (with confirmation), photo, all register fields (हजेरी/रजिस्टर क्र., सरल आयडी, UDISE PEN, आई-वडील-पालक, जात, प्रवर्ग, धर्म, पत्ता, मोबाईल, प्रवेश, मागील शाळा, शाळा सोडल्याची माहिती). Search by name / roll / register number; filters by लिंग, जात, प्रवर्ग, श्रेणी; CSV/Excel import with preview, CSV/Excel export. |
| **आकारिक मूल्यमापन** | Tool-wise entry (निरीक्षण, तोंडीकाम, प्रात्यक्षिक, उपक्रम, प्रकल्प, चाचणी, स्वाध्याय, इतर — all configurable). Table mode (keyboard: Enter/arrow keys) and “एकेक विद्यार्थी” card mode for phones; column fill; autosave on every valid keystroke (“जतन झाले ✓”); values above the maximum or negative are refused with Marathi messages. |
| **संकलित मूल्यमापन** | तोंडी / प्रात्य. / लेखी parts, प्रथम व द्वितीय सत्र, automatic अ + ब = एकूण, टक्केवारी, श्रेणी. |
| **वर्णनात्मक नोंदी** | 9 subject areas + विशेष प्रगती, आवड/छंद, सुधारणा आवश्यक, व्यक्तिमत्व गुण विशेष. Dropdown from the **वर्णनात्मक नोंद संच** (≈130 starter remarks, separate मुलगा/मुलगी forms — घेतो/घेते, करता है/करती है, He/She), free text, “+ नवीन नोंद”, copy from term 1, student-wise or subject-wise entry. |
| **उपस्थिती** | Daily register (आजची हजेरी), monthly working/present days with automatic absent days and %, fill-from-daily, annual summary. Present days can never exceed working days. |
| **निकाल** | प्रगती कार्ड (both terms side by side), वार्षिक गुणपत्रक, निकाल पत्रक with summary, श्रेणीवार निकाल (मुले/मुली), जातनिहाय / प्रवर्गनिहाय निकाल. |
| **शाळा सोडल्याचा दाखला** | Pre-filled from the student record (DOB in Marathi words, e.g. *अठ्ठावीस नोव्हेंबर दोन हजार तेरा*), running certificate number, issued-certificate register, optional “शाळा सोडली” status, configurable template (title, fields, order, wording, signatures). |
| **अहवाल / PDF** | 16 report layouts reproduced from the reference CCE registers; preview, PDF, print, share (Android/iOS share sheet), A4 portrait/landscape, page numbers, signatures. |
| **सेटिंग्ज** | वर्ग व शाळेची माहिती, विषय, भारांश (tool maxima per term), श्रेणी नियम, निकाल नियम, अहवाल/PDF, बॅकअप/पुनर्संचयित, खाते/पासवर्ड, ॲप व साठवण, नमुना माहिती. |
| **प्रशासन (admin)** | School info & logo, academic years (default **2026-27**; add 2027-28 …), teacher accounts (add, reset password, disable), दाखला नमुना, whole-device backup/restore. The admin **cannot** see any class's marks. |

## Technology stack

| Layer | Choice | Why |
| --- | --- | --- |
| UI | **React 19 + TypeScript** (strict), **Tailwind CSS 4** | small, typed, fast on low-end phones |
| Build | **Vite 8** | static output, works from any folder (`base: './'`) |
| Routing | React Router 7 (`HashRouter`) | deep links work on any static host and offline, no server rewrites |
| Local database | **IndexedDB via Dexie 4** (+ `dexie-react-hooks` live queries) | structured offline storage; not `localStorage` |
| PWA | `vite-plugin-pwa` (Workbox `generateSW`) | precaches the whole app, fonts and the PDF engine |
| PDF | Own lightweight PDF writer + **HarfBuzz** (`harfbuzzjs`, WebAssembly) + Noto Sans Devanagari | correct Marathi shaping in every PDF viewer |
| Spreadsheets | Own CSV + minimal XLSX reader/writer on **fflate** | no heavy spreadsheet dependency |
| Tests | **Vitest** (+ `fake-indexeddb`) and **Playwright** (Python) | unit + full browser/offline tests |

There is **no backend**: this is a purely front-end, offline-first app. See [security](#teacher-login-architecture--security) for what that implies.

## Installation & development

Requirements: **Node.js 20+** (22 recommended) and npm.

```bash
git clone https://github.com/Vedantsg23/CC-App.git
cd CC-App
npm install
npm run dev          # http://localhost:5173  (service worker disabled in dev)
```

Useful scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | development server with hot reload |
| `npm run typecheck` | TypeScript (strict) |
| `npm run lint` | ESLint |
| `npm test` | unit tests (calculations, grades, Marathi helpers, crypto, CSV/XLSX, isolation, backup) |
| `npm run build` | type-check + production build into `dist/` |
| `npm run preview` | serve `dist/` at http://localhost:4173 (with the service worker) |
| `npm run test:e2e` | full browser test against the preview server (see below) |

> Opening the dev server from a phone on the same Wi-Fi (`http://192.168.x.x:5173`) works for UI testing, but service workers and WebCrypto need **HTTPS or localhost**; the app falls back to a built-in SHA-256/PBKDF2 so login still works, but offline install only works on HTTPS.

## Production build

```bash
npm run build        # → dist/ (≈2 MB precached: app, fonts, HarfBuzz wasm, icons)
npm run preview      # check it locally
```

`dist/` is a static site. Upload it to any static host (Vercel, Netlify, GitHub Pages, a school server). Because the build uses relative paths and hash routing, it also works from a sub-folder.

## Testing

**Unit tests** — `npm test` (73 tests): weightage defaults, every grade boundary (अ-1 … इ-2), अ+ब totals, annual totals, result rules, grade/category distributions, 500-student performance, Marathi number/date words, gendered remarks, validation messages, SHA-256/PBKDF2 (JS fallback = WebCrypto), backup encryption, CSV/XLSX round-trips and formula-injection guard, and **class isolation** (teacher 5 can't read/edit/mark/delete class 7 records; forged scopes rejected; restores never reuse another class's ids).

**End-to-end** — `e2e/e2e_test.py` (Playwright for Python + Chromium, 77 checks):

```bash
npm run build && npx vite preview --port 4173 --strictPort &
pip install playwright && python3 -m playwright install chromium   # first time only
npm run test:e2e        # BASE_URL=http://localhost:4173/ by default
```

It runs the required offline procedure — *login online → add student → marks → attendance → remarks → PDF → internet OFF → refresh → login → data still there → edit marks → PDF → internet ON* — plus validation messages, two-teacher isolation (including opening another class's student by URL), backup/restore, all 16 report PDFs (each checked for **zero unrenderable glyphs**), A4 landscape, the leaving certificate, admin password reset, mobile layout and console errors. Screenshots and PDFs are written to `e2e/out/`.

## PWA & offline architecture

- **Manifest**: name “CCE नोंदवही”, short name “CCE”, standalone display, maskable icons.
- **Service worker** (Workbox): precaches every built file — JS, CSS, HTML, the bundled fonts and `harfbuzz.wasm` — so after the first visit the app, login, data entry and **PDF generation** all work without internet. Navigations fall back to the cached `index.html`.
- **Updates**: a new version waits until the teacher taps “अद्ययावत करा” in the banner (no surprise reloads during data entry).
- **Install**: “ॲप स्थापित करा / ऑफलाइन वापरासाठी PWA स्थापित करा” uses the browser install prompt; iPhone users get Add-to-Home-Screen instructions.
- **Status**: the header shows **ऑनलाइन** (green) / **ऑफलाइन** (amber) and “स्थानिक पातळीवर जतन झाले ✓” after every save.
- **Storage durability**: after login the app asks for persistent storage (`navigator.storage.persist`) so the browser does not evict data; status is in सेटिंग्ज → ॲप व साठवण. Because data lives only on the device, the dashboard nags weekly for a backup.

## Database / storage

IndexedDB database `cce-nondvahi` (Dexie, see `src/lib/db.ts`, types in `src/lib/types.ts`):

| Table | Holds | Key |
| --- | --- | --- |
| `meta` | app meta (years, default year), school info, दाखला template, certificate counter, last-backup times | `key` |
| `users` | admin + teacher accounts (PBKDF2 hashes only) | `id`, unique `username` |
| `sessions` | random session tokens with expiry | `token` |
| `classes` | one row per teacher per academic year: standard, division and the **class config** (subjects, tool lists, भारांश per term, grade bands, result rules, report settings) | `id`, `[teacherId+year]` |
| `students` | student records | `id`, `classId` |
| `assessments` | one row per student × subject × term × type (F = आकारिक, S = संकलित) with tool scores | `${studentId}\|${subjectId}\|${term}\|${type}` |
| `remarks` | वर्णनात्मक नोंदी per student × term × area | `${studentId}\|${term}\|${area}` |
| `attendanceMonths`, `attendance`, `dailyAttendance` | working days per month, present days per student-month, daily absentee lists | |
| `remarkLibrary` | वर्णनात्मक नोंद संच (मुलगा / मुलगी forms) | `id`, `classId` |
| `certificates` | issued leaving certificates (snapshot of printed values) | `id`, `classId` |

Every class-owned row carries `classId` and `updatedAt` with a stable string id, so a cloud-sync layer can be added later (push rows changed since the last sync, keyed by id) without restructuring the app. Progress cards, annual results and distributions are **computed** from these records by the calculation engine rather than stored, so they can never go stale.

## Teacher login architecture & security

- **Accounts**: one `admin` (मुख्याध्यापक/प्रशासक) and one account per teacher. Each teacher is assigned a standard + division; on the first login of an academic year the app creates that teacher's class for that year (copying the previous year's subjects and settings).
- **Passwords**: stored only as **PBKDF2-SHA-256 (150 000 iterations, random 16-byte salt)**; compared in constant time; never displayed. Teachers change their own password; the admin can set a temporary one, which the teacher must change at the next login.
- **Sessions**: a random 256-bit token in `sessionStorage` (or `localStorage` for 30 days with “लॉगिन ठेवा”) that maps to a row in IndexedDB. The class is always derived from the user record in the database — never from anything stored in the browser — and logout deletes the session row.
- **Class isolation**: every read/write goes through `src/lib/repo.ts`, which takes a `Scope` derived from the session and rejects any record whose `classId` is not the teacher's (`AccessError` → “या माहितीमध्ये प्रवेश करण्याची परवानगी नाही.”). Teacher 7 cannot see or change Class 5 data — not through menus, not by typing a URL. The admin account has no class and cannot open marks or student records.
- **Input/file safety**: Marathi validation everywhere; imports are size-limited and whitelisted field-by-field; CSV export neutralises spreadsheet formulas; backups can be **encrypted with AES-GCM** (password-derived key); restores re-key ids that belong to another class; a strict Content-Security-Policy is shipped in `vercel.json`.
- **Limitations (offline-first, no server)**: all data is stored unencrypted in the browser's IndexedDB on that device. The per-teacher separation is enforced by the app, not by the operating system — someone with full access to the device and browser developer tools could read the raw database, and clearing browser data deletes it. Recommendations: one browser profile (or device) per teacher, a phone screen lock, persistent storage enabled, and regular (preferably password-protected) backups. Server-side authorization would require adding a backend/sync service.

## Calculations, grades and results

All arithmetic lives in **`src/lib/calc.ts`** — screens and reports never re-implement it.

- आकारिक (अ) = sum of the used formative tools; संकलित (ब) = sum of the used summative parts; एकूण = अ + ब; टक्केवारी = एकूण ÷ कमाल × 100; वार्षिक = प्रथम + द्वितीय सत्र.
- **Default भारांश** (per term, per scholastic subject, out of 100): इ. 1–2 → 70 + 30, इ. 3–4 → 60 + 40, **इ. 5–6 → 50 + 50**, **इ. 7–8 → 40 + 60**; कला, कार्यानुभव, शारीरिक शिक्षण → 100 आकारिक. Tool maxima default to an even split (e.g. 8 × 5 = 40) and are editable per subject and term.
- **Default श्रेणी** (Maharashtra CCE, std 1–8): अ-1 91–100, अ-2 81–90, ब-1 71–80, ब-2 61–70, क-1 51–60, क-2 41–50, ड 33–40, इ-1 21–32, इ-2 ≤ 20 — fully editable.
- **Default निकाल नियम** (editable): overall ≥ 33 % **and** each counted subject ≥ 33 % → “उत्तीर्ण”, otherwise “आवश्यक सुधारणा”; no marks → “अनुपस्थित”; missing subjects/term → “अपूर्ण”. Change these to your school's/government's current rules (e.g. the std 5 and 8 annual-examination rules).

## PDF generation

Reports are normal React pages laid out as exact A4 sheets (`src/report.css`). For a PDF, `src/lib/pdf/painter.ts` reads the browser's finished layout of each sheet — every border, background, image and the position of every word — and redraws it in a PDF written by `src/lib/pdf/writer.ts`:

- Words are **shaped with HarfBuzz** (`src/lib/pdf/hb.ts`) using the same **Noto Sans Devanagari** files the browser uses, with the Marathi language system — so conjuncts (क्ष, ज्ञ, द्ध), reph (र्य), matras and Marathi letter forms are exactly right, and line breaks match the preview.
- Glyphs are embedded once as vector outlines and re-used, so PDFs look identical in every viewer (no font installation, no broken akshars, no boxes) and stay small (≈60–300 KB; 120 pages ≈ 1.5 MB).
- Rotated register headers are drawn by the engine itself.
- Tables have repeated headers across pages, page numbers (“पृष्ठ 2 / 6”) and signature rows.
- The automated test asserts that every report PDF contains **zero** glyphs the font could not render.
- **Print** uses the browser's own print engine on the same pages (`@page` A4 portrait/landscape, margins 0); **Share** uses the phone's share sheet.

Trade-off: text in the PDF is drawn as outlines, so it is not selectable/searchable.

## Reports

| Report | Layout |
| --- | --- |
| मुखपृष्ठ | A4 portrait — युडायस, शाळा, वर्गशिक्षक, इयत्ता, तुकडी |
| अनुक्रमणिका | अ.नं, विद्यार्थ्याचे नाव, रजि.नं., जन्मतारीख, पृष्ठ क्र. |
| विद्यार्थी यादी | landscape, with मुले/मुली totals |
| उपस्थिती | landscape, month-wise हजर दिवस, कामाचे दिवस, % (term or annual) |
| आकारिक मूल्यमापन / संकलित मूल्यमापन | landscape class summaries of अ or ब per subject |
| विषयवार CCE नोंद | per subject: tools 1–8 with maxima, एकूण, तोंडी/प्रात्य./लेखी, अ+ब, शे.गुण, श्रेणी — **A4 portrait or landscape** |
| विद्यार्थीवार CCE | per student: प्राप्त / पैकी rows for every subject |
| वर्गनिहाय CCE नोंद (गुण–श्रेणी) | लिंग, हजर दिवस, गुण & श्रेणी per subject + grade distribution |
| वर्गनिहाय CCE नोंद (अ–ब) | आकारिक, संकलित, एकूण, श्रेणी per subject + grade distribution |
| वर्णनात्मक नोंदी | the 13 remark areas per student |
| प्रगती कार्ड | landscape, प्रथम व द्वितीय सत्र side by side, with विशेष नोंदी, उपस्थिती and शिक्षक / मुख्याध्यापक / पालक signatures |
| वार्षिक गुणपत्रक | both terms, annual marks, %, grade, निकाल, उपस्थिती, शेरा, grade legend |
| निकाल पत्रक | class result + summary (पट, उपस्थित, अनुपस्थित, उत्तीर्ण, आवश्यक सुधारणा, निकाल %) |
| श्रेणीवार निकाल | every grade × मुले/मुली per subject, पट/उपस्थिती, overall grade table |
| जातनिहाय / प्रवर्गनिहाय निकाल | मुलगे, मुली, एकूण, बसलेले, उत्तीर्ण, टक्केवारी |
| शाळा सोडल्याचा दाखला | from the configurable template |

## How-to

### Add a teacher
1. Log in as **`admin`** → **शिक्षक खाती** → “नवीन शिक्षक खाते”.
2. Enter वर्गशिक्षकाचे नाव, वापरकर्ता नाव (e.g. `teacher6`), a temporary password, इयत्ता and तुकडी → **खाते तयार करा**.
3. The teacher logs in once with the temporary password and must set a new one. Their class for the current year is created automatically.

The same page resets a forgotten password (“पासवर्ड”) or disables an account. Passwords are never shown.

### Configure subjects
Teacher login → **सेटिंग्ज → विषय**: rename (full name, short name used in table headers, name used in वर्णनात्मक नोंदी), choose the remark category, reorder, include/exclude from the total, add or remove subjects. Each class has its own subject list — Class 5 (परिसर अभ्यास भाग 1/2 …) and Class 7 (सा.वि./प.अ., स.शा. …) never share marks.

### Configure weightage (भारांश) and tools
**सेटिंग्ज → भारांश (गुण विभागणी)**: per term and subject, set the maximum for each आकारिक tool and संकलित part (blank = not used). Totals are shown live and you are warned if a subject does not total 100. Tool names can be changed or new tools added under “मूल्यमापन साधनांची नावे”.

### Configure grading and results
- **सेटिंग्ज → श्रेणी नियम**: edit labels/minimum percentages, add or remove bands, or restore the defaults.
- **सेटिंग्ज → निकाल नियम**: overall and per-subject minimum %, the words printed for pass / needs-improvement / absent / incomplete, and rounding before grading.

### Backup and restore
- **Teacher**: **सेटिंग्ज → डेटा बॅकअप → बॅकअप डाउनलोड करा (.json)** — optionally password-protected. Keep the file on Google Drive / email / a pen drive. To restore on any device: log in to the same class → **डेटा पुनर्संचयित करा** → choose the file. A backup of a different standard is refused. Students and marks can also be exported to Excel/CSV.
- **Admin (whole device, e.g. moving to a new phone/computer)**: on the old device log in as `admin` → **डेटा बॅकअप → संपूर्ण बॅकअप (.json)**. On the new device open the app, finish the first-time setup with any temporary passwords, log in as `admin` → **डेटा बॅकअप → संपूर्ण माहिती पुनर्संचयित करा** and choose the file. This replaces everything on the new device — school details, all classes and the teacher accounts (with their old passwords) — and then asks everyone to log in again.

## Deployment

The app is a static site; any HTTPS static host works (HTTPS is required for service workers).

**Vercel** (recommended): import the GitHub repository in Vercel — the included `vercel.json` sets the build (`npm run build`, output `dist`), long-term caching for hashed assets, `no-cache` for `sw.js`, and security headers including a Content-Security-Policy that allows WebAssembly (needed for PDFs). No environment variables or secrets are needed.

**Netlify / Cloudflare Pages / GitHub Pages / school server**: build command `npm run build`, publish directory `dist`. Make sure `.wasm` is served as `application/wasm` and `sw.js` is not cached for long.

After each deployment, teachers see “ॲपची नवीन आवृत्ती उपलब्ध आहे” and tap **अद्ययावत करा**; their data is untouched.

## Project structure

```
src/
  app/            session (login state), live data hooks, PWA helpers
  components/     UI kit, icons, app shell, report building blocks & viewer
  features/       screens: auth, dashboard, students, assessment, remarks,
                  attendance, results, reports (templates + registry),
                  certificates, settings, admin
  lib/
    calc.ts       central calculation engine (totals, %, grades, results)
    repo.ts       class-scoped data access (isolation)
    auth.ts       accounts, setup, sessions
    backup.ts     JSON backup / restore (+ encryption)
    db.ts         IndexedDB schema (Dexie)
    defaults.ts   default subjects, भारांश, grades, rules, remark library, दाखला template
    labels.ts     Marathi labels & constants
    validation.ts Marathi validation messages
    marathi.ts    number/date words, मुलगा→मुलगी remark forms
    sheet.ts      CSV / XLSX
    pdf/          HarfBuzz wrapper, PDF writer, DOM → PDF painter, fonts
  report.css      A4 report styles (preview, print and PDF)
tests/            Vitest unit tests
e2e/              Playwright end-to-end test
```

## Licences and credits

- **Noto Sans Devanagari** (Google / Noto project) and **Tiro Devanagari Marathi** (Tiro Typeworks) — SIL Open Font License 1.1; licence texts in `src/assets/fonts/`.
- **HarfBuzz / harfbuzzjs** — MIT; **React**, **React Router**, **fflate** — MIT; **Dexie** — Apache-2.0; **Workbox** — MIT.
- The report layouts follow the information structure of standard Maharashtra CCE registers. No third-party logos, branding or code are included; the app emblem and icons are original.
- The generated शाळा सोडल्याचा दाखला is a school-records format; if your school must use an official government/board format, adapt the template under प्रशासन → दाखला नमुना.
