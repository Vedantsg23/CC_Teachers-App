import { describe, expect, it } from 'vitest';
import { hashPassword, pbkdf2Sha256, pbkdf2Sha256Js, sha256, toHex, verifyPassword, encryptText, decryptText } from '../src/lib/crypto';
import { parseCsv, parseXlsx, toCsv, toXlsx } from '../src/lib/sheet';

describe('crypto', () => {
  it('sha256 matches known vectors', () => {
    expect(toHex(sha256(new TextEncoder().encode('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(toHex(sha256(new Uint8Array(0)))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('JS PBKDF2 fallback equals WebCrypto', async () => {
    const salt = new TextEncoder().encode('salt-1234');
    const a = pbkdf2Sha256Js(new TextEncoder().encode('शिक्षक@७'), salt, 1000);
    const b = await pbkdf2Sha256('शिक्षक@७', salt, 1000);
    expect(toHex(a)).toBe(toHex(b));
  });
  it('hashes and verifies passwords (no plain text stored)', async () => {
    const h = await hashPassword('secret77', 2000);
    expect(h.pwHash).not.toContain('secret77');
    expect(await verifyPassword('secret77', h)).toBe(true);
    expect(await verifyPassword('secret78', h)).toBe(false);
  });
  it('encrypts backups', async () => {
    const blob = await encryptText('{"a":"मराठी"}', 'pass123');
    expect(await decryptText(blob, 'pass123')).toBe('{"a":"मराठी"}');
    await expect(decryptText(blob, 'wrong')).rejects.toBeTruthy();
  });
});

describe('CSV / XLSX', () => {
  const rows = [
    ['हजेरी क्र.', 'विद्यार्थ्याचे नाव', 'टीप'],
    [1, 'अमोल विजय गायकवाड', 'a, "quoted"'],
    [2, 'सई महेश देशमुख', '=1+1'],
  ];
  it('CSV round trip with BOM and quoting', () => {
    const csv = toCsv(rows);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const back = parseCsv(csv);
    expect(back[1]).toEqual(['1', 'अमोल विजय गायकवाड', 'a, "quoted"']);
    expect(back[2][2]).toBe("'=1+1"); // formula injection neutralised
  });
  it('XLSX round trip', () => {
    const bytes = toXlsx([{ name: 'विद्यार्थी', rows }]);
    const back = parseXlsx(bytes);
    expect(back[0]).toEqual(['हजेरी क्र.', 'विद्यार्थ्याचे नाव', 'टीप']);
    expect(back[1]).toEqual(['1', 'अमोल विजय गायकवाड', 'a, "quoted"']);
  });
});
