import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { applyUpdate, dismissUpdate, useOnline, usePwa } from '../../app/pwa';
import { useSession } from '../../app/session';
import { APP_NAME, standardOrdinal } from '../../lib/labels';
import { useSaveStatus } from '../../lib/saveStatus';
import { Icon, type IconName } from '../Icon';
import { useFeedback } from '../feedback';
import { ChangePasswordModal } from '../../features/auth/ChangePassword';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

const TEACHER_NAV: { group?: string; items: NavItem[] }[] = [
  { items: [{ to: '/', label: 'डॅशबोर्ड', icon: 'home' }] },
  {
    group: 'विद्यार्थी',
    items: [
      { to: '/students', label: 'विद्यार्थी माहिती', icon: 'student' },
      { to: '/student-list', label: 'विद्यार्थी यादी', icon: 'list' },
    ],
  },
  {
    group: 'मूल्यमापन',
    items: [
      { to: '/formative', label: 'आकारिक मूल्यमापन', icon: 'formative' },
      { to: '/summative', label: 'संकलित मूल्यमापन', icon: 'summative' },
      { to: '/remarks', label: 'वर्णनात्मक नोंदी', icon: 'remarks' },
      { to: '/attendance', label: 'उपस्थिती', icon: 'calendar' },
    ],
  },
  {
    group: 'निकाल',
    items: [
      { to: '/progress-card', label: 'प्रगती कार्ड', icon: 'progress' },
      { to: '/marksheet', label: 'वार्षिक गुणपत्रक', icon: 'marksheet' },
      { to: '/result', label: 'निकाल पत्रक', icon: 'trophy' },
      { to: '/grade-result', label: 'श्रेणीवार निकाल', icon: 'bars' },
      { to: '/category-result', label: 'जातनिहाय निकाल', icon: 'group' },
    ],
  },
  {
    group: 'दाखले व अहवाल',
    items: [
      { to: '/certificates', label: 'शाळा सोडल्याचा दाखला', icon: 'certificate' },
      { to: '/reports', label: 'अहवाल / PDF', icon: 'printer' },
    ],
  },
  { items: [{ to: '/settings', label: 'सेटिंग्ज', icon: 'settings' }] },
];

const ADMIN_NAV: { group?: string; items: NavItem[] }[] = [
  {
    items: [
      { to: '/', label: 'प्रशासन', icon: 'school' },
      { to: '/admin/teachers', label: 'शिक्षक खाती', icon: 'group' },
      { to: '/admin/certificate', label: 'दाखला नमुना', icon: 'certificate' },
      { to: '/admin/backup', label: 'डेटा बॅकअप', icon: 'database' },
      { to: '/admin/account', label: 'माझे खाते', icon: 'key' },
    ],
  },
];

