import React, { useEffect, useState } from 'react';
import { Alert, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { settingsService } from '../services/api';

const fields = [
  { name: 'cooperativeName', label: 'Cooperative name' },
  { name: 'email', label: 'Contact email', type: 'email' },
  { name: 'phone', label: 'Contact phone', type: 'tel' },
  { name: 'address', label: 'Address' }
] as const;

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsService.get().then(setSettings).catch(() => setNotice({ text: 'Could not load settings.', error: true }));
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await settingsService.update(settings);
      setSettings(response.data);
      setNotice({ text: 'Settings saved.', error: false });
    } catch (error: any) {
      setNotice({ text: error.response?.data?.message || 'Could not save settings.', error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2} maxWidth={640}>
      <Typography variant="h4" component="h1">Cooperative settings</Typography>
      {notice && <Alert severity={notice.error ? 'error' : 'success'}>{notice.text}</Alert>}
      {settings && <Paper sx={{ p: 3 }}>
        <Stack component="form" spacing={2} onSubmit={save}>
          {fields.map(field => <TextField key={field.name} label={field.label}
            type={'type' in field ? field.type : 'text'} value={settings[field.name]}
            required={field.name === 'cooperativeName'}
            onChange={event => setSettings({ ...settings, [field.name]: event.target.value })} />)}
          <TextField label="Currency" value={settings.currency} InputProps={{ readOnly: true }} />
          <Button type="submit" variant="contained" disabled={saving}>Save settings</Button>
        </Stack>
      </Paper>}
    </Stack>
  );
}
