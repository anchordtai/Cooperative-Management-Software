import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { saveAs } from 'file-saver';
import api from '../services/api';
import { downloadCsv } from '../utils/reportCsv';

const fields = { firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone', address: 'Address' };
const keys = Object.keys(fields) as Array<keyof typeof fields>;
const template = [keys, ['Ada', 'Example', 'ada@example.test', '08000000000', 'Abuja']];
const messages: Record<string, string> = {
  valid: 'Ready to import', duplicate: 'Duplicate email or phone', invalid: 'Check required values, email or phone format',
  capacity: 'Did not fit within available capacity', created: 'Imported'
};
type Batch = { remaining: number | null; created?: number; rows: Array<{ line: number; status: string }> };

function csvTable(text: string) {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => {
    if (!line.trim()) return [];
    if (!/^(?:"(?:[^"]|"")*"|[^",]*)(?:,(?:"(?:[^"]|"")*"|[^",]*))*$/.test(line)) throw new Error('The CSV contains an invalid line.');
    const cells: string[] = [];
    const pattern = /("(?:[^"]|"")*"|[^",]*)(,|$)/g;
    for (const match of line.matchAll(pattern)) {
      const value = match[1];
      cells.push(value.startsWith('"') ? value.slice(1, -1).replace(/""/g, '"') : value);
      if (!match[2]) break;
    }
    return cells;
  }).filter(row => row.length);
}

export function checkWorkbook(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 22 || view.getUint32(0, true) !== 0x04034b50) throw new Error('Choose a valid .xlsx file.');
  let end = view.byteLength - 22;
  const minimum = Math.max(0, end - 65535);
  while (end >= minimum && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < minimum || end + 22 + view.getUint16(end + 20, true) !== view.byteLength ||
      view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error('The workbook archive is invalid.');
  const entries = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  let expanded = 0;
  if (!entries || entries > 120 || cursor + view.getUint32(end + 12, true) !== end) throw new Error('The workbook archive is too complex.');
  for (let entry = 0; entry < entries; entry++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) throw new Error('The workbook archive is invalid.');
    expanded += view.getUint32(cursor + 24, true);
    cursor += 46 + view.getUint16(cursor + 28, true) + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
    if (expanded > 8_000_000) throw new Error('The workbook expands beyond the import limit.');
  }
  if (cursor !== end) throw new Error('The workbook archive is invalid.');
}

async function read(file: File) {
  if (file.size > 256_000) throw new Error('Use a file up to 256 KB for this batch.');
  if (/\.csv$/i.test(file.name)) return csvTable(await file.text());
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Choose a CSV or Excel .xlsx file.');
  const buffer = await file.arrayBuffer();
  checkWorkbook(buffer);
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);
  if (workbook.worksheets.length !== 1) throw new Error('Use a workbook with one worksheet.');
  const sheet = workbook.worksheets[0];
  if (sheet.rowCount > 101 || sheet.columnCount > 30) throw new Error('Use at most 100 data rows and 30 columns.');
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, row => {
    const cells = Array.from({ length: sheet.columnCount }, (_, i) => {
      const value = row.getCell(i + 1).value;
      if (value == null) return '';
      if (typeof value !== 'string' && typeof value !== 'number') {
        throw new Error('Use plain text or number cells. Remove formulas, links and special cell values.');
      }
      return String(value);
    });
    if (cells.some(cell => cell.trim())) rows.push(cells);
  });
  return rows;
}

