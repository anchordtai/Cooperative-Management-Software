import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Skeleton, Stack,
  Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography
} from '@mui/material';
import Brand from '../components/Brand';
import { AppearanceButton } from '../components/Appearance';
import { ProductAttribution } from '../components/AuthBranding';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface Tenant {
  id: string;
  name: string;
  createdAt: string;
  suspendedAt: string | null;
  memberCount: string;
}

interface AuditEntry {
  id: string;
  action: 'tenant.suspended' | 'tenant.reactivated';
  tenantName: string;
  cooperativeId: string;
  createdAt: string;
}

const date = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' });

export default function PlatformOwner() {
  const { logout } = useAuth();
  const [view, setView] = useState<'tenants' | 'audit'>('tenants');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [events, setEvents] = useState<AuditEntry[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<{ error?: boolean; text: string } | null>(null);
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    api.get(`/platform/${view}`, { params: { page, limit: 25 } }).then(({ data }) => {
      if (!active) return;
      if (view === 'tenants') setTenants(data.data);
      else setEvents(data.data);
      setHasNext(data.hasNext);
    }).catch(() => { if (active) setLoadError('Could not load platform records.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [view, page, revision]);

  const changeStatus = async () => {
    if (!selected) return;
    const status = selected.suspendedAt ? 'active' : 'suspended';
    setSaving(true);
    setNotice(null);
    try {
      await api.patch(`/platform/tenants/${selected.id}/status`, { status });
      setSelected(null);
      setNotice({ text: status === 'active' ? 'Tenant reactivated.' : 'Tenant suspended.' });
      setRevision(value => value + 1);
    } catch {
      setSelected(null);
      setNotice({ error: true, text: 'Could not change tenant status. Check the directory and try again.' });
      setRevision(value => value + 1);
    } finally {
      setSaving(false);
    }
  };

  return <Box component="main" sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, sm: 4 } }}>
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap">
        <Brand to="/platform" />
        <Stack direction="row" alignItems="center">
          <AppearanceButton />
          <Button onClick={() => logout().catch(() => setNotice({ error: true, text: 'Could not sign out. Try again.' }))}>
            Sign out
          </Button>
        </Stack>
      </Stack>
      <Typography component="h1" variant="h4">Platform administration</Typography>
      <Tabs value={view} aria-label="Platform management" onChange={(_, next: typeof view) => {
        setPage(1);
        setNotice(null);
        setView(next);
      }}>
        <Tab value="tenants" id="platform-tenants" aria-controls="platform-panel" label="Tenants" />
        <Tab value="audit" id="platform-audit" aria-controls="platform-panel" label="Audit history" />
      </Tabs>
      {notice && <Alert severity={notice.error ? 'error' : 'success'}>{notice.text}</Alert>}
      {loadError && <Alert severity="error" action={<Button color="inherit" onClick={() => setRevision(value => value + 1)}>
        Retry
      </Button>}>{loadError}</Alert>}
      <Box role="tabpanel" id="platform-panel" aria-labelledby={`platform-${view}`}>
        {loading ? <Skeleton variant="rounded" height={240} /> : !loadError && <TableContainer component={Paper} variant="outlined">
          {view === 'tenants' ? <Table size="small" aria-label="Cooperative tenants">
            <TableHead><TableRow><TableCell>Cooperative</TableCell><TableCell>Status</TableCell>
              <TableCell align="right">Members</TableCell><TableCell>Access</TableCell></TableRow></TableHead>
            <TableBody>{tenants.map(tenant => <TableRow key={tenant.id}>
              <TableCell component="th" scope="row">{tenant.name}
                <Typography display="block" variant="caption">{date.format(new Date(tenant.createdAt))} WAT</Typography>
              </TableCell>
              <TableCell><Chip size="small" label={tenant.suspendedAt ? 'Suspended' : 'Active'}
                color={tenant.suspendedAt ? 'warning' : 'success'} /></TableCell>
              <TableCell align="right">{tenant.memberCount}</TableCell>
              <TableCell><Button size="small" onClick={() => setSelected(tenant)}>{tenant.suspendedAt ? 'Reactivate' : 'Suspend'}</Button></TableCell>
            </TableRow>)}
            {!tenants.length && <TableRow><TableCell colSpan={4}>No cooperatives on this page.</TableCell></TableRow>}
            </TableBody>
          </Table> : <Table size="small" aria-label="Platform access history">
            <TableHead><TableRow><TableCell>Cooperative</TableCell><TableCell>Action</TableCell><TableCell>Time (WAT)</TableCell></TableRow></TableHead>
            <TableBody>{events.map(event => <TableRow key={event.id}>
              <TableCell component="th" scope="row">{event.tenantName}</TableCell>
              <TableCell>{event.action === 'tenant.suspended' ? 'Suspended' : 'Reactivated'}</TableCell>
              <TableCell>{date.format(new Date(event.createdAt))}</TableCell>
            </TableRow>)}
            {!events.length && <TableRow><TableCell colSpan={3}>No access changes on this page.</TableCell></TableRow>}
            </TableBody>
          </Table>}
        </TableContainer>}
      </Box>
      {(page > 1 || hasNext) && <Stack direction="row" alignItems="center">
        <Button disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}>Previous</Button>
        <Typography>Page {page}</Typography>
        <Button disabled={loading || Boolean(loadError) || !hasNext} onClick={() => setPage(value => value + 1)}>Next</Button>
      </Stack>}
      <ProductAttribution />
    </Stack>
    <Dialog open={Boolean(selected)} onClose={() => { if (!saving) setSelected(null); }} aria-labelledby="tenant-status-title">
      <DialogTitle id="tenant-status-title">{selected?.suspendedAt ? 'Reactivate' : 'Suspend'} {selected?.name}?</DialogTitle>
      <DialogContent>{selected?.suspendedAt
        ? 'This cooperative’s users will be able to sign in again.'
        : 'This signs out the cooperative’s users and blocks access until you reactivate it.'}</DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={() => setSelected(null)}>Cancel</Button>
        <Button disabled={saving} variant="contained" onClick={changeStatus}>
          {selected?.suspendedAt ? 'Reactivate' : 'Suspend'}
        </Button>
      </DialogActions>
    </Dialog>
  </Box>;
}
