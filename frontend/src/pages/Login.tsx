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
import { AuthBranding, ProductAttribution } from '../components/AuthBranding';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const platform = location.pathname === '/platform/login';
  const { login, verify2FA } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [localError, setLocalError] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [redirectMessage, setRedirectMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    try {
      setLoading(true);
      const result = await login(formData.email, formData.password, platform);
      
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
        const redirectTo = '/';
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
      await verify2FA(pendingEmail, code, platform);
      navigate('/');
    } catch (err: any) {
      setLocalError(err?.response?.data?.message || err?.message || '2FA verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper variant="outlined" sx={{ padding: { xs: 2.5, sm: 4 }, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <AuthBranding />
          <Typography component="h1" variant="h5">
            {platform ? 'Platform owner sign-in' : 'Welcome to Co-opSphere'}
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 1 }}>
            {platform ? 'Sign in to the Co-opSphere platform console.' : 'Manage your cooperative, members, savings, loans and financial operations in one workspace.'}
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
          {localError && (
            <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
              {localError}
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
              {!platform && <><Link component={RouterLink} to="/register" variant="body2">
                {"Don't have an account? Sign Up"}
              </Link>
                <br /></>}
                <Link component={RouterLink} to={platform ? '/platform/forgot-password' : '/forgot-password'} variant="body2">
                  Forgot Password?
                </Link>
              </Box>
            </Box>
          ) : (
            <Box component="form" onSubmit={handle2FASubmit} sx={{ mt: 1, width: '100%' }} aria-label="2FA form">
              <Typography variant="body1" mb={2}>
                Enter the 2FA code sent to your email.
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
              <Button onClick={() => { setShow2FA(false); setCode(''); }}>
                Return to sign in
              </Button>
          </Box>
          )}
          <ProductAttribution />
        </Paper>
      </Box>
    </Container>
  );
};

export default Login; 