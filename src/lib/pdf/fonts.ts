/**
 * The report font. The same TTF files are used by the browser (screen and
 * print) and by the PDF engine, so line breaks and widths match exactly.
 * Noto Sans Devanagari — SIL Open Font License 1.1 (see OFL-*.txt).
 */
import regularUrl from '../../assets/fonts/NotoSansDevanagari-Regular.ttf?url';
import semiBoldUrl from '../../assets/fonts/NotoSansDevanagari-SemiBold.ttf?url';
import boldUrl from '../../assets/fonts/NotoSansDevanagari-Bold.ttf?url';

export const FONT_URLS = { R: regularUrl, S: semiBoldUrl, B: boldUrl } as const;

/** Vertical metrics of Noto Sans Devanagari (units per em = 1000). */
export const FONT_ASCENT = 0.896;
export const FONT_DESCENT = 0.408;
