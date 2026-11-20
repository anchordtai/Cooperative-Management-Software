import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, LinearProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { Link, useSearchParams } from 'react-router-dom';
import { saveAs } from 'file-saver';
import api from '../services/api';

export interface Plan {
  slug: string; name: string; description: string; maximumMembers: number | null; monthlyMinor: string | null;
  annualMinor: string | null; features: string[]; recommended: boolean; customPricing: boolean;
  active: boolean; trialDays: number; graceDays: number; displayOrder: number;
}
interface Payment {
  reference: string; planName: string; cycle: string; gateway: string; mode: string; amountMinor: string; status: string;
}
interface BillingState {
  term: { planName: string; status: string; cycle: string | null; startsAt: string; endsAt: string; cancelledAt: string | null } | null;
  allowed: boolean; used: number; maximum: number | null; remaining: number | null; profile: Record<string, string>;
  history: Payment[]; gateways: string[];
}

export const naira = (minor: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(minor) / 100);
const period = (date: string) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeZone: 'Africa/Lagos' }).format(new Date(date));
const labels: Record<string, string> = {
  name: 'Cooperative name', registrationNumber: 'Registration number (optional)', cooperativeType: 'Cooperative type',
  address: 'Address', state: 'State', country: 'Country', email: 'Contact email', phone: 'Contact phone',
  establishedOn: 'Date established (optional)', description: 'Description (optional)'
};
const errorText = (error: any, fallback: string) => error.response?.data?.message || fallback;

