import { describe, expect, it } from 'vitest';
import { digitsOnly, validateStudent, verhoeffValid } from '../src/lib/validation';
import { normalizePhone } from '../src/lib/cloud/account';
import { canonical, fingerprint } from '../src/lib/cloud/canon';
import { splitName } from '../src/features/reports/templates/certificate';
import { splitThree } from '../src/features/reports/templates/progress';
import { CATEGORIES, categoryLabel } from '../src/lib/labels';
import { logoMode, schoolLogoSrc, ZP_LOGO_SRC } from '../src/lib/logo';

describe('आधार / अपार', () => {
  it('checks the Aadhaar check digit (Verhoeff)', () => {
    expect(verhoeffValid('499118665246')).toBe(true);
    expect(verhoeffValid('499118665247')).toBe(false);
  });
  it('12 digits are required; a wrong check digit is only a warning', () => {
    const base = { fullName: 'नमुना', gender: 'M' as const };
    expect(validateStudent({ ...base, aadhaar: '49911866524' }, []).errors.aadhaar).toBeTruthy();
    const w = validateStudent({ ...base, aadhaar: '4991 1866 5247' }, []);
    expect(w.errors.aadhaar).toBeUndefined();
    expect(w.warnings.aadhaar).toBeTruthy();
    expect(validateStudent({ ...base, aadhaar: '४९९११८६६५२४६' }, []).warnings.aadhaar).toBeUndefined();
    expect(validateStudent({ ...base, apaar: '12345678901' }, []).errors.apaar).toBeTruthy();
    expect(validateStudent({ ...base, apaar: '123456789012' }, []).errors.apaar).toBeUndefined();
    expect(digitsOnly('१२३४ ५६७८-९०')).toBe('1234567890');
  });
  it('weight and height must be numbers', () => {
    const r = validateStudent({ fullName: 'नमुना', gender: 'F', health: { weight1: '32.5', height1: 'abc', weight2: '', height2: '१४०' } }, []);
    expect(r.errors['health.weight1']).toBeUndefined();
    expect(r.errors['health.height1']).toBeTruthy();
    expect(r.errors['health.height2']).toBeUndefined();
  });
});

describe('labels', () => {
  it('प्रवर्ग shows बिगर मागास instead of खुला', () => {
    expect(categoryLabel('OPEN')).toContain('बिगर मागास');
    expect(CATEGORIES.some((c) => c.label.includes('खुला'))).toBe(false);
  });
});

describe('logo', () => {
  it('defaults to the ZP emblem, a school logo once uploaded, or none', () => {
    expect(logoMode({ logo: '' })).toBe('zp');
    expect(schoolLogoSrc({ logo: '' })).toBe(ZP_LOGO_SRC);
    expect(schoolLogoSrc({ logo: 'data:image/jpeg;base64,xx' })).toBe('data:image/jpeg;base64,xx');
    expect(schoolLogoSrc({ logo: 'data:x', logoMode: 'zp' })).toBe(ZP_LOGO_SRC);
    expect(schoolLogoSrc({ logo: 'data:x', logoMode: 'none' })).toBeNull();
    expect(schoolLogoSrc({ logo: '', logoMode: 'custom' })).toBeNull();
  });
});

describe('दाखला and प्रगतीपत्रक helpers', () => {
  it('splits "नाव वडिलांचे नाव आडनाव"', () => {
    expect(splitName('शालिनी रामलिंग पाटील')).toEqual({ first: 'शालिनी', father: 'रामलिंग', surname: 'पाटील' });
    expect(splitName(' सई  देशमुख ')).toEqual({ first: 'सई', father: '', surname: 'देशमुख' });
    expect(splitName('अ ब क ड')).toEqual({ first: 'अ', father: 'ब क', surname: 'ड' });
  });
  it('divides the subject rows into the three वर्णनात्मक नोंदी blocks', () => {
    expect(splitThree(9)).toEqual([3, 3, 3]);
    expect(splitThree(8)).toEqual([3, 3, 2]);
    expect(splitThree(7)).toEqual([3, 2, 2]);
    expect(splitThree(6)).toEqual([2, 2, 2]);
  });
});

describe('online accounts helpers', () => {
  it('normalizes mobile numbers', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('9876543210');
    expect(normalizePhone('09876543210')).toBe('9876543210');
    expect(normalizePhone('९८७६५४३२१०')).toBe('9876543210');
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('5876543210')).toBeNull();
  });
  it('fingerprints ignore key order (the server reorders JSON keys)', () => {
    const a = { b: 1, a: { d: 2, c: [1, { y: 1, x: 2 }] }, u: undefined };
    const b = { a: { c: [1, { x: 2, y: 1 }], d: 2 }, b: 1 };
    expect(canonical(a)).toBe(canonical(b));
    expect(fingerprint(a)).toBe(fingerprint(b));
    expect(fingerprint({ ...b, b: 2 })).not.toBe(fingerprint(b));
  });
});
