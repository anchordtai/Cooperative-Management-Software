import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Link,
  Paper,
  Alert,
  Grid,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, error } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [tosChecked, setTosChecked] = useState(false);
  const [tosError, setTosError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | ''>('');

  const passwordRequirements = [
    { label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
    { label: 'One uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
    { label: 'One lowercase letter', test: (pw: string) => /[a-z]/.test(pw) },
    { label: 'One number', test: (pw: string) => /[0-9]/.test(pw) },
    { label: 'One special character', test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
  ];

  const getPasswordStrength = (pw: string) => {
    const passed = passwordRequirements.filter(r => r.test(pw)).length;
    if (passed <= 2) return 'weak';
    if (passed === 3 || passed === 4) return 'medium';
    if (passed === 5) return 'strong';
    return '';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    if (name === 'password') {
      setPasswordStrength(getPasswordStrength(value));
      setPasswordError('');
    }
    if (name === 'confirmPassword') setConfirmError('');
    if (name === 'phone') setPhoneError('');
    if (name === 'tos') {
      setTosChecked(checked);
      setTosError('');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validatePhone = (phone: string) => {
    // Simple E.164 or local format validation
    return /^\+?\d{10,15}$/.test(phone);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let valid = true;
    setPasswordError('');
    setConfirmError('');
    setPhoneError('');
    setTosError('');
    // Password requirements
    if (getPasswordStrength(formData.password) !== 'strong') {
      setPasswordError('Password does not meet all requirements.');
      valid = false;
    }
    // Confirm password
    if (formData.password !== formData.confirmPassword) {
      setConfirmError('Passwords do not match.');
      valid = false;
    }
    // Phone validation
    if (!validatePhone(formData.phone)) {
      setPhoneError('Enter a valid phone number (10-15 digits, may start with +).');
      valid = false;
    }
    // Terms of Service
    if (!tosChecked) {
      setTosError('You must agree to the Terms of Service.');
      valid = false;
    }
    if (!valid) {
      setLoading(false);
      return;
    }
    try {
      const result = await register(formData);
      // Show success message and redirect to login
      navigate('/login', { 
        state: { 
          message: 'Registration successful! Please check your email to verify your account before logging in.',
          email: formData.email,
          registrationSuccess: true
        } 
      });
    } catch (err) {
      // Error is handled by the auth context
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Typography component="h1" variant="h5">
            Sign up
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
              {error}
            </Alert>
          )}
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3, width: '100%' }} aria-label="Registration form">
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  id="firstName"
                  label="First Name"
                  name="firstName"
                  autoComplete="given-name"
                  value={formData.firstName}
                  onChange={handleChange}
                  inputProps={{ 'aria-label': 'First Name' }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  id="lastName"
                  label="Last Name"
                  name="lastName"
                  autoComplete="family-name"
                  value={formData.lastName}
                  onChange={handleChange}
                  inputProps={{ 'aria-label': 'Last Name' }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  required
                  fullWidth
                  id="email"
                  label="Email Address"
                  name="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  inputProps={{ 'aria-label': 'Email Address' }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  required
                  fullWidth
                  id="phone"
                  label="Phone Number"
                  name="phone"
                  autoComplete="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  error={!!phoneError}
                  helperText={phoneError}
                  inputProps={{ 'aria-label': 'Phone Number', inputMode: 'tel', pattern: '^\\+?\\d{10,15}$' }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  required
                  fullWidth
                  name="password"
                  label="Password"
                  type="password"
                  id="password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange}
                  error={!!passwordError}
                  inputProps={{ 'aria-label': 'Password' }}
                  helperText={passwordError}
                />
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">Password requirements:</Typography>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {passwordRequirements.map((req) => (
                      <li key={req.label} style={{ color: req.test(formData.password) ? 'green' : 'gray' }}>{req.label}</li>
                    ))}
                  </ul>
                  {passwordStrength && (
                    <Typography variant="caption" color={passwordStrength === 'strong' ? 'success.main' : passwordStrength === 'medium' ? 'warning.main' : 'error.main'}>
                      Strength: {passwordStrength.charAt(0).toUpperCase() + passwordStrength.slice(1)}
                    </Typography>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  required
                  fullWidth
                  name="confirmPassword"
                  label="Confirm Password"
                  type="password"
                  id="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  error={!!confirmError}
                  helperText={confirmError}
                  inputProps={{ 'aria-label': 'Confirm Password' }}
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    id="tos"
                    name="tos"
                    checked={tosChecked}
                    onChange={handleChange}
                    aria-label="Agree to Terms of Service"
                    style={{ marginRight: 8 }}
                  />
                  <Typography variant="body2" component="label" htmlFor="tos">
                    I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                  </Typography>
                </Box>
                {tosError && <Typography color="error" variant="caption">{tosError}</Typography>}
              </Grid>
            </Grid>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
              aria-label="Sign Up"
            >
              {loading ? 'Signing up...' : 'Sign Up'}
            </Button>
            <Box sx={{ textAlign: 'center' }}>
              <Link component={RouterLink} to="/login" variant="body2">
                Already have an account? Sign in
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Register; 