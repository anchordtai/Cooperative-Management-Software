import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, CardContent, Grid, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface Summary {
  cooperativeName: string;
  totalMembers: string;
  totalSavings: string;
  activeLoans: string;
  pendingLoans: string;
}
interface Entry {
  id: string;
  description: string;
  amount: string;
  type: string;
  status: string;
}

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' });

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/dashboard'), api.get('/transactions', { params: { limit: 5 } })])
      .then(([dashboard, transactions]) => {
        setSummary(dashboard.data.data);
        setEntries(transactions.data.data);
      })
      .catch(() => setFailed(true));
  }, []);

  const cards = summary ? [
    ['Members', summary.totalMembers],
    ['Savings balance', naira.format(Number(summary.totalSavings))],
    ['Active loans', summary.activeLoans],
    ['Pending loan applications', summary.pendingLoans]
  ] : [];

  return (
    <Stack spacing={3}>
      <div>
        <Typography component="h1" variant="h4">Dashboard</Typography>
        {summary && <Typography color="text.secondary">{summary.cooperativeName}</Typography>}
      </div>
      {failed && <Alert severity="error">Could not load your cooperative dashboard.</Alert>}
      {!summary && !failed && <Skeleton variant="rounded" height={110} />}
      {summary && <>
        <Grid container spacing={2}>
          {cards.map(([label, value]) => <Grid item xs={12} sm={6} lg={3} key={label}>
            <Card variant="outlined"><CardContent>
              <Typography color="text.secondary" variant="body2">{label}</Typography>
              <Typography variant="h5" sx={{ mt: 1 }}>{value}</Typography>
            </CardContent></Card>
          </Grid>)}
        </Grid>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography component="h2" variant="h6">Recent transactions</Typography>
            {!entries.length && <Typography color="text.secondary">There are no recorded transactions yet.</Typography>}
            {entries.map(entry => <Stack key={entry.id} direction="row" justifyContent="space-between" spacing={2}>
              <div>
                <Typography>{entry.description}</Typography>
                <Typography variant="caption" color="text.secondary">{entry.type} · {entry.status}</Typography>
              </div>
              <Typography>{naira.format(Number(entry.amount))}</Typography>
            </Stack>)}
            <Button component={Link} to="/app/transactions" sx={{ alignSelf: 'flex-start' }}>View transactions</Button>
          </Stack>
        </Paper>
      </>}
    </Stack>
  );
}
