// ================================================================
// SENFA 2026 — Sistem Pendaftaran Seminar & LKTII
// Google Apps Script — App.gs
// ================================================================

const SPREADSHEET_ID   = '1ZdP62DSCiYAlkdn-TH7dtGvczCp1WXobtY4RRgqNYK8';
const DRIVE_FOLDER_NAME = 'Pendaftaran Acara 2026';

// ================================================================
// ROUTER
// ================================================================

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents)
      return jsonResponse({ success: false, message: 'Request tidak valid' });

    const data = JSON.parse(e.postData.contents);
    const type = (data.type || '').toLowerCase();

    if (type === 'seminar')      return handleSeminar(data);
    if (type === 'lktii')        return handleLKTII(data);
    if (type === 'submit_paper') return handleSubmitPaper(data);

    return jsonResponse({ success: false, message: 'Tipe tidak dikenali' });
  } catch (err) {
    return jsonResponse({ success: false, message: 'Kesalahan server: ' + err.message });
  }
}

function doGet() {
  return jsonResponse({ success: true, message: 'SENFA 2026 Apps Script aktif!' });
}

// ================================================================
// SEMINAR SHEET COLUMNS (1-based)
// A  Timestamp          1
// B  Reg ID             2
// C  Nama               3
// D  Email              4
// E  WhatsApp           5
// F  Instansi           6
// G  Fakultas/Jurusan   7
// H  Status Peserta     8
// I  Kehadiran          9
// J  Kategori           10
// K  Nominal            11
// L  Bidang Minat       12
// M  Judul Paper        13
// N  Abstrak Paper      14
// O  Link File          15
// P  Nama Pemilik Rek.  16
// Q  Konfirmasi         17
// R  Link Grup WA       18
// S  Status Bayar       19  ← dropdown Unpaid/Paid
// T  Status Daftar      20  ← dropdown Pending/Verified/Rejected
// U  Invoice Sent       21
// V  Paid Email Sent    22
// ================================================================

// ================================================================
// LKTII SHEET COLUMNS (1-based)
// A  Timestamp          1
// B  Reg ID             2
// C  Nama Tim           3
// D  Jumlah Anggota     4
// E  Nama Ketua         5
// F  Email Ketua        6
// G  WA Ketua           7
// H  Instansi           8
// I  Anggota 2          9
// J  Anggota 3          10
// K  Judul Karya        11
// L  Subtema            12
// M  Abstrak Singkat    13
// N  Link Karya         14
// O  Link Surat Pern.   15
// P  Nama Pemilik Rek.  16
// Q  Konfirmasi         17
// R  Link Grup WA       18
// S  Nominal            19
// T  Status Bayar       20  ← dropdown Unpaid/Paid
// U  Status Daftar      21  ← dropdown Pending/Verified/Rejected
// V  Invoice Sent       22
// W  Paid Email Sent    23
// ================================================================

// ================================================================
// HANDLER SEMINAR
// ================================================================

function handleSeminar(data) {
  const required = ['nama','email','whatsapp','instansi','fakultas',
                    'statusPeserta','kehadiran','kategori','nominal',
                    'bidangMinat','namaPemilikRekening','linkGrupWA'];
  for (const f of required) {
    if (!data[f] || data[f].toString().trim() === '')
      return jsonResponse({ success: false, message: 'Field ' + f + ' wajib diisi' });
  }
  if (!isValidEmail(data.email))
    return jsonResponse({ success: false, message: 'Format email tidak valid' });
  if (!isValidWhatsApp(data.whatsapp))
    return jsonResponse({ success: false, message: 'Nomor WhatsApp tidak valid (10-15 digit)' });

  const ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet  = getOrCreateSheet(ss, 'Seminar');
  const config = getConfig(ss);

  if (isDuplicateEmail(sheet, data.email.trim().toLowerCase(), 4))
    return jsonResponse({ success: false, message: 'Email ini sudah terdaftar untuk Seminar' });

  const regId = generateRegistrationID(sheet, 'SEM');

  // Upload file paper jika ada (pemakalah)
  let fileLink = '';
  if (data.fileBase64 && data.fileName) {
    if (!data.fileName.toLowerCase().endsWith('.pdf'))
      return jsonResponse({ success: false, message: 'File harus berformat PDF' });
    fileLink = uploadFile(data.fileBase64, data.fileName, 'Seminar', regId + ' - ' + data.nama.trim());
  }

  const konfirmasiText = Array.isArray(data.konfirmasi) ? data.konfirmasi.join(' | ') : (data.konfirmasi || '');

  sheet.appendRow([
    new Date(),                               // A Timestamp
    regId,                                    // B Reg ID
    data.nama.trim(),                         // C Nama
    data.email.trim().toLowerCase(),          // D Email
    data.whatsapp.trim(),                     // E WhatsApp
    data.instansi.trim(),                     // F Instansi
    data.fakultas.trim(),                     // G Fakultas/Jurusan
    data.statusPeserta,                       // H Status Peserta
    data.kehadiran,                           // I Kehadiran
    data.kategori,                            // J Kategori
    Number(data.nominal) || 0,               // K Nominal
    data.bidangMinat,                         // L Bidang Minat
    (data.judulPaper  || '').trim(),          // M Judul Paper
    (data.abstrakPaper || '').trim(),         // N Abstrak Paper
    fileLink,                                 // O Link File
    data.namaPemilikRekening.trim(),          // P Nama Pemilik Rek
    konfirmasiText,                           // Q Konfirmasi
    data.linkGrupWA.trim(),                   // R Link Grup WA
    'Unpaid',                                 // S Status Bayar
    'Pending',                                // T Status Daftar
    'No',                                     // U Invoice Sent
    'No'                                      // V Paid Email Sent
  ]);

  const lastRow = sheet.getLastRow();
  _setRowDropdowns(sheet, lastRow, 'seminar');
  sendInvoiceEmailSeminar(data, regId, config);
  sheet.getRange(lastRow, 21).setValue('Yes'); // Invoice Sent
  sendAdminNotification('Seminar', data.nama, regId, data.email, data.nominal, config);

  return jsonResponse({ success: true, registrationId: regId,
    message: 'Pendaftaran Seminar berhasil! Cek email untuk invoice.' });
}

