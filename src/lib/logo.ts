/**
 * Logo printed on the leaving certificate, the register cover and the
 * progress card. Default: the Pune Zilla Parishad emblem (supplied by the
 * school). A school can upload its own logo or print none.
 */
import zpPune from '../assets/zp-pune.jpg';
import type { School } from './types';

export type LogoMode = 'zp' | 'custom' | 'none';

export const ZP_LOGO_SRC: string = zpPune;

export function logoMode(s: Pick<School, 'logo' | 'logoMode'>): LogoMode {
  return s.logoMode ?? (s.logo ? 'custom' : 'zp');
}

export function schoolLogoSrc(s: Pick<School, 'logo' | 'logoMode'>): string | null {
  const m = logoMode(s);
  if (m === 'none') return null;
  if (m === 'custom') return s.logo || null;
  return ZP_LOGO_SRC;
}

export const LOGO_OPTIONS: { value: LogoMode; label: string }[] = [
  { value: 'zp', label: 'पुणे जिल्हा परिषद लोगो' },
  { value: 'custom', label: 'शाळेचा स्वतःचा लोगो (अपलोड केलेला)' },
  { value: 'none', label: 'लोगो नको' },
];
