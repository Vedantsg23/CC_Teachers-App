import { describe, expect, it } from 'vitest';
import { dateToMarathiWords, numberToMarathiWords, toFeminine } from '../src/lib/marathi';
import { fmtDate, parseDateLoose, termOfMonth, yearMonths, nextYear, isValidYear } from '../src/lib/format';
import { validateMark, validateStudent, validateCount, MSG, normalizeDigits } from '../src/lib/validation';

describe('Marathi number words', () => {
  it.each([
    [1, 'एक'], [19, 'एकोणीस'], [28, 'अठ्ठावीस'], [45, 'पंचेचाळीस'], [99, 'नव्व्याण्णव'],
    [2013, 'दोन हजार तेरा'], [2026, 'दोन हजार सव्वीस'], [1999, 'एक हजार नऊशे नव्व्याण्णव'],
  ])('%d → %s', (n, w) => expect(numberToMarathiWords(n)).toBe(w));
  it('date in words for the leaving certificate', () => {
    expect(dateToMarathiWords('2013-11-28')).toBe('अठ्ठावीस नोव्हेंबर दोन हजार तेरा');
  });
});

describe('gendered remarks (मुलगा → मुलगी)', () => {
  it('Marathi verb endings', () => {
    expect(toFeminine('शालेय उपक्रमात सहभाग घेतो.')).toBe('शालेय उपक्रमात सहभाग घेते.');
    expect(toFeminine('कविता तालासुरात म्हणतो.', 'marathi')).toBe('कविता तालासुरात म्हणते.');
    expect(toFeminine('तो नियमित येतो.')).toBe('ती नियमित येते.');
    expect(toFeminine('वाचन, लेखनाकडे लक्ष द्यावे.')).toBe('वाचन, लेखनाकडे लक्ष द्यावे.');
  });
  it('Hindi', () => {
    expect(toFeminine('कविता का सस्वर पाठ करता है।', 'hindi')).toBe('कविता का सस्वर पाठ करती है।');
    expect(toFeminine('पाठ का आशय अपने शब्दों में बताता है।', 'hindi')).toBe('पाठ का आशय अपने शब्दों में बताती है।');
  });
  it('English', () => {
    expect(toFeminine('He reads simple English words.', 'english')).toBe('She reads simple English words.');
    expect(toFeminine('He helps his friends.', 'english')).toBe('She helps her friends.');
  });
});

describe('dates', () => {
  it('formats and parses', () => {
    expect(fmtDate('2013-11-28')).toBe('28-11-2013');
    expect(parseDateLoose('28-11-2013')).toBe('2013-11-28');
    expect(parseDateLoose('3/5/2014')).toBe('2014-05-03');
    expect(parseDateLoose('2014-05-03')).toBe('2014-05-03');
    expect(parseDateLoose('31-02-2014')).toBe('');
    expect(parseDateLoose(41606)).toBe('2013-11-28'); // Excel serial
  });
  it('academic year months and terms', () => {
    const m = yearMonths('2026-27');
    expect(m[0]).toBe('2026-06');
    expect(m[m.length - 1]).toBe('2027-04');
    expect(termOfMonth('2026-10')).toBe(1);
    expect(termOfMonth('2026-11')).toBe(2);
    expect(nextYear('2026-27')).toBe('2027-28');
    expect(isValidYear('2026-27')).toBe(true);
    expect(isValidYear('2026-28')).toBe(false);
  });
});

describe('validation', () => {
  it('marks', () => {
    expect(validateMark('', 10)).toEqual({ ok: true, value: null });
    expect(validateMark('8.5', 10)).toEqual({ ok: true, value: 8.5 });
    expect(validateMark('८५', 100)).toEqual({ ok: true, value: 85 });
    expect(validateMark('11', 10)).toEqual({ ok: false, error: MSG.marksMax });
    expect(validateMark('-1', 10)).toEqual({ ok: false, error: MSG.marksNegative });
    expect(validateMark('abc', 10)).toEqual({ ok: false, error: MSG.marksInvalid });
  });
  it('attendance cannot exceed working days', () => {
    expect(validateCount('23', 22, MSG.attendanceExceeds)).toEqual({ ok: false, error: MSG.attendanceExceeds });
    expect(validateCount('22', 22, MSG.attendanceExceeds)).toEqual({ ok: true, value: 22 });
  });
  it('student form', () => {
    const { errors } = validateStudent({ fullName: '', gender: 'M' }, []);
    expect(errors.fullName).toBe(MSG.nameRequired);
    const r = validateStudent({ id: 'x', fullName: 'अ', gender: 'F', dob: '2099-01-01', mobile: '12345' }, []);
    expect(r.errors.dob).toBe(MSG.dobFuture);
    expect(r.errors.mobile).toBe(MSG.mobileInvalid);
  });
  it('duplicate roll / register numbers are warnings', () => {
    const other = { id: 'o', rollNo: 4, regNo: '5123', status: 'active' } as never;
    const r = validateStudent({ id: 'x', fullName: 'अ', gender: 'M', rollNo: 4, regNo: '5123' }, [other]);
    expect(r.warnings.rollNo).toBe(MSG.dupRoll);
    expect(r.warnings.regNo).toBe(MSG.dupReg);
    expect(Object.keys(r.errors)).toHaveLength(0);
  });
  it('normalizes Devanagari digits', () => expect(normalizeDigits('२०२६')).toBe('2026'));
});
