import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    const { tab } = req.query;
    if (!tab) {
      return res.status(400).json({ error: "Missing 'tab' query parameter" });
    }

    // Load credentials from environment
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const client = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    );

    const sheets = google.sheets({ version: "v4", auth: client });

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: tab, // e.g. "Routines" or "Users"
    });

    const rows = result.data.values || [];
    res.status(200).json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
