// CCE नोंदवही — password / login-ID recovery: send and verify a mobile OTP.
//
// POST {"action": "send", "phone": "9xxxxxxxxx"}
// POST {"action": "verify", "phone": "9xxxxxxxxx", "code": "123456"}
//   → {"ok": true, "resetToken": "...", "usernames": ["..."]}
//
// SMS provider (Edge Function secrets):
//   SMS_PROVIDER=fast2sms  FAST2SMS_API_KEY=...            (India, OTP route)
//   SMS_PROVIDER=twilio    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID
//   SMS_PROVIDER=test      codes are only written to private.otp_outbox (testing)
// Without SMS_PROVIDER the function answers {"ok": false, "error": "sms_not_configured"}.
// Codes, attempts and rate limits are handled in the database (svc_* functions).

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const env = (k: string) => Deno.env.get(k) ?? '';
const PROVIDER = env('SMS_PROVIDER').trim().toLowerCase();
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

function normPhone(v: unknown): string | null {
  const d = String(v ?? '')
    .replace(/[०-९]/g, (c) => String('०१२३४५६७८९'.indexOf(c)))
    .replace(/\D/g, '');
  const m = /^(?:91|0)?([6-9]\d{9})$/.exec(d);
  return m ? m[1] : null;
}

async function sendFast2sms(phone: string, code: string): Promise<boolean> {
  const url = new URL('https://www.fast2sms.com/dev/bulkV2');
  url.searchParams.set('route', 'otp');
  url.searchParams.set('variables_values', code);
  url.searchParams.set('flash', '0');
  url.searchParams.set('numbers', phone);
  const r = await fetch(url, { headers: { authorization: env('FAST2SMS_API_KEY') } });
  const body = await r.json().catch(() => null);
  if (!r.ok || body?.return !== true) {
    console.error('fast2sms failed', r.status, JSON.stringify(body));
    return false;
  }
  return true;
}

function twilioAuth() {
  return 'Basic ' + btoa(`${env('TWILIO_ACCOUNT_SID')}:${env('TWILIO_AUTH_TOKEN')}`);
}

async function twilioStart(phone: string): Promise<boolean> {
  const r = await fetch(`https://verify.twilio.com/v2/Services/${env('TWILIO_VERIFY_SID')}/Verifications`, {
    method: 'POST',
    headers: { Authorization: twilioAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: `+91${phone}`, Channel: 'sms', Locale: 'en' }),
  });
  if (!r.ok) console.error('twilio start failed', r.status, await r.text());
  return r.ok;
}

async function twilioCheck(phone: string, code: string): Promise<boolean | null> {
  const r = await fetch(`https://verify.twilio.com/v2/Services/${env('TWILIO_VERIFY_SID')}/VerificationCheck`, {
    method: 'POST',
    headers: { Authorization: twilioAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: `+91${phone}`, Code: code }),
  });
  if (r.status === 404) return false; // expired or already used
  if (!r.ok) {
    console.error('twilio check failed', r.status, await r.text());
    return null;
  }
  const body = await r.json();
  return body?.status === 'approved';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'bad_request' }, 405);
  const body = await req.json().catch(() => null);
  const phone = normPhone(body?.phone);
  if (!phone) return json({ ok: false, error: 'invalid_phone' });
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';

  if (body?.action === 'send') {
    if (!['fast2sms', 'twilio', 'test'].includes(PROVIDER)) return json({ ok: false, error: 'sms_not_configured' });
    const { data, error } = await db.rpc('svc_otp_create', { p_phone: phone, p_ip: ip, p_provider: PROVIDER });
    if (error) {
      console.error('svc_otp_create', error);
      return json({ ok: false, error: 'server' }, 500);
    }
    if (!data?.ok) return json(data);
    let sent = true;
    if (PROVIDER === 'fast2sms') sent = await sendFast2sms(phone, data.code);
    else if (PROVIDER === 'twilio') sent = await twilioStart(phone);
    return json(sent ? { ok: true } : { ok: false, error: 'sms_failed' });
  }

  if (body?.action === 'verify') {
    const code = String(body?.code ?? '').replace(/\D/g, '');
    if (!/^\d{4,8}$/.test(code)) return json({ ok: false, error: 'otp_invalid' });
    let res;
    if (PROVIDER === 'twilio') {
      const okCode = await twilioCheck(phone, code);
      if (okCode === null) return json({ ok: false, error: 'sms_failed' });
      res = await db.rpc('svc_otp_result', { p_phone: phone, p_ok: okCode });
    } else {
      res = await db.rpc('svc_otp_check', { p_phone: phone, p_code: code });
    }
    if (res.error) {
      console.error('otp verify', res.error);
      return json({ ok: false, error: 'server' }, 500);
    }
    return json(res.data);
  }

  return json({ ok: false, error: 'bad_request' });
});
