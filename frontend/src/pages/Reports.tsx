import React, { useEffect, useState } from 'react';
import { Alert, Button, MenuItem, Paper, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { saveAs } from 'file-saver';
import api from '../services/api';

interface Activity {
  month: string;
  deposits: string;
  withdrawals: string;
  disbursements: string;
  repayments: string;
}
const series = [
  { key: 'deposits', label: 'Deposits', color: '#176b63' },
  { key: 'withdrawals', label: 'Withdrawals', color: '#93b9b3' },
  { key: 'disbursements', label: 'Loan disbursements', color: '#354b91' },
  { key: 'repayments', label: 'Loan repayments', color: '#a3addb' }
] as const;
const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' });

export default function Reports() {
  const [months, setMonths] = useState('6');
  const [rows, setRows] = useState<Activity[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setRows(null);
    setError('');
    api.get('/reports/activity', { params: { months } }).then(response => {
      if (active) setRows(response.data.data);
    }).catch(() => {
      if (active) setError('Could not load the activity report.');
    });
    return () => { active = false; };
  }, [months]);

  const exportReport = () => {
    if (!rows) return;
    const header = ['Month', ...series.map(item => item.label)].join(',');
    const activity = rows.map(row => [row.month, ...series.map(item => row[item.key])].join(','));
    saveAs(new Blob([[header, ...activity].join('\n')], { type: 'text/csv;charset=utf-8;' }), 'cooperative-activity.csv');
  };

  const chartRows = rows?.map(row => ({
    month: row.month, deposits: Number(row.deposits), withdrawals: Number(row.withdrawals),
    disbursements: Number(row.disbursements), repayments: Number(row.repayments)
  }));
  return (
    <Stack spacing={3}>
      <Typography component="h1" variant="h4">Financial activity</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField select label="Reporting period" value={months} onChange={event => setMonths(event.target.value)} size="small">
          <MenuItem value="3">Last 3 months</MenuItem>
          <MenuItem value="6">Last 6 months</MenuItem>
          <MenuItem value="12">Last 12 months</MenuItem>
        </TextField>
        <Button variant="outlined" disabled={!rows} onClick={exportReport}>Export CSV</Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {!rows && !error && <Skeleton variant="rounded" height={320} />}
      {chartRows && <Paper variant="outlined" sx={{ p: { xs: 1, sm: 3 } }}>
        {chartRows.some(row => series.some(item => row[item.key] !== 0))
          ? <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartRows}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis width={75} />
              <Tooltip formatter={value => naira.format(Number(value))} />
              <Legend />
              {series.map(item => <Bar key={item.key} name={item.label} dataKey={item.key} fill={item.color} />)}
            </BarChart>
          </ResponsiveContainer>
          : <Typography sx={{ p: 2 }} color="text.secondary">No completed financial activity in this period.</Typography>}
      </Paper>}
    </Stack>
  );
}
