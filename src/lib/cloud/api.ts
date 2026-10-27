/**
 * Calls to the online service: `POST /rest/v1/rpc/api_*` (database functions)
 * and the `otp` edge function. Expected refusals come back as
 * {"ok": false, "error": "<code>"} and are thrown as CloudError; anything that
 * means "the service cannot be reached right now" is CloudUnavailable, so the
 * app can carry on with the data on this device.
 */
import { CLOUD_ENABLED, CLOUD_KEY, CLOUD_URL } from './config';

export class CloudError extends Error {
  code: string;
  info: Record<string, unknown>;
  constructor(code: string, info: Record<string, unknown> = {}) {
    super(code);
    this.name = 'CloudError';
    this.code = code;
    this.info = info;
  }
}

export class CloudUnavailable extends Error {
  constructor(msg = 'unavailable') {
    super(msg);
    this.name = 'CloudUnavailable';
  }
}

export interface CloudAccount {
  id: string;
  username: string;
  displayName: string;
  phone: string;
  standard: number | null;
  section: string;
  updatedAt: string;
}

export interface CloudRecord {
  tbl: string;
  id: string;
  data: Record<string, unknown> | null;
  deleted: boolean;
  seq: number;
}

export interface Change {
  tbl: string;
  id: string;
  data?: unknown;
  deleted?: boolean;
}

