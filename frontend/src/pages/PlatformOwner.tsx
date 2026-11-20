import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Skeleton, Stack,
  Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography
} from '@mui/material';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import GroupOutlined from '@mui/icons-material/GroupOutlined';
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded';
import PauseCircleOutlineRounded from '@mui/icons-material/PauseCircleOutlineRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import Brand from '../components/Brand';
import { AppearanceButton } from '../components/Appearance';
import { ProductAttribution } from '../components/AuthBranding';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface Overview {
  tenantCount: string;
  activeTenants: string;
  suspendedTenants: string;
  newTenants: string;
  tenantsWithoutActiveAdmin: string;
  memberCount: string;
  asOf: string;
}
interface Tenant {
  id: string;
  name: string;
  createdAt: string;
  suspendedAt: string | null;
  memberCount: string;
  hasActiveAdmin: boolean;
}
interface Details {
  activeMembers: string;
  verifiedAdmins: string;
  pendingAdmins: string;
  activeStaff: string;
  lastAccessChange: string | null;
}
interface AuditEntry {
  id: string;
  action: 'tenant.suspended' | 'tenant.reactivated';
  tenantName: string;
  cooperativeId: string;
  createdAt: string;
}

const timestamp = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' });
const formatDate = (date: string) => timestamp.format(new Date(date)) + ' WAT';
const count = (value: string) => BigInt(value).toLocaleString('en-NG');
const metrics = [
  { label: 'Total cooperatives', key: 'tenantCount', icon: ApartmentRounded },
  { label: 'Active cooperatives', key: 'activeTenants', icon: CheckCircleOutlineRounded },
  { label: 'Suspended cooperatives', key: 'suspendedTenants', icon: PauseCircleOutlineRounded },
  { label: 'Registered members', key: 'memberCount', icon: GroupOutlined }
] as const;

function Status({ suspended }: { suspended: string | null }) {
  return <Chip size="small" label={suspended ? 'Suspended' : 'Active'} color={suspended ? 'warning' : 'success'} />;
}

function AuditTable({ events }: { events: AuditEntry[] }) {
  return <TableContainer component={Paper} variant="outlined">
    <Table size="small" aria-label="Platform access history">
      <TableHead><TableRow><TableCell>Cooperative</TableCell><TableCell>Action</TableCell><TableCell>Time</TableCell></TableRow></TableHead>
      <TableBody>{events.map(event => <TableRow key={event.id}>
        <TableCell component="th" scope="row" sx={{ overflowWrap: 'anywhere' }}>{event.tenantName}</TableCell>
        <TableCell>{event.action === 'tenant.suspended' ? 'Suspended' : 'Reactivated'}</TableCell>
        <TableCell>{formatDate(event.createdAt)}</TableCell>
      </TableRow>)}
      {!events.length && <TableRow><TableCell colSpan={3}>No access changes match this view.</TableCell></TableRow>}
      </TableBody>
    </Table>
  </TableContainer>;
}

