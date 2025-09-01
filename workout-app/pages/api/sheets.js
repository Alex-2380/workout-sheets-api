// pages/api/sheets.js
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function parseCredentialsFromEnv() {
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      const raw = typeof process.env.GOOGLE_CREDENTIALS === 'string'
        ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
        : process.env.GOOGLE_CREDENTIALS;
      return raw;
    } catch (err) {
      throw new Error('Failed to parse GOOGLE_CREDENTIALS JSON env var: ' + err.message);
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (email && privateKey) {
    const key = privateKey.replace(/\\n/g, '\n');
    return {
      type: 'service_account',
      client_email: email,
      private_key: key
    };
  }

  throw new Error('No Google service account credentials found in env (GOOGLE_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY).');
}

async function getAuth() {
  const creds = parseCredentialsFromEnv();
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: SCOPES
  });
  const client = await auth.getClient();
  return client;
}

/** Converts zero-based column index -> A1 column (0 -> A, 25 -> Z, 26 -> AA) */
function colIndexToA1(n) {
  let s = '';
  let x = n + 1;
  while (x > 0) {
    const rem = (x - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

async function readSheetValues(sheets, spreadsheetId, range) {
  const r = await sheets.spreadsheets.values.get({ spreadsheetId, range, majorDimension: 'ROWS' });
  return r.data.values || [];
}

async function updateRange(sheets, spreadsheetId, range, values) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values }
  });
}

async function appendRows(sheets, spreadsheetId, tab, rows) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: tab,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows }
  });
}

export default async function handler(req, res) {
  try {
    const tab = req.query.tab;
    if (!tab || typeof tab !== 'string') {
      return res.status(400).json({ error: "Missing or invalid 'tab' query parameter" });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID || process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
      return res.status(500).json({ error: 'Missing GOOGLE_SHEETS_ID (or SPREADSHEET_ID) env variable.' });
    }

    const authClient = await getAuth();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // GET -> existing behavior (returns array-of-arrays)
    if (req.method === 'GET') {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: tab
      });
      const values = r.data.values || [];
      return res.status(200).json(values);
    }

    // POST -> append rows (existing behavior)
    if (req.method === 'POST') {
      const body = req.body || {};
      const rows = body.rows;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'POST body must include "rows": array-of-arrays' });
      }

      await appendRows(sheets, spreadsheetId, tab, rows);
      return res.status(200).json({ ok: true });
    }

    // PATCH -> update a row by key column/value with set object
    if (req.method === 'PATCH') {
      const body = req.body || {};
      if (body.action !== 'update') {
        return res.status(400).json({ error: 'PATCH expects { action: "update", keyColumn, keyValue, set }' });
      }

      const keyColumn = body.keyColumn;
      const keyValue = body.keyValue;
      const setObj = body.set || {};

      if (!keyColumn || keyValue === undefined || typeof setObj !== 'object') {
        return res.status(400).json({ error: 'PATCH missing keyColumn / keyValue / set' });
      }

      // Read a broad range so we pick up many columns
      const raw = await readSheetValues(sheets, spreadsheetId, `${tab}!A:Z`);
      if (!raw.length) return res.status(404).json({ error: 'Sheet empty or not found' });

      // header + data rows
      let header = raw[0].map(h => (h === undefined || h === null) ? '' : String(h));
      const dataRows = raw.slice(1).map(r => r.map(c => (c === undefined || c === null) ? '' : c));

      // find key column index (case-insensitive)
      const lowerHeaders = header.map(h => String(h).toLowerCase());
      let keyIx = header.indexOf(keyColumn);
      if (keyIx === -1) keyIx = lowerHeaders.indexOf(String(keyColumn).toLowerCase());
      if (keyIx === -1) {
        return res.status(400).json({ error: `keyColumn "${keyColumn}" not found in header` });
      }

      // find the row where key column equals keyValue
      const rowIxInData = dataRows.findIndex(r => String(r[keyIx] ?? '') === String(keyValue));
      if (rowIxInData === -1) {
        return res.status(404).json({ error: `Row with ${keyColumn}=${keyValue} not found` });
      }

      // prepare targetRow and ensure it matches header length
      const targetRow = dataRows[rowIxInData].slice();
      while (targetRow.length < header.length) targetRow.push('');

      // detect any new keys in setObj that aren't in header (case-insensitive)
      const newKeys = Object.keys(setObj).filter(k => {
        if (header.indexOf(k) !== -1) return false;
        if (lowerHeaders.indexOf(String(k).toLowerCase()) !== -1) return false;
        return true;
      });

      // if we have new headers, append them to header row (and expand all data rows)
      if (newKeys.length > 0) {
        newKeys.forEach(k => header.push(k));
        // expand data rows
        dataRows.forEach(r => {
          while (r.length < header.length) r.push('');
        });
        while (targetRow.length < header.length) targetRow.push('');

        // write header row back (A1:LASTCOL1)
        const headerRange = `${tab}!A1:${colIndexToA1(header.length - 1)}1`;
        await updateRange(sheets, spreadsheetId, headerRange, [header]);
      }

      // apply each set key -> value (case-insensitive matching)
      for (const [k, v] of Object.entries(setObj)) {
        // find index in header (exact or case-insensitive)
        let ix = header.indexOf(k);
        if (ix === -1) ix = header.map(h => h.toLowerCase()).indexOf(String(k).toLowerCase());
        if (ix === -1) {
          // fallback: append column
          header.push(k);
          ix = header.length - 1;
        }
        targetRow[ix] = (v === undefined || v === null) ? '' : String(v);
      }

      // write updated single row back (row number = 2 + rowIxInData)
      const rowNumber = 2 + rowIxInData;
      const lastCol = colIndexToA1(header.length - 1);
      const rowRange = `${tab}!A${rowNumber}:${lastCol}${rowNumber}`;
      await updateRange(sheets, spreadsheetId, rowRange, [targetRow]);

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (err) {
    console.error('API /api/sheets error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}