type Ok<T> = T & { ok: true };

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<Ok<T>> {
  if (!CLOUD_ENABLED) throw new CloudUnavailable('disabled');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new CloudUnavailable('offline');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${CLOUD_URL}${path}`, {
      method: 'POST',
      headers: { apikey: CLOUD_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: 'no-store',
    });
  } catch {
    throw new CloudUnavailable('network');
  } finally {
    clearTimeout(timer);
  }
  let json: Record<string, unknown> | null;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = null;
  }
  if (res.status >= 500 || res.status === 404 || res.status === 401 || res.status === 403 || !json) throw new CloudUnavailable(`http ${res.status}`);
  if (res.status >= 400) {
    if (json.message === 'quota') throw new CloudError('quota');
    throw new CloudUnavailable(`http ${res.status}: ${String(json.message ?? '')}`);
  }
  if (json.ok !== true) throw new CloudError(String(json.error ?? 'unknown'), json);
  return json as Ok<T>;
}

const rpc = <T>(fn: string, args: Record<string, unknown>, timeoutMs = 20000) => post<T>(`/rest/v1/rpc/${fn}`, args, timeoutMs);

export function deviceLabel(): string {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return [os, br].filter(Boolean).join(' · ');
}

export type Session = { token: string; account: CloudAccount };

export const api = {
  register: (a: { username: string; password: string; displayName: string; phone: string; standard: number; section: string }) =>
    rpc<Session>('api_register', {
      p_username: a.username,
      p_password: a.password,
      p_display_name: a.displayName,
      p_phone: a.phone,
      p_standard: a.standard,
      p_section: a.section,
      p_device: deviceLabel(),
    }),
  login: (username: string, password: string) => rpc<Session>('api_login', { p_username: username, p_password: password, p_device: deviceLabel() }),
  logout: (token: string) => rpc<object>('api_logout', { p_token: token }, 8000),
  session: (token: string) => rpc<{ account: CloudAccount }>('api_session', { p_token: token }),
  updateProfile: (token: string, displayName: string, section: string) =>
    rpc<{ account: CloudAccount }>('api_update_profile', { p_token: token, p_display_name: displayName, p_section: section }),
  changePhone: (token: string, password: string, phone: string) => rpc<{ account: CloudAccount }>('api_change_phone', { p_token: token, p_password: password, p_phone: phone }),
  changePassword: (token: string, current: string, next: string) => rpc<object>('api_change_password', { p_token: token, p_current: current, p_new: next }),
  push: (token: string, changes: Change[]) => rpc<{ count: number }>('api_push', { p_token: token, p_changes: changes }, 60000),
  pull: (token: string, since: number, limit = 1000) =>
    rpc<{ records: CloudRecord[]; next: number; more: boolean; account: CloudAccount }>('api_pull', { p_token: token, p_since: since, p_limit: limit }, 60000),
  resetPassword: (resetToken: string, username: string, password: string) =>
    rpc<{ username: string }>('api_reset_password', { p_reset_token: resetToken, p_username: username, p_new_password: password }),
  otpSend: (phone: string) => post<object>('/functions/v1/otp', { action: 'send', phone }, 30000),
  otpVerify: (phone: string, code: string) => post<{ resetToken: string; usernames: string[] }>('/functions/v1/otp', { action: 'verify', phone, code }, 30000),
};

/** Marathi message for an expected refusal. */
export function cloudMessage(e: unknown): string {
  if (e instanceof CloudUnavailable) return 'इंटरनेट किंवा ऑनलाइन सेवेशी संपर्क होऊ शकला नाही. थोड्या वेळाने पुन्हा प्रयत्न करा.';
  if (!(e instanceof CloudError)) return e instanceof Error ? e.message : String(e);
  const wait = Number(e.info.wait ?? 0);
  switch (e.code) {
    case 'invalid_username':
      return 'वापरकर्ता नाव 3 ते 20 इंग्रजी लहान अक्षरे/अंक असावे (उदा. jadhav7).';
    case 'username_taken':
      return 'हे वापरकर्ता नाव आधीच वापरले आहे. दुसरे नाव निवडा.';
    case 'invalid_password':
      return 'पासवर्ड किमान 6 अक्षरांचा असावा.';
    case 'invalid_phone':
      return 'मोबाईल नंबर 10 अंकी असावा (उदा. 9876543210).';
    case 'phone_limit':
      return 'या मोबाईल नंबरवर आधीच 5 खाती आहेत.';
    case 'invalid_name':
      return 'कृपया वर्गशिक्षकाचे नाव भरा.';
    case 'invalid_standard':
      return 'कृपया इयत्ता निवडा.';
    case 'invalid_section':
      return 'कृपया तुकडी निवडा.';
    case 'bad_credentials':
      return 'वापरकर्ता नाव किंवा पासवर्ड चुकीचा आहे.';
    case 'bad_password':
      return 'पासवर्ड चुकीचा आहे.';
    case 'locked':
      return `अनेक चुकीचे प्रयत्न झाले. कृपया ${Math.max(1, Math.ceil(wait / 60))} मिनिटांनी पुन्हा प्रयत्न करा.`;
    case 'rate_limited':
      return 'खूप प्रयत्न झाले. थोड्या वेळाने पुन्हा प्रयत्न करा.';
    case 'inactive':
      return 'हे खाते बंद केले आहे.';
    case 'bad_token':
      return 'या उपकरणावरील ऑनलाइन लॉगिन संपले आहे. कृपया पुन्हा लॉगिन करा.';
    case 'no_account':
      return 'या मोबाईल नंबरशी जोडलेले खाते सापडले नाही. खाते तयार करताना दिलेला नंबर टाका.';
    case 'wait':
      return `OTP नुकताच पाठवला आहे. ${wait} सेकंदांनी पुन्हा प्रयत्न करा.`;
    case 'sms_not_configured':
      return 'SMS सेवा अजून सुरू केलेली नाही, त्यामुळे OTP पाठवता येत नाही. मुख्याध्यापक/ॲप व्यवस्थापकांशी संपर्क साधा.';
    case 'sms_failed':
      return 'SMS पाठवता आला नाही. थोड्या वेळाने पुन्हा प्रयत्न करा.';
    case 'otp_invalid':
      return `OTP चुकीचा आहे.${e.info.left !== undefined ? ` अजून ${Number(e.info.left)} प्रयत्न बाकी.` : ''}`;
    case 'otp_expired':
    case 'otp_missing':
      return 'OTP ची वेळ संपली. नवीन OTP मागवा.';
    case 'otp_attempts':
      return 'खूप चुकीचे प्रयत्न झाले. नवीन OTP मागवा.';
    case 'reset_invalid':
      return 'ही प्रक्रिया कालबाह्य झाली. पुन्हा OTP मागवा.';
    case 'quota':
      return 'ऑनलाइन साठवणुकीची मर्यादा संपली.';
    default:
      return 'ऑनलाइन सेवेत अडचण आली. पुन्हा प्रयत्न करा.';
  }
}
