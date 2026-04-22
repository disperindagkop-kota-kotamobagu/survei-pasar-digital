import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, amount, notes, market_name, surveyor_name, photo_base64, photo_url, created_at } = body;

    // 1. Setup Google Auth & Validate Key (Added robust sanitization for Vercel/Env quotes)
    let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
    const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
    
    // Bersihkan tanda kutip jika ada (sering terjadi di Vercel env)
    privateKey = privateKey.trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');

    if (!privateKey || !privateKey.includes('BEGIN PRIVATE KEY')) {
      return NextResponse.json({ success: false, error: 'Kunci Google (Private Key) tidak valid atau terpotong di Vercel.', phase: 'AUTH_VALIDATION', serviceEmail }, { status: 400 });
    }

    const auth = new google.auth.JWT({
      email: serviceEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file']
    });

    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // 1.5. Dynamic Folder Management (Hierarchical: Market > Type > Date)
    let marketFolderId = '';
    let typeFolderId = '';
    let dateFolderId = '';
    let rawFolderId = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
    
    // SMART EXTRACTOR: Jika user memasukkan URL, ambil ID-nya saja
    if (rawFolderId.includes('http')) {
      const folderMatch = rawFolderId.match(/folders\/([a-zA-Z0-9-_]+)/) || rawFolderId.match(/id=([a-zA-Z0-9-_]+)/);
      if (folderMatch && folderMatch[1]) {
        rawFolderId = folderMatch[1];
      }
    }
    const rootFolderId = rawFolderId;
    
    // Masked ID for debugging (Ambil 4 awal/akhir dari ID bersih)
    const maskedFolderId = rootFolderId ? `${rootFolderId.slice(0, 4)}...${rootFolderId.slice(-4)}` : 'TIDAK_ADA';

    if (!rootFolderId) {
      return NextResponse.json({ success: false, error: 'ID Folder Google Drive belum diisi di Vercel.', phase: 'FOLDER_MANAGEMENT' }, { status: 400 });
    }

    const now = new Date(created_at);
    const dateStrOnly = now.toLocaleDateString('id-ID').replace(/\//g, '-'); // DD-MM-YYYY

    // 1.6. Spreadsheet Setup & Smart ID Extractor
    let rawSheetId = (process.env.GOOGLE_SHEET_ID || '').trim();
    if (rawSheetId.includes('http')) {
      const sheetMatch = rawSheetId.match(/\/d\/([a-zA-Z0-9-_]+)/) || rawSheetId.match(/id=([a-zA-Z0-9-_]+)/);
      if (sheetMatch && sheetMatch[1]) {
        rawSheetId = sheetMatch[1];
      }
    }
    const spreadsheetId = rawSheetId;
    const maskedSheetId = spreadsheetId ? `${spreadsheetId.slice(0, 4)}...${spreadsheetId.slice(-4)}` : 'TIDAK_ADA';

    // 1.7. AUTO-DETECT Proxy dari Sheets (untuk Cron Job & Manual Sync)
    let finalProxyUrl = body.proxyUrl || process.env.GOOGLE_APPS_SCRIPT_URL;
    if (!finalProxyUrl && spreadsheetId) {
      try {
        const configRes = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'_CONFIG_'!A1`,
        });
        if (configRes.data.values && configRes.data.values[0]) {
          finalProxyUrl = configRes.data.values[0][0];
        }
      } catch (e) {
        // Ignored: Tab _CONFIG_ mungkin belum ada
      }
    }

    try {
      // Market Folder
      marketFolderId = await findOrCreateFolder(drive, market_name, rootFolderId);
      // Type Folder
      typeFolderId = await findOrCreateFolder(drive, body.location_type || 'Lapak', marketFolderId);
      // Date Folder
      dateFolderId = await findOrCreateFolder(drive, dateStrOnly, typeFolderId);
    } catch (folderErr: any) {
      console.error('Folder Management Error:', folderErr.message);
      const isNotFound = folderErr.message.includes('File not found') || folderErr.message.includes('not found');
      const errorMsg = isNotFound 
        ? `Folder Utama (ID: ${maskedFolderId}) tidak ditemukan atau robot belum dibagikan akses Editor.` 
        : folderErr.message;
        
      return NextResponse.json({ 
        success: false, 
        error: `Gagal mengelola folder: ${errorMsg}`, 
        phase: 'FOLDER_MANAGEMENT',
        folderId: maskedFolderId,
        serviceEmail
      }, { status: 500 });
    }

    // 2. Upload to Google Drive
    if (photo_base64 || (photo_url && photo_url !== '-')) {
      try {
        const fileDatePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
        const fileName = `${fileDatePrefix}_${market_name.replace(/\s+/g, '_')}_${(body.location_type || 'Lapak').replace(/\s+/g, '_')}_${id}.jpg`;
        const proxyUrl = finalProxyUrl;

        if (!proxyUrl) {
          throw new Error('Konfigurasi URL Proxy tidak ditemukan.');
        }

        let finalBase64 = photo_base64;
        
        if (!finalBase64 && photo_url && photo_url.startsWith('http')) {
          try {
            console.log(`[RECAP] Downloading photo from Supabase: ${photo_url}`);
            const resp = await fetch(photo_url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const arrayBuffer = await resp.arrayBuffer();
            finalBase64 = Buffer.from(arrayBuffer).toString('base64');
          } catch (fetchErr: any) {
            throw new Error(`Gagal download dari Supabase: ${fetchErr.message}`);
          }
        }

        if (finalBase64) {
          console.log(`[RECAP] Sending photo to Google Proxy: ${fileName}`);
          const proxyRes = await fetch(proxyUrl, {
            method: 'POST',
            body: JSON.stringify({
              folderId: dateFolderId,
              photo_base64: finalBase64,
              fileName: fileName
            })
          });
          
          if (!proxyRes.ok) throw new Error(`Proxy Apps Script error HTTP ${proxyRes.status}`);
          
          const proxyData = await proxyRes.json();
          if (proxyData.success) {
            finalPhotoLink = proxyData.webViewLink;
            console.log(`[RECAP] Success! Drive Link: ${finalPhotoLink}`);
          } else {
            throw new Error(`Proxy Apps Script Gagal: ${proxyData.error}`);
          }
        } else {
          console.log(`[RECAP] Photo URL present but could not be converted to Base64.`);
          finalPhotoLink = '-';
        }
      } catch (uploadErr: any) {
        console.error(`[RECAP] Drive Upload Error: ${uploadErr.message}`);
        return NextResponse.json({ 
          success: false, 
          error: `Gagal kirim foto ke Drive: ${uploadErr.message}`, 
          phase: 'DRIVE_UPLOAD', 
          serviceEmail 
        }, { status: 500 });
      }
    } else {
      console.log(`[RECAP] No photo detected (photo_base64 and photo_url are empty)`);
      finalPhotoLink = '-';
    }

    // 2.5. Update Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    await supabaseAdmin.from('submissions').update({ drive_link: finalPhotoLink }).eq('id', id);

    // 3. Multi-Tab Google Sheets Recap (DIPINDAH KE SINI AGAR LINK FOTO ADA)
    const fullDate = now.toLocaleString('id-ID');
    // Kolom H (ke-8) adalah ID Unik untuk pencegahan duplikat
    const values = [
      [fullDate, surveyor_name, market_name, body.location_type || 'Lapak', amount, finalPhotoLink, notes || '-', id]
    ];

    // FITUR: Simpan Konfigurasi ke Sheets
    if (body.saveConfig && body.proxyUrl) {
      try {
        const configTitle = '_CONFIG_';
        // Ensure sheet exists
        try {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests: [{ addSheet: { properties: { title: configTitle } } }] }
          });
        } catch (e) {} // Ignore if already exists

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${configTitle}'!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[body.proxyUrl]] },
        });
        return NextResponse.json({ 
          success: true, 
          message: 'Sync Berhasil', 
          driveLink: finalPhotoLink, 
          folderId: maskedFolderId 
        });
      } catch (e: any) {
        return NextResponse.json({ success: false, error: 'Gagal simpan konfigurasi: ' + e.message }, { status: 500 });
      }
    }

    // Helper to append and ensure tab
    const appendToSheet = async (title: string) => {
      try {
        const range = `'${title}'!A:H`;

        // 1. CEK DUPLIKAT: Cari ID di Kolom H
        try {
          const checkRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${title}'!H:H`,
          });
          const existingIds = (checkRes.data.values || []).map(row => row[0]);
          if (existingIds.includes(id)) {
            console.log(`[SKIP] Data ${id} sudah ada di tab ${title}`);
            return;
          }
        } catch (e) {
          // Abaikan error jika range tidak ditemukan (berarti tab baru)
        }

        // 2. Tambah Data (Append)
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [values[0]] },
        });
      } catch (err: any) {
        const isMissingSheet = 
          err.message.includes('not found') || 
          err.message.includes('Unable to parse range');
          
        if (isMissingSheet && !err.message.includes('Requested entity was not found')) {
          // Create Sheet
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{ addSheet: { properties: { title } } }]
            }
          });
          // Add Header (8 Kolom)
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${title}'!A1:H1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['Tanggal', 'Surveyor', 'Pasar', 'Tipe', 'Nominal', 'Foto (Drive)', 'Catatan', 'ID Transaksi']] },
          });
          // Re-append
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `'${title}'!A:H`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [values[0]] },
          });
        } else {
          throw err;
        }
      }
    };

    try {
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
    } catch (sheetErr: any) {
      return NextResponse.json({ 
        success: false, 
        error: `Gagal menulis ke Sheets: ${sheetErr.message}`, 
        phase: 'SHEETS_APPEND', 
        serviceEmail,
        sheetId: maskedSheetId
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, driveLink: finalPhotoLink, serviceEmail, sheetId: maskedSheetId });
  } catch (error: any) {
    console.error('API Error:', error);
    // Kembalikan pesan error asli agar bisa didiagnosa di dashboard
    const errorMsg = error.response?.data?.error_description || error.message || 'Unknown Error';
    return NextResponse.json({ 
      success: false, 
      error: errorMsg,
      phase: 'UNEXPECTED',
      serviceEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
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
