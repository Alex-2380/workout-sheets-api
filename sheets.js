// api/sheets.js  (Node, for Vercel / Netlify functions)
// Install dependency: npm i googleapis
import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const SA = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON); // full JSON string
    const auth = new google.auth.JWT(
      SA.client_email,
      null,
      SA.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID; // set this in Vercel/Netlify

    if (req.method === 'GET') {
      // ?tab=Routines  -> reads A:E by default
      const tab = req.query.tab || 'Routines';
      const range = `${tab}!A:Z`;
      const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
      return res.json({ values: resp.data.values || [] });
    }

    if (req.method === 'POST') {
      // POST body: { tab: 'Data', row: ['Alex','STACKED',1,'ALTERNATING DUMBBELL CURL',20,1,25,'2023-09-04 00:00:00'] }
      const { tab, row } = req.body;
      if (!tab || !row) return res.status(400).json({ error: 'Missing tab or row' });

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] }
      });
      return res.json({ ok: true });
    }

    res.status(405).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
