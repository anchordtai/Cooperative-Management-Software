import { saveAs } from 'file-saver';

export function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const csv = rows.map(row => row.map(value => {
    const text = String(value ?? '');
    const escaped = /^[\s=+@-]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text) ? "'" + text : text;
    return '"' + escaped.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
  saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
}