// ================================================================
// HANDLER LKTII
// ================================================================

function handleLKTII(data) {
  const required = ['namaTim','namaKetua','emailKetua','whatsappKetua','instansi',
                    'judulKarya','subtema','abstrakSingkat',
                    'namaPemilikRekening','linkGrupWA'];
  for (const f of required) {
    if (!data[f] || data[f].toString().trim() === '')
      return jsonResponse({ success: false, message: 'Field ' + f + ' wajib diisi' });
  }
  if (!data.fileBase64 || !data.fileName)
    return jsonResponse({ success: false, message: 'File abstrak/karya wajib diupload' });
  if (!data.fileName.toLowerCase().endsWith('.pdf'))
    return jsonResponse({ success: false, message: 'File karya harus berformat PDF' });
  if (!isValidEmail(data.emailKetua))
    return jsonResponse({ success: false, message: 'Format email tidak valid' });
  if (!isValidWhatsApp(data.whatsappKetua))
    return jsonResponse({ success: false, message: 'Nomor WhatsApp tidak valid (10-15 digit)' });

  const ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet  = getOrCreateSheet(ss, 'LKTII');
  const config = getConfig(ss);

  if (isDuplicateEmail(sheet, data.emailKetua.trim().toLowerCase(), 6))
    return jsonResponse({ success: false, message: 'Email ini sudah terdaftar untuk LKTII' });

  const regId   = generateRegistrationID(sheet, 'LKTII');
  const nominal = config['nominal_lktii'] || 150000;
  const folderName = regId + ' - ' + data.namaTim.trim();

  // Upload file karya
  const fileKaryaLink = uploadFile(data.fileBase64, data.fileName, 'LKTII', folderName);

  // Upload surat pernyataan orisinalitas (jika ada)
  let suratLink = '';
  if (data.suratBase64 && data.suratName) {
    suratLink = uploadFile(data.suratBase64, data.suratName, 'LKTII', folderName);
  }

  const konfirmasiText = Array.isArray(data.konfirmasi) ? data.konfirmasi.join(' | ') : (data.konfirmasi || '');

  sheet.appendRow([
    new Date(),                                  // A Timestamp
    regId,                                       // B Reg ID
    data.namaTim.trim(),                         // C Nama Tim
    data.jumlahAnggota || '2 orang',             // D Jumlah Anggota
    data.namaKetua.trim(),                       // E Nama Ketua
    data.emailKetua.trim().toLowerCase(),        // F Email Ketua
    data.whatsappKetua.trim(),                   // G WA Ketua
    data.instansi.trim(),                        // H Instansi
    (data.anggota2 || '').trim(),                // I Anggota 2
    (data.anggota3 || '').trim(),                // J Anggota 3
    data.judulKarya.trim(),                      // K Judul Karya
    data.subtema,                                // L Subtema
    data.abstrakSingkat.trim(),                  // M Abstrak Singkat
    fileKaryaLink,                               // N Link Karya
    suratLink,                                   // O Link Surat Pernyataan
    data.namaPemilikRekening.trim(),             // P Nama Pemilik Rek
    konfirmasiText,                              // Q Konfirmasi
    data.linkGrupWA.trim(),                      // R Link Grup WA
    Number(nominal),                             // S Nominal
    'Unpaid',                                    // T Status Bayar
    'Pending',                                   // U Status Daftar
    'No',                                        // V Invoice Sent
    'No'                                         // W Paid Email Sent
  ]);

  const lastRow = sheet.getLastRow();
  _setRowDropdowns(sheet, lastRow, 'lktii');
  sendInvoiceEmailLKTII(data, regId, nominal, config);
  sheet.getRange(lastRow, 22).setValue('Yes'); // Invoice Sent
  sendAdminNotification('LKTII', data.namaTim, regId, data.emailKetua, nominal, config);

  return jsonResponse({ success: true, registrationId: regId,
    message: 'Pendaftaran LKTII berhasil! Cek email untuk invoice.' });
}

