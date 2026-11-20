import React, { useEffect, useState } from 'react';
import {
  Alert, Button, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography
} from '@mui/material';
import { saveAs } from 'file-saver';
import api from '../services/api';

const reasons = {
  missing_postings: 'Missing accounting entries',
  posting_amount: 'Transaction and posting amounts differ',
  posting_accounts: 'Unexpected accounts or posting lines',
  missing_loan_reference: 'Transaction has no loan reference',
  savings_balance: 'Member savings differs from recorded activity',
  missing_loan_schedule: 'Loan has no repayment schedule',
  loan_balance: 'Loan balance differs from schedule',
  loan_principal: 'Principal postings differ from schedule',
  loan_interest: 'Interest postings differ from schedule'
} as const;

interface Issue {
  reason: keyof typeof reasons;
  recordId: string;
  memberId: string;
  reference: string | null;
  expected: string | null;
  recorded: string;
  occurredAt: string | null;
}

interface ReconciliationReport {
  from: string;
  to: string;
  asOf: string;
  openingSavings: string;
  deposits: string;
  withdrawals: string;
  closingSavings: string;
  disbursements: string;
  repayments: string;
  currentSavings: string;
  currentLoans: string;
  transactionCount: number;
  issueCount: number;
  page: number;
  pageSize: number;
  issues: Issue[];
}

const rows = [
  ['Opening savings from recorded activity', 'openingSavings'],
  ['Deposits', 'deposits'],
  ['Withdrawals', 'withdrawals'],
  ['Closing savings from recorded activity', 'closingSavings'],
  ['Loan disbursements', 'disbursements'],
  ['Loan repayments', 'repayments'],
  ['Current member savings balances', 'currentSavings'],
  ['Current outstanding loans, including unpaid interest', 'currentLoans']
] as const;

const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' });
const localTimestamp = new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' });
const naira = (value: string | null) => value === null ? '—' : `₦${value.replace(/\B(?=(\d{3})+\.)/g, ',')}`;

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const csv = rows.map(row => row.map(value => {
    const text = String(value ?? '');
    const escaped = /^[\s=+@-]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text) ? "'" + text : text;
    return '"' + escaped.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
  saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

export default function Reconciliation() {
  const today = localDate.format(new Date());
  const [dates, setDates] = useState({ from: today.slice(0, 7) + '-01', to: today });
  const [query, setQuery] = useState({ ...dates, page: 1 });
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setReport(null);
    setError('');
    api.get('/reports/reconciliation', { params: query })
      .then(response => { if (active) setReport(response.data.data); })
      .catch(error => { if (active) setError(error.response?.data?.message || 'Could not load the reconciliation report.'); });
    return () => { active = false; };
  }, [query]);

  return <Stack spacing={3}>
    <Typography component="h1" variant="h4">Financial reconciliation</Typography>
    <Typography color="text.secondary">
      Compare recorded activity with accounting entries and balances. Use bank statements separately to confirm funds received and payouts.
    </Typography>
    <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={2} onSubmit={event => {
      event.preventDefault();
      setQuery({ ...dates, page: 1 });
    }}>
      <TextField label="From (WAT)" type="date" value={dates.from} required InputLabelProps={{ shrink: true }}
        inputProps={{ max: dates.to || today }} onChange={event => setDates({ ...dates, from: event.target.value })} />
      <TextField label="To (WAT)" type="date" value={dates.to} required InputLabelProps={{ shrink: true }}
        inputProps={{ min: dates.from, max: today }} onChange={event => setDates({ ...dates, to: event.target.value })} />
      <Button type="submit" variant="contained">Run report</Button>
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    {!report && !error && <Skeleton variant="rounded" height={280} />}
    {report && <>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
        <Typography>{report.transactionCount} completed transactions from {report.from} to {report.to} (WAT).</Typography>
        <Button variant="outlined" onClick={() => downloadCsv('reconciliation-summary.csv', [
          ['From (WAT)', 'To (WAT)', 'Snapshot time (UTC)', 'Completed transactions', 'Issues'],
          [report.from, report.to, report.asOf, report.transactionCount, report.issueCount],
          ['Metric', 'Amount (NGN)'],
          ...rows.map(([label, key]) => [label, report[key]])
        ])}>Export summary</Button>
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Reconciliation totals">
          <TableHead><TableRow><TableCell>Metric</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
          <TableBody>{rows.map(([label, key]) => <TableRow key={key}>
            <TableCell component="th" scope="row">{label}</TableCell>
            <TableCell align="right">{naira(report[key])}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </TableContainer>
      <Typography color="text.secondary" variant="body2">
        Opening and closing savings use available completed transactions, including activity recorded before the selected dates.
        Current savings and loans are a separate snapshot taken {localTimestamp.format(new Date(report.asOf))} WAT.
        Imported balances without matching transactions may appear as differences.
      </Typography>
      <Alert severity={report.issueCount ? 'warning' : 'success'}>
        {report.issueCount ? `${report.issueCount} discrepancies or missing records need review.` : 'No discrepancies found in the records checked.'}
      </Alert>
      {report.issues.length > 0 && <>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
          <Typography component="h2" variant="h6">Records to review</Typography>
          <Button variant="outlined" onClick={() => downloadCsv(`reconciliation-issues-page-${report.page}.csv`, [
            ['Issue', 'Record ID', 'Member ID', 'Transfer reference', 'Expected (NGN)', 'Recorded (NGN)', 'Transaction time (UTC)'],
            ...report.issues.map(issue => [
              reasons[issue.reason], issue.recordId, issue.memberId, issue.reference, issue.expected, issue.recorded, issue.occurredAt
            ])
          ])}>Export this page</Button>
        </Stack>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Reconciliation exceptions">
            <TableHead><TableRow>
              <TableCell>Issue</TableCell><TableCell>Record and reference</TableCell>
              <TableCell align="right">Expected</TableCell><TableCell align="right">Recorded</TableCell>
            </TableRow></TableHead>
            <TableBody>{report.issues.map(issue => <TableRow key={issue.recordId + issue.reason}>
              <TableCell component="th" scope="row">
                {reasons[issue.reason]}
                <Typography variant="body2" color="text.secondary">
                  {issue.occurredAt ? localTimestamp.format(new Date(issue.occurredAt)) + ' WAT' : 'Current balance check'}
                </Typography>
              </TableCell>
              <TableCell sx={{ overflowWrap: 'anywhere' }}>
                {issue.reference && <Typography variant="body2">{issue.reference}</Typography>}
                <Typography variant="caption" component="div">Record {issue.recordId}</Typography>
                {issue.memberId !== issue.recordId && <Typography variant="caption" component="div">Member {issue.memberId}</Typography>}
              </TableCell>
              <TableCell align="right">{naira(issue.expected)}</TableCell>
              <TableCell align="right">{naira(issue.recorded)}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>
      </>}
      {(report.page > 1 || report.issueCount > report.pageSize) && <Stack direction="row" spacing={1} alignItems="center">
        <Button disabled={report.page === 1} onClick={() => setQuery({ ...query, page: report.page - 1 })}>Previous</Button>
        <Typography>Page {report.page}</Typography>
        <Button disabled={report.page * report.pageSize >= report.issueCount}
          onClick={() => setQuery({ ...query, page: report.page + 1 })}>Next</Button>
      </Stack>}
    </>}
  </Stack>;
}
