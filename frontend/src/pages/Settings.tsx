import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
} from '@mui/material';
import { settingsService } from '../services/api';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState({
    cooperativeName: '',
    email: '',
    phone: '',
    address: '',
    currency: '',
    interestRate: 0,
    minimumSavings: 0,
    enableNotifications: false,
    enableAutoApproval: false,
    enableTwoFactor: false,
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    settingsService.get()
      .then(data => {
        setSettings({
          cooperativeName: data.cooperativeName || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          currency: data.currency || '',
          interestRate: data.interestRate || 0,
          minimumSavings: data.minimumSavings || 0,
          enableNotifications: !!data.enableNotifications,
          enableAutoApproval: !!data.enableAutoApproval,
          enableTwoFactor: !!data.enableTwoFactor,
        });
        setLoading(false);
      })
      .catch(() => {
        setMessage({ type: 'error', text: 'Failed to load settings' });
        setLoading(false);
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: e.target.type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async () => {
    try {
      await settingsService.update(settings);
      setMessage({
        type: 'success',
        text: 'Settings saved successfully',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to save settings',
      });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              General Settings
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Cooperative Name"
                  name="cooperativeName"
                  value={settings.cooperativeName}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={settings.email}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Phone"
                  name="phone"
                  value={settings.phone}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  name="address"
                  multiline
                  rows={2}
                  value={settings.address}
                  onChange={handleChange}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Financial Settings
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Currency"
                  name="currency"
                  value={settings.currency}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Interest Rate (%)"
                  name="interestRate"
                  type="number"
                  value={settings.interestRate}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Minimum Savings"
                  name="minimumSavings"
                  type="number"
                  value={settings.minimumSavings}
                  onChange={handleChange}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Settings
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.enableNotifications}
                      onChange={handleChange}
                      name="enableNotifications"
                    />
                  }
                  label="Enable Email Notifications"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.enableAutoApproval}
                      onChange={handleChange}
                      name="enableAutoApproval"
                    />
                  }
                  label="Enable Auto-approval for Small Loans"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.enableTwoFactor}
                      onChange={handleChange}
                      name="enableTwoFactor"
                    />
                  }
                  label="Enable Two-Factor Authentication"
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={handleSave}>
              Save Settings
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings; 