export default function MemberImport() {
  const [table, setTable] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Batch | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; createdAt: string; result: Batch }>>([]);
  const [requestId, setRequestId] = useState('');
  const [partial, setPartial] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [historyError, setHistoryError] = useState(false);

  const refreshHistory = () => api.get('/members/import/history')
    .then(({ data }) => { setHistory(data.data); setHistoryError(false); }).catch(() => setHistoryError(true));
  useEffect(() => { void refreshHistory(); }, []);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await operation(); }
    catch (error: any) { setError(error.response?.data?.message || error.message || 'Import could not be completed.'); }
    finally { setBusy(false); }
  };

  const loadFile = (file?: File) => run(async () => {
    if (!file) return;
    setResult(null); setTable([]); setPartial(false); setRequestId('');
    const rows = await read(file);
    if (rows.length < 2 || rows.length > 101 || rows[0].length > 30 || rows.some(row => row.length > rows[0].length)) {
      throw new Error('Include a header and 1 to 100 rows with no more than 30 columns.');
    }
    setTable(rows);
    setFileName(file.name);
    const normalized = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
    setMapping(Object.fromEntries(keys.map(key => {
      const found = rows[0].findIndex(column => normalized(column) === normalized(key));
      return [key, found < 0 ? '' : String(found)];
    })));
  });

  const submit = (confirm: boolean) => run(async () => {
    if (keys.some(key => !mapping[key]) || new Set(Object.values(mapping)).size !== keys.length) {
      throw new Error('Map all five fields to different columns.');
    }
    const rows = table.slice(1).map(row => Object.fromEntries(keys.map(key => [key, row[Number(mapping[key])] || ''])));
    const payload = { rows, requestId, acceptPartial: partial };
    if (new TextEncoder().encode(JSON.stringify(payload)).length > 60000) throw new Error('This batch is too large. Split it into smaller files.');
    const { data } = await api.post('/members/import/' + (confirm ? 'confirm' : 'preview'), payload);
    setResult(data.data);
    if (!confirm) setRequestId(crypto.randomUUID());
    else void refreshHistory();
  });
  const ready = result?.rows.filter(row => row.status === 'valid').length || 0;
  const overflow = Boolean(result && result.remaining !== null && ready > result.remaining);
  const exportErrors = (batch: Batch) => downloadCsv('member-import-results.csv', [
    ['Data row number (header is row 1)', 'Result'],
    ...batch.rows.filter(row => row.status !== 'created' && row.status !== 'valid').map(row => [row.line, messages[row.status]])
  ]);

  return <Stack spacing={3}>
    <Typography component="h1" variant="h4">Import members</Typography>
    <Typography color="text.secondary">Use one CSV or Excel worksheet with up to 100 members per batch. Format phone numbers as text to preserve leading zeros.</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <Button variant="outlined" onClick={() => downloadCsv('coopsphere-members.csv', template)}>Download CSV template</Button>
      <Button variant="outlined" disabled={busy} onClick={() => run(async () => {
        const { Workbook } = await import('exceljs');
        const workbook = new Workbook();
        workbook.addWorksheet('Members').addRows(template);
        const bytes = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'coopsphere-members.xlsx');
      })}>Download Excel template</Button>
    </Stack>
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography component="label">Member file
        <input style={{ display: 'block', maxWidth: '100%' }} type="file" accept=".csv,.xlsx" disabled={busy}
          onChange={event => { void loadFile(event.target.files?.[0]); }} />
      </Typography>
      {table.length > 0 && <Typography variant="caption">{fileName} · {table.length - 1} data rows</Typography>}
    </Paper>
    {table.length > 0 && <>
      <Typography variant="h6">Map columns</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
        {keys.map(key => <TextField key={key} select label={fields[key]} value={mapping[key] || ''} disabled={busy}
          onChange={event => { setMapping({ ...mapping, [key]: event.target.value }); setResult(null); setRequestId(''); setPartial(false); }}>
          <MenuItem value="">Choose a column</MenuItem>
          {table[0].map((column, index) => <MenuItem key={index} value={String(index)}>{column || `Column ${index + 1}`}</MenuItem>)}
        </TextField>)}
      </Box>
      <Button variant="outlined" sx={{ alignSelf: 'start' }} disabled={busy} onClick={() => submit(false)}>Validate and preview</Button>
    </>}
    {result && <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Typography variant="h6">{result.created === undefined ? `${ready} ready · ${result.rows.length - ready} need review` : `${result.created} members imported`}</Typography>
        {result.remaining !== null && <Typography>Available capacity: {result.remaining}</Typography>}
        {overflow && <FormControlLabel label="Import only the rows that fit" control={<Checkbox checked={partial} disabled={busy}
          onChange={event => setPartial(event.target.checked)} />} />}
        {result.rows.slice(0, 15).map(row => <Typography key={row.line} variant="body2">
          Row {row.line} · {messages[row.status]}
        </Typography>)}
        {result.rows.length > 15 && <Typography variant="caption">Showing the first 15 rows.</Typography>}
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Button variant="contained" disabled={busy || !requestId || !ready || (overflow && !partial)}
            onClick={() => submit(true)}>Confirm import</Button>
          <Button onClick={() => exportErrors(result)}>Download exceptions</Button>
        </Stack>
      </Stack>
    </Paper>}
    <Typography variant="h6">Import history</Typography>
    {historyError ? <Alert severity="error">Could not load import history.</Alert> : !history.length && <Typography>No imports recorded.</Typography>}
    {history.map(item => <Paper key={item.id} variant="outlined" sx={{ p: 2 }}>
      <Typography>{new Date(item.createdAt).toLocaleString('en-NG')} · {item.result.created} imported</Typography>
      <Button onClick={() => exportErrors(item.result)}>Download exceptions</Button>
    </Paper>)}
  </Stack>;
}
