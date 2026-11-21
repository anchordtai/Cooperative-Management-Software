import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, FormControlLabel, MenuItem, Paper, Stack, Switch, TextField, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { naira, Plan } from './Billing';

function toMinor(value: string) {
  if (!value.trim()) return null;
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) throw new Error('Enter a naira amount with up to two decimal places.');
  const [major, minor = ''] = value.split('.');
  return String(Number(major) * 100 + Number(minor.padEnd(2, '0')));
}
const priceInput = (minor: string | null) => minor ? (Number(minor) / 100).toFixed(2) : '';

export default function PlatformBilling() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [readiness, setReadiness] = useState<{
    mode: string; checkoutEnabled: boolean; enforcement: boolean;
    gateways: Array<{ gateway: string; apiConfigured: boolean; webhookConfigured: boolean; paused: boolean }>;
  } | null>(null);
  const [paymentRows, setPayments] = useState<Array<{ reference: string; cooperativeName: string; gateway: string; amountMinor: string; status: string }>>([]);
  const [subscriptions, setSubscriptions] = useState<Array<{
    cooperativeId: string; cooperativeName: string; planName: string | null;
    maximumMembers: number | null; endsAt: string | null; status: string;
  }>>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [selected, setSelected] = useState<Plan | null>(null);
  const [monthly, setMonthly] = useState('');
  const [annual, setAnnual] = useState('');
  const [tenant, setTenant] = useState('');
  const [trialPlan, setTrialPlan] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/platform/billing/plans'),
      api.get('/platform/billing/payments', { params: { search, status: paymentStatus } }),
      api.get('/platform/billing/subscriptions', { params: { search } }),
      api.get('/platform/billing/readiness')
    ])
      .then(([catalog, history, directory, configuration]) => {
        if (active) {
          setPlans(catalog.data.data);
          setReadiness(configuration.data.data);
          setPayments(history.data.data);
          setSubscriptions(directory.data.data);
        }
      }).catch(() => { if (active) setError('Could not load platform billing.'); });
    return () => { active = false; };
  }, [reload, search, paymentStatus]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setError(''); setNotice(''); setBusy(true);
    try { await action(); setNotice(success); setReload(value => value + 1); }
    catch (error: any) { setError(error.response?.data?.message || error.message || 'Could not save changes.'); }
    finally { setBusy(false); }
  };

  return <Stack component="main" spacing={3} sx={{ maxWidth: 1050, mx: 'auto', p: { xs: 2, sm: 4 } }}>
    <Button component={Link} to="/platform" sx={{ alignSelf: 'start' }}>Platform overview</Button>
    <Typography component="h1" variant="h4">Platform billing</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {notice && <Alert severity="success">{notice}</Alert>}
    {readiness && <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={1}>
        <Typography component="h2" variant="h6">Billing readiness</Typography>
        <Typography color="text.secondary">
          Mode {readiness.mode} · New checkout {readiness.checkoutEnabled ? 'enabled' : 'off'} · Enforcement {readiness.enforcement ? 'on' : 'off'}
        </Typography>
        {readiness.gateways.map(item => <Stack key={item.gateway} direction={{ xs: 'column', sm: 'row' }}
          spacing={1} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
          <Typography>
            {item.gateway === 'paystack' ? 'Paystack' : 'Flutterwave'} · API {item.apiConfigured ? 'configured' : 'missing'}
            {' · Webhook '}{item.webhookConfigured ? 'configured' : 'missing'}{item.paused ? ' · Paused' : ''}
          </Typography>
          <Button size="small" disabled={busy} onClick={() => void run(
            () => api.put('/platform/billing/gateways/' + item.gateway, { paused: !item.paused }),
            item.paused ? 'Gateway pause removed.' : 'New checkouts paused.'
          )}>{item.paused ? 'Remove pause' : 'Pause new checkouts'}</Button>
        </Stack>)}
        <Typography color="text.secondary">
          {plans.filter(plan => plan.active && !plan.customPricing && (plan.monthlyMinor || plan.annualMinor)).length} plans have at least one published price
        </Typography>
      </Stack>
    </Paper>}
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2} component="form" onSubmit={event => {
        event.preventDefault();
        if (selected) void run(() => api.put('/platform/billing/plans/' + selected.slug, {
          ...selected, features: selected.features.map(value => value.trim()).filter(Boolean), monthlyMinor: toMinor(monthly), annualMinor: toMinor(annual)
        }), 'Subscription plan updated.');
      }}>
        <Typography variant="h6">Subscription plans</Typography>
        <Typography color="text.secondary">Saved prices take effect for new checkouts. Existing subscriptions keep their current terms.</Typography>
        <TextField select value={selected?.slug || ''} label="Plan" onChange={event => {
          const plan = plans.find(item => item.slug === event.target.value) || null;
          setSelected(plan);
          setMonthly(priceInput(plan?.monthlyMinor ?? null));
          setAnnual(priceInput(plan?.annualMinor ?? null));
        }}>
          {plans.map(item => <MenuItem key={item.slug} value={item.slug}>
            {item.name} · {item.customPricing ? 'Custom pricing' : item.monthlyMinor ? naira(item.monthlyMinor) + ' per month' : 'Monthly price unpublished'}
          </MenuItem>)}
        </TextField>
        {selected && <>
          <TextField label="Description" multiline value={selected.description} onChange={event => setSelected({ ...selected, description: event.target.value })} />
          <TextField label="Features, one per line" multiline value={selected.features.join('\n')}
            onChange={event => setSelected({ ...selected, features: event.target.value.split('\n') })} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
            <TextField label="Monthly price (NGN)" value={monthly} onChange={event => setMonthly(event.target.value)} />
            <TextField label="Annual price (NGN)" value={annual} onChange={event => setAnnual(event.target.value)} />
            {([
              ['maximumMembers', 'Member capacity'], ['displayOrder', 'Display order'], ['trialDays', 'Trial length (days)'], ['graceDays', 'Grace period (days)']
            ] as const).map(([key, label]) => <TextField key={key} label={label} type="number" value={selected[key] ?? ''}
              onChange={event => setSelected({ ...selected, [key]: key === 'maximumMembers' && !event.target.value ? null : Number(event.target.value) })} />)}
          </Box>
          {selected.slug === 'enterprise-plus' && <Typography variant="caption">Leave member capacity blank for unlimited membership.</Typography>}
          {(['active', 'recommended', 'customPricing'] as const).map((key, i) => <FormControlLabel key={key}
            label={['Plan available', 'Recommended plan', 'Requires custom pricing'][i]} control={<Switch checked={selected[key]}
              onChange={event => setSelected({ ...selected, [key]: event.target.checked })} />} />)}
          <Button type="submit" variant="contained" disabled={busy} sx={{ alignSelf: 'start' }}>Save plan</Button>
        </>}
      </Stack>
    </Paper>
    <Paper id="grant-trial" variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2} component="form" onSubmit={event => {
        event.preventDefault();
        void run(() => api.post('/platform/billing/trial/' + encodeURIComponent(tenant.trim()), { plan: trialPlan }), 'Trial granted.');
      }}>
        <Typography variant="h6">Authorise a trial</Typography>
        <TextField required label="Cooperative ID" value={tenant} onChange={event => setTenant(event.target.value)} />
        <TextField required select label="Trial plan" value={trialPlan} onChange={event => setTrialPlan(event.target.value)}>
          {plans.filter(item => item.active && item.trialDays).map(item => <MenuItem key={item.slug} value={item.slug}>
            {item.name} · {item.trialDays} days</MenuItem>)}
        </TextField>
        <Button type="submit" variant="outlined" disabled={busy || !trialPlan} sx={{ alignSelf: 'start' }}>Grant trial</Button>
      </Stack>
    </Paper>
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack component="form" spacing={2} onSubmit={event => { event.preventDefault(); setSearch(searchInput.trim()); }}>
        <Typography variant="h6">Cooperative subscriptions</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField fullWidth label="Cooperative name, ID or payment reference" value={searchInput}
            onChange={event => setSearchInput(event.target.value)} />
          <Button variant="outlined" type="submit">Search</Button>
        </Stack>
        {!subscriptions.length && <Typography color="text.secondary">No matching cooperative subscriptions.</Typography>}
        {subscriptions.map(item => <Stack key={item.cooperativeId} direction={{ xs: 'column', sm: 'row' }}
          spacing={1} sx={{ justifyContent: 'space-between', borderTop: 1, borderColor: 'divider', py: 1 }}>
          <Box>
            <Typography>{item.cooperativeName} · {item.planName || 'No plan'} · {item.status}</Typography>
            {item.endsAt && <Typography variant="caption">
              Term ends {new Date(item.endsAt).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos' })} · {item.maximumMembers ?? 'Unlimited'} member capacity
            </Typography>}
          </Box>
          {item.status === 'unsubscribed' && <Button onClick={() => setTenant(item.cooperativeId)} href="#grant-trial">Select for trial</Button>}
        </Stack>)}
      </Stack>
    </Paper>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
      <Typography variant="h6">Recent subscription payments</Typography>
      <TextField select label="Payment status" size="small" sx={{ minWidth: 170 }} value={paymentStatus}
        onChange={event => setPaymentStatus(event.target.value)}>
        <MenuItem value="">All payments</MenuItem>
        {['paid', 'pending', 'failed', 'review'].map(status => <MenuItem key={status} value={status}>{status}</MenuItem>)}
      </TextField>
    </Stack>
    {!paymentRows.length && <Typography color="text.secondary">No matching subscription payments.</Typography>}
    {paymentRows.map(item => <Paper key={item.reference} variant="outlined" sx={{ p: 2 }}>
      <Typography>{item.cooperativeName} · {naira(item.amountMinor)} · {item.gateway} · {item.status}</Typography>
      <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>{item.reference}</Typography>
    </Paper>)}
  </Stack>;
}
