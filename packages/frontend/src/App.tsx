import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.js';
import { Login } from './pages/Login.js';
import { Dashboard } from './pages/Dashboard.js';
import { EmployeeList } from './pages/EmployeeList.js';
import { EmployeeDetail } from './pages/EmployeeDetail.js';
import { AddEmployee } from './pages/AddEmployee.js';
import { TaskCodeList } from './pages/TaskCodeList.js';
import { TaskCodeDetail } from './pages/TaskCodeDetail.js';
import { TaskCodeForm } from './components/TaskCodeForm.js';
import './App.css';

/**
 * Layout wrapper that includes navigation
 */
function AppLayout() {
  const { user, logout, isSupervisor } = useAuth();

  return (
    <div className="app-layout">
      <nav className="app-nav">
        <div className="nav-brand">
          <a href="/dashboard">Renewal Initiatives</a>
        </div>
        <div className="nav-links">
          {isSupervisor && (
            <>
              <a href="/dashboard">Dashboard</a>
              <a href="/employees">Employees</a>
              <a href="/task-codes">Task Codes</a>
            </>
          )}
        </div>
        <div className="nav-user">
          <span className="user-name">{user?.name}</span>
          <button onClick={logout} className="logout-button">
            Sign Out
          </button>
        </div>
      </nav>
      <main className="app-main">
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
    return <div className="loading-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireSupervisor && !isSupervisor) {
    return (
      <div className="forbidden-screen">
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

              {/* Supervisor-only routes */}
              <Route element={<ProtectedRoute requireSupervisor />}>
                <Route path="/employees" element={<EmployeeList />} />
                <Route path="/employees/add" element={<AddEmployee />} />
                <Route path="/employees/:id" element={<EmployeeDetail />} />
                <Route path="/task-codes" element={<TaskCodeList />} />
                <Route path="/task-codes/new" element={<TaskCodeForm mode="create" />} />
                <Route path="/task-codes/:id" element={<TaskCodeDetail />} />
                <Route path="/task-codes/:id/edit" element={<TaskCodeForm mode="edit" />} />
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
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
