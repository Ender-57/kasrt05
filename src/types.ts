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

export interface FamilyMemberItem {
  name: string;
  nik?: string; // 16 digit NIK / No. KTP
  phone?: string; // No. HP / WhatsApp
  relation?: string; // Hubungan keluarga: Anak, Istri/Suami, Orang Tua, Mertua, Famili, ART, dll
}

export interface Resident {
  id: string;
  houseNo: string;
  name: string;
  isVacant: boolean; // Rumah kosong
  customMonthlyRate?: number; // Nominal pembayaran khusus per bulan (misal: Rp 45.000 untuk rumah No. 83)
  customRateReason?: string; // Alasan / keterangan tarif khusus (misal: "Kesepakatan Warga No. 83", "Keringanan Lansia", dll)
  discountAmount?: number; // (Opsional) Nominal potongan / diskon
  discountReason?: string; // (Opsional) Keterangan diskon
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
      adminFee?: number;
    };
  };
  phone?: string;
  notes?: string;

  // Data Kependudukan & Susunan Keluarga
  nik?: string; // Nomor KTP Kepala Keluarga (16 digit)
  kkNumber?: string; // Nomor Kartu Keluarga (16 digit)
  spouseName?: string; // Nama Istri / Suami (Pasangan)
  spouseNik?: string; // NIK Istri / Suami
  spousePhone?: string; // No. HP / WhatsApp Istri / Suami
  children?: (string | FamilyMemberItem)[]; // Daftar Nama Anak (bisa string nama atau objek dengan NIK & No. HP)
  otherFamilyMembers?: (string | FamilyMemberItem)[]; // Anggota Keluarga Lain (Orang tua, mertua, famili, dll)
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
  | 'Gaji & Honor'
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
  // Salary Management optional fields
  salaryBase?: number; // Gaji Pokok
  salaryDeduction?: number; // Potongan
  salaryDeductionType?: 'KASBON' | 'LAINNYA'; // Jenis Potongan
  salaryRecipient?: string; // Nama Penerima
  salaryMonth?: string; // Bulan Gaji
  linkedDebtId?: string; // ID piutang yang dikoneksikan
  linkedDebtIds?: string[]; // ID piutang yang dikoneksikan (multi-select)
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
  secretaryPin?: string; // Quick secretary passcode
  officers?: CommitteeOfficer[]; // Daftar Susunan Pengurus & Riwayat Masa Jabatan
  programKerjaList?: ProgramKerjaItem[];
  bankName?: string;
  bankAccountNo?: string;
  bankAccountHolder?: string;
  bankTransferNote?: string;
  defaultMonthlyRate?: number; // Besaran iuran bulanan default
  monthlyRates?: { [key in MonthKey]?: number }; // Besaran iuran warga tiap bulan (Januari - Desember)
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
  adminFee?: number;
}

export interface IncidentalDuesPayment {
  paid: boolean;
  paidAt?: string;
  receiptNo?: string;
  paymentMethod?: 'Tunai' | 'Transfer Bank' | 'QRIS RT';
  note?: string;
}

export interface IncidentalDuesProgram {
  id: string;
  title: string;
  amount: number;
  date: string;
  description?: string;
  targetResidentIds?: string[]; // ID rumah/warga yang dikenakan iuran (jika undefined/kosong = seluruh rumah berpenghuni)
  payments: {
    [residentId: string]: IncidentalDuesPayment;
  };
}

