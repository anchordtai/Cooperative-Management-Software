import React, { lazy, Suspense } from 'react';
import { Typography } from '@mui/material';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import LoadingSpinner from './components/LoadingSpinner';
import LandingPage from './pages/LandingPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyAccount from './pages/VerifyAccount';
import FAQ from './pages/FAQ';
import Contact from './pages/Contact';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Members = lazy(() => import('./pages/Members'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Loans = lazy(() => import('./pages/Loans'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Staff = lazy(() => import('./pages/Staff'));
const Audit = lazy(() => import('./pages/Audit'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));

const ProtectedRoute = ({ children, roles, permission }: { children: React.ReactNode; roles?: string[]; permission?: string }) => {
  const { user, loading, can } = useAuth();
  if (loading) return <LoadingSpinner message="Checking authentication…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  if (permission && !can(permission)) return <Navigate to="/app" replace />;
  return <>{children}</>;
};

export default function App() {
  const { user, can } = useAuth();

  return (
    <Suspense fallback={<LoadingSpinner message="Loading page…" />}>
      <Routes>
        <Route path="/" element={user ? <Navigate replace to={user.role === 'member' ? '/user-dashboard' : '/app'} /> : <LandingPage />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-account" element={<VerifyAccount />} />
        <Route path="/dashboard" element={<Navigate to="/app" replace />} />
        <Route path="/user-dashboard" element={<ProtectedRoute roles={['member']}><UserDashboard /></ProtectedRoute>} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/app" element={<ProtectedRoute roles={['admin', 'staff']}><Layout /></ProtectedRoute>}>
          <Route index element={can('finance.read') ? <Dashboard /> : <Typography component="h1" variant="h4">Cooperative workspace</Typography>} />
          <Route path="members" element={<ProtectedRoute permission="members.read"><Members /></ProtectedRoute>} />
          <Route path="transactions" element={<ProtectedRoute permission="finance.read"><Transactions /></ProtectedRoute>} />
          <Route path="loans" element={<ProtectedRoute permission="finance.read"><Loans /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute permission="reports.read"><Reports /></ProtectedRoute>} />
          <Route path="audit" element={<ProtectedRoute permission="audit.read"><Audit /></ProtectedRoute>} />
          <Route path="staff" element={<ProtectedRoute roles={['admin']}><Staff /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
