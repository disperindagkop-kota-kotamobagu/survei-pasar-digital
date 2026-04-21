import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, amount, notes, market_name, surveyor_name, photo_base64, photo_url, created_at } = body;

    // 1. Setup Google Auth
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file']
    });

    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    let finalPhotoLink = '-';

    // 2. Upload to Google Drive if photo exists
    if (photo_base64 || photo_url) {
      try {
        const fileName = `Bukti_${market_name}_${id}.jpg`;
        let media = {};

        if (photo_base64) {
          const buffer = Buffer.from(photo_base64, 'base64');
          media = {
            mimeType: 'image/jpeg',
            body: require('stream').Readable.from(buffer),
          };
        } else if (photo_url) {
          // Fetch from Supabase URL
          const response = await fetch(photo_url);
          const arrayBuffer = await response.arrayBuffer();
          media = {
            mimeType: 'image/jpeg',
            body: require('stream').Readable.from(Buffer.from(arrayBuffer)),
          };
        }

        const driveResponse = await drive.files.create({
          requestBody: {
            name: fileName,
            parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
          },
          media: media,
          fields: 'id, webViewLink',
        });

        if (driveResponse.data.id) {
          // Make file readable to everyone (optional, depends on security needs)
          await drive.permissions.create({
            fileId: driveResponse.data.id,
            requestBody: {
              role: 'reader',
              type: 'anyone',
            },
          });
          finalPhotoLink = driveResponse.data.webViewLink || '-';
        }
      } catch (err: any) {
        console.error('Google Drive Upload Error:', err.message);
      }
    }

    // 3. Append to Google Sheets
    const dateStr = new Date(created_at).toLocaleString('id-ID');
    const values = [
      [dateStr, surveyor_name, market_name, amount, finalPhotoLink, notes || '-']
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Sheet1!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    return NextResponse.json({ success: true, driveLink: finalPhotoLink });
  } catch (error: any) {
    console.error('Recap API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