export default function Billing({ publicPricing = false }: { publicPricing?: boolean }) {
  const [search] = useSearchParams();
  const returned = search.get('checkout');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [state, setState] = useState<BillingState | null>(null);
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
  const [expected, setExpected] = useState('');
  const [gateway, setGateway] = useState('');
  const [selected, setSelected] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([api.get('/billing/plans'), publicPricing ? Promise.resolve(null) : api.get('/billing')])
      .then(([catalog, billing]) => {
        if (!active) return;
        setPlans(catalog.data.data);
        if (billing) {
          const data: BillingState = billing.data.data;
          setState(data);
          setProfile(data.profile);
          setGateway(current => data.gateways.includes(current) ? current : data.gateways[0] || '');
        }
      }).catch(error => { if (active) setError(errorText(error, 'Could not load the subscription catalog.')); });
    return () => { active = false; };
  }, [publicPricing, version]);

  const verify = async (reference: string) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const { data } = await api.post('/billing/verify/' + encodeURIComponent(reference));
      const result = data.data.status;
      setMessage(result === 'paid' ? 'Payment verified. Your subscription is active.'
        : result === 'review' ? 'Payment received and flagged for review. Contact support with the reference.'
        : result === 'failed' ? 'The gateway marked this attempt as unsuccessful. You can start a new checkout.'
        : 'Payment is pending. Check again after the gateway finishes processing.');
      setVersion(value => value + 1);
    } catch (error) { setError(errorText(error, 'Could not verify the payment.')); }
    finally { setBusy(false); }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await api.put('/billing/profile', Object.fromEntries(Object.keys(labels).map(key => [key, profile[key] || ''])));
      setMessage('Cooperative profile saved.');
    } catch (error) { setError(errorText(error, 'Could not save your profile.')); }
    finally { setBusy(false); }
  };

  const price = (plan: Plan) => cycle === 'monthly' ? plan.monthlyMinor : plan.annualMinor;
  const fit = Math.max(Number(expected) || 0, state?.used || 0);
  const sizing = [...plans].sort((a, b) => (a.maximumMembers ?? Infinity) - (b.maximumMembers ?? Infinity))
    .find(plan => plan.maximumMembers === null || plan.maximumMembers >= fit);

  const buy = async () => {
    if (!selected || !price(selected)) return;
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/billing/checkout', { plan: selected.slug, cycle, gateway, expectedMinor: price(selected) });
      window.location.assign(data.data.url);
    } catch (error) { setError(errorText(error, 'Could not start checkout.')); setBusy(false); }
  };

  return <Stack component="main" spacing={3} sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 4 }, py: 4 }}>
    <Typography component="h1" variant="h4">{publicPricing ? 'Co-opSphere pricing' : 'Cooperative billing'}</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {message && <Alert severity="info">{message}</Alert>}
    {returned && !publicPricing && <Alert severity="info" action={<Button disabled={busy} onClick={() => verify(returned)}>Verify payment</Button>}>
      Check the payment with the gateway to confirm the result.
    </Alert>}
    {!publicPricing && !state && !error && <CircularProgress />}
    {state && <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={1}>
        <Typography variant="h6">{state.term?.planName ?? 'No subscription selected'}</Typography>
        <Typography>{state.term
          ? `${state.term.status} · ${state.term.cycle ?? 'Trial'} · ${period(state.term.startsAt)} to ${period(state.term.endsAt)}`
          : 'Complete your profile and choose a plan to activate billing.'}</Typography>
        <Typography>{state.used} members{state.maximum === null ? '' : ` of ${state.maximum} · ${state.remaining} remaining`}</Typography>
        {state.maximum !== null && <LinearProgress aria-label="Member capacity used" variant="determinate"
          value={Math.min(100, state.used * 100 / state.maximum)} color={state.used / state.maximum >= 0.9 ? 'warning' : 'primary'} />}
                {state.term?.status === 'active' && !state.term.cancelledAt && <Button color="warning" sx={{ alignSelf: 'start' }} disabled={busy} onClick={async () => {
          if (!window.confirm('Schedule cancellation when the current term ends? Access ends at expiry without a grace period.')) return;
          setBusy(true); setError('');
          try {
            const { data } = await api.post('/billing/cancel-at-expiry');
            setMessage(data.message);
            setVersion(value => value + 1);
          } catch (error) { setError(errorText(error, 'Could not schedule cancellation.')); }
          finally { setBusy(false); }
        }}>Cancel at expiry</Button>}
        {state.term?.cancelledAt && <Typography variant="body2">Cancellation scheduled for the end of the current term.</Typography>}
        {state.allowed && <Button component={Link} to="/app" sx={{ alignSelf: 'start' }}>Open workspace</Button>}
      </Stack>
    </Paper>}
    {state && <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack component="form" spacing={2} onSubmit={saveProfile}>
        <Typography variant="h6">Cooperative profile</Typography>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))' } }}>
          {Object.entries(labels).map(([key, label]) => <TextField key={key} label={label} value={profile[key] || ''}
            type={key === 'email' ? 'email' : key === 'establishedOn' ? 'date' : 'text'}
            required={!label.includes('(optional)')} InputLabelProps={key === 'establishedOn' ? { shrink: true } : undefined}
            onChange={event => setProfile({ ...profile, [key]: event.target.value })} />)}
        </Box>
        <Button type="submit" variant="outlined" disabled={busy} sx={{ alignSelf: 'start' }}>Save profile</Button>
      </Stack>
    </Paper>}
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <TextField select size="small" label="Billing cycle" value={cycle} onChange={event => {
        setCycle(event.target.value as typeof cycle); setSelected(null);
      }} sx={{ minWidth: 155 }}>
        <MenuItem value="monthly">Monthly</MenuItem><MenuItem value="annual">Annual</MenuItem>
      </TextField>
      <TextField size="small" type="number" label="Expected members" value={expected} inputProps={{ min: 0 }}
        onChange={event => { setExpected(event.target.value); setSelected(null); }} />
    </Stack>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(3,minmax(0,1fr))' }, gap: 2 }}>
      {plans.map(plan => <Paper key={plan.slug} variant="outlined" sx={{ p: 3, borderColor: selected?.slug === plan.slug ? 'primary.main' : undefined }}>
        <Stack spacing={1.3} height="100%">
          <Typography component="h2" variant="h6">{plan.name}</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {plan.recommended && <Chip size="small" color="primary" label="Recommended" />}
            {fit > 0 && sizing?.slug === plan.slug && <Chip size="small" label="Fits your size" />}
          </Stack>
          <Typography>{plan.maximumMembers === null ? 'Unlimited members' : `Up to ${plan.maximumMembers} members`}</Typography>
          <Typography variant="h5">{plan.customPricing ? 'Custom pricing' : price(plan) ? naira(price(plan)!) : 'Price unpublished'}</Typography>
          <Typography color="text.secondary">{plan.description}</Typography>
          {plan.features.map(feature => <Typography key={feature} variant="body2">· {feature}</Typography>)}
          <Box flexGrow={1} />
          {publicPricing ? <Button component={Link} to="/register">Register cooperative</Button>
            : <Button variant={selected?.slug === plan.slug ? 'contained' : 'outlined'}
              disabled={busy || !state || plan.customPricing || !price(plan) || (plan.maximumMembers !== null && fit > plan.maximumMembers)}
              onClick={() => setSelected(plan)}>Select {plan.name}</Button>}
        </Stack>
      </Paper>)}
    </Box>
    {!publicPricing && state && !state.gateways.length && <Alert severity="info">Online payment is unavailable until the platform configures a billing gateway.</Alert>}
    {selected && state && <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Review checkout</Typography>
        <Typography>{selected.name} · {cycle} · {naira(price(selected)!)} NGN</Typography>
        <Typography color="text.secondary">Renewal on the same plan extends an active term. An upgrade starts a new term at the full displayed price, with no prorated credit. Downgrades are available after the current paid term ends.</Typography>
        <TextField select label="Payment gateway" value={gateway} onChange={event => setGateway(event.target.value)}>
          {state.gateways.map(item => <MenuItem key={item} value={item}>{item === 'paystack' ? 'Paystack' : 'Flutterwave'}</MenuItem>)}
        </TextField>
        <Button variant="contained" disabled={busy || !gateway} onClick={buy}>Continue to secure checkout</Button>
      </Stack>
    </Paper>}
    {state && <Stack spacing={1}>
      <Typography variant="h6">Payment history</Typography>
      {!state.history.length && <Typography color="text.secondary">No payment attempts yet.</Typography>}
      {state.history.map(item => <Paper key={item.reference} variant="outlined" sx={{ p: 2 }}>
        <Typography>{item.planName} · {naira(item.amountMinor)} · {item.gateway} · {item.status}{item.mode === 'test' ? ' (test)' : ''}</Typography>
        <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>{item.reference}</Typography>
        {item.status === 'paid' ? <Button disabled={busy} onClick={async () => {
          try { const { data } = await api.get('/billing/receipt/' + item.reference, { responseType: 'blob' }); saveAs(data, item.reference + '.pdf'); }
          catch { setError('Could not download the receipt.'); }
        }}>Download receipt</Button> : item.status !== 'review' && <Button disabled={busy} onClick={() => verify(item.reference)}>Verify again</Button>}
      </Paper>)}
    </Stack>}
  </Stack>;
}
