/** Choose the logo printed on the leaving certificate, the cover and the progress card. */
import { useState } from 'react';
import { LOGO_OPTIONS, logoMode, schoolLogoSrc, type LogoMode } from '../lib/logo';
import { imageFileToDataUrl } from '../lib/share';
import type { School } from '../lib/types';
import { Icon } from './Icon';
import { SelectField } from './ui';

export function LogoPicker({ school, onChange }: { school: School; onChange: (s: School) => void }) {
  const [err, setErr] = useState('');
  const mode = logoMode(school);
  const src = schoolLogoSrc(school);
  return (
    <div className="grid gap-3 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <SelectField
        label="दाखला, मुखपृष्ठ व प्रगती कार्डावरील लोगो"
        value={mode}
        onChange={(v) => onChange({ ...school, logoMode: v as LogoMode })}
        options={LOGO_OPTIONS}
        error={err || undefined}
        hint={mode === 'custom' && !school.logo ? 'लोगोची फाइल निवडा.' : undefined}
      />
      <div className="flex min-h-[48px] items-center gap-3">
        {src ? (
          <img src={src} alt="निवडलेला लोगो" className="h-14 w-16 rounded bg-white object-contain ring-1 ring-rule" />
        ) : (
          <span className="text-[14px] text-muted">लोगो छापला जाणार नाही</span>
        )}
        {mode === 'custom' ? (
          <label className="btn btn-secondary cursor-pointer">
            <Icon name="camera" />
            {school.logo ? 'लोगो बदला' : 'लोगो निवडा'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  setErr('');
                  onChange({ ...school, logoMode: 'custom', logo: await imageFileToDataUrl(f, 400, 400, 0.9) });
                } catch (x) {
                  setErr(x instanceof Error ? x.message : 'लोगो उघडता आला नाही.');
                }
              }}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
