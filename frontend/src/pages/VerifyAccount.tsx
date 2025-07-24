import React, { useState, useEffect } from 'react';
import { Container, Box, Typography, TextField, Button, Alert, Paper, Link } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';

const VerifyAccount: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState(location.state?.phone || '');
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [resendEmailCooldown, setResendEmailCooldown] = useState(0);
  const [resendSmsCooldown, setResendSmsCooldown] = useState(0);

  // Check for email verification token in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('token');
    if (token) {
      handleEmailTokenVerification(token);
    }
  }, [location.search]);

  const handleEmailTokenVerification = async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/verify-email', { token });
      setEmailVerified(true);
      setMessage('Email verified successfully! You can now log in.');
      setTimeout(() => navigate('/login', { state: { message: 'Email verified! You can now log in.' } }), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Email verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Auto-redirect after phone verification
  useEffect(() => {
    if (phoneVerified) {
      setTimeout(() => navigate('/login', { state: { message: 'Account verified! You can now log in.' } }), 2000);
    }
  }, [phoneVerified, navigate]);

  // Cooldown timers for resend buttons
  useEffect(() => {
    if (resendEmailCooldown > 0) {
      const timer = setTimeout(() => setResendEmailCooldown(resendEmailCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendEmailCooldown]);
  useEffect(() => {
    if (resendSmsCooldown > 0) {
      const timer = setTimeout(() => setResendSmsCooldown(resendSmsCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendSmsCooldown]);

  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await api.post('/auth/verify-phone', { phone, code });
      setPhoneVerified(true);
      setMessage('Phone number verified!');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (resendEmailCooldown > 0) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await api.post('/auth/resend-email', { email });
      setEmailSent(true);
      setMessage('Verification email resent!');
      setResendEmailCooldown(30);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to resend email');
    } finally {
      setLoading(false);
    }
  };

  const handleResendSMS = async () => {
    if (resendSmsCooldown > 0) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await api.post('/auth/resend-sms', { phone });
      setSmsSent(true);
      setMessage('Verification SMS resent!');
      setResendSmsCooldown(30);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to resend SMS');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <Typography component="h1" variant="h5" mb={2}>
            Verify Your Account
          </Typography>
          {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ width: '100%', mb: 3 }}>
            <Typography variant="body1" mb={1}>
              1. Please check your email for a verification link.
            </Typography>
            <Button variant="outlined" onClick={handleResendEmail} disabled={loading || emailSent || resendEmailCooldown > 0} fullWidth sx={{ mb: 2 }} aria-label="Resend Email">
              {emailSent ? 'Email Sent!' : resendEmailCooldown > 0 ? `Resend Email (${resendEmailCooldown}s)` : 'Resend Email'}
            </Button>
            <Typography variant="body1" mb={1}>
              2. Enter the code sent to your phone:
            </Typography>
            <form onSubmit={handleVerifyPhone} aria-label="Phone verification form">
              <TextField
                margin="normal"
                required
                fullWidth
                id="phoneCode"
                label="Phone Verification Code"
                name="code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                disabled={phoneVerified}
                inputProps={{ 'aria-label': 'Phone Verification Code', inputMode: 'numeric', pattern: '\\d*', maxLength: 6 }}
                helperText="Enter the 6-digit code sent to your phone."
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 2, mb: 1 }}
                disabled={loading || phoneVerified}
                aria-label="Verify Phone"
              >
                {phoneVerified ? 'Phone Verified' : 'Verify Phone'}
              </Button>
            </form>
            <Button variant="outlined" onClick={handleResendSMS} disabled={loading || smsSent || resendSmsCooldown > 0} fullWidth aria-label="Resend SMS">
              {smsSent ? 'SMS Sent!' : resendSmsCooldown > 0 ? `Resend SMS (${resendSmsCooldown}s)` : 'Resend SMS'}
            </Button>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Link href="/login" variant="body2">
              Back to Login
            </Link>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default VerifyAccount; 