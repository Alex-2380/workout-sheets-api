import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    const { tab } = req.query;
    if (!tab) {
      return res.status(400).json({ error: "Missing 'tab' query parameter" });
    }

    // Load credentials
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Replace with your real spreadsheetId
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: tab,
    });

    res.status(200).json(response.data.values);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
