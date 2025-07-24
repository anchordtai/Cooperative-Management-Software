import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Link,
  Alert,
  Paper,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, error, require2FA, verify2FA, pending2FAEmail } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [localError, setLocalError] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [twoFAMethod, setTwoFAMethod] = useState<'email' | 'sms'>('email');
  const [pendingEmail, setPendingEmail] = useState('');
  const [redirectMessage, setRedirectMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [rateLimit, setRateLimit] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      navigate(location.pathname, { replace: true });
    }
    if (location.state?.redirectMessage) {
      setRedirectMessage(location.state.redirectMessage);
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setLocalError('');
  };

  // Debounce login API call
  let loginTimeout: NodeJS.Timeout;
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (rateLimit) return;
    setRateLimit(true);
    loginTimeout = setTimeout(() => setRateLimit(false), 2000); // 2s debounce
    try {
      setLoading(true);
      const result = await login(formData.email, formData.password, twoFAMethod);
      
      if (result?.require2FA) {
        setShow2FA(true);
        setPendingEmail(formData.email);
      } else if (result?.requiresVerification) {
        // Redirect to verification page with user info
        navigate('/verify-account', { 
          state: { 
            email: formData.email, 
            message: result.message,
            verificationType: result.verificationType 
          } 
        });
      } else {
        // Successful login - redirect to dashboard based on role
        const redirectTo = result?.data?.redirectTo || '/';
        navigate(redirectTo);
      }
    } catch (err: any) {
      // Handle other login errors
      setLocalError(err?.response?.data?.message || err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    try {
      setLoading(true);
      await verify2FA(pendingEmail, code);
      navigate('/');
    } catch (err: any) {
      setLocalError(err?.response?.data?.message || err?.message || '2FA verification failed');
    } finally {
      setLoading(false);
    }
  };

  // 2FA resend logic
  const handleResend2FA = async (method: 'email' | 'sms') => {
    if (resendCooldown > 0) return;
    setTwoFAMethod(method);
    setResendCooldown(30);
    // Call backend resend endpoint
    try {
      if (method === 'email') {
        await fetch('/api/auth/resend-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: pendingEmail }),
        });
      } else {
        await fetch('/api/auth/resend-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: pendingEmail }),
        });
      }
    } catch {}
  };
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  return (
    <Container component="main" maxWidth="xs">
      <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <Typography component="h1" variant="h5">
            Sign in
          </Typography>
          {successMessage && (
            <Alert severity="success" sx={{ mt: 2, width: '100%' }}>
              {successMessage}
            </Alert>
          )}
          {redirectMessage && (
            <Alert severity="info" sx={{ mt: 2, width: '100%' }}>
              {redirectMessage}
            </Alert>
          )}
          {(error || localError) && (
            <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
              {error || localError}
            </Alert>
          )}
          {!show2FA ? (
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }} aria-label="Login form">
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={formData.email}
              onChange={handleChange}
                inputProps={{ 'aria-label': 'Email Address' }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
                type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
                inputProps={{ 'aria-label': 'Password' }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((show) => !show)}
                        edge="end"
                        tabIndex={-1}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 1 }}>
                <input
                  type="checkbox"
                  id="rememberMe"
                  name="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  aria-label="Remember Me"
                  style={{ marginRight: 8 }}
                />
                <Typography variant="body2" component="label" htmlFor="rememberMe">
                  Remember Me
                </Typography>
              </Box>
              {rateLimit && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  Please wait a moment before trying again.
                </Alert>
              )}
              <Box sx={{ display: 'flex', gap: 2, mt: 2, mb: 1 }}>
                <Button
                  variant={twoFAMethod === 'email' ? 'contained' : 'outlined'}
                  onClick={() => setTwoFAMethod('email')}
                  fullWidth
                  aria-label="2FA via Email"
                >
                  2FA via Email
                </Button>
                <Button
                  variant={twoFAMethod === 'sms' ? 'contained' : 'outlined'}
                  onClick={() => setTwoFAMethod('sms')}
                  fullWidth
                  aria-label="2FA via SMS"
                >
                  2FA via SMS
                </Button>
              </Box>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
                disabled={loading}
                aria-label="Sign In"
            >
                {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            <Box sx={{ textAlign: 'center' }}>
              <Link component={RouterLink} to="/register" variant="body2">
                {"Don't have an account? Sign Up"}
              </Link>
                <br />
                <Link component={RouterLink} to="/forgot-password" variant="body2">
                  Forgot Password?
                </Link>
              </Box>
            </Box>
          ) : (
            <Box component="form" onSubmit={handle2FASubmit} sx={{ mt: 1, width: '100%' }} aria-label="2FA form">
              <Typography variant="body1" mb={2}>
                Enter the 2FA code sent to your {twoFAMethod === 'sms' ? 'phone' : 'email'}.
              </Typography>
              <TextField
                margin="normal"
                required
                fullWidth
                id="2fa-code"
                label="2FA Code"
                name="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputProps={{ 'aria-label': '2FA Code', inputMode: 'numeric', pattern: '\\d*' }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 2, mb: 2 }}
                disabled={loading}
                aria-label="Verify 2FA Code"
              >
                {loading ? 'Verifying...' : 'Verify 2FA Code'}
              </Button>
              <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                <Button
                  variant={twoFAMethod === 'email' ? 'contained' : 'outlined'}
                  onClick={() => handleResend2FA('email')}
                  fullWidth
                  aria-label="Resend 2FA via Email"
                  disabled={resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Resend via Email (${resendCooldown}s)` : 'Resend via Email'}
                </Button>
                <Button
                  variant={twoFAMethod === 'sms' ? 'contained' : 'outlined'}
                  onClick={() => handleResend2FA('sms')}
                  fullWidth
                  aria-label="Resend 2FA via SMS"
                  disabled={resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Resend via SMS (${resendCooldown}s)` : 'Resend via SMS'}
                </Button>
            </Box>
          </Box>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default Login; 