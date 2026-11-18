import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  Paper, Stack, TextField, Typography
} from '@mui/material';
import api from '../services/api';

const permissionLabels = {
  'members.read': 'View members',
  'finance.read': 'View financial records',
  'loans.submit': 'Submit loan applications',
  'loans.decide': 'Approve or reject loan applications',
  'loans.post': 'Record loan disbursements and repayments',
  'savings.deposit': 'Record savings deposits',
  'withdrawals.decide': 'Review withdrawals',
  'reports.read': 'View and export reports',
  'audit.read': 'View audit history'
};

interface StaffAccount {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  permissions: string[];
  isActive: boolean;
  isEmailVerified: boolean;
}

const blank = { email: '', phone: '', firstName: '', lastName: '', permissions: [] as string[], isActive: true };

export default function Staff() {
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [form, setForm] = useState<typeof blank | null>(null);
  const [selected, setSelected] = useState<StaffAccount | null>(null);
  const [notice, setNotice] = useState<{ severity: 'error' | 'success' | 'warning'; text: string }>();
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await api.get('/staff');
    setAccounts(response.data.data);
  }, []);

  useEffect(() => {
    load().catch(() => setNotice({ severity: 'error', text: 'Could not load staff accounts.' }));
  }, [load]);

  const open = (account?: StaffAccount) => {
    setFormError('');
    setSelected(account || null);
    setForm(account || blank);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    setFormError('');
    try {
      if (selected) {
        await api.put(`/staff/${selected.id}`, form);
        setNotice({ severity: 'success', text: 'Staff access saved.' });
      } else {
        const response = await api.post('/staff', form);
        const delivered = response.data.data.delivered;
        setNotice(delivered
          ? { severity: 'success', text: 'Staff invitation sent.' }
          : { severity: 'warning', text: 'The account was created. Use Resend invitation to retry email delivery.' });
      }
      setForm(null);
      await load();
    } catch (error: any) {
      setFormError(error.response?.data?.message || 'Could not save staff access.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async (account: StaffAccount) => {
    setBusy(true);
    try {
      const response = await api.post(`/staff/${account.id}/invite`);
      const sent = response.data.data.delivered;
      setNotice({ severity: sent ? 'success' : 'warning', text: sent ? 'Staff invitation sent.' : 'Email delivery failed.' });
    } catch (error: any) {
      setNotice({ severity: 'error', text: error.response?.data?.message || 'Could not resend the invitation.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography component="h1" variant="h4">Staff access</Typography>
        <Button variant="contained" onClick={() => open()}>Invite staff</Button>
      </Stack>
      {notice && <Alert severity={notice.severity}>{notice.text}</Alert>}
      {accounts.map(account => <Paper variant="outlined" key={account.id} sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
          <div>
            <Typography>{account.firstName} {account.lastName}</Typography>
            <Typography variant="body2" color="text.secondary">{account.email}</Typography>
          </div>
          <Chip label={!account.isActive ? 'Suspended' : account.isEmailVerified ? 'Active' : 'Invitation pending'} />
          <Stack direction="row">
            {!account.isEmailVerified && account.isActive &&
              <Button disabled={busy} onClick={() => resend(account)}>Resend invitation</Button>}
            <Button onClick={() => open(account)}>Edit access</Button>
          </Stack>
        </Stack>
      </Paper>)}
      <Dialog open={Boolean(form)} onClose={() => { if (!busy) setForm(null); }} fullWidth maxWidth="sm">
        <Stack component="form" onSubmit={save}>
          <DialogTitle>{selected ? 'Edit staff access' : 'Invite staff'}</DialogTitle>
          {form && <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {formError && <Alert severity="error">{formError}</Alert>}
              {!selected && <>
                {(['firstName', 'lastName', 'email', 'phone'] as const).map((field, index) =>
                  <TextField key={field} required label={['First name', 'Last name', 'Email', 'Phone'][index]}
                    type={field === 'email' ? 'email' : 'text'} value={form[field]}
                    onChange={event => setForm({ ...form, [field]: event.target.value })} />)}
              </>}
              <Stack>
                {Object.entries(permissionLabels).map(([key, label]) =>
                  <FormControlLabel key={key} label={label} control={<Checkbox checked={form.permissions.includes(key)}
                    onChange={event => setForm({ ...form, permissions: event.target.checked
                      ? [...form.permissions, key]
                      : form.permissions.filter(permission => permission !== key) })}
                  />} />)}
              </Stack>
              {selected && <FormControlLabel label="Account active" control={<Checkbox checked={form.isActive}
                onChange={event => setForm({ ...form, isActive: event.target.checked })} />} />}
            </Stack>
          </DialogContent>}
          <DialogActions>
            <Button disabled={busy} onClick={() => setForm(null)}>Cancel</Button>
            <Button disabled={busy} variant="contained" type="submit">{selected ? 'Save access' : 'Send invitation'}</Button>
          </DialogActions>
        </Stack>
      </Dialog>
    </Stack>
  );
}
