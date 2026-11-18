import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Members from './pages/Members';
import Transactions from './pages/Transactions';
import Loans from './pages/Loans';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import LoadingSpinner from './components/LoadingSpinner';
import theme from './theme';
import UserDashboard from './pages/UserDashboard';
import LandingPage from './pages/LandingPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyAccount from './pages/VerifyAccount';
import FAQ from './pages/FAQ';
import Contact from './pages/Contact';

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode; roles?: string[] }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner message="Checking authentication…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default function App() {
  const { user } = useAuth();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
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
          <Route index element={<Dashboard />} />
          <Route path="members" element={<Members />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="loans" element={<Loans />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
