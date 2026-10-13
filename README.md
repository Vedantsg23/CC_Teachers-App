# CCE नोंदवही — सातत्यपूर्ण सर्वंकष मूल्यमापन

Marathi CCE record app for primary-school teachers (सन 2026-27). Works on phone and computer, also without internet.

## How teachers use it

1. Open the site → **नवीन खाते तयार करा**.
2. Choose your इयत्ता (1–8) and तुकडी, enter your name, a username and a password.
3. Log in → add students → enter आकारिक / संकलित marks, remarks and attendance.
4. **अहवाल / PDF** → progress card, result sheet, registers, leaving certificate → PDF, print or share.

Each account sees only its own class. Data is stored on that device only, so take a backup from **सेटिंग्ज → डेटा बॅकअप** regularly.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm test           # unit tests
```

## Deploy

Static site — on Vercel import the repo (framework: Vite, output: `dist`). `vercel.json` adds the security headers.

Fonts: Noto Sans Devanagari and Tiro Devanagari Marathi (SIL Open Font License).
