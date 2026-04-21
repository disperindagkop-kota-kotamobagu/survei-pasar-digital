import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, amount, notes, market_name, surveyor_name, photo_base64, photo_url, created_at } = body;

    // 1. Setup Google Auth & Validate Key (Added robust sanitization for Vercel/Env quotes)
    let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
    
    // Bersihkan tanda kutip jika ada (sering terjadi di Vercel env)
    privateKey = privateKey.trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');

    if (!privateKey || !privateKey.includes('BEGIN PRIVATE KEY')) {
      return NextResponse.json({ success: false, error: 'Kunci Google (Private Key) tidak valid atau terpotong di Vercel.', phase: 'AUTH_VALIDATION' }, { status: 400 });
    }

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file']
    });

    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // 1.5. Dynamic Folder Management (Hierarchical: Market > Type > Date)
    let marketFolderId = '';
    let typeFolderId = '';
    let dateFolderId = '';
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
    const now = new Date(created_at);
    const dateStrOnly = now.toLocaleDateString('id-ID').replace(/\//g, '-'); // DD-MM-YYYY

    try {
      // Market Folder
      marketFolderId = await findOrCreateFolder(drive, market_name, rootFolderId);
      // Type Folder
      typeFolderId = await findOrCreateFolder(drive, body.location_type || 'Lapak', marketFolderId);
      // Date Folder
      dateFolderId = await findOrCreateFolder(drive, dateStrOnly, typeFolderId);
    } catch (folderErr: any) {
      console.error('Folder Management Error:', folderErr.message);
      return NextResponse.json({ success: false, error: `Gagal membuat folder di Drive: ${folderErr.message}`, phase: 'FOLDER_MANAGEMENT' }, { status: 500 });
    }

    let finalPhotoLink = '-';

    // 2. Upload to Google Drive (Sekarang tanpa silent failure agar error terlihat)
    if (photo_base64 || photo_url) {
      try {
        const fileDatePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
        const fileName = `${fileDatePrefix}_${market_name}_${body.location_type || 'Lapak'}_${id}.jpg`;
        let media = {};

        if (photo_base64) {
          const buffer = Buffer.from(photo_base64, 'base64');
          media = { mimeType: 'image/jpeg', body: require('stream').Readable.from(buffer) };
        } else if (photo_url) {
          const response = await fetch(photo_url);
          if (!response.ok) {
            throw new Error(`Gagal mengambil foto dari Supabase URL (HTTP ${response.status}). Pastikan Bucket Publik.`);
          }
          const arrayBuffer = await response.arrayBuffer();
          media = { mimeType: 'image/jpeg', body: require('stream').Readable.from(Buffer.from(arrayBuffer)) };
        }

        const driveResponse = await drive.files.create({
          requestBody: { name: fileName, parents: [dateFolderId] },
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
      } catch (uploadErr: any) {
        return NextResponse.json({ success: false, error: `Gagal upload ke Drive: ${uploadErr.message}`, phase: 'DRIVE_UPLOAD' }, { status: 500 });
      }
    }

    // 2.5. Update Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    await supabaseAdmin.from('submissions').update({ drive_link: finalPhotoLink }).eq('id', id);

    // 3. Multi-Tab Google Sheets Recap
    const fullDate = now.toLocaleString('id-ID');
    const values = [
      [fullDate, surveyor_name, market_name, body.location_type || 'Lapak', amount, finalPhotoLink, notes || '-']
    ];

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    // Helper to append and ensure tab
    const appendToSheet = async (title: string) => {
      try {
        // Try to append. If fails (likely sheet not found), create it.
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${title}!A:G`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values },
        });
      } catch (err: any) {
        if (err.message.includes('not found')) {
          // Create Sheet
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{ addSheet: { properties: { title } } }]
            }
          });
          // Add Header
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${title}!A1:G1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['Tanggal', 'Surveyor', 'Pasar', 'Tipe', 'Nominal', 'Foto', 'Catatan']] },
          });
          // Re-append
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${title}!A:G`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
          });
        }
      }
    };

    // Calculate Week String (Monday Start)
    const weekStart = new Date(now);
    const day = weekStart.getDay() || 7; // Sunday=7
    weekStart.setDate(weekStart.getDate() - day + 1);
    const weekLabel = `Minggu-${weekStart.toISOString().slice(5, 10)}`;
    const monthLabel = `Bulan-${now.toISOString().slice(0, 7)}`;

    await Promise.all([
      appendToSheet('Master'),
      appendToSheet(`Harian-${dateStrOnly}`),
      appendToSheet(`Mingguan-${weekLabel}`),
      appendToSheet(`Bulanan-${monthLabel}`)
    ]);

    return NextResponse.json({ success: true, driveLink: finalPhotoLink });
  } catch (error: any) {
    console.error('API Error:', error);
    // Kembalikan pesan error asli agar bisa didiagnosa di dashboard
    const errorMsg = error.response?.data?.error_description || error.message || 'Unknown Error';
    return NextResponse.json({ 
      success: false, 
      error: errorMsg,
      details: error.response?.data || error.stack
    }, { status: 500 });
  }
}

async function findOrCreateFolder(drive: any, name: string, parentId: string) {
  const search = await drive.files.list({
    q: `name = '${name}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
  });
  if (search.data.files && search.data.files.length > 0) return search.data.files[0].id!;
  const create = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  });
  return create.data.id!;
}
