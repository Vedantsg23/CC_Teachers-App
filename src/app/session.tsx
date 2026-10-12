/** App-wide session state: setup → login → teacher / admin. */
import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as auth from '../lib/auth';
import { db } from '../lib/db';
import * as repo from '../lib/repo';
import type { AppMeta, ClassConfig, ClassRoom, School, User } from '../lib/types';
import { requestPersistentStorage } from './pwa';

type Phase = 'loading' | 'setup' | 'login' | 'ready';

interface SessionCtx {
  phase: Phase;
  meta: AppMeta;
  school: School;
  auth: auth.AuthState | null;
  user: User | null;
  cls: ClassRoom | null;
  scope: repo.Scope | null;
  signedIn: (a: auth.AuthState) => void;
  signOut: () => Promise<void>;
  reloadAll: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [authState, setAuth] = useState<auth.AuthState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const metaRow = useLiveQuery(() => db.meta.get('app'), []);
  const schoolRow = useLiveQuery(() => db.meta.get('school'), []);
  const meta = (metaRow?.value as AppMeta | undefined) ?? repo.DEFAULT_META;
  const school = useMemo(() => ({ ...repo.emptySchool(), ...((schoolRow?.value as Partial<School>) ?? {}) }), [schoolRow]);

  const classId = authState?.classRoom?.id;
  const liveClass = useLiveQuery(() => (classId ? db.classes.get(classId) : undefined), [classId]);
  const userId = authState?.user.id;
  const liveUser = useLiveQuery(() => (userId ? db.users.get(userId) : undefined), [userId]);

  const reloadAll = useCallback(async () => {
    try {
      const m = await repo.getMeta();
      if (!m?.setupDone) {
        setAuth(null);
        setPhase('setup');
        return;
      }
      const restored = await auth.restoreSession();
      setAuth(restored);
      setPhase(restored ? 'ready' : 'login');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  const signedIn = useCallback((a: auth.AuthState) => {
    setAuth(a);
    setPhase('ready');
    void requestPersistentStorage();
  }, []);

  const signOut = useCallback(async () => {
    await auth.logout();
    setAuth(null);
    setPhase('login');
    window.location.hash = '#/';
  }, []);

  // If the account was disabled or the session row removed elsewhere, sign out.
  useEffect(() => {
    if (authState && liveUser === undefined) return; // still loading
    if (authState && liveUser && !liveUser.active) void signOut();
  }, [authState, liveUser, signOut]);

  const cls = liveClass ?? authState?.classRoom ?? null;
  const user = liveUser ?? authState?.user ?? null;
  const scope = useMemo(() => (cls && user ? { classId: cls.id, userId: user.id } : null), [cls, user]);

  const value: SessionCtx = { phase, meta, school, auth: authState, user, cls, scope, signedIn, signOut, reloadAll };

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <p className="text-lg font-semibold text-margin">माहिती उघडताना अडचण आली.</p>
          <p className="mt-2 text-muted">{error}</p>
          <p className="mt-2 text-sm text-muted">ब्राउझर Private/Incognito मोडमध्ये असल्यास साध्या मोडमध्ये उघडा.</p>
        </div>
      </div>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('SessionProvider missing');
  return c;
}

export interface TeacherCtx {
  scope: repo.Scope;
  cls: ClassRoom;
  cfg: ClassConfig;
  user: User;
  school: School;
  year: string;
}

/** Use inside teacher-only screens. */
export function useTeacher(): TeacherCtx {
  const s = useSession();
  if (!s.scope || !s.cls || !s.user) throw new Error('teacher session required');
  return { scope: s.scope, cls: s.cls, cfg: s.cls.config, user: s.user, school: s.school, year: s.cls.year };
}
