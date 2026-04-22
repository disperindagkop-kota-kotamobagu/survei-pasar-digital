/**
 * GOOGLE APPS SCRIPT: Otomatisasi Rekapitulasi (Aggregated Backup)
 * 
 * Pasang kode ini di editor Google Apps Script Anda.
 * Pastikan Anda sudah mengatur Trigger (Pemicu) untuk fungsi:
 * - triggerMingguan (Mingguan)
 * - triggerBulanan (Bulanan)
 */

function triggerMingguan() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName("Master");
  if (!masterSheet) return;
  
  const data = masterSheet.getDataRange().getValues();
  if (data.length <= 1) return;

  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  // Filter data 7 hari terakhir & Lakukan Penjumlahan (Aggregation)
  const summary = aggregateData(data, sevenDaysAgo, now);
  
  const dateLabel = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
  const sheetName = "Rekap-Mingguan-" + dateLabel;
  
  writeSummaryToSheet(ss, summary, sheetName, "Mingguan (7 Hari Terakhir)");
}

function triggerBulanan() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName("Master");
  if (!masterSheet) return;
  
  const data = masterSheet.getDataRange().getValues();
  if (data.length <= 1) return;

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Filter data bulan ini & Lakukan Penjumlahan (Aggregation)
  const summary = aggregateData(data, firstDayOfMonth, now);
  
  const dateLabel = Utilities.formatDate(now, "GMT+7", "yyyy-MM");
  const sheetName = "Rekap-Bulanan-" + dateLabel;
  
  writeSummaryToSheet(ss, summary, sheetName, "Rekap Bulanan " + dateLabel);
}

/**
 * Fungsi untuk menjumlahkan nominal berdasarkan Pasar
 */
function aggregateData(rows, startDate, endDate) {
  const header = rows[0];
  const dataRows = rows.slice(1);
  
  // Map untuk menyimpan { "Nama Pasar": TotalNominal }
  const totals = {};

  dataRows.forEach(row => {
    const rowDate = new Date(row[0]); // Kolom 0: Tanggal
    const market = row[2];          // Kolom 2: Pasar
    const amount = Number(row[4]);  // Kolom 4: Nominal
    
    // Cek apakah masuk dalam rentang waktu
    if (rowDate >= startDate && rowDate <= endDate) {
      if (!totals[market]) {
        totals[market] = 0;
      }
      totals[market] += amount;
    }
  });

  // Ubah object ke format Array untuk ditulis ke Sheet
  const result = [];
  for (let market in totals) {
    result.push([market, totals[market]]);
  }
  
  // Urutkan berdasarkan nominal terbesar
  result.sort((a, b) => b[1] - a[1]);
  
  return result;
}

/**
 * Fungsi untuk menulis hasil rekap ke sheet baru
 */
function writeSummaryToSheet(ss, summaryData, sheetName, title) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clear();
  }

  // Header Rekap
  const reportHeader = [
    [title],
    ["Dibuat pada: " + new Date().toLocaleString()],
    [],
    ["Nama Pasar", "Total Nominal (Penjumlahan)"]
  ];

  sheet.getRange(1, 1, reportHeader.length, reportHeader[0].length).setValues(reportHeader);
  
  if (summaryData.length > 0) {
    sheet.getRange(5, 1, summaryData.length, 2).setValues(summaryData);
    
    // Tambahkan baris total di paling bawah
    const grandTotal = summaryData.reduce((sum, row) => sum + row[1], 0);
    sheet.getRange(5 + summaryData.length, 1, 1, 2)
         .setValues([["TOTAL KESELURUHAN", grandTotal]])
         .setFontWeight("bold")
         .setBackground("#f0fdf4");
  } else {
    sheet.getRange(5, 1).setValue("Tidak ada data ditemukan untuk periode ini.");
  }

  // Styling sedikit
  sheet.getRange("A4:B4").setFontWeight("bold").setBackground("#f8fafc");
  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(2, 200);
}
