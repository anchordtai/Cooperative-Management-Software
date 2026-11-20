import React, { useState } from 'react';
import { Container, Typography, TextField, Button, Box, Alert, Paper } from '@mui/material';

import api from '../services/api';
import { useSearchParams } from 'react-router-dom';
import { SiteFooter, SiteHeader } from '../components/marketing/SiteChrome';

const Contact: React.FC = () => {
  const [searchParams] = useSearchParams();
  const demo = searchParams.get('topic') === 'demo';
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.name || !form.email || !form.message) {
      setError('All fields are required.');
      return;
    }
    // Simple email validation
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const result = await api.post('/contact', demo ? { ...form, message: `Demo request\n\n${form.message}` } : form);
      setSuccess(result.data.message);
      setForm({ name: '', email: '', message: '' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send the message. Please try again later.');
    } finally {
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
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              fullWidth
              required
              sx={{ mb: 2 }}
            />
            <TextField
              label="Email"
              name="email"
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
              value={form.message}
              onChange={handleChange}
              fullWidth
              required
              multiline
              minRows={4}
              sx={{ mb: 2 }}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Message'}
            </Button>
          </Box>
        </Paper>
      </Container>
      <SiteFooter />
    </div>
  );
};

export default Contact;
