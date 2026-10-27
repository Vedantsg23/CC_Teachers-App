# CCE नोंदवही — सातत्यपूर्ण सर्वंकष मूल्यमापन

Marathi CCE record app for primary-school teachers (सन 2026-27). Works on phone, tablet and computer, also without internet.

## How teachers use it

1. Open the site → **नवीन खाते तयार करा**.
2. Choose your इयत्ता (1–8) and तुकडी, enter your name, a username, a password and your mobile number.
3. Log in → add students → enter आकारिक / संकलित marks, remarks and attendance.
4. **अहवाल / PDF** → प्रगती कार्ड (घडीचे or पिवळे कार्ड), निकाल पत्रक (A3/A4), सत्र परीक्षा निकाल पत्रक, registers, शाळा सोडल्याचा दाखला → PDF, print or share. Most reports offer प्रथम सत्र, द्वितीय सत्र or both.

The same username and password work on any device; the data is saved online and synced. Login does not expire — it ends with **बाहेर पडा**. Forgot the password or username? **पासवर्ड / वापरकर्ता नाव विसरलात?** → OTP on the registered mobile number.

## Online service (Supabase)

- Database: `supabase/migrations/` (accounts, sessions, synced records, OTP). The browser calls only the `api_*` functions; data lives in the non-exposed `private` schema.
- Edge function `otp` (`supabase/functions/otp`) sends and checks the OTP. SMS needs a provider, set as Edge Function secrets in the Supabase dashboard:
  - `SMS_PROVIDER=fast2sms` and `FAST2SMS_API_KEY` (India, OTP route), or
  - `SMS_PROVIDER=twilio` with `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID`.
  Until then "पासवर्ड विसरलात?" reports that SMS is not set up.
- A daily Vercel cron (`api/keepalive.js`) keeps the free project from pausing.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm test           # unit tests
python3 e2e/e2e_test.py     # end-to-end, device-only build (see the file header)
python3 e2e/cloud_test.py   # end-to-end, online accounts against a local database (e2e/backend)
```

`VITE_CLOUD_URL=off` builds a device-only version.

## Deploy

Vercel imports the repo (framework: Vite, output: `dist`); every push to `main` deploys. `vercel.json` adds the security headers and the cron.

Fonts: Noto Sans Devanagari and Tiro Devanagari Marathi (SIL Open Font License). Pune ZP logo supplied by the school.