// ================================================================
// HANDLER SUBMIT PAPER (pemakalah yang awal hanya upload abstrak)
// ================================================================

function handleSubmitPaper(data) {
  if (!data.regId || !data.fileBase64 || !data.fileName)
    return jsonResponse({ success: false, message: 'Reg ID dan file wajib diisi' });
  if (!data.fileName.toLowerCase().endsWith('.pdf'))
    return jsonResponse({ success: false, message: 'File harus berformat PDF' });

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, 'Seminar');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1)
    return jsonResponse({ success: false, message: 'Data tidak ditemukan' });

  // Cari baris berdasarkan Reg ID (kolom B = 2)
  const regIds = sheet.getRange(2, 2, lastRow - 1, 1).getValues().flat();
  const rowIndex = regIds.findIndex(id => id.toString().trim() === data.regId.trim());
  if (rowIndex === -1)
    return jsonResponse({ success: false, message: 'Registration ID tidak ditemukan' });

  const sheetRow = rowIndex + 2;
  const nama = sheet.getRange(sheetRow, 3).getValue();

  // Upload full paper
  const fileLink = uploadFile(data.fileBase64, data.fileName, 'Seminar', data.regId + ' - ' + nama + ' (Full Paper)');

  // Update kolom O (Link File = 15)
  sheet.getRange(sheetRow, 15).setValue(fileLink);

  return jsonResponse({ success: true, message: 'Full paper berhasil diupload!' });
}

// ================================================================
// UPLOAD FILE KE GOOGLE DRIVE
// ================================================================

function uploadFile(base64Data, fileName, subfolder, folderName) {
  // Folder utama
  let mainFolder;
  const mainIter = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  mainFolder = mainIter.hasNext() ? mainIter.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);

  // Subfolder (Seminar / LKTII)
  let subFolder;
  const subIter = mainFolder.getFoldersByName(subfolder);
  subFolder = subIter.hasNext() ? subIter.next() : mainFolder.createFolder(subfolder);

  // Folder per peserta/tim (cari dulu, buat jika belum ada)
  let targetFolder;
  const targetIter = subFolder.getFoldersByName(folderName);
  targetFolder = targetIter.hasNext() ? targetIter.next() : subFolder.createFolder(folderName);

  const decoded = Utilities.newBlob(Utilities.base64Decode(base64Data), 'application/pdf', fileName);
  const file    = targetFolder.createFile(decoded);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

// ================================================================
// GET OR CREATE SHEET + HEADER OTOMATIS
// ================================================================

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;

  sheet = ss.insertSheet(name);
  const navyBg = '#201C46', white = '#ffffff';

  if (name === 'Seminar') {
    const h = ['Timestamp','Reg ID','Nama','Email','WhatsApp','Instansi',
               'Fakultas/Jurusan','Status Peserta','Kehadiran','Kategori','Nominal',
               'Bidang Minat','Judul Paper','Abstrak Paper','Link File',
               'Nama Pemilik Rek.','Konfirmasi','Link Grup WA',
               'Status Bayar','Status Daftar','Invoice Sent','Paid Email Sent'];
    _writeHeader(sheet, h, navyBg, white);
  }

  if (name === 'LKTII') {
    const h = ['Timestamp','Reg ID','Nama Tim','Jumlah Anggota','Nama Ketua',
               'Email Ketua','WA Ketua','Instansi','Anggota 2','Anggota 3',
               'Judul Karya','Subtema','Abstrak Singkat','Link Karya',
               'Link Surat Pernyataan','Nama Pemilik Rek.','Konfirmasi','Link Grup WA',
               'Nominal','Status Bayar','Status Daftar','Invoice Sent','Paid Email Sent'];
    _writeHeader(sheet, h, navyBg, white);
  }

  return sheet;
}

function _writeHeader(sheet, headers, bg, fg) {
  const range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setFontWeight('bold').setBackground(bg).setFontColor(fg).setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  headers.forEach(function(_, i) { sheet.setColumnWidth(i + 1, 140); });
  // Lebih lebar untuk kolom teks panjang
  sheet.setColumnWidth(3, 200); // Nama / Nama Tim
  sheet.setColumnWidth(4, 200); // Email
  if (headers.length >= 13) sheet.setColumnWidth(13, 280); // Judul Paper / Abstrak
}

// ================================================================
// ONEDIT TRIGGER — Email lunas real-time
// ================================================================

