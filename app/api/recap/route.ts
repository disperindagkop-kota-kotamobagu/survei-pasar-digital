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

    // 1.5. Dynamic Folder Management
    let marketFolderId = '';
    let typeFolderId = '';
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

    try {
      // Find or create Market folder
      const marketSearch = await drive.files.list({
        q: `name = '${market_name}' and '${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id)',
      });
      
      if (marketSearch.data.files && marketSearch.data.files.length > 0) {
        marketFolderId = marketSearch.data.files[0].id!;
      } else {
        const createMarket = await drive.files.create({
          requestBody: { name: market_name, mimeType: 'application/vnd.google-apps.folder', parents: [rootFolderId] },
          fields: 'id',
        });
        marketFolderId = createMarket.data.id!;
      }

      // Find or create Location Type subfolder
      const typeLabel = body.location_type || 'Lapak';
      const typeSearch = await drive.files.list({
        q: `name = '${typeLabel}' and '${marketFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id)',
      });

      if (typeSearch.data.files && typeSearch.data.files.length > 0) {
        typeFolderId = typeSearch.data.files[0].id!;
      } else {
        const createType = await drive.files.create({
          requestBody: { name: typeLabel, mimeType: 'application/vnd.google-apps.folder', parents: [marketFolderId] },
          fields: 'id',
        });
        typeFolderId = createType.data.id!;
      }
    } catch (folderErr: any) {
      console.error('Folder Management Error:', folderErr.message);
      typeFolderId = rootFolderId; // Fallback to root
    }

    let finalPhotoLink = '-';

    // 2. Upload to Google Drive if photo exists
    if (photo_base64 || photo_url) {
      try {
        const datePrefix = new Date(created_at).toISOString().slice(0, 10).replace(/-/g, '');
        const fileName = `${datePrefix}_${market_name}_${body.location_type || 'Lapak'}_${id}.jpg`;
        let media = {};

        if (photo_base64) {
          const buffer = Buffer.from(photo_base64, 'base64');
          media = {
            mimeType: 'image/jpeg',
            body: require('stream').Readable.from(buffer),
          };
        } else if (photo_url) {
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
            parents: [typeFolderId],
          },
          media: media,
          fields: 'id, webViewLink',
        });

        if (driveResponse.data.id) {
          await drive.permissions.create({
            fileId: driveResponse.data.id,
            requestBody: { role: 'reader', type: 'anyone' },
          });
          finalPhotoLink = driveResponse.data.webViewLink || '-';
        }
      } catch (err: any) {
        console.error('Google Drive Upload Error:', err.message);
      }
    }

    // 2.5. Update Supabase with the Drive Link
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      await supabaseAdmin
        .from('submissions')
        .update({ drive_link: finalPhotoLink })
        .eq('id', id);
    } catch (dbErr) {
      console.error('Failed to update drive_link in Supabase:', dbErr);
    }

    // 3. Append to Google Sheets
    const dateStr = new Date(created_at).toLocaleString('id-ID');
    const values = [
      [dateStr, surveyor_name, market_name, body.location_type || 'Lapak', amount, finalPhotoLink, notes || '-']
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Sheet1!A:G', // Updated range to include Type
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    return NextResponse.json({ success: true, driveLink: finalPhotoLink });
  } catch (error: any) {
    console.error('Recap API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
