import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.js';
import { usePendingReviewCount } from './hooks/useReviewQueue.js';
import './App.css';

// Eagerly loaded pages (needed immediately)
import { Login } from './pages/Login.js';
import { Dashboard } from './pages/Dashboard.js';
import { Timesheet } from './pages/Timesheet.js';

// Lazy loaded pages (supervisor features, loaded on demand)
const EmployeeList = lazy(() =>
  import('./pages/EmployeeList.js').then((m) => ({ default: m.EmployeeList }))
);
const EmployeeDetail = lazy(() =>
  import('./pages/EmployeeDetail.js').then((m) => ({ default: m.EmployeeDetail }))
);
const AddEmployee = lazy(() =>
  import('./pages/AddEmployee.js').then((m) => ({ default: m.AddEmployee }))
);
const TaskCodeList = lazy(() =>
  import('./pages/TaskCodeList.js').then((m) => ({ default: m.TaskCodeList }))
);
const TaskCodeDetail = lazy(() =>
  import('./pages/TaskCodeDetail.js').then((m) => ({ default: m.TaskCodeDetail }))
);
const TaskCodeForm = lazy(() =>
  import('./components/TaskCodeForm.js').then((m) => ({ default: m.TaskCodeForm }))
);
const ReviewQueue = lazy(() =>
  import('./pages/ReviewQueue.js').then((m) => ({ default: m.ReviewQueue }))
);
const ReviewDetail = lazy(() =>
  import('./pages/ReviewDetail.js').then((m) => ({ default: m.ReviewDetail }))
);
const PayrollReportPage = lazy(() =>
  import('./pages/PayrollReportPage.js').then((m) => ({ default: m.PayrollReportPage }))
);
const Alerts = lazy(() => import('./pages/Alerts.js').then((m) => ({ default: m.Alerts })));
const ReportsDashboard = lazy(() =>
  import('./pages/ReportsDashboard.js').then((m) => ({ default: m.ReportsDashboard }))
);
const ComplianceAuditReport = lazy(() =>
  import('./pages/ComplianceAuditReport.js').then((m) => ({ default: m.ComplianceAuditReport }))
);
const TimesheetHistoryReport = lazy(() =>
  import('./pages/TimesheetHistoryReport.js').then((m) => ({ default: m.TimesheetHistoryReport }))
);

/**
 * Loading fallback for lazy-loaded routes
 */
function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true" />
      <p>Loading page...</p>
    </div>
  );
}

/**
 * Layout wrapper that includes navigation
 */
function AppLayout() {
  const { user, logout, isSupervisor } = useAuth();
  const { count: pendingReviewCount } = usePendingReviewCount();

  return (
    <div className="app-layout">
      {/* Skip link for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <nav className="app-nav" aria-label="Main navigation">
        <div className="nav-brand">
          <a href="/dashboard" aria-label="Renewal Initiatives Home">
            Renewal Initiatives
          </a>
        </div>
        <div className="nav-links" role="menubar">
          <a href="/timesheet" role="menuitem">
            My Timesheet
          </a>
          {isSupervisor && (
            <>
              <a href="/dashboard" role="menuitem">
                Dashboard
              </a>
              <a
                href="/review"
                className="nav-link-with-badge"
                role="menuitem"
                aria-label={
                  pendingReviewCount > 0
                    ? `Review Queue (${pendingReviewCount} pending)`
                    : 'Review Queue'
                }
              >
                Review Queue
                {pendingReviewCount > 0 && (
                  <span className="nav-badge" data-testid="review-queue-badge" aria-hidden="true">
                    {pendingReviewCount}
                  </span>
                )}
              </a>
              <a href="/employees" role="menuitem">
                Employees
              </a>
              <a href="/task-codes" role="menuitem">
                Task Codes
              </a>
              <a href="/reports" role="menuitem">
                Reports
              </a>
            </>
          )}
        </div>
        <div className="nav-user">
          <span className="user-name" aria-label={`Logged in as ${user?.name}`}>
            {user?.name}
          </span>
          <button
            onClick={logout}
            className="logout-button"
            data-testid="auth-logout-button"
            aria-label="Sign out of your account"
          >
            Sign Out
          </button>
        </div>
      </nav>
      <main id="main-content" className="app-main" role="main">
        <Outlet />
      </main>
    </div>
  );
}

/**
 * Protected route wrapper
 */
function ProtectedRoute({ requireSupervisor = false }: { requireSupervisor?: boolean }) {
  const { isAuthenticated, isSupervisor, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen" role="status" aria-live="polite">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireSupervisor && !isSupervisor) {
    return (
      <div className="forbidden-screen" role="alert">
        <h1>Access Denied</h1>
        <p>You need supervisor privileges to access this page.</p>
        <a href="/dashboard">Go to Dashboard</a>
      </div>
    );
  }

  return <Outlet />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                {/* Redirect root to dashboard */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />

                {/* Dashboard - accessible to all authenticated users */}
                <Route path="/dashboard" element={<Dashboard />} />

                {/* Timesheet - accessible to all authenticated users */}
                <Route path="/timesheet" element={<Timesheet />} />
                <Route path="/timesheet/:weekStartDate" element={<Timesheet />} />

                {/* Supervisor-only routes (lazy loaded) */}
                <Route element={<ProtectedRoute requireSupervisor />}>
                  <Route path="/employees" element={<EmployeeList />} />
                  <Route path="/employees/add" element={<AddEmployee />} />
                  <Route path="/employees/:id" element={<EmployeeDetail />} />
                  <Route path="/task-codes" element={<TaskCodeList />} />
                  <Route path="/task-codes/new" element={<TaskCodeForm mode="create" />} />
                  <Route path="/task-codes/:id" element={<TaskCodeDetail />} />
                  <Route path="/task-codes/:id/edit" element={<TaskCodeForm mode="edit" />} />
                  <Route path="/review" element={<ReviewQueue />} />
                  <Route path="/review/:timesheetId" element={<ReviewDetail />} />
                  <Route path="/reports" element={<ReportsDashboard />} />
                  <Route path="/reports/payroll" element={<PayrollReportPage />} />
                  <Route path="/reports/compliance-audit" element={<ComplianceAuditReport />} />
                  <Route path="/reports/timesheet-history" element={<TimesheetHistoryReport />} />
                  <Route path="/payroll" element={<PayrollReportPage />} />
                  <Route path="/alerts" element={<Alerts />} />
                </Route>
              </Route>
            </Route>

            {/* 404 */}
            <Route
              path="*"
              element={
                <div className="not-found">
                  <h1>Page Not Found</h1>
                  <a href="/dashboard">Go to Dashboard</a>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