function onEditTrigger(e) {
  try {
    if (!e || !e.range) return;

    const sheet     = e.range.getSheet();
    const sheetName = sheet.getName();
    if (sheetName !== 'Seminar' && sheetName !== 'LKTII') return;

    const col = e.range.getColumn();
    const row = e.range.getRow();
    if (row <= 1) return;

    const isSeminar = sheetName === 'Seminar';

    // 1-based column indices
    const COL_STATUS_BAYAR    = isSeminar ? 19 : 20;
    const COL_STATUS_DAFTAR   = isSeminar ? 20 : 21;
    const COL_PAID_EMAIL_SENT = isSeminar ? 22 : 23;
    const COL_EMAIL           = isSeminar ? 4  : 6;
    const COL_NAMA            = isSeminar ? 3  : 3;
    const COL_REG_ID          = 2;

    if (col !== COL_STATUS_BAYAR) return;

    const val = e.value || sheet.getRange(row, COL_STATUS_BAYAR).getValue();
    if (val !== 'Paid') return;

    sheet.getRange(row, COL_STATUS_DAFTAR).setValue('Verified');

    if (sheet.getRange(row, COL_PAID_EMAIL_SENT).getValue() === 'Yes') return;

    const regId = sheet.getRange(row, COL_REG_ID).getValue();
    const nama  = sheet.getRange(row, COL_NAMA).getValue();
    const email = sheet.getRange(row, COL_EMAIL).getValue();
    const config = getConfig(SpreadsheetApp.openById(SPREADSHEET_ID));

    _sendPaidConfirmationEmail(isSeminar ? 'seminar' : 'lktii', nama, regId, email, config);
    sheet.getRange(row, COL_PAID_EMAIL_SENT).setValue('Yes');

  } catch (err) {
    Logger.log('onEditTrigger error: ' + err.message);
  }
}

// ================================================================
// SETUP TRIGGER — Jalankan SEKALI
// ================================================================

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('checkAndSendPaidEmails')
    .timeBased().everyMinutes(5).create();

  ScriptApp.newTrigger('onEditTrigger')
    .forSpreadsheet(SPREADSHEET_ID).onEdit().create();

  Logger.log('✅ Trigger terpasang: checkAndSendPaidEmails (5 menit) + onEditTrigger (realtime)');
}

// ================================================================
// SETUP DROPDOWN — Jalankan SEKALI
// ================================================================

function setupDropdowns() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const bayarRule  = SpreadsheetApp.newDataValidation().requireValueInList(['Unpaid','Paid'],true).setAllowInvalid(false).build();
  const daftarRule = SpreadsheetApp.newDataValidation().requireValueInList(['Pending','Verified','Rejected'],true).setAllowInvalid(false).build();

  const sem = getOrCreateSheet(ss, 'Seminar');
  const semLast = Math.max(sem.getLastRow(), 2);
  sem.getRange(2, 19, semLast, 1).setDataValidation(bayarRule);
  sem.getRange(2, 20, semLast, 1).setDataValidation(daftarRule);

  const lkt = getOrCreateSheet(ss, 'LKTII');
  const lktLast = Math.max(lkt.getLastRow(), 2);
  lkt.getRange(2, 20, lktLast, 1).setDataValidation(bayarRule);
  lkt.getRange(2, 21, lktLast, 1).setDataValidation(daftarRule);

  Logger.log('✅ Dropdown terpasang!');
}

function _setRowDropdowns(sheet, row, type) {
  const isSeminar  = type === 'seminar';
  const colBayar   = isSeminar ? 19 : 20;
  const colDaftar  = isSeminar ? 20 : 21;
  sheet.getRange(row, colBayar).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Unpaid','Paid'],true).setAllowInvalid(false).build());
  sheet.getRange(row, colDaftar).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Pending','Verified','Rejected'],true).setAllowInvalid(false).build());
}

// ================================================================
// CEK PAID — Backup setiap 5 menit
// ================================================================

function checkAndSendPaidEmails() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const config = getConfig(ss);
  _checkSheetForPaid(getOrCreateSheet(ss,'Seminar'), 'seminar', config);
  _checkSheetForPaid(getOrCreateSheet(ss,'LKTII'),   'lktii',   config);
}

function _checkSheetForPaid(sheet, type, config) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const isSeminar = type === 'seminar';
  // 0-based
  const C_BAYAR  = isSeminar ? 18 : 19;
  const C_DAFTAR = isSeminar ? 19 : 20;
  const C_PAID   = isSeminar ? 21 : 22;
  const C_EMAIL  = isSeminar ? 3  : 5;
  const C_NAMA   = 2;
  const C_REGID  = 1;

  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row[C_BAYAR] !== 'Paid') continue;
    if (row[C_DAFTAR] !== 'Verified')
      sheet.getRange(i + 2, C_DAFTAR + 1).setValue('Verified');
    if (row[C_PAID] === 'No') {
      _sendPaidConfirmationEmail(type, row[C_NAMA], row[C_REGID], row[C_EMAIL], config);
      sheet.getRange(i + 2, C_PAID + 1).setValue('Yes');
    }
  }
}

// ================================================================
// GENERATE REGISTRATION ID
// ================================================================

function generateRegistrationID(sheet, prefix) {
  const year    = new Date().getFullYear();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return prefix + '-' + year + '-0001';

  const ids     = sheet.getRange(2, 2, lastRow - 1, 1).getValues().flat().filter(x => x !== '');
  if (!ids.length) return prefix + '-' + year + '-0001';

  const numbers = ids.map(id => parseInt(id.toString().split('-').pop())).filter(n => !isNaN(n));
  return prefix + '-' + year + '-' + (Math.max(...numbers) + 1).toString().padStart(4, '0');
}

