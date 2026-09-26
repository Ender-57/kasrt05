export const formatRupiah = (val: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val || 0);
};

export const formatNumber = (val: number): string => {
  return new Intl.NumberFormat('id-ID').format(val || 0);
};

export const formatPercent = (val: number, decimals: number = 2): string => {
  return (
    new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(val || 0) + '%'
  );
};

export const formatDateIndo = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

// Fungsi konversi angka ke terbilang bahasa Indonesia (resmi untuk kuitansi kas)
export const terbilang = (angka: number): string => {
  const bilangan = [
    '',
    'Satu',
    'Dua',
    'Tiga',
    'Empat',
    'Lima',
    'Enam',
    'Tujuh',
    'Delapan',
    'Sembilan',
    'Sepuluh',
    'Sebelas',
  ];

  const n = Math.abs(Math.floor(angka));

  if (n < 12) {
    return bilangan[n];
  } else if (n < 20) {
    return terbilang(n - 10) + ' Belas';
  } else if (n < 100) {
    return terbilang(Math.floor(n / 10)) + ' Puluh ' + (n % 10 !== 0 ? terbilang(n % 10) : '');
  } else if (n < 200) {
    return 'Seratus ' + (n - 100 !== 0 ? terbilang(n - 100) : '');
  } else if (n < 1000) {
    return terbilang(Math.floor(n / 100)) + ' Ratus ' + (n % 100 !== 0 ? terbilang(n % 100) : '');
  } else if (n < 2000) {
    return 'Seribu ' + (n - 1000 !== 0 ? terbilang(n - 1000) : '');
  } else if (n < 1000000) {
    return terbilang(Math.floor(n / 1000)) + ' Ribu ' + (n % 1000 !== 0 ? terbilang(n % 1000) : '');
  } else if (n < 1000000000) {
    return (
      terbilang(Math.floor(n / 1000000)) +
      ' Juta ' +
      (n % 1000000 !== 0 ? terbilang(n % 1000000) : '')
    );
  } else if (n < 1000000000000) {
    return (
      terbilang(Math.floor(n / 1000000000)) +
      ' Miliar ' +
      (n % 1000000000 !== 0 ? terbilang(n % 1000000000) : '')
    );
  }
  return n.toString();
};

export interface OfficerLookupResult {
  name: string;
  role: string;
  periodText?: string;
  isCustomPeriod?: boolean;
}

/**
 * Mendapatkan nama pejabat pengurus yang menjabat pada tanggal tertentu (sesuai periode input/bayar transaksi).
 * Jika ada riwayat pengurus dengan periode mencakup tanggal tersebut, nama pengurus dari periode tersebut yang dipakai.
 * Jika tidak ditemukan, fallback ke nama pejabat di profil utama.
 */
export const getOfficerForDate = (
  profile: {
    chairpersonName?: string;
    treasurerName?: string;
    secretaryName?: string;
    officers?: Array<{
      id: string;
      role: string;
      name: string;
      startPeriod: string;
      endPeriod?: string;
      isCurrent?: boolean;
    }>;
  },
  roleKey: 'Ketua RT' | 'Bendahara' | 'Sekretaris' | string,
  targetDateStr?: string
): OfficerLookupResult => {
  const officers = profile.officers || [];
  
  // Standarkan tanggal target YYYY-MM-DD
  const targetDate = targetDateStr ? targetDateStr.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const targetYearMonth = targetDate.slice(0, 7); // YYYY-MM

  // Normalisasi nama role
  const normRole = roleKey.trim().toLowerCase();

  // Cari di daftar officers yang cocok dengan role dan rentang waktu
  const matched = officers.find((off) => {
    const offRole = off.role.trim().toLowerCase();
    const isRoleMatch = offRole === normRole || 
      (normRole.includes('bendahara') && offRole.includes('bendahara')) ||
      (normRole.includes('ketua') && offRole.includes('ketua')) ||
      (normRole.includes('sekretaris') && offRole.includes('sekretaris'));

    if (!isRoleMatch) return false;

    // Cek periode (startPeriod format YYYY-MM atau YYYY-MM-DD)
    const start = (off.startPeriod || '').slice(0, 7);
    const end = (off.endPeriod || '').slice(0, 7);

    if (start && targetYearMonth < start) return false;
    if (end && targetYearMonth > end) return false;

    return true;
  });

  if (matched && matched.name?.trim()) {
    const startFormatted = matched.startPeriod ? formatDateIndo(matched.startPeriod) : '';
    const endFormatted = matched.endPeriod ? formatDateIndo(matched.endPeriod) : 'Sekarang';
    return {
      name: matched.name,
      role: matched.role,
      periodText: startFormatted ? `Periode ${startFormatted} - ${endFormatted}` : undefined,
      isCustomPeriod: true,
    };
  }

  // Fallback ke profil utama
  if (normRole.includes('ketua')) {
    return { name: profile.chairpersonName || '', role: 'Ketua RT' };
  }
  if (normRole.includes('bendahara')) {
    return { name: profile.treasurerName || '', role: 'Bendahara RT' };
  }
  if (normRole.includes('sekretaris')) {
    return { name: profile.secretaryName || '', role: 'Sekretaris RT' };
  }

  // Jika seksi lain dan tidak ada di list
  return { name: '-', role: roleKey };
};
