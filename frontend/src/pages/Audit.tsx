import React, { useEffect, useState } from 'react';
import { Alert, Button, Paper, Skeleton, Stack, Typography } from '@mui/material';
import api from '../services/api';

interface AuditRecord {
  id: string;
  action: string;
  recordId: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

const labels: Record<string, string> = {
  'staff.invited': 'Staff account invited',
  'staff.permissions_updated': 'Staff access updated',
  'savings.deposit': 'Savings deposit recorded',
  'withdrawal.completed': 'Withdrawal payout recorded',
  'withdrawal.failed': 'Withdrawal rejected',
  'loan.approved': 'Loan application approved',
  'loan.rejected': 'Loan application rejected',
  'loan.disbursed': 'Loan disbursement recorded',
  'loan.repayment': 'Loan repayment recorded'
};

export default function Audit() {
  const [entries, setEntries] = useState<AuditRecord[] | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  useEffect(() => {
    let active = true;
    setEntries(null);
    setError('');
    api.get('/audit', { params: { page, limit: 20 } }).then(({ data }) => {
      if (active) {
        setEntries(data.data);
        setHasNext(data.hasNext);
      }
    }).catch(() => {
      if (active) setError('Could not load audit history.');
    });
    return () => { active = false; };
  }, [page]);

  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1">Audit history</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {!error && !entries && <Skeleton variant="rounded" height={120} />}
      {entries?.length === 0 && <Typography color="text.secondary">There are no audit events yet.</Typography>}
      {entries?.map(entry => <Paper variant="outlined" sx={{ p: 2 }} key={entry.id}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
          <div>
            <Typography fontWeight={650}>{labels[entry.action] || entry.action}</Typography>
            <Typography variant="body2" color="text.secondary">{entry.firstName} {entry.lastName}</Typography>
          </div>
          <Typography variant="body2" color="text.secondary">
            {new Date(entry.createdAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>Record {entry.recordId}</Typography>
      </Paper>)}
      <Stack direction="row" spacing={1}>
        <Button onClick={() => setPage(page - 1)} disabled={page === 1 || !entries}>Previous</Button>
        <Button onClick={() => setPage(page + 1)} disabled={!hasNext || !entries}>Next</Button>
      </Stack>
    </Stack>
  );
}