// ================================================================
// GET CONFIG
// ================================================================

function getConfig(ss) {
  let cs = ss.getSheetByName('Config');
  if (!cs) {
    cs = ss.insertSheet('Config');
    cs.getRange(1,1,1,2).setValues([['Key','Value']]);
    cs.getRange(2,1,5,2).setValues([
      ['event_name','SENFA 2026 - Seminar Nasional Fisika dan Aplikasinya'],
      ['payment_deadline','14 Juli 2026'],
      ['admin_emails',''],
      ['nominal_lktii',150000],
      ['wa_bendahara','6289616864774']
    ]);
    cs.getRange(1,1,1,2).setFontWeight('bold').setBackground('#201C46').setFontColor('#ffffff');
  }
  const rows = cs.getDataRange().getValues();
  const cfg  = {};
  for (let i = 1; i < rows.length; i++)
    if (rows[i][0]) cfg[rows[i][0].toString().trim()] = rows[i][1];
  return cfg;
}

// ================================================================
// EMAIL INVOICE — SEMINAR
// ================================================================

function sendInvoiceEmailSeminar(data, regId, config) {
  const eventName = config['event_name'] || 'SENFA 2026';
  const deadline  = config['payment_deadline'] || '14 Juli 2026';
  const waNumber  = config['wa_bendahara'] || '6289616864774';
  const nominal   = Number(data.nominal) || 0;
  const nomFmt    = 'Rp ' + nominal.toLocaleString('id-ID');

  // Pilih QRIS berdasarkan kategori
  const qrisKey = 'qris_url_' + (data.kategori || '').toLowerCase().replace(/[\s()\/]/g,'_').replace(/_+/g,'_');
  const qrisUrl = config[qrisKey] || config['qris_url_umum'] || '';

  const waText = encodeURIComponent(
    'Halo Bendahara SENFA 2026, saya ingin konfirmasi pembayaran.\n\n' +
    'Registration ID: ' + regId + '\nNama: ' + data.nama +
    '\nKategori: ' + data.kategori + '\nNominal: ' + nomFmt + '\n\nBerikut bukti pembayaran saya:'
  );
  const waLink    = 'https://wa.me/' + waNumber + '?text=' + waText;
  const logoFisika = 'http://hifi.fmipa.unpad.ac.id/wp-content/uploads/2026/05/Logo-Fisika-Background-Putih.png';
  const logoHifi   = 'http://hifi.fmipa.unpad.ac.id/wp-content/uploads/2023/07/cropped-hifi.png';

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

<tr><td style="background:#201C46;padding:24px 32px;text-align:center;">
  <img src="${logoFisika}" height="36" style="vertical-align:middle;margin-right:6px;"/>
  <img src="${logoHifi}"   height="36" style="vertical-align:middle;"/>
  <p style="margin:10px 0 0;color:white;font-size:19px;font-weight:bold;">${eventName}</p>
  <p style="margin:4px 0 0;color:#F98F1D;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Invoice Pendaftaran Seminar</p>
</td></tr>

<tr><td style="padding:28px 32px;">
  <p style="margin:0 0 14px;font-size:15px;color:#333;">Halo <strong>${data.nama}</strong>,</p>
  <p style="margin:0 0 22px;color:#666;font-size:13px;line-height:1.6;">Terima kasih telah mendaftar <strong>SENFA 2026</strong>! Berikut detail tagihan kamu.</p>

  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:22px;">
    <tr style="background:#f8fafc;"><td colspan="2" style="padding:10px 16px;font-weight:700;font-size:11px;color:#64748b;border-bottom:1px solid #e5e7eb;letter-spacing:1px;text-transform:uppercase;">Detail Pendaftaran</td></tr>
    <tr><td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #f1f5f9;width:38%;">Registration ID</td>
        <td style="padding:10px 16px;font-weight:700;color:#201C46;font-size:13px;border-bottom:1px solid #f1f5f9;">${regId}</td></tr>
    <tr><td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #f1f5f9;">Nama</td>
        <td style="padding:10px 16px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;">${data.nama}</td></tr>
    <tr><td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #f1f5f9;">Instansi</td>
        <td style="padding:10px 16px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;">${data.instansi}</td></tr>
    <tr><td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #f1f5f9;">Kehadiran</td>
        <td style="padding:10px 16px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;">${data.kehadiran}</td></tr>
    <tr><td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #f1f5f9;">Kategori</td>
        <td style="padding:10px 16px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;">${data.kategori}</td></tr>
    <tr style="background:rgba(249,143,29,0.08);">
      <td style="padding:13px 16px;font-weight:700;font-size:14px;color:#201C46;">Total Pembayaran</td>
      <td style="padding:13px 16px;font-weight:800;font-size:19px;color:#F98F1D;">${nomFmt}</td></tr>
  </table>

  <p style="font-weight:700;margin:0 0 8px;font-size:13px;color:#201C46;">Cara Pembayaran via QRIS</p>
  <ol style="color:#555;font-size:13px;line-height:2;margin:0 0 18px;padding-left:18px;">
    <li>Scan QR Code di bawah dengan mobile banking / e-wallet</li>
    <li>Masukkan nominal: <strong>${nomFmt}</strong></li>
    <li>Simpan bukti pembayaran</li>
    <li>Kirim bukti via tombol WhatsApp di bawah</li>
  </ol>

  ${qrisUrl ? `<div style="text-align:center;margin:16px 0;"><img src="${qrisUrl}" style="max-width:190px;border:1px solid #e5e7eb;border-radius:12px;padding:8px;"/><p style="font-size:11px;color:#94a3b8;margin:6px 0 0;">Scan QR Code ini untuk membayar</p></div>` : ''}

  <div style="text-align:center;margin:20px 0;">
    <a href="${waLink}" style="display:inline-block;background:#25D366;color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;">📱 Kirim Bukti Pembayaran via WhatsApp</a>
    <p style="font-size:11px;color:#94a3b8;margin:6px 0 0;">Klik untuk langsung chat bendahara</p>
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-left:4px solid #F98F1D;border-radius:6px;margin:18px 0;">
    <tr><td style="padding:13px 16px;font-size:13px;color:#555;">
      ⚠️ <strong>Penting:</strong> Simpan Registration ID kamu: <strong style="color:#201C46;">${regId}</strong><br/>
      Batas waktu pembayaran: <strong>${deadline}</strong>
    </td></tr>
  </table>

  <p style="font-size:13px;color:#666;line-height:1.6;">Setelah pembayaran terverifikasi, kamu akan mendapat email konfirmasi lunas otomatis.</p>
</td></tr>

<tr><td style="background:#f8fafc;padding:14px 32px;border-top:1px solid #e5e7eb;text-align:center;">
  <p style="margin:0 0 3px;font-size:12px;color:#201C46;font-weight:600;">SENFA 2026 — Seminar Nasional Fisika dan Aplikasinya</p>
  <p style="margin:0 0 3px;font-size:11px;color:#94a3b8;">Department of Physics & HIFI FMIPA Universitas Padjadjaran</p>
  <p style="margin:0;font-size:11px;color:#cbd5e1;">Email ini dikirim otomatis. Mohon tidak membalas.</p>
</td></tr>

</table></td></tr></table></body></html>`;

  MailApp.sendEmail({ to: data.email, subject: '📋 [Invoice] Seminar ' + eventName + ' — ' + regId, htmlBody: html });
}

// ================================================================
// EMAIL INVOICE — LKTII
// ================================================================

function sendInvoiceEmailLKTII(data, regId, nominal, config) {
  const eventName = config['event_name'] || 'SENFA 2026';
  const deadline  = config['payment_deadline'] || '14 Juli 2026';
  const waNumber  = config['wa_bendahara'] || '6289616864774';
  const nomFmt    = 'Rp ' + Number(nominal).toLocaleString('id-ID');
  const qrisUrl   = config['qris_url_lktii'] || '';

  const waText = encodeURIComponent(
    'Halo Bendahara SENFA 2026, kami ingin konfirmasi pembayaran LKTII.\n\n' +
    'Registration ID: ' + regId + '\nNama Tim: ' + data.namaTim +
    '\nKetua: ' + data.namaKetua + '\nNominal: ' + nomFmt + '\n\nBerikut bukti pembayaran kami:'
  );
  const waLink     = 'https://wa.me/' + waNumber + '?text=' + waText;
  const logoFisika = 'http://hifi.fmipa.unpad.ac.id/wp-content/uploads/2026/05/Logo-Fisika-Background-Putih.png';
  const logoHifi   = 'http://hifi.fmipa.unpad.ac.id/wp-content/uploads/2023/07/cropped-hifi.png';

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

<tr><td style="background:#201C46;padding:24px 32px;text-align:center;">
  <img src="${logoFisika}" height="36" style="vertical-align:middle;margin-right:6px;"/>
  <img src="${logoHifi}"   height="36" style="vertical-align:middle;"/>
  <p style="margin:10px 0 0;color:white;font-size:19px;font-weight:bold;">${eventName}</p>
  <p style="margin:4px 0 0;color:#44CBA8;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Invoice Pendaftaran LKTII</p>
</td></tr>

<tr><td style="padding:28px 32px;">
  <p style="margin:0 0 14px;font-size:15px;color:#333;">Halo Tim <strong>${data.namaTim}</strong>,</p>
  <p style="margin:0 0 22px;color:#666;font-size:13px;line-height:1.6;">Pendaftaran LKTII kalian telah kami terima! Berikut detail tagihan.</p>

  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:22px;">
    <tr style="background:#f8fafc;"><td colspan="2" style="padding:10px 16px;font-weight:700;font-size:11px;color:#64748b;border-bottom:1px solid #e5e7eb;letter-spacing:1px;text-transform:uppercase;">Detail Pendaftaran</td></tr>
    <tr><td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #f1f5f9;width:38%;">Registration ID</td>
        <td style="padding:10px 16px;font-weight:700;color:#201C46;font-size:13px;border-bottom:1px solid #f1f5f9;">${regId}</td></tr>
    <tr><td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #f1f5f9;">Nama Tim</td>
        <td style="padding:10px 16px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;">${data.namaTim}</td></tr>
    <tr><td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #f1f5f9;">Ketua</td>
        <td style="padding:10px 16px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;">${data.namaKetua}</td></tr>
    <tr><td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #f1f5f9;">Judul Karya</td>
        <td style="padding:10px 16px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;">${data.judulKarya}</td></tr>
    <tr><td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #f1f5f9;">Subtema</td>
        <td style="padding:10px 16px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;">${data.subtema}</td></tr>
    <tr style="background:rgba(68,203,168,0.08);">
      <td style="padding:13px 16px;font-weight:700;font-size:14px;color:#201C46;">Total Pembayaran</td>
      <td style="padding:13px 16px;font-weight:800;font-size:19px;color:#44CBA8;">${nomFmt}</td></tr>
  </table>

  <p style="font-weight:700;margin:0 0 8px;font-size:13px;color:#201C46;">Cara Pembayaran via QRIS</p>
  <ol style="color:#555;font-size:13px;line-height:2;margin:0 0 18px;padding-left:18px;">
    <li>Scan QR Code di bawah dengan mobile banking / e-wallet</li>
    <li>Masukkan nominal: <strong>${nomFmt}</strong></li>
    <li>Simpan bukti pembayaran</li>
    <li>Kirim bukti via tombol WhatsApp di bawah</li>
  </ol>

  ${qrisUrl ? `<div style="text-align:center;margin:16px 0;"><img src="${qrisUrl}" style="max-width:190px;border:1px solid #e5e7eb;border-radius:12px;padding:8px;"/></div>` : ''}

  <div style="text-align:center;margin:20px 0;">
    <a href="${waLink}" style="display:inline-block;background:#25D366;color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;">📱 Kirim Bukti Pembayaran via WhatsApp</a>
    <p style="font-size:11px;color:#94a3b8;margin:6px 0 0;">Klik untuk langsung chat bendahara</p>
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-left:4px solid #44CBA8;border-radius:6px;margin:18px 0;">
    <tr><td style="padding:13px 16px;font-size:13px;color:#555;">
      ⚠️ <strong>Penting:</strong> Simpan Registration ID tim: <strong style="color:#201C46;">${regId}</strong><br/>
      Batas waktu pembayaran: <strong>${deadline}</strong>
    </td></tr>
  </table>

  <p style="font-size:13px;color:#666;line-height:1.6;">Setelah pembayaran terverifikasi, kalian akan mendapat email konfirmasi lunas otomatis.</p>
</td></tr>

<tr><td style="background:#f8fafc;padding:14px 32px;border-top:1px solid #e5e7eb;text-align:center;">
  <p style="margin:0 0 3px;font-size:12px;color:#201C46;font-weight:600;">SENFA 2026 — Seminar Nasional Fisika dan Aplikasinya</p>
  <p style="margin:0 0 3px;font-size:11px;color:#94a3b8;">Department of Physics & HIFI FMIPA Universitas Padjadjaran</p>
  <p style="margin:0;font-size:11px;color:#cbd5e1;">Email ini dikirim otomatis. Mohon tidak membalas.</p>
</td></tr>

</table></td></tr></table></body></html>`;

  MailApp.sendEmail({ to: data.emailKetua, subject: '📋 [Invoice] LKTII ' + eventName + ' — ' + regId, htmlBody: html });
}

