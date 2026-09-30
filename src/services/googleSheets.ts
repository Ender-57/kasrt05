import { Resident, CashTransaction, RTProfile, MONTHS } from '../types';
import { getCleanRtRwTitle } from '../utils/formatters';

export interface SyncResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  createdAt: string;
}

export const formatRupiah = (val: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
};

export const syncToGoogleSheets = async (
  accessToken: string,
  profile: RTProfile,
  residents: Resident[],
  transactions: CashTransaction[],
  existingSpreadsheetId?: string | null
): Promise<SyncResult> => {
  let spreadsheetId = existingSpreadsheetId;
  let spreadsheetUrl = '';

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const targetSheetTitles = [
    'Iuran Warga 2026',
    'Buku Kas Transaksi',
    'Ringkasan Bulanan',
    'Data Warga & KK',
    'Visi & Program Kerja',
  ];

  // If no existing spreadsheet, create a new one with 5 sheets
  if (!spreadsheetId) {
    const title = `Buku Kas, Iuran & Program Kerja ${getCleanRtRwTitle(profile)} - Th 2026`;
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        properties: {
          title,
        },
        sheets: [
          { properties: { title: 'Iuran Warga 2026', gridProperties: { frozenRowCount: 2 } } },
          { properties: { title: 'Buku Kas Transaksi', gridProperties: { frozenRowCount: 1 } } },
          { properties: { title: 'Ringkasan Bulanan', gridProperties: { frozenRowCount: 1 } } },
          { properties: { title: 'Data Warga & KK', gridProperties: { frozenRowCount: 1 } } },
          { properties: { title: 'Visi & Program Kerja', gridProperties: { frozenRowCount: 1 } } },
        ],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.error?.message || 'Gagal membuat Google Spreadsheet baru.');
    }

    const createdData = await createRes.json();
    spreadsheetId = createdData.spreadsheetId;
    spreadsheetUrl = createdData.spreadsheetUrl;
  } else {
    spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // Fetch existing spreadsheet metadata to verify sheet tabs
    try {
      const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers,
      });
      if (getRes.ok) {
        const meta = await getRes.json();
        const existingTitles: string[] = meta.sheets?.map((s: { properties: { title: string } }) => s.properties.title) || [];
        
        const missingTitles = targetSheetTitles.filter((t) => !existingTitles.includes(t));
        if (missingTitles.length > 0) {
          const addRequests = missingTitles.map((t) => ({
            addSheet: {
              properties: {
                title: t,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          }));

          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ requests: addRequests }),
          });
        }
      }
    } catch (metaErr) {
      console.warn('Could not check or add missing sheet tabs:', metaErr);
    }
  }

  // 1. Prepare Data for Sheet "Iuran Warga 2026"
  const duesRows: (string | number)[][] = [
    [`REKAP IURAN RUTIN WARGA ${getCleanRtRwTitle(profile).toUpperCase()} TAHUN 2026`],
    [
      'NO. RMH',
      'NAMA WARGA',
      'STATUS TUNGGAKAN',
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
      'TOTAL TERBAYAR',
    ],
  ];

  residents.forEach((r) => {
    let totalPaid = 0;
    const monthCols = MONTHS.map((m) => {
      const p = r.payments[m];
      if (p && p.paid) {
        totalPaid += p.amount;
        return formatRupiah(p.amount);
      }
      return '';
    });

    const statusTunggakan = r.isVacant ? 'KOSONG' : r.arrearsAmount === 0 ? 'LUNAS' : formatRupiah(r.arrearsAmount);

    duesRows.push([
      r.houseNo,
      r.name,
      statusTunggakan,
      ...monthCols,
      formatRupiah(totalPaid),
    ]);
  });

  // 2. Prepare Data for Sheet "Buku Kas Transaksi"
  const txRows: (string | number)[][] = [
    ['NO', 'TANGGAL', 'JENIS', 'KATEGORI', 'URAIAN / KETERANGAN', 'PENERIMA / PENCATAT', 'NO BUKTI', 'MASUK', 'KELUAR', 'SALDO BERJALAN'],
  ];

  let currentBalance = 0;
  // Sort transactions by date ascending
  const sortedTx = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  sortedTx.forEach((tx, idx) => {
    const masuk = tx.type === 'MASUK' ? tx.amount : 0;
    const keluar = tx.type === 'KELUAR' ? tx.amount : 0;
    currentBalance += masuk - keluar;

    txRows.push([
      idx + 1,
      tx.date,
      tx.type,
      tx.category,
      tx.description,
      tx.recordedBy,
      tx.receiptNumber || '-',
      masuk ? formatRupiah(masuk) : '-',
      keluar ? formatRupiah(keluar) : '-',
      formatRupiah(currentBalance),
    ]);
  });

  // 3. Prepare Data for Sheet "Ringkasan Bulanan"
  const monthlyRows: (string | number)[][] = [
    ['BULAN', 'TOTAL PEMASUKAN IURAN', 'TOTAL PENGELUARAN', 'SURPLUS / DEFISIT'],
  ];

  MONTHS.forEach((m) => {
    let totalMonthDues = 0;
    residents.forEach((r) => {
      if (r.payments[m]?.paid) {
        totalMonthDues += r.payments[m]!.amount;
      }
    });

    // Match expense transactions for this month (approx based on month number)
    const monthIdx = MONTHS.indexOf(m) + 1;
    const monthStr = monthIdx < 10 ? `2026-0${monthIdx}` : `2026-${monthIdx}`;
    
    const monthExpenses = transactions
      .filter((t) => t.type === 'KELUAR' && t.date.startsWith(monthStr))
      .reduce((sum, t) => sum + t.amount, 0);

    const monthSurplus = totalMonthDues - monthExpenses;

    monthlyRows.push([
      m,
      formatRupiah(totalMonthDues),
      formatRupiah(monthExpenses),
      formatRupiah(monthSurplus),
    ]);
  });

  // 4. Prepare Data for Sheet "Data Warga & KK"
  const residentRows: (string | number)[][] = [
    [
      'NO. RMH',
      'KEPALA KELUARGA',
      'NO. KARTU KELUARGA (KK)',
      'NIK / KTP KEPALA',
      'ISTRI / PASANGAN',
      'DAFTAR NAMA ANAK',
      'KELUARGA LAIN',
      'TOTAL JIWA',
      'STATUS HUNIAN',
      'WHATSAPP',
    ],
  ];

  residents.forEach((r) => {
    const occupants = r.totalOccupants || (
      1 +
      (r.spouseName ? 1 : 0) +
      (r.children ? r.children.length : 0) +
      (r.otherFamilyMembers ? r.otherFamilyMembers.length : 0)
    );

    residentRows.push([
      r.houseNo,
      r.name,
      r.kkNumber || '-',
      r.nik || '-',
      r.spouseName || '-',
      r.children && r.children.length > 0 ? r.children.join(', ') : '-',
      r.otherFamilyMembers && r.otherFamilyMembers.length > 0 ? r.otherFamilyMembers.join(', ') : '-',
      r.isVacant ? 0 : occupants,
      r.isVacant ? 'Kosong' : r.houseStatus || 'Milik Sendiri',
      r.phone || '-',
    ]);
  });

  // 5. Prepare Data for Sheet "Visi & Program Kerja"
  const programRows: (string | number)[][] = [
    [`VISI, MISI, PROGRAM KERJA & PENGURUS RT ${profile.rtNumber || '05'} / RW ${profile.rwNumber || '08'}`],
    [`Desa ${profile.subdistrict || 'Satriajaya'}, Kec. ${profile.district || 'Tambun Utara'}, ${profile.city || 'Kab. Bekasi'}`],
    [''],
    ['--- VISI & MISI RT ---'],
    ['KATEGORI', 'URAIAN VISI & MISI'],
    ['VISI', 'Mewujudkan lingkungan RT 05 yang Aman, Bersih, Rukun, Transparan, dan Harmonis.'],
    ['MISI 1', 'Mengoptimalkan sistem keamanan dan ronda warga 24 jam.'],
    ['MISI 2', 'Menjaga kebersihan dan keasrian lingkungan secara gotong royong.'],
    ['MISI 3', 'Transparansi pengelolaan keuangan kas RT secara digital & akuntabel.'],
    [''],
    ['--- DAFTAR PROGRAM KERJA RT 05 ---'],
    ['NO', 'NAMA PROGRAM KERJA', 'DESKRIPSI & KEGIATAN'],
  ];

  const programList = profile.programKerjaList || [];
  if (programList.length === 0) {
    programRows.push(['-', 'Belum ada program kerja', 'Tidak ada program kerja aktif saat ini.']);
  } else {
    programList.forEach((prog, idx) => {
      programRows.push([idx + 1, prog.title, prog.desc]);
    });
  }

  programRows.push(['']);
  programRows.push(['--- SUSUNAN PENGURUS RT 05 ---']);
  programRows.push(['NO', 'JABATAN', 'NAMA PENGURUS', 'NO. TELEPON / WA', 'PERIODE', 'CATATAN / TUGAS']);

  const officersList = profile.officers || [];
  if (officersList.length === 0) {
    programRows.push(['1', 'Ketua RT', profile.chairpersonName || 'Ketua RT', '-', '2024 - Sekarang', 'Penanggung Jawab Utama']);
    programRows.push(['2', 'Sekretaris RT', profile.secretaryName || 'Sekretaris RT', '-', '2024 - Sekarang', 'Administrasi Warga & Surat Pengantar']);
    programRows.push(['3', 'Bendahara RT', profile.treasurerName || 'Bendahara RT', '-', '2024 - Sekarang', 'Pengelolaan Kas & Pembayaran Iuran Warga']);
  } else {
    officersList.forEach((off, idx) => {
      programRows.push([
        idx + 1,
        off.role,
        off.name,
        off.phone || '-',
        off.startPeriod || '2024-2026',
        off.notes || '-',
      ]);
    });
  }

  // Push values to Google Sheets
  const updatePayload = {
    valueInputOption: 'USER_ENTERED',
    data: [
      {
        range: "'Iuran Warga 2026'!A1:P" + duesRows.length,
        values: duesRows,
      },
      {
        range: "'Buku Kas Transaksi'!A1:J" + txRows.length,
        values: txRows,
      },
      {
        range: "'Ringkasan Bulanan'!A1:D" + monthlyRows.length,
        values: monthlyRows,
      },
      {
        range: "'Data Warga & KK'!A1:J" + residentRows.length,
        values: residentRows,
      },
      {
        range: "'Visi & Program Kerja'!A1:F" + programRows.length,
        values: programRows,
      },
    ],
  };

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(updatePayload),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.json();
    throw new Error(err.error?.message || 'Gagal menyinkronkan data ke spreadsheet.');
  }

  return {
    spreadsheetId: spreadsheetId!,
    spreadsheetUrl,
    createdAt: new Date().toISOString(),
  };
};
