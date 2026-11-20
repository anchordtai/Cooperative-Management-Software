import Brand from '../components/Brand';
import { ProductAttribution } from '../components/AuthBranding';
import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { saveAs } from 'file-saver';
import { useSearchParams } from 'react-router-dom';
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
  const [query, setQuery] = useSearchParams();
  const pendingDeposit = query.get('deposit');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [transactions, setTransactions] = useState<Entry[]>([]);
  const [application, setApplication] = useState({ amount: '', term: '', purpose: '' });
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawal, setWithdrawal] = useState('');
  const [loanRate, setLoanRate] = useState<string | null>(null);
  const [testDeposits, setTestDeposits] = useState(false);
  const [deposit, setDeposit] = useState('');
  const [depositBusy, setDepositBusy] = useState(false);

  const load = useCallback(async () => {
    const [member, loanList, financialHistory, policy, payments] = await Promise.all([
      api.get('/members/my'), api.get('/financial/loans/my'), api.get('/transactions/my'),
      api.get('/financial/loans/policy'), api.get('/payments/config')
    ]);
    setProfile(member.data.data);
    setLoans(loanList.data.data);
    setTransactions(financialHistory.data.data);
    setLoanRate(policy.data.data.loanRate);
    setTestDeposits(payments.data.data.testDeposits);
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

  const startDeposit = async (event: FormEvent) => {
    event.preventDefault();
    setDepositBusy(true);
    try {
      const { data } = await api.post('/payments/deposit', { amount: deposit });
      window.location.assign(data.data.checkout);
    } catch (error: any) {
      setNotice({ error: true, text: error.response?.data?.message || 'Could not start Paystack test checkout.' });
      setDepositBusy(false);
    }
  };

  const verifyDeposit = async () => {
    if (!pendingDeposit) return;
    setDepositBusy(true);
    try {
      const { data } = await api.post(`/payments/${encodeURIComponent(pendingDeposit)}/verify`);
      if (data.data.status === 'completed') {
        setNotice({ error: false, text: 'The Paystack test deposit was verified.' });
        setQuery({}, { replace: true });
        await load();
      } else {
        setNotice({ error: false, text: 'Paystack has yet to confirm this test payment.' });
      }
    } catch (error: any) {
      setNotice({ error: true, text: error.response?.data?.message || 'Could not verify the test payment.' });
    } finally {
      setDepositBusy(false);
    }
  };

  const download = async (path: string, filename: string) => {
    try {
      const { data } = await api.get('/documents/' + path, { responseType: 'blob' });
      saveAs(data, filename);
    } catch {
      setNotice({ error: true, text: 'Could not download the requested document.' });
    }
  };

  return (
    <Stack spacing={3} sx={{ maxWidth: 1120, mx: 'auto', p: { xs: 2, sm: 4 } }}>
      <Brand to="/user-dashboard" />
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
              <Button size="small" sx={{ mt: 1 }} onClick={() => download('my-savings-statement', 'savings-statement.pdf')}>
                Download savings statement
              </Button>
              <Stack component="form" spacing={2} onSubmit={requestWithdrawal} sx={{ mt: 2 }}>
                <TextField label="Withdrawal amount (NGN)" type="number" required
                  inputProps={{ min: '0.01', max: Number(profile.savings), step: '0.01' }}
                  value={withdrawal} onChange={event => setWithdrawal(event.target.value)} />
                <Button type="submit" variant="outlined" disabled={withdrawBusy || Number(profile.savings) <= 0}>
                  Request withdrawal
                </Button>
              </Stack>
              {testDeposits && <Stack component="form" spacing={2} onSubmit={startDeposit} sx={{ mt: 3 }}>
                <TextField label="Test deposit amount (NGN)" type="number" required
                  value={deposit} inputProps={{ min: '0.01', step: '0.01' }}
                  onChange={event => setDeposit(event.target.value)} />
                <Button type="submit" variant="outlined" disabled={depositBusy}>Open Paystack test checkout</Button>
              </Stack>}
              {testDeposits && pendingDeposit && <Button sx={{ mt: 2 }} onClick={verifyDeposit} disabled={depositBusy}>
                Verify test payment
              </Button>}
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
            <Stack alignItems="flex-end">
              <Typography>{naira.format(Number(entry.amount))}</Typography>
              {entry.status === 'completed' &&
                <Button size="small" onClick={() => download(`receipts/${entry.id}`, `receipt-${entry.id}.pdf`)}>Download receipt</Button>}
            </Stack>
          </Stack>)}
        </CardContent></Card>
      </>}
      <ProductAttribution />
    </Stack>
  );
}
