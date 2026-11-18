import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, CardContent, Grid, Stack, TextField, Typography } from '@mui/material';
import { AppearanceButton } from '../components/Appearance';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface Loan {
  id: string;
  purpose: string;
  status: string;
  amount: string;
  remainingBalance: string;
}
interface Entry {
  id: string;
  type: string;
  amount: string;
  description: string;
  createdAt: string;
  status: string;
}
interface Profile {
  firstName: string;
  membershipNumber: string;
  savings: string;
}

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' });

export default function UserDashboard() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [transactions, setTransactions] = useState<Entry[]>([]);
  const [application, setApplication] = useState({ amount: '', term: '', purpose: '' });
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawal, setWithdrawal] = useState('');
  const [loanRate, setLoanRate] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [member, loanList, financialHistory, policy] = await Promise.all([
      api.get('/members/my'), api.get('/financial/loans/my'), api.get('/transactions/my'), api.get('/financial/loans/policy')
    ]);
    setProfile(member.data.data);
    setLoans(loanList.data.data);
    setTransactions(financialHistory.data.data);
    setLoanRate(policy.data.data.loanRate);
  }, []);

  useEffect(() => {
    load().catch(() => setNotice({ error: true, text: 'Could not load your membership records.' }));
  }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/financial/loans', { ...application, agreedRate: loanRate });
      setApplication({ amount: '', term: '', purpose: '' });
      setNotice({ error: false, text: 'Loan application submitted for review.' });
      await load();
    } catch (error: any) {
      setNotice({ error: true, text: error.response?.data?.message || 'Could not save the application.' });
    } finally {
      setBusy(false);
    }
  };

  const requestWithdrawal = async (event: FormEvent) => {
    event.preventDefault();
    setWithdrawBusy(true);
    try {
      await api.post('/transactions/withdrawals', { amount: withdrawal });
      setWithdrawal('');
      setNotice({ error: false, text: 'Withdrawal request submitted.' });
      await load();
    } catch (error: any) {
      setNotice({ error: true, text: error.response?.data?.message || 'Could not submit the withdrawal.' });
    } finally {
      setWithdrawBusy(false);
    }
  };

  return (
    <Stack spacing={3} sx={{ maxWidth: 1120, mx: 'auto', p: { xs: 2, sm: 4 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <div>
          <Typography component="h1" variant="h4">{profile ? `Welcome, ${profile.firstName}` : 'Member portal'}</Typography>
          {profile && <Typography color="text.secondary">{profile.membershipNumber}</Typography>}
        </div>
        <Stack direction="row"><AppearanceButton /><Button onClick={() => logout().catch(() => setNotice({ error: true, text: 'Sign out failed. Try again.' }))}>Sign out</Button></Stack>
      </Stack>
      {notice && <Alert severity={notice.error ? 'error' : 'success'}>{notice.text}</Alert>}
      {profile && <>
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Card variant="outlined"><CardContent>
              <Typography color="text.secondary">Savings balance</Typography>
              <Typography variant="h5">{naira.format(Number(profile.savings))}</Typography>
              <Stack component="form" spacing={2} onSubmit={requestWithdrawal} sx={{ mt: 2 }}>
                <TextField label="Withdrawal amount (NGN)" type="number" required
                  inputProps={{ min: '0.01', max: Number(profile.savings), step: '0.01' }}
                  value={withdrawal} onChange={event => setWithdrawal(event.target.value)} />
                <Button type="submit" variant="outlined" disabled={withdrawBusy || Number(profile.savings) <= 0}>
                  Request withdrawal
                </Button>
              </Stack>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={7}>
            <Card variant="outlined"><CardContent>
              <Stack component="form" spacing={2} onSubmit={submit}>
                <Typography component="h2" variant="h6">Apply for a loan</Typography>
                {loanRate === null ? <Alert severity="info">Loan applications are currently closed.</Alert> : <>
                <Typography color="text.secondary">Annual flat interest rate · {loanRate}%</Typography>
                <TextField label="Amount (NGN)" required type="number" inputProps={{ min: '0.01', step: '0.01' }}
                  value={application.amount} onChange={e => setApplication({ ...application, amount: e.target.value })} />
                <TextField label="Term in months" required type="number" inputProps={{ min: 1, max: 120 }}
                  value={application.term} onChange={e => setApplication({ ...application, term: e.target.value })} />
                <TextField label="Purpose" required inputProps={{ maxLength: 255 }}
                  value={application.purpose} onChange={e => setApplication({ ...application, purpose: e.target.value })} />
                <Button type="submit" variant="contained" disabled={busy}>Submit application</Button>
                </>}
              </Stack>
            </CardContent></Card>
          </Grid>
        </Grid>
        <Card variant="outlined"><CardContent>
          <Typography component="h2" variant="h6" gutterBottom>My loans</Typography>
          {loans.length === 0 && <Typography color="text.secondary">No loan applications yet.</Typography>}
          {loans.map(loan => <Typography key={loan.id} sx={{ mt: 1 }}>
            {loan.purpose} · {naira.format(Number(loan.amount))} · {loan.status}
            {loan.status === 'active' && ` · ${naira.format(Number(loan.remainingBalance))} outstanding`}
          </Typography>)}
        </CardContent></Card>
        <Card variant="outlined"><CardContent>
          <Typography component="h2" variant="h6" gutterBottom>Recent transactions</Typography>
          {transactions.length === 0 && <Typography color="text.secondary">No transactions yet.</Typography>}
          {transactions.map(entry => <Stack key={entry.id} direction="row" justifyContent="space-between" spacing={2} sx={{ mt: 1 }}>
            <div>
              <Typography>{entry.description}</Typography>
              <Typography variant="body2" color="text.secondary">{new Date(entry.createdAt).toLocaleDateString('en-NG')} · {entry.status}</Typography>
            </div>
            <Typography>{naira.format(Number(entry.amount))}</Typography>
          </Stack>)}
        </CardContent></Card>
      </>}
    </Stack>
  );
}
