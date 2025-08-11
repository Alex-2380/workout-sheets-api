// api/sheets.js
const { google } = require('googleapis');

module.exports = async function (req, res) {
  try {
    const rawSA = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!rawSA) {
      return res.status(500).json({ error: 'Missing GOOGLE_SERVICE_ACCOUNT_JSON env var' });
    }

    let SA;
    try {
      SA = JSON.parse(rawSA);
    } catch (err) {
      return res.status(500).json({ error: 'Invalid GOOGLE_SERVICE_ACCOUNT_JSON (JSON.parse failed)', detail: err.message });
    }

    const auth = new google.auth.JWT(
      SA.client_email,
      null,
      SA.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    await auth.authorize();

    const sheets = google.sheets({ version: 'v4', auth });
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
    if (!SPREADSHEET_ID) return res.status(500).json({ error: 'Missing SPREADSHEET_ID env var' });

    if (req.method === 'GET') {
      const tab = (req.query.tab || 'Routines').toString();
      const range = `${tab}!A:Z`;
      const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
      return res.json({ values: resp?.data?.values || [] });
    }

    if (req.method === 'POST') {
      if (!req.body) return res.status(400).json({ error: 'Missing JSON body' });
      const { tab, row } = req.body;
      if (!tab || !Array.isArray(row)) return res.status(400).json({ error: 'Missing tab or row array in body' });

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] }
      });

      return res.json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  } catch (err) {
    console.error('API ERROR:', err);
    return res.status(500).json({ error: err.message || err.toString() });
  }
};