export default function PlatformOwner() {
  const { logout } = useAuth();
  const [view, setView] = useState<'overview' | 'tenants' | 'audit'>('overview');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [action, setAction] = useState('');
  const [auditTenant, setAuditTenant] = useState<Tenant | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [events, setEvents] = useState<AuditEntry[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<{ error?: boolean; text: string } | null>(null);
  const [detailsTenant, setDetailsTenant] = useState<Tenant | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [detailsError, setDetailsError] = useState(false);
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    const load = async () => {
      if (view === 'overview') {
        const [summary, recent] = await Promise.all([
          api.get('/platform/overview'),
          api.get('/platform/audit', { params: { limit: 5 } })
        ]);
        if (active) {
          setOverview(summary.data.data);
          setEvents(recent.data.data);
        }
        return;
      }
      const filters = view === 'tenants' ? { status: statusFilter, sort } : { action, tenantId: auditTenant?.id };
      const { data } = await api.get(`/platform/${view}`, { params: { ...filters, page, limit: 25, search } });
      if (!active) return;
      if (view === 'tenants') setTenants(data.data);
      else setEvents(data.data);
      setHasNext(data.hasNext);
    };
    load().catch(() => { if (active) setLoadError('Could not load platform records.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [view, page, revision, search, statusFilter, sort, action, auditTenant]);

  useEffect(() => {
    if (!detailsTenant) return;
    let active = true;
    setDetails(null);
    setDetailsError(false);
    api.get(`/platform/tenants/${detailsTenant.id}`)
      .then(({ data }) => { if (active) setDetails(data.data); })
      .catch(() => { if (active) setDetailsError(true); });
    return () => { active = false; };
  }, [detailsTenant]);

  const openView = (next: typeof view, tenant: Tenant | null = null) => {
    setPage(1);
    setQuery('');
    setSearch('');
    setAction('');
    setAuditTenant(tenant);
    setView(next);
  };

  const changeStatus = async () => {
    if (!selected) return;
    const status = selected.suspendedAt ? 'active' : 'suspended';
    setSaving(true);
    setNotice(null);
    try {
      await api.patch(`/platform/tenants/${selected.id}/status`, { status });
      setNotice({ text: status === 'active' ? 'Tenant reactivated.' : 'Tenant suspended.' });
    } catch {
      setNotice({ error: true, text: 'Could not change tenant status. Check the directory and try again.' });
    } finally {
      setSelected(null);
      setSaving(false);
      setRevision(value => value + 1);
    }
  };

  return <Box component="main" sx={{ maxWidth: 1240, mx: 'auto', p: { xs: 2, sm: 4 } }}>
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap">
        <Brand to="/platform" />
        <Stack direction="row" alignItems="center">
          <Button component={Link} to="/platform/billing">Billing</Button>
          <AppearanceButton />
          <Button onClick={() => logout().catch(() => setNotice({ error: true, text: 'Could not sign out. Try again.' }))}>Sign out</Button>
        </Stack>
      </Stack>
      <Paper sx={{ p: { xs: 3, sm: 4 }, color: '#fff', background: 'linear-gradient(115deg,#0B1530,#143769)' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
          <Box>
            <Typography component="h1" variant="h4">Platform administration</Typography>
            <Typography sx={{ mt: 1, color: '#CEDBF1' }}>Monitor onboarding, manage cooperative access and review changes.</Typography>
          </Box>
          <Button sx={{ color: '#fff', alignSelf: 'flex-start' }} variant="outlined" startIcon={<RefreshRounded />}
            disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh</Button>
        </Stack>
      </Paper>
      <Tabs value={view} variant="scrollable" allowScrollButtonsMobile aria-label="Platform management"
        onChange={(_, next: typeof view) => openView(next)}>
        <Tab value="overview" id="platform-overview" aria-controls="platform-panel" label="Overview" />
        <Tab value="tenants" id="platform-tenants" aria-controls="platform-panel" label="Tenants" />
        <Tab value="audit" id="platform-audit" aria-controls="platform-panel" label="Audit history" />
      </Tabs>
      {notice && <Alert severity={notice.error ? 'error' : 'success'}>{notice.text}</Alert>}
      <Stack id="platform-panel" role="tabpanel" aria-labelledby={`platform-${view}`} spacing={2}>
        {view !== 'overview' && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} component="form" onSubmit={event => {
          event.preventDefault();
          setPage(1);
          setSearch(query.trim());
        }}>
          <TextField size="small" label={view === 'tenants' ? 'Cooperative name or ID' : 'Cooperative name'} value={query}
            inputProps={{ maxLength: 160 }} onChange={event => setQuery(event.target.value)} sx={{ flex: 1 }} />
          {view === 'tenants' ? <>
            <TextField select size="small" label="Status" value={statusFilter} sx={{ minWidth: 140 }}
              onChange={event => { setPage(1); setStatusFilter(event.target.value); }}>
              <MenuItem value="all">All statuses</MenuItem><MenuItem value="active">Active</MenuItem><MenuItem value="suspended">Suspended</MenuItem>
            </TextField>
            <TextField select size="small" label="Sort by" value={sort} sx={{ minWidth: 142 }}
              onChange={event => { setPage(1); setSort(event.target.value); }}>
              <MenuItem value="newest">Newest</MenuItem><MenuItem value="oldest">Oldest</MenuItem><MenuItem value="name">Name A–Z</MenuItem>
            </TextField>
          </> : <TextField select size="small" label="Action" value={action} sx={{ minWidth: 140 }}
            onChange={event => { setPage(1); setAction(event.target.value); }}>
            <MenuItem value="">All actions</MenuItem><MenuItem value="tenant.suspended">Suspended</MenuItem>
            <MenuItem value="tenant.reactivated">Reactivated</MenuItem>
          </TextField>}
          <Button variant="contained" type="submit">Search</Button>
        </Stack>}
        {view === 'audit' && auditTenant && <Chip label={auditTenant.name} onDelete={() => { setPage(1); setAuditTenant(null); }}
          sx={{ alignSelf: 'flex-start' }} />}
        {loadError && <Alert severity="error" action={<Button color="inherit" onClick={() => setRevision(value => value + 1)}>
          Retry</Button>}>{loadError}</Alert>}
        {loading && <Skeleton variant="rounded" height={240} />}
        {!loading && !loadError && view === 'overview' && overview && <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(4,minmax(0,1fr))' }, gap: 2 }}>
            {metrics.map(({ label, key, icon: Icon }) => <Paper key={key} variant="outlined" sx={{ p: 2 }}>
              <Icon color="primary" />
              <Typography variant="h5">{count(overview[key])}</Typography>
              <Typography variant="body2" color="text.secondary">{label}</Typography>
            </Paper>)}
          </Box>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography component="h2" variant="h6">Onboarding</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }}>
              <Typography>{count(overview.newTenants)} registered in the last 30 days · {count(overview.tenantsWithoutActiveAdmin)} active without a verified administrator.</Typography>
              <Button endIcon={<ArrowForwardRounded />} onClick={() => openView('tenants')}>Open tenants</Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">Updated {formatDate(overview.asOf)}</Typography>
          </Paper>
          <Typography component="h2" variant="h6">Recent access changes</Typography>
          <AuditTable events={events} />
        </>}
        {!loading && !loadError && view === 'audit' && <AuditTable events={events} />}
        {!loading && !loadError && view === 'tenants' && <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Cooperative tenants">
            <TableHead><TableRow><TableCell>Cooperative</TableCell><TableCell>Status</TableCell>
              <TableCell>Onboarding</TableCell><TableCell align="right">Members</TableCell><TableCell>Access</TableCell></TableRow></TableHead>
            <TableBody>{tenants.map(tenant => <TableRow key={tenant.id}>
              <TableCell component="th" scope="row" sx={{ minWidth: 160, overflowWrap: 'anywhere' }}>
                <Button sx={{ textAlign: 'left', p: 0 }} onClick={() => setDetailsTenant(tenant)}>{tenant.name}</Button>
                <Typography display="block" variant="caption">{formatDate(tenant.createdAt)}</Typography>
              </TableCell>
              <TableCell><Status suspended={tenant.suspendedAt} /></TableCell>
              <TableCell>{tenant.hasActiveAdmin ? 'Administrator verified' : 'No verified administrator'}</TableCell>
              <TableCell align="right">{count(tenant.memberCount)}</TableCell>
              <TableCell><Button size="small" onClick={() => setSelected(tenant)}>{tenant.suspendedAt ? 'Reactivate' : 'Suspend'}</Button></TableCell>
            </TableRow>)}
            {!tenants.length && <TableRow><TableCell colSpan={5}>No cooperatives match these filters.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>}
        {view !== 'overview' && (page > 1 || hasNext) && <Stack direction="row" alignItems="center">
          <Button disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}>Previous</Button>
          <Typography>Page {page}</Typography>
          <Button disabled={loading || Boolean(loadError) || !hasNext} onClick={() => setPage(value => value + 1)}>Next</Button>
        </Stack>}
      </Stack>
      <ProductAttribution />
    </Stack>

    <Dialog open={Boolean(detailsTenant)} onClose={() => setDetailsTenant(null)} fullWidth maxWidth="sm" aria-labelledby="tenant-details-title">
      <DialogTitle id="tenant-details-title" sx={{ overflowWrap: 'anywhere' }}>{detailsTenant?.name}</DialogTitle>
      <DialogContent>
        {detailsTenant && <Stack spacing={2}>
          <Box><Status suspended={detailsTenant.suspendedAt} /></Box>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>Tenant ID {detailsTenant.id}</Typography>
          <Typography variant="body2">Registered {formatDate(detailsTenant.createdAt)}</Typography>
          {detailsError && <Alert severity="error">Could not load tenant details.</Alert>}
          {!details && !detailsError && <Skeleton height={110} />}
          {details && <>
            <Typography>{count(details.activeMembers)} active members · {count(details.activeStaff)} active staff</Typography>
            <Typography>{count(details.verifiedAdmins)} verified administrators · {count(details.pendingAdmins)} awaiting verification</Typography>
            <Typography variant="body2">{details.lastAccessChange ? `Last access change ${formatDate(details.lastAccessChange)}` : 'No access changes recorded.'}</Typography>
          </>}
        </Stack>}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDetailsTenant(null)}>Close</Button>
        <Button onClick={() => { openView('audit', detailsTenant); setDetailsTenant(null); }}>View tenant history</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={Boolean(selected)} onClose={() => { if (!saving) setSelected(null); }} aria-labelledby="tenant-status-title">
      <DialogTitle id="tenant-status-title">{selected?.suspendedAt ? 'Reactivate' : 'Suspend'} {selected?.name}?</DialogTitle>
      <DialogContent>{selected?.suspendedAt ? 'This cooperative’s users will be able to sign in again.'
        : 'This signs out the cooperative’s users and blocks access until you reactivate it.'}</DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={() => setSelected(null)}>Cancel</Button>
        <Button disabled={saving} variant="contained" onClick={changeStatus}>{selected?.suspendedAt ? 'Reactivate' : 'Suspend'}</Button>
      </DialogActions>
    </Dialog>
  </Box>;
}
