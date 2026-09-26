export type MonthKey =
  | 'Januari'
  | 'Februari'
  | 'Maret'
  | 'April'
  | 'Mei'
  | 'Juni'
  | 'Juli'
  | 'Agustus'
  | 'September'
  | 'Oktober'
  | 'November'
  | 'Desember';

export const MONTHS: MonthKey[] = [
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
];

export interface Resident {
  id: string;
  houseNo: string;
  name: string;
  isVacant: boolean; // Rumah kosong
  customMonthlyRate?: number; // Default: Jan-Mei 60rb, Jun-Des 70rb, unless customized (e.g. No 373 = 30rb)
  arrearsAmount: number; // Tunggakan per September
  arrearsStatusText?: string; // 'LUNAS' or nominal
  payments: {
    [key in MonthKey]?: {
      paid: boolean;
      amount: number;
      paidAt?: string;
      receiptNo?: string;
      note?: string;
      paymentMethod?: 'Tunai' | 'Transfer Bank' | 'QRIS RT';
      isCorrected?: boolean;
      correctionNote?: string;
      correctedAt?: string;
    };
  };
  phone?: string;
  notes?: string;

  // Data Kependudukan & Susunan Keluarga
  nik?: string; // Nomor KTP Kepala Keluarga (16 digit)
  kkNumber?: string; // Nomor Kartu Keluarga (16 digit)
  spouseName?: string; // Nama Istri / Suami (Pasangan)
  spouseNik?: string; // NIK Istri / Suami
  children?: string[]; // Daftar Nama Anak
  otherFamilyMembers?: string[]; // Anggota Keluarga Lain (Orang tua, mertua, famili, dll)
  houseStatus?: 'Milik Sendiri' | 'Kontrak / Sewa' | 'Kos' | 'Rumah Dinas' | 'Lainnya';
  totalOccupants?: number; // Jumlah total jiwa penghuni
}

export type TransactionType = 'MASUK' | 'KELUAR';

export type TransactionCategory =
  | 'Saldo Awal'
  | 'Iuran Warga'
  | 'Donasi / Swadaya'
  | 'Iuran RW'
  | 'Kasbon / Pinjaman'
  | 'Biaya Bank / Administrasi'
  | 'Kebersihan & Sampah'
  | 'Keamanan & Satpam'
  | 'Perbaikan & Pemeliharaan'
  | 'Listrik & Penerangan Pos'
  | 'Kegiatan Warga & HUT RI'
  | 'Sosial & Santunan Warga'
  | 'Kas & Operasional RT'
  | 'Lain-lain';

export interface CashTransaction {
  id: string;
  date: string;
  type: TransactionType;
  category: TransactionCategory;
  description: string;
  amount: number;
  recordedBy: string;
  receiptNumber?: string;
  referenceId?: string; // e.g., if linked to dues receipt
  notes?: string;
  attachmentName?: string;
  attachmentUrl?: string;
}

export interface CommitteeOfficer {
  id: string;
  role: 'Ketua RT' | 'Sekretaris' | 'Bendahara' | string; // Free text for custom sections e.g. "Seksi Keamanan", "Seksi Kebersihan", "Seksi Humas & Sosial"
  name: string;
  phone?: string;
  startPeriod: string; // YYYY-MM or YYYY-MM-DD (e.g. 2024-01)
  endPeriod?: string; // YYYY-MM or YYYY-MM-DD or empty for currently active
  isCurrent?: boolean;
  notes?: string;
}

export interface ProgramKerjaItem {
  id: string;
  title: string;
  desc: string;
  iconName?: string;
}

export interface RTProfile {
  name: string;
  rtNumber: string;
  rwNumber: string;
  subdistrict: string; // Desa
  district: string; // Kecamatan
  city: string; // Kota / Kab
  chairpersonName: string; // Ketua RT
  treasurerName: string; // Bendahara RT
  secretaryName: string; // Sekretaris RT
  adminPin: string; // Quick committee passcode
  officers?: CommitteeOfficer[]; // Daftar Susunan Pengurus & Riwayat Masa Jabatan
  programKerjaList?: ProgramKerjaItem[];
  bankName?: string;
  bankAccountNo?: string;
  bankAccountHolder?: string;
  bankTransferNote?: string;
}

export interface GoogleSyncState {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  lastSyncedAt: string | null;
  syncInProgress: boolean;
  statusMessage?: string;
}

export type DebtType = 'PIUTANG' | 'UTANG'; // PIUTANG = RT meminjamkan ke warga/pihak lain; UTANG = RT berhutang ke pihak lain
export type DebtStatus = 'BELUM_LUNAS' | 'LUNAS';

export interface DebtPaymentRecord {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface DebtItem {
  id: string;
  type: DebtType;
  personName: string;
  contact?: string;
  amount: number;
  remainingAmount: number;
  date: string;
  dueDate?: string;
  status: DebtStatus;
  notes?: string;
  paymentsHistory?: DebtPaymentRecord[];
}
