import React, { useEffect, useState } from 'react';
import { Container, Typography, TextField, Button, Box, Alert, Paper } from '@mui/material';

import ContactChallenge from '../components/ContactChallenge';
import api from '../services/api';
import { useSearchParams } from 'react-router-dom';
import { SiteFooter, SiteHeader } from '../components/marketing/SiteChrome';

const Contact: React.FC = () => {
  const [searchParams] = useSearchParams();
  const demo = searchParams.get('topic') === 'demo';
  const topic = demo ? 'demo' : 'contact';
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [siteKey, setSiteKey] = useState('');
  const [configError, setConfigError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [token, setToken] = useState('');
  const [challengeError, setChallengeError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    api.get('/contact/config', { signal: controller.signal }).then(({ data }) => {
      if (typeof data.siteKey !== 'string' || !data.siteKey) throw new Error('Missing security configuration');
      setSiteKey(data.siteKey);
    }).catch(() => { if (!controller.signal.aborted) setConfigError(true); });
    return () => controller.abort();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const details = { name: form.name.trim(), email: form.email.trim(), message: form.message.trim() };
    if (!details.name || !details.email || !details.message) {
      setError('All fields are required.');
      return;
    }
    if (!token || loading) return;
    setLoading(true);
    try {
      const result = await api.post('/contact', { ...details, topic, turnstileToken: token });
      setSuccess(result.data.message);
      setForm({ name: '', email: '', message: '' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send the message. Please try again later.');
    } finally {
      setToken('');
      setAttempt(value => value + 1);
      setLoading(false);
    }
  };

  return (
    <div className="cs-site">
      <SiteHeader />
      <Container component="main" maxWidth="sm" sx={{ py: { xs: 5, sm: 8 } }}>
        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Typography component="h1" variant="h4" align="center" gutterBottom fontWeight={700} color="primary">
            {demo ? 'Request a Co-opSphere demo' : 'Contact Co-opSphere'}
          </Typography>
          <Typography align="center" color="textSecondary" mb={3}>
            {demo ? 'Tell us about your cooperative and what you would like to see.' : 'Send a question about Co-opSphere or ask for help with the platform.'}
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
          {configError && <Alert severity="warning" sx={{ mb: 2 }}>
            The form is temporarily unavailable. Email <a href="mailto:info@megastride.com.ng">info@megastride.com.ng</a> for help.
          </Alert>}
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Name"
              name="name"
              autoComplete="name"
              inputProps={{ maxLength: 160 }}
              disabled={loading}
              value={form.name}
              onChange={handleChange}
              fullWidth
              required
              sx={{ mb: 2 }}
            />
            <TextField
              label="Email"
              name="email"
              autoComplete="email"
              inputProps={{ maxLength: 160 }}
              disabled={loading}
              value={form.email}
              onChange={handleChange}
              fullWidth
              required
              sx={{ mb: 2 }}
              type="email"
            />
            <TextField
              label="Message"
              name="message"
              inputProps={{ maxLength: 4000 }}
              disabled={loading}
              value={form.message}
              onChange={handleChange}
              fullWidth
              required
              multiline
              minRows={4}
              sx={{ mb: 2 }}
            />
            {siteKey && <Box sx={{ mb: 2 }}>
              <ContactChallenge siteKey={siteKey} action={topic} attempt={attempt} onToken={setToken} onFailure={setChallengeError} />
              {challengeError && <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => {
                setChallengeError('');
                setAttempt(value => value + 1);
              }}>Reload check</Button>}>{challengeError}</Alert>}
              {!challengeError && !token && <Typography variant="body2" color="text.secondary" role="status">
                Completing the security check…
              </Typography>}
            </Box>}
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading || !token || configError}
            >
              {loading ? 'Sending…' : demo ? 'Request demo' : 'Send message'}
            </Button>
          </Box>
        </Paper>
      </Container>
      <SiteFooter />
    </div>
  );
};

export default Contact;