// ================================================================
// EMAIL NOTIFIKASI ADMIN
// ================================================================

function sendAdminNotification(type, nama, regId, email, nominal, config) {
  const adminEmails = (config['admin_emails'] || '').toString().trim();
  if (!adminEmails) return;

  const eventName = config['event_name'] || 'SENFA 2026';
  const nomFmt    = 'Rp ' + Number(nominal).toLocaleString('id-ID');
  const sheetUrl  = 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID;

  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;color:#333;">
<div style="background:#201C46;padding:16px 20px;border-radius:8px 8px 0 0;">
  <p style="margin:0;color:white;font-weight:bold;font-size:15px;">🔔 Pendaftaran Baru — ${type}</p>
  <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:12px;">${eventName}</p>
</div>
<div style="border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;padding:20px;">
  <table width="100%">
    <tr><td style="padding:7px 0;color:#777;font-size:13px;width:130px;">Jenis</td><td style="font-weight:bold;font-size:13px;">${type}</td></tr>
    <tr><td style="padding:7px 0;color:#777;font-size:13px;">Nama</td><td style="font-size:13px;">${nama}</td></tr>
    <tr><td style="padding:7px 0;color:#777;font-size:13px;">Reg ID</td><td style="font-weight:bold;color:#201C46;font-size:13px;">${regId}</td></tr>
    <tr><td style="padding:7px 0;color:#777;font-size:13px;">Email</td><td style="font-size:13px;">${email}</td></tr>
    <tr><td style="padding:7px 0;color:#777;font-size:13px;">Nominal</td><td style="font-weight:bold;font-size:13px;">${nomFmt}</td></tr>
    <tr><td style="padding:7px 0;color:#777;font-size:13px;">Status</td><td style="color:#e65100;font-size:13px;">⏳ Menunggu Pembayaran</td></tr>
  </table>
  <div style="margin-top:18px;text-align:center;">
    <a href="${sheetUrl}" style="background:#201C46;color:white;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:13px;">Buka Google Sheets</a>
  </div>
</div></body></html>`;

  MailApp.sendEmail({ to: adminEmails, subject: '[Baru] ' + type + ' — ' + regId + ' | ' + nama, htmlBody: html });
}

// ================================================================
// EMAIL KONFIRMASI LUNAS
// ================================================================

function _sendPaidConfirmationEmail(type, nama, regId, email, config) {
  const isSeminar = type === 'seminar';
  const eventName = config['event_name'] || 'SENFA 2026';
  const typeName  = isSeminar ? 'Seminar' : 'LKTII';
  const accent    = isSeminar ? '#F98F1D' : '#44CBA8';
  const logoFisika = 'http://hifi.fmipa.unpad.ac.id/wp-content/uploads/2026/05/Logo-Fisika-Background-Putih.png';
  const logoHifi   = 'http://hifi.fmipa.unpad.ac.id/wp-content/uploads/2023/07/cropped-hifi.png';

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

<tr><td style="background:#201C46;padding:24px 32px;text-align:center;">
  <img src="${logoFisika}" height="36" style="vertical-align:middle;margin-right:6px;"/>
  <img src="${logoHifi}"   height="36" style="vertical-align:middle;"/>
  <p style="margin:10px 0 0;color:white;font-size:19px;font-weight:bold;">${eventName}</p>
  <p style="margin:4px 0 0;color:#44CBA8;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Konfirmasi Pembayaran Lunas</p>
</td></tr>

<tr><td style="padding:32px;text-align:center;">
  <div style="width:70px;height:70px;margin:0 auto 14px;background:#e8f5e9;border-radius:50%;line-height:70px;">
    <span style="font-size:34px;">✅</span>
  </div>
  <h2 style="margin:0 0 8px;color:#2e7d32;font-size:21px;font-weight:800;">Pembayaran Lunas!</h2>
  <p style="margin:0 0 24px;color:#666;font-size:13px;line-height:1.6;">Halo <strong>${nama}</strong>, pembayaran <strong>${typeName}</strong> kamu telah <strong style="color:#2e7d32;">berhasil diverifikasi</strong>.</p>

  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;text-align:left;margin-bottom:22px;">
    <tr style="background:#f8fafc;"><td colspan="2" style="padding:10px 16px;font-weight:700;font-size:11px;color:#64748b;border-bottom:1px solid #e5e7eb;letter-spacing:1px;text-transform:uppercase;">Detail Pendaftaran</td></tr>
    <tr><td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #f1f5f9;width:38%;">Registration ID</td>
        <td style="padding:10px 16px;font-weight:700;color:#201C46;font-size:13px;border-bottom:1px solid #f1f5f9;">${regId}</td></tr>
    <tr><td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #f1f5f9;">Jenis</td>
        <td style="padding:10px 16px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;">${typeName}</td></tr>
    <tr><td style="padding:10px 16px;color:#94a3b8;font-size:13px;">Status</td>
        <td style="padding:10px 16px;color:#2e7d32;font-weight:700;font-size:13px;">✅ Verified & Paid</td></tr>
  </table>

  <p style="font-size:13px;color:#666;text-align:left;line-height:1.6;">Simpan email ini sebagai <strong>bukti pendaftaran resmi</strong>. Info selanjutnya akan dikirim melalui email.</p>
</td></tr>

<tr><td style="background:#f8fafc;padding:14px 32px;border-top:1px solid #e5e7eb;text-align:center;">
  <p style="margin:0 0 3px;font-size:12px;color:#201C46;font-weight:600;">SENFA 2026 — Seminar Nasional Fisika dan Aplikasinya</p>
  <p style="margin:0 0 3px;font-size:11px;color:#94a3b8;">Department of Physics & HIFI FMIPA Universitas Padjadjaran</p>
  <p style="margin:0;font-size:11px;color:#cbd5e1;">Email ini dikirim otomatis. Mohon tidak membalas.</p>
</td></tr>

</table></td></tr></table></body></html>`;

  MailApp.sendEmail({ to: email, subject: '✅ [Lunas] ' + typeName + ' ' + eventName + ' — ' + regId, htmlBody: html });
}

// ================================================================
// HELPERS
// ================================================================

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function isValidWhatsApp(number) {
  const c = String(number).replace(/\D/g,'');
  return c.length >= 10 && c.length <= 15;
}

function isDuplicateEmail(sheet, email, colIndex) {
  const last = sheet.getLastRow();
  if (last <= 1) return false;
  return sheet.getRange(2, colIndex, last - 1, 1).getValues().flat()
    .some(e => String(e).toLowerCase().trim() === email);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
