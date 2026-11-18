import React, { useState } from 'react';
import { Alert, Button, Container, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import api from '../services/api';

export default function VerifyAccount() {
  const location = useLocation();
  const parameters = new URLSearchParams(location.hash.slice(1));
  const invitation = parameters.get('invite');
  const verification = parameters.get('token');
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string>(location.state?.message || '');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = invitation
        ? await api.post('/auth/accept-invitation', { token: invitation, password })
        : verification
          ? await api.post('/auth/verify-email', { token: verification })
          : await api.post('/auth/resend-email', { email });
      setMessage(response.data.message);
      setDone(Boolean(invitation || verification));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not complete the request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Stack component="form" spacing={2} onSubmit={submit}>
          <Typography component="h1" variant="h5">{invitation ? 'Activate your account' : 'Verify your email'}</Typography>
          {message && <Alert severity={done ? 'success' : 'info'}>{message}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          {!done && <>
            {invitation && <TextField label="New password" autoComplete="new-password" type="password"
              required value={password} inputProps={{ minLength: 12 }} onChange={e => setPassword(e.target.value)} />}
            {!invitation && !verification && <TextField label="Email" type="email" required
              value={email} onChange={e => setEmail(e.target.value)} />}
            <Button type="submit" variant="contained" disabled={busy}>
              {invitation ? 'Activate account' : verification ? 'Verify email' : 'Resend verification email'}
            </Button>
          </>}
          <Link component={RouterLink} to="/login">Back to sign in</Link>
        </Stack>
      </Paper>
    </Container>
  );
}
