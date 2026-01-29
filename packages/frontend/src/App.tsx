import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.js';
import { usePendingReviewCount } from './hooks/useReviewQueue.js';
import './App.css';

// Eagerly loaded pages (needed immediately)
import { Login } from './pages/Login.js';
import { ChangePassword } from './pages/ChangePassword.js';
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

// Employee report pages (accessible to all authenticated users)
const MyReportsDashboard = lazy(() =>
  import('./pages/MyReportsDashboard.js').then((m) => ({ default: m.MyReportsDashboard }))
);
const MyTimesheetHistory = lazy(() =>
  import('./pages/MyTimesheetHistory.js').then((m) => ({ default: m.MyTimesheetHistory }))
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
          <Link to="/dashboard" aria-label="Renewal Initiatives Home">
            Renewal Initiatives
          </Link>
        </div>
        <div className="nav-links" role="menubar">
          <Link to="/timesheet" role="menuitem">
            My Timesheet
          </Link>
          <Link to="/my-reports" role="menuitem">
            My Reports
          </Link>
          {isSupervisor && (
            <>
              <Link to="/dashboard" role="menuitem">
                Dashboard
              </Link>
              <Link
                to="/review"
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
              </Link>
              <Link to="/employees" role="menuitem">
                Employees
              </Link>
              <Link to="/task-codes" role="menuitem">
                Task Codes
              </Link>
              <Link to="/reports" role="menuitem">
                Reports
              </Link>
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
        <Link to="/dashboard">Go to Dashboard</Link>
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

            {/* Password change - protected but no layout (special page) */}
            <Route element={<ProtectedRoute />}>
              <Route path="/change-password" element={<ChangePassword />} />
            </Route>

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

                {/* Employee reports - accessible to all authenticated users */}
                <Route path="/my-reports" element={<MyReportsDashboard />} />
                <Route path="/my-reports/timesheet-history" element={<MyTimesheetHistory />} />

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
                  <Link to="/dashboard">Go to Dashboard</Link>
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
