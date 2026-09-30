/**
 * Mendapatkan tanggal hari ini dalam format YYYY-MM-DD menggunakan Zona Waktu Asia/Jakarta (WIB, UTC+7)
 */
export const getTodayJakarta = (): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const wibDate = new Date(utcMs + 7 * 3600000);
    const y = wibDate.getFullYear();
    const m = String(wibDate.getMonth() + 1).padStart(2, '0');
    const d = String(wibDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
};

/**
 * Format tanggal + waktu dengan locale id-ID dan Zona Waktu Asia/Jakarta (WIB)
 */
export const formatDateTimeJakarta = (date: Date = new Date(), options?: Intl.DateTimeFormatOptions): string => {
  return date.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'long',
    timeStyle: 'short',
    ...options,
  });
};

/**
 * Format tanggal saja dengan locale id-ID dan Zona Waktu Asia/Jakarta (WIB)
 */
export const formatDateJakarta = (date: Date = new Date(), options?: Intl.DateTimeFormatOptions): string => {
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'long',
    ...options,
  });
};

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
    // Menghindari masalah timezone offset dengan melakukan split jika formatnya YYYY-MM-DD
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      if (y.length === 4 && m.length === 2 && d.length === 2) {
        return `${d}-${m}-${y}`;
      }
    }
    
    // Fallback jika berupa ISO string penuh atau objek Date
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
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
  
  // Standarkan tanggal target YYYY-MM-DD (WIB / Jakarta)
  const targetDate = targetDateStr ? targetDateStr.slice(0, 10) : getTodayJakarta();
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

/**
 * Formats uploaded attachment filename into YYYYMMDD-Keterangan.ext
 * Example: 2026-09-24, "Kasbon Rosam", "image.jpeg" -> "20260924-Kasbon Rosam.jpeg"
 */
export const formatAttachmentFileName = (
  dateStr: string,
  description: string,
  originalFileName: string
): string => {
  // 1. Format date into YYYYMMDD
  let yyyymmdd = '';
  if (dateStr) {
    const cleaned = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
      yyyymmdd = cleaned.slice(0, 10).replace(/-/g, '');
    } else {
      const d = new Date(cleaned);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        yyyymmdd = `${y}${m}${day}`;
      }
    }
  }

  if (!yyyymmdd) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    yyyymmdd = `${y}${m}${day}`;
  }

  // 2. Sanitize description (remove illegal filename characters: / \ ? % * : | " < >)
  const cleanDesc = (description || 'Bukti')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ');

  // 3. Extract original file extension if present
  let ext = '';
  if (originalFileName && originalFileName.includes('.')) {
    const parts = originalFileName.split('.');
    const rawExt = parts[parts.length - 1];
    if (rawExt && rawExt.length <= 5) {
      ext = `.${rawExt.toLowerCase()}`;
    }
  }

  return `${yyyymmdd}-${cleanDesc}${ext}`;
};

/**
 * Membersihkan nama profil RT dari awalan/pengulangan RT/RW atau 'WARGA RT ...'
 * Contoh: 'RT 05 / RW 08 Satriajaya' -> 'Satriajaya'
 * Contoh: 'RT 05 / RW 08 WARGA RT 05 / RW 08' -> 'Satriajaya'
 */
export const getCleanProfileName = (profile: { rtNumber?: string; rwNumber?: string; name?: string; subdistrict?: string }): string => {
  const rt = profile.rtNumber || '05';
  const rw = profile.rwNumber || '08';
  let rawName = (profile.name || '').trim();

  // Strip repeated patterns of RT xx / RW yy or WARGA RT xx / RW yy
  rawName = rawName
    .replace(new RegExp(`^RT\\s*0*${parseInt(rt, 10) || '5'}\\s*\\/\\s*RW\\s*0*${parseInt(rw, 10) || '8'}\\s*`, 'gi'), '')
    .replace(new RegExp(`^WARGA\\s*RT\\s*0*${parseInt(rt, 10) || '5'}\\s*\\/\\s*RW\\s*0*${parseInt(rw, 10) || '8'}\\s*`, 'gi'), '')
    .replace(/^WARGA\s*RT\s*\d+\s*\/\s*RW\s*\d+\s*/gi, '')
    .replace(/^RT\s*\d+\s*\/\s*RW\s*\d+\s*/gi, '')
    .replace(/^WARGA\s*/gi, '')
    .trim();

  if (!rawName || rawName.toLowerCase() === 'rt' || rawName.toLowerCase() === 'rw') {
    return profile.subdistrict || 'Satriajaya';
  }

  return rawName;
};

/**
 * Mengembalikan judul gabungan RT/RW + Nama tanpa pengulangan kata.
 * Mengikuti instruksi user: "Hindari penggunaan kata yang berulang RT 05 / RW 08 WARGA RT 05 / RW 08, gunakan RT 05 / RW 08 saja"
 */
export const getCleanRtRwTitle = (profile: { rtNumber?: string; rwNumber?: string; name?: string; subdistrict?: string }): string => {
  const rt = profile.rtNumber || '05';
  const rw = profile.rwNumber || '08';
  const baseRtRw = `RT ${rt} / RW ${rw}`;
  const cleanName = getCleanProfileName(profile);

  if (!cleanName || cleanName.toLowerCase() === profile.subdistrict?.toLowerCase()) {
    return `${baseRtRw} ${cleanName}`.trim();
  }

  return `${baseRtRw} ${cleanName}`.trim();
};
