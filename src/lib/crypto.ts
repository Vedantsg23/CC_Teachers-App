/**
 * Password hashing (PBKDF2-SHA256) and backup encryption (AES-GCM).
 *
 * WebCrypto is used when available (HTTPS / localhost). A small pure-JS
 * SHA-256/PBKDF2 fallback keeps login working when the app is opened from an
 * insecure origin such as a LAN IP during testing.
 */

export const PBKDF2_ITERATIONS = 150_000;

const subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle;

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

export function uid(): string {
  const c = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (typeof c.randomUUID === 'function') {
    try {
      return c.randomUUID();
    } catch {
      /* insecure context — fall through */
    }
  }
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function toHex(b: Uint8Array): string {
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function toB64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ------------------------------------------------------------------ */
/* Pure-JS SHA-256 / HMAC / PBKDF2 (fallback)                          */
/* ------------------------------------------------------------------ */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const W = new Uint32Array(64);

function compress(state: Uint32Array, block: Uint8Array, off: number) {
  for (let i = 0; i < 16; i++) {
    const j = off + i * 4;
    W[i] = (block[j] << 24) | (block[j + 1] << 16) | (block[j + 2] << 8) | block[j + 3];
  }
  for (let i = 16; i < 64; i++) {
    const a = W[i - 15];
    const b = W[i - 2];
    const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
    const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
  }
  let a = state[0];
  let b = state[1];
  let c = state[2];
  let d = state[3];
  let e = state[4];
  let f = state[5];
  let g = state[6];
  let h = state[7];
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (S0 + maj) | 0;
    h = g;
    g = f;
    f = e;
    e = (d + t1) | 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) | 0;
  }
  state[0] = (state[0] + a) | 0;
  state[1] = (state[1] + b) | 0;
  state[2] = (state[2] + c) | 0;
  state[3] = (state[3] + d) | 0;
  state[4] = (state[4] + e) | 0;
  state[5] = (state[5] + f) | 0;
  state[6] = (state[6] + g) | 0;
  state[7] = (state[7] + h) | 0;
}

const IV = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

export function sha256(data: Uint8Array): Uint8Array {
  const state = new Uint32Array(IV);
  const len = data.length;
  const total = Math.ceil((len + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(data);
  buf[len] = 0x80;
  const bits = len * 8;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 4, bits >>> 0);
  dv.setUint32(total - 8, Math.floor(bits / 0x100000000));
  for (let off = 0; off < total; off += 64) compress(state, buf, off);
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) odv.setUint32(i * 4, state[i]);
  return out;
}

function stateAfterBlock(block64: Uint8Array): Uint32Array {
  const s = new Uint32Array(IV);
  compress(s, block64, 0);
  return s;
}

/** Finish a hash whose first 64-byte block is already absorbed, with a 32-byte message. */
function finish32(prefixState: Uint32Array, msg32: Uint8Array): Uint8Array {
  const s = new Uint32Array(prefixState);
  const block = new Uint8Array(64);
  block.set(msg32);
  block[32] = 0x80;
  // total length = 64 + 32 bytes = 768 bits
  block[62] = 0x03;
  block[63] = 0x00;
  compress(s, block, 0);
  const out = new Uint8Array(32);
  const dv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) dv.setUint32(i * 4, s[i]);
  return out;
}

function hmacKeyStates(key: Uint8Array): { inner: Uint32Array; outer: Uint32Array } {
  let k = key;
  if (k.length > 64) k = sha256(k);
  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const b = k[i] ?? 0;
    ipad[i] = b ^ 0x36;
    opad[i] = b ^ 0x5c;
  }
  return { inner: stateAfterBlock(ipad), outer: stateAfterBlock(opad) };
}

function hmacFull(key: Uint8Array, msg: Uint8Array): Uint8Array {
  let k = key;
  if (k.length > 64) k = sha256(k);
  const ipad = new Uint8Array(64 + msg.length);
  const opad = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i++) {
    const b = k[i] ?? 0;
    ipad[i] = b ^ 0x36;
    opad[i] = b ^ 0x5c;
  }
  ipad.set(msg, 64);
  opad.set(sha256(ipad), 64);
  return sha256(opad);
}

export function pbkdf2Sha256Js(password: Uint8Array, salt: Uint8Array, iterations: number, dkLen = 32): Uint8Array {
  const { inner, outer } = hmacKeyStates(password);
  const blocks = Math.ceil(dkLen / 32);
  const out = new Uint8Array(blocks * 32);
  for (let bi = 1; bi <= blocks; bi++) {
    const s1 = new Uint8Array(salt.length + 4);
    s1.set(salt);
    new DataView(s1.buffer).setUint32(salt.length, bi);
    let u = hmacFull(password, s1);
    const t = new Uint8Array(u);
    for (let i = 1; i < iterations; i++) {
      u = finish32(outer, finish32(inner, u));
      for (let j = 0; j < 32; j++) t[j] ^= u[j];
    }
    out.set(t, (bi - 1) * 32);
  }
  return out.slice(0, dkLen);
}

export async function pbkdf2Sha256(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const pw = new TextEncoder().encode(password.normalize('NFC'));
  if (subtle) {
    try {
      const key = await subtle.importKey('raw', pw, 'PBKDF2', false, ['deriveBits']);
      const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
      return new Uint8Array(bits);
    } catch {
      /* fall back */
    }
  }
  return pbkdf2Sha256Js(pw, salt, iterations);
}

export interface PasswordHash {
  pwHash: string;
  pwSalt: string;
  pwIter: number;
}

export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<PasswordHash> {
  const salt = randomBytes(16);
  const hash = await pbkdf2Sha256(password, salt, iterations);
  return { pwHash: toB64(hash), pwSalt: toB64(salt), pwIter: iterations };
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, rec: PasswordHash): Promise<boolean> {
  try {
    const hash = await pbkdf2Sha256(password, fromB64(rec.pwSalt), rec.pwIter);
    return constantTimeEqual(hash, fromB64(rec.pwHash));
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Backup encryption (AES-GCM, key from PBKDF2)                        */
/* ------------------------------------------------------------------ */

export function canEncrypt(): boolean {
  return !!subtle;
}

export interface EncryptedBlob {
  salt: string;
  iv: string;
  iter: number;
  data: string;
}

async function aesKey(password: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  if (!subtle) throw new Error('WebCrypto unavailable');
  const raw = await pbkdf2Sha256(password, salt, iter);
  return subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptText(text: string, password: string): Promise<EncryptedBlob> {
  if (!subtle) throw new Error('WebCrypto unavailable');
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const iter = PBKDF2_ITERATIONS;
  const key = await aesKey(password, salt, iter);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(text));
  return { salt: toB64(salt), iv: toB64(iv), iter, data: toB64(new Uint8Array(ct)) };
}

export async function decryptText(blob: EncryptedBlob, password: string): Promise<string> {
  if (!subtle) throw new Error('WebCrypto unavailable');
  const key = await aesKey(password, fromB64(blob.salt), blob.iter);
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(blob.iv) as BufferSource }, key, fromB64(blob.data) as BufferSource);
  return new TextDecoder().decode(pt);
}
