import { Component, lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { SessionProvider, useSession } from './app/session';
import { FeedbackProvider } from './components/feedback';
import { AppShell } from './components/layout/AppShell';
import { EmptyState, LinkButton, Spinner } from './components/ui';
import { LoginPage } from './features/auth/LoginPage';
import { SetupWizard } from './features/auth/SetupWizard';
import { Dashboard } from './features/dashboard/Dashboard';

const StudentsPage = lazy(() => import('./features/students/StudentsPage'));
const StudentEdit = lazy(() => import('./features/students/StudentEdit'));
const StudentView = lazy(() => import('./features/students/StudentView'));
const ImportStudents = lazy(() => import('./features/students/ImportStudents'));
const StudentRegister = lazy(() => import('./features/students/StudentRegister'));
const AssessmentEntry = lazy(() => import('./features/assessment/AssessmentEntry'));
const RemarksPage = lazy(() => import('./features/remarks/RemarksPage'));
const RemarkLibraryPage = lazy(() => import('./features/remarks/RemarkLibraryPage'));
const AttendancePage = lazy(() => import('./features/attendance/AttendancePage'));
const ResultPage = lazy(() => import('./features/results/ResultPage'));
const ReportScreen = lazy(() => import('./features/reports/ReportScreen'));
const ReportsHub = lazy(() => import('./features/reports/ReportsHub'));
const CertificatesPage = lazy(() => import('./features/certificates/CertificatesPage'));
const CertificateEdit = lazy(() => import('./features/certificates/CertificateEdit'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const AdminPages = lazy(() => import('./features/admin/AdminPages'));

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const e = this.state.error;
    if (e) {
      const access = e.name === 'AccessError' || e.name === 'NotFoundError';
      return (
        <div className="py-6">
          <EmptyState
            icon="alert"
            title={access ? e.message : 'हे पान उघडताना अडचण आली.'}
            text={access ? 'ही माहिती तुमच्या वर्गाची नाही किंवा हटवली गेली आहे.' : 'पान पुन्हा लोड करून पहा. तुमची जतन केलेली माहिती सुरक्षित आहे.'}
            action={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  this.setState({ error: null });
                  window.location.hash = '#/';
                }}
              >
                डॅशबोर्डवर जा
              </button>
            }
          />
        </div>
      );
    }
    return this.props.children;
  }
}

function Loading() {
  return (
    <div className="flex items-center gap-3 py-16 text-muted" role="status">
      <Spinner /> माहिती लोड होत आहे…
    </div>
  );
}

function Page({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return (
    <ErrorBoundary key={loc.pathname}>
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function NotFound() {
  return <EmptyState icon="info" title="हे पान सापडले नाही." action={<LinkButton to="/" variant="primary">डॅशबोर्डवर जा</LinkButton>} />;
}

function TeacherRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Page><Dashboard /></Page>} />
        <Route path="students" element={<Page><StudentsPage /></Page>} />
        <Route path="students/new" element={<Page><StudentEdit /></Page>} />
        <Route path="students/import" element={<Page><ImportStudents /></Page>} />
        <Route path="students/:id" element={<Page><StudentView /></Page>} />
        <Route path="students/:id/edit" element={<Page><StudentEdit /></Page>} />
        <Route path="student-list" element={<Page><StudentRegister /></Page>} />
        <Route path="formative" element={<Page><AssessmentEntry type="F" /></Page>} />
        <Route path="summative" element={<Page><AssessmentEntry type="S" /></Page>} />
        <Route path="remarks" element={<Page><RemarksPage /></Page>} />
        <Route path="remarks/library" element={<Page><RemarkLibraryPage /></Page>} />
        <Route path="attendance" element={<Page><AttendancePage /></Page>} />
        <Route path="progress-card" element={<Page><ReportScreen reportKey="progress-card" /></Page>} />
        <Route path="marksheet" element={<Page><ReportScreen reportKey="annual-marksheet" /></Page>} />
        <Route path="result" element={<Page><ResultPage /></Page>} />
        <Route path="grade-result" element={<Page><ReportScreen reportKey="grade-wise" /></Page>} />
        <Route path="category-result" element={<Page><ReportScreen reportKey="category-wise" /></Page>} />
        <Route path="certificates" element={<Page><CertificatesPage /></Page>} />
        <Route path="certificates/new" element={<Page><CertificateEdit /></Page>} />
        <Route path="certificates/:id" element={<Page><CertificateEdit /></Page>} />
        <Route path="reports" element={<Page><ReportsHub /></Page>} />
        <Route path="reports/:key" element={<Page><ReportScreen /></Page>} />
        <Route path="settings" element={<Page><SettingsPage /></Page>} />
        <Route path="settings/:section" element={<Page><SettingsPage /></Page>} />
        <Route path="admin/*" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Page><AdminPages section="school" /></Page>} />
        <Route path="admin/teachers" element={<Page><AdminPages section="teachers" /></Page>} />
        <Route path="admin/certificate" element={<Page><AdminPages section="certificate" /></Page>} />
        <Route path="admin/backup" element={<Page><AdminPages section="backup" /></Page>} />
        <Route path="admin/account" element={<Page><AdminPages section="account" /></Page>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function Gate() {
  const { phase, user } = useSession();
  if (phase === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-deep text-white" role="status">
        <div className="text-center">
          <div className="font-display text-[30px]">CCE नोंदवही</div>
          <div className="mt-2 text-white/70">उघडत आहे…</div>
        </div>
      </div>
    );
  }
  if (phase === 'setup') return <SetupWizard />;
  if (phase === 'login' || !user) return <LoginPage />;
  return <HashRouter>{user.role === 'admin' ? <AdminRoutes /> : <TeacherRoutes />}</HashRouter>;
}

export function App() {
  return (
    <FeedbackProvider>
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </FeedbackProvider>
  );
}
