// Daily ping (Vercel Cron, see vercel.json) so the free online database is
// never paused for inactivity during school holidays.
const URL = 'https://lwwroelwrxkmcgdlqlqe.supabase.co/rest/v1/rpc/api_ping';
const KEY = 'sb_publishable__uzXLd-izc3hb72U_rp1tg_3u2t1nuQ';

export async function GET() {
  try {
    const r = await fetch(URL, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: '{}' });
    return Response.json({ ok: r.ok, status: r.status });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