export function NetworkBadge({ light }: { light?: boolean }) {
  const online = useOnline();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold ${
        light ? 'bg-white/12 text-white' : online ? 'bg-leaf-soft text-leaf' : 'bg-turmeric-soft text-turmeric'
      }`}
      aria-live="polite"
    >
      <span className={`h-2 w-2 rounded-full ${online ? 'bg-[#3ccf7f]' : 'bg-[#f0a43a]'}`} aria-hidden />
      {online ? 'ऑनलाइन' : 'ऑफलाइन'}
    </span>
  );
}

function SaveIndicator() {
  const s = useSaveStatus();
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (s.kind !== 'saved') return;
    setFresh(true);
    const t = setTimeout(() => setFresh(false), 4000);
    return () => clearTimeout(t);
  }, [s]);
  if (s.kind === 'idle') return null;
  if (s.kind === 'saving') return <span className="text-[13px] text-white/85">जतन होत आहे…</span>;
  if (s.kind === 'error')
    return (
      <span className="rounded bg-margin px-2 py-0.5 text-[13px] font-semibold text-white" role="alert">
        जतन झाले नाही
      </span>
    );
  return (
    <span className={`text-[13px] font-semibold transition-opacity ${fresh ? 'text-[#a8f0c6] opacity-100' : 'text-white/70'}`} aria-live="polite">
      {fresh ? 'स्थानिक पातळीवर जतन झाले ✓' : 'जतन झाले ✓'}
    </span>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden className="shrink-0">
        <rect x="3" y="2" width="26" height="30" rx="3" fill="#ffffff" />
        <line x1="9" y1="2" x2="9" y2="32" stroke="#c2362f" strokeWidth="1.6" />
        <line x1="12" y1="11" x2="25" y2="11" stroke="#9bb3d3" strokeWidth="1.4" />
        <line x1="12" y1="16" x2="25" y2="16" stroke="#9bb3d3" strokeWidth="1.4" />
        <line x1="12" y1="21" x2="22" y2="21" stroke="#9bb3d3" strokeWidth="1.4" />
        <path d="M13 26.5l2.5 2.5 5-5.5" stroke="#1f7a4a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="leading-tight">
        <div className="font-display text-[19px] text-white">{APP_NAME}</div>
        <div className="text-[12.5px] text-white/70">सातत्यपूर्ण सर्वंकष मूल्यमापन</div>
      </div>
    </div>
  );
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user, cls, signOut, auth } = useSession();
  const { confirm } = useFeedback();
  const nav = user?.role === 'admin' ? ADMIN_NAV : TEACHER_NAV;
  return (
    <nav className="flex h-full flex-col" aria-label="मुख्य मेनू">
      <div className="bg-ink-deep px-4 pt-4 pb-3.5">
        <Brand />
        <div className="mt-3 rounded-lg bg-white/8 px-3 py-2 text-white">
          <div className="truncate text-[15px] font-semibold">{user?.displayName}</div>
          <div className="text-[13px] text-white/75">
            {user?.role === 'admin' ? 'मुख्याध्यापक / प्रशासक' : cls ? `इयत्ता ${standardOrdinal(cls.standard)} — तुकडी ${cls.section}` : ''}
            <span className="ml-1.5">सन {auth?.year}</span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {nav.map((g, gi) => (
          <div key={gi} className={gi ? 'mt-2 border-t border-rule pt-2' : ''}>
            {g.group ? <div className="px-3 pt-1 pb-1 text-[12.5px] font-semibold text-muted">{g.group}</div> : null}
            {g.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-[15.5px] ${
                    isActive ? 'bg-ink-soft font-semibold text-ink-deep shadow-[inset_3px_0_0_#c2362f]' : 'text-text hover:bg-[#f0f3f8]'
                  }`
                }
              >
                <Icon name={it.icon} size={19} className="text-ink" />
                {it.label}
              </NavLink>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-rule p-2">
        <button
          type="button"
          className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-[15.5px] font-semibold text-margin hover:bg-margin-soft"
          onClick={async () => {
            if (await confirm({ title: 'बाहेर पडा', message: 'तुम्हाला खात्यातून बाहेर पडायचे आहे का? तुमची सर्व माहिती या उपकरणावर सुरक्षित राहील.', confirmLabel: 'बाहेर पडा' })) {
              onNavigate?.();
              await signOut();
            }
          }}
        >
          <Icon name="logout" size={19} />
          बाहेर पडा
        </button>
      </div>
    </nav>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const { cls, user } = useSession();
  const pwa = usePwa();
  const { toast } = useFeedback();
  const loc = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpen(false);
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    drawerRef.current?.querySelector<HTMLElement>('a,button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (pwa.offlineReady) toast('ॲप आता ऑफलाइन वापरासाठी तयार आहे.', 'info');
  }, [pwa.offlineReady, toast]);

  const title: ReactNode = user?.role === 'admin' ? 'प्रशासन' : cls ? `इयत्ता ${standardOrdinal(cls.standard)} (${cls.section})` : '';

  return (
    <div className="min-h-dvh lg:pl-[280px]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:rounded focus:bg-white focus:px-3 focus:py-2">
        मुख्य मजकुराकडे जा
      </a>
      {/* desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[280px] border-r border-rule bg-white lg:block">
        <SideNav />
      </aside>
      {/* mobile drawer */}
      {open ? (
        <div className="no-print fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="मेनू">
          <button type="button" className="absolute inset-0 bg-[#0f1f3d]/45" aria-label="मेनू बंद करा" onClick={() => setOpen(false)} />
          <div ref={drawerRef} className="toast-in absolute inset-y-0 left-0 w-[86%] max-w-[320px] bg-white shadow-2xl">
            <SideNav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}

      <header className="no-print sticky top-0 z-20 bg-ink-deep text-white shadow-sm">
        <div className="flex min-h-[56px] items-center gap-2 px-2 sm:px-4">
          <button type="button" className="btn btn-ghost !text-white hover:!bg-white/10 lg:hidden" onClick={() => setOpen(true)} aria-label="मेनू उघडा" aria-expanded={open}>
            <Icon name="menu" size={24} />
          </button>
          <div className="min-w-0 flex-1 truncate font-display text-[19px]">{title}</div>
          <SaveIndicator />
          <NetworkBadge light />
        </div>
        {pwa.needRefresh ? (
          <div className="flex flex-wrap items-center gap-2 bg-[#fff4df] px-4 py-2 text-[14px] text-[#6b3e05]">
            <span className="flex-1">ॲपची नवीन आवृत्ती उपलब्ध आहे. तुमची माहिती सुरक्षित राहील.</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void applyUpdate()}>
              अद्ययावत करा
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={dismissUpdate}>
              नंतर
            </button>
          </div>
        ) : null}
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-3 pt-4 pb-24 outline-none sm:px-5 md:pt-6">
        <Outlet />
      </main>
      {user?.mustChangePassword ? <ChangePasswordModal forced /> : null}
    </div>
  );
}
