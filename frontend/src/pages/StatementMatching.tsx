import React, { useState } from 'react';
import {
  Alert, Button, Chip, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography
} from '@mui/material';
import { downloadCsv } from '../utils/reportCsv';
import api from '../services/api';

const labels = {
  matched: 'Matched',
  statement_only: 'Statement only',
  record_only: 'Co-opSphere only',
  duplicate_reference: 'Duplicate reference',
  date_mismatch: 'Dates differ',
  direction_mismatch: 'Debit or credit differs',
  amount_mismatch: 'Amounts differ'
} as const;
type MatchStatus = keyof typeof labels;
interface Entry { date: string; reference: string | null; direction: 'debit' | 'credit'; amount: string }
interface Result {
  from: string;
  to: string;
  matched: number;
  statementCount: number;
  recordedCount: number;
  rows: Array<{
    status: MatchStatus;
    statement: (Entry & { line: number }) | null;
    recorded: (Entry & { id: string; type: string }) | null;
    candidateCount: number;
  }>;
}

const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' });
const pageSize = 25;
const amountText = (entry: Entry) => (entry.direction === 'credit' ? 'Credit' : 'Debit') + ' · ₦' + entry.amount;
const maxBytes = 28000;

export default function StatementMatching() {
  const today = localDate.format(new Date());
  const [from, setFrom] = useState(today.slice(0, 7) + '-01');
  const [to, setTo] = useState(today);
  const [statement, setStatement] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [filter, setFilter] = useState<'all' | 'review' | 'matched'>('all');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!statement || busy) return;
    setResult(null);
    setError('');
    if (statement.size > maxBytes) {
      setError('Choose a CSV file smaller than 28,000 bytes.');
      return;
    }
    setBusy(true);
    try {
      const csv = await statement.text();
      const { data } = await api.post('/reports/statement-matching', { from, to, csv });
      setFilter('all');
      setPage(1);
      setResult(data.data);
    } catch (error) {
      setError((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Could not compare the statement.');
    } finally {
      setBusy(false);
    }
  };

  const rows = result?.rows.filter(row => filter === 'all' || (filter === 'matched') === (row.status === 'matched')) ?? [];
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const exportReport = () => {
    if (!result) return;
    downloadCsv(`statement-comparison-${result.from}-to-${result.to}.csv`, [
      ['Status', 'Statement line', 'Statement date (WAT)', 'Statement reference', 'Statement direction', 'Statement amount (NGN)',
        'Co-opSphere ID', 'Posted date (WAT)', 'Co-opSphere reference', 'Recorded direction', 'Recorded amount (NGN)', 'Candidate count'],
      ...rows.map(({ status, statement, recorded, candidateCount }) => [
        labels[status], statement?.line ?? null, statement?.date ?? null, statement?.reference ?? null,
        statement?.direction ?? null, statement?.amount ?? null, recorded?.id ?? null, recorded?.date ?? null,
        recorded?.reference ?? null, recorded?.direction ?? null, recorded?.amount ?? null, candidateCount
      ])
    ]);
  };

  return <Stack spacing={3}>
    <Typography component="h1" variant="h4">Bank statement matching</Typography>
    <Typography color="text.secondary">
      Upload an NGN CSV for the chosen period. Use bank references and dates in West Africa Time. The comparison does not save your CSV or change any balances.
    </Typography>
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack component="form" spacing={2} onSubmit={submit}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField size="small" label="From (WAT)" type="date" value={from} required InputLabelProps={{ shrink: true }}
            inputProps={{ max: to || today }} disabled={busy} onChange={event => setFrom(event.target.value)} />
          <TextField size="small" label="To (WAT)" type="date" value={to} required InputLabelProps={{ shrink: true }}
            inputProps={{ min: from, max: today }} disabled={busy} onChange={event => setTo(event.target.value)} />
        </Stack>
        <Typography component="label" variant="body2">
          Bank statement CSV
          <input type="file" accept=".csv,text/csv" required disabled={busy}
            style={{ display: 'block', marginTop: 8, maxWidth: '100%' }}
            onChange={event => setStatement(event.target.files?.item(0) ?? null)} />
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button type="submit" variant="contained" disabled={!statement || busy}>{busy ? 'Comparing…' : 'Compare statement'}</Button>
          <Button onClick={() => downloadCsv('bank-statement-template.csv', [
            ['date', 'reference', 'direction', 'amount'],
            [today, 'EXAMPLE-001', 'credit', '1250.50'],
            [today, 'EXAMPLE-002', 'debit', '350.00']
          ])}>Download CSV template</Button>
        </Stack>
      </Stack>
    </Paper>
    {error && <Alert severity="error">{error}</Alert>}
    {result && <>
      <Alert severity={result.rows.length === result.matched ? 'success' : 'warning'}>
        {result.matched} matched · {result.rows.length - result.matched} need review. Compared {result.statementCount} statement entries and {result.recordedCount} Co-opSphere records for {result.from} to {result.to} (WAT).
      </Alert>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
        <TextField select size="small" label="Show results" value={filter} sx={{ minWidth: 170 }} onChange={event => {
          setFilter(event.target.value as typeof filter);
          setPage(1);
        }}>
          <MenuItem value="all">All results</MenuItem><MenuItem value="review">Needs review</MenuItem><MenuItem value="matched">Matched</MenuItem>
        </TextField>
        <Button variant="outlined" disabled={!rows.length} onClick={exportReport}>Export filtered results</Button>
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Bank statement comparison">
          <TableHead><TableRow><TableCell>Status</TableCell><TableCell>Reference</TableCell>
            <TableCell>Statement</TableCell><TableCell>Co-opSphere</TableCell></TableRow></TableHead>
          <TableBody>{visibleRows.map(({ statement, recorded, status, candidateCount }) =>
            <TableRow key={statement ? `line-${statement.line}` : recorded?.id}>
              <TableCell><Chip size="small" label={labels[status]} color={status === 'matched' ? 'success' : 'warning'} /></TableCell>
              <TableCell sx={{ minWidth: 120, overflowWrap: 'anywhere' }}>{statement?.reference ?? recorded?.reference ?? '—'}</TableCell>
              <TableCell>{statement ? <><Typography variant="body2">{amountText(statement)}</Typography>
                <Typography variant="caption">{statement.date} · CSV line {statement.line}</Typography></> : '—'}</TableCell>
              <TableCell sx={{ minWidth: 150, overflowWrap: 'anywhere' }}>{recorded
                ? <><Typography variant="body2">{amountText(recorded)}</Typography>
                  <Typography display="block" variant="caption">{recorded.date}</Typography>
                  <Typography variant="caption">{recorded.id}</Typography></>
                : candidateCount > 1 ? `${candidateCount} candidate records` : '—'}</TableCell>
            </TableRow>)}
          {!visibleRows.length && <TableRow><TableCell colSpan={4}>No results for this filter.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
      {rows.length > pageSize && <Stack direction="row" spacing={1} alignItems="center">
        <Button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
        <Typography>Page {page}</Typography>
        <Button disabled={page * pageSize >= rows.length} onClick={() => setPage(page + 1)}>Next</Button>
      </Stack>}
      <Typography variant="body2" color="text.secondary">
        Only completed direct transactions within the selected period are compared. Cash receipts may appear as Co-opSphere-only records. Payment clearing and Paystack test entries are excluded.
      </Typography>
    </>}
  </Stack>;
}
