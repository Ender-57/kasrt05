import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PlusCircle,
  Search,
  Filter,
  Calendar,
  Tag,
  Edit2,
  Trash2,
  Receipt,
  FileSpreadsheet,
  CheckCircle,
  Paperclip,
  Upload,
  FileText,
  AlertTriangle,
  Copy,
  Check,
  Printer,
  Clock,
} from 'lucide-react';
import {
  CashTransaction,
  TransactionType,
  TransactionCategory,
  RTProfile,
  DebtItem,
  DebtType,
  DebtStatus,
  MONTHS,
  MonthKey,
} from '../types';
import { formatRupiah, formatDateIndo, formatAttachmentFileName, getTodayJakarta, formatDateTimeJakarta, formatDateJakarta, getCleanRtRwTitle, getCleanProfileName } from '../utils/formatters';
import { uploadFileToGoogleDrive } from '../services/googleDrive';
import { getAccessToken, googleSignIn } from '../services/auth';
import { CashReceiptModal } from './CashReceiptModal';
import { CurrencyInput } from './CurrencyInput';

type PeriodType = 'SEMUA' | 'TAHUNAN' | 'TRIWULAN' | 'BULANAN' | 'RENTANG_TANGGAL';

const MONTH_INDEX_MAP: Record<MonthKey, number> = {
  Januari: 1,
  Februari: 2,
  Maret: 3,
  April: 4,
  Mei: 5,
  Juni: 6,
  Juli: 7,
  Agustus: 8,
  September: 9,
  Oktober: 10,
  November: 11,
  Desember: 12,
};

const QUARTERS = [
  { id: 'Q1', label: 'Triwulan I (Jan - Mar)', shortLabel: 'TW I (Jan-Mar)', months: ['Januari', 'Februari', 'Maret'] as MonthKey[], startMonth: '01', endMonth: '03' },
  { id: 'Q2', label: 'Triwulan II (Apr - Jun)', shortLabel: 'TW II (Apr-Jun)', months: ['April', 'Mei', 'Juni'] as MonthKey[], startMonth: '04', endMonth: '06' },
  { id: 'Q3', label: 'Triwulan III (Jul - Sep)', shortLabel: 'TW III (Jul-Sep)', months: ['Juli', 'Agustus', 'September'] as MonthKey[], startMonth: '07', endMonth: '09' },
  { id: 'Q4', label: 'Triwulan IV (Okt - Des)', shortLabel: 'TW IV (Okt-Des)', months: ['Oktober', 'November', 'Desember'] as MonthKey[], startMonth: '10', endMonth: '12' },
];

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

interface CashbookProps {
  transactions: CashTransaction[];
  debts: DebtItem[];
  isAdmin: boolean;
  profile: RTProfile;
  onAddTransaction: (tx: Omit<CashTransaction, 'id'>) => void;
  onUpdateTransaction: (tx: CashTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  onUpdateDebts: (debts: DebtItem[]) => void;
}

const CATEGORIES: TransactionCategory[] = [
  'Saldo Awal',
  'Iuran Warga',
  'Donasi / Swadaya',
  'Iuran RW',
  'Kasbon / Pinjaman',
  'Biaya Bank / Administrasi',
  'Kebersihan & Sampah',
  'Keamanan & Satpam',
  'Perbaikan & Pemeliharaan',
  'Listrik & Penerangan Pos',
  'Kegiatan Warga & HUT RI',
  'Sosial & Santunan Warga',
  'Kas & Operasional RT',
  'Gaji & Honor',
  'Lain-lain',
];

export const Cashbook: React.FC<CashbookProps> = ({
  transactions,
  debts,
  isAdmin,
  profile,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onUpdateDebts,
}) => {
  const [activeBookTab, setActiveBookTab] = useState<'cash' | 'debts' | 'salaries'>('cash');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | TransactionCategory>('ALL');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [copiedBankNo, setCopiedBankNo] = useState(false);

  // Period filter states
  const [periodType, setPeriodType] = useState<PeriodType>('SEMUA');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>('September');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('Q3');
  const [customStartDate, setCustomStartDate] = useState<string>('2026-09-01');
  const [customEndDate, setCustomEndDate] = useState<string>('2026-09-30');

  const handleCopyBankNo = () => {
    const accountNo = profile.bankAccountNo || '1030013542580';
    navigator.clipboard.writeText(accountNo);
    setCopiedBankNo(true);
    setTimeout(() => setCopiedBankNo(false), 2000);
  };

  // Delete Confirmation States (Safe for iframe)
  const [deleteConfirmTx, setDeleteConfirmTx] = useState<{ id: string; desc: string; amount: number; type: TransactionType } | null>(null);
  const [deleteConfirmDebt, setDeleteConfirmDebt] = useState<{ id: string; name: string; amount: number; type: DebtType } | null>(null);

  // Debt Filters & States
  const [debtTypeFilter, setDebtTypeFilter] = useState<'ALL' | DebtType>('ALL');
  const [debtStatusFilter, setDebtStatusFilter] = useState<'ALL' | DebtStatus>('ALL');

  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtItem | null>(null);
  const [formDebtType, setFormDebtType] = useState<DebtType>('PIUTANG');
  const [formDebtPersonName, setFormDebtPersonName] = useState('');
  const [formDebtContact, setFormDebtContact] = useState('');
  const [formDebtAmount, setFormDebtAmount] = useState<number | ''>('');
  const [formDebtDate, setFormDebtDate] = useState(() => getTodayJakarta());
  const [formDebtDueDate, setFormDebtDueDate] = useState('');
  const [formDebtNotes, setFormDebtNotes] = useState('');
  const [formDebtAdminFee, setFormDebtAdminFee] = useState<number | ''>('');
  const [syncDebtToCashbook, setSyncDebtToCashbook] = useState(true);
  const [syncDebtAdminToCashbook, setSyncDebtAdminToCashbook] = useState(true);
  const [debtAdminFeeType, setDebtAdminFeeType] = useState<'KELUAR' | 'MASUK'>('KELUAR');

  // Repayment Modal State
  const [isRepaymentModalOpen, setIsRepaymentModalOpen] = useState(false);
  const [repayingDebt, setRepayingDebt] = useState<DebtItem | null>(null);
  const [repayAmount, setRepayAmount] = useState<number | ''>('');
  const [repayDate, setRepayDate] = useState(() => getTodayJakarta());
  const [repayNote, setRepayNote] = useState('');
  const [syncRepayToCashbook, setSyncRepayToCashbook] = useState(true);

  // Modal State for adding/editing transaction
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);

  // Digital Receipt Modal State
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<CashTransaction | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const handleOpenReceiptModal = (tx: CashTransaction) => {
    setSelectedReceiptTx(tx);
    setIsReceiptModalOpen(true);
  };

  // Form Fields
  const [formDate, setFormDate] = useState(() => getTodayJakarta());
  const [formType, setFormType] = useState<TransactionType>('KELUAR');
  const [formCategory, setFormCategory] = useState<TransactionCategory>('Kebersihan & Sampah');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formRecordedBy, setFormRecordedBy] = useState(profile.treasurerName || 'Bendahara RT');
  const [formReceiptNumber, setFormReceiptNumber] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(() => Boolean(getAccessToken()));
  const [formDriveError, setFormDriveError] = useState<string | null>(null);

  // Salary Management States
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [salaryRecipient, setSalaryRecipient] = useState('');
  const [salaryMonth, setSalaryMonth] = useState('September 2026');
  const [salaryBase, setSalaryBase] = useState<number | ''>('');
  const [salaryDeduction, setSalaryDeduction] = useState<number | ''>('');
  const [salaryDeductionType, setSalaryDeductionType] = useState<'KASBON' | 'LAINNYA'>('LAINNYA');
  const [linkedDebtId, setLinkedDebtId] = useState('');
  const [linkedDebtIds, setLinkedDebtIds] = useState<string[]>([]);
  const [salaryNotes, setSalaryNotes] = useState('');
  const [salaryDate, setSalaryDate] = useState(() => getTodayJakarta());
  const [salaryRecipientType, setSalaryRecipientType] = useState<'OFFICER' | 'MANUAL'>('OFFICER');

  const salaryTransactions = useMemo(() => {
    return transactions.filter((tx) => tx.category === 'Gaji & Honor');
  }, [transactions]);

  const salaryStats = useMemo(() => {
    let baseTotal = 0;
    let deductionTotal = 0;
    let netTotal = 0;
    
    salaryTransactions.forEach((tx) => {
      baseTotal += tx.salaryBase || tx.amount;
      deductionTotal += tx.salaryDeduction || 0;
      netTotal += tx.amount;
    });

    return {
      baseTotal,
      deductionTotal,
      netTotal,
    };
  }, [salaryTransactions]);

  const handleSaveSalary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!salaryRecipient || typeof salaryBase !== 'number' || salaryBase <= 0) return;

    const deductionAmount = Number(salaryDeduction || 0);
    const netAmount = salaryBase - deductionAmount;
    if (netAmount < 0) {
      alert('Potongan tidak boleh melebihi Gaji Pokok!');
      return;
    }

    if (salaryDeductionType === 'KASBON' && deductionAmount > 0) {
      if (linkedDebtIds.length === 0) {
        alert('Silakan pilih setidaknya satu data piutang kasbon yang akan dikoneksikan!');
        return;
      }

      // Compute total outstanding sum of selected debts
      const totalSelectedRemaining = linkedDebtIds.reduce((sum, id) => {
        const debt = debts.find(d => d.id === id);
        return sum + (debt ? debt.remainingAmount : 0);
      }, 0);

      if (deductionAmount > totalSelectedRemaining) {
        alert(`Jumlah potongan (${formatRupiah(deductionAmount)}) melebihi total kasbon terpilih (${formatRupiah(totalSelectedRemaining)})!`);
        return;
      }

      // Distribute deduction sequentially across selected debts
      let remainingDeduction = deductionAmount;
      const updatedDebts = debts.map((d) => {
        if (!linkedDebtIds.includes(d.id) || remainingDeduction <= 0) return d;

        const deductFromThis = Math.min(d.remainingAmount, remainingDeduction);
        remainingDeduction -= deductFromThis;

        const newRemaining = d.remainingAmount - deductFromThis;
        const newStatus: DebtStatus = newRemaining === 0 ? 'LUNAS' : 'BELUM_LUNAS';

        const paymentRecord = {
          id: `pay-${Date.now()}-${d.id}`,
          date: salaryDate,
          amount: deductFromThis,
          note: `Potongan otomatis Gaji ${salaryMonth} (Bagian: ${formatRupiah(deductFromThis)})`,
        };

        return {
          ...d,
          remainingAmount: newRemaining,
          status: newStatus,
          paymentsHistory: [...(d.paymentsHistory || []), paymentRecord],
        };
      });
      onUpdateDebts(updatedDebts);
    }

    // Save cash transaction KELUAR under category 'Gaji & Honor'
    onAddTransaction({
      date: salaryDate,
      type: 'KELUAR',
      category: 'Gaji & Honor',
      description: `Gaji ${salaryMonth} - ${salaryRecipient} (Pokok: ${formatRupiah(salaryBase)}${deductionAmount > 0 ? `, Potongan: ${formatRupiah(deductionAmount)}` : ''})`,
      amount: netAmount,
      recordedBy: profile.treasurerName || 'Bendahara RT',
      receiptNumber: `SLR-${Date.now().toString().slice(-6)}`,
      notes: salaryNotes,
      salaryBase,
      salaryDeduction: deductionAmount,
      salaryDeductionType: deductionAmount > 0 ? salaryDeductionType : undefined,
      salaryRecipient,
      salaryMonth,
      linkedDebtId: salaryDeductionType === 'KASBON' && deductionAmount > 0 ? linkedDebtIds[0] : undefined,
      linkedDebtIds: salaryDeductionType === 'KASBON' && deductionAmount > 0 ? linkedDebtIds : undefined,
    });

    setIsSalaryModalOpen(false);
    // Reset form
    setSalaryRecipient('');
    setSalaryBase('');
    setSalaryDeduction('');
    setSalaryDeductionType('LAINNYA');
    setLinkedDebtId('');
    setLinkedDebtIds([]);
    setSalaryNotes('');
  };

  const angkaKeTerbilang = (num: number): string => {
    const values = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
    if (num < 12) return values[num];
    if (num < 20) return angkaKeTerbilang(num - 10) + ' Belas';
    if (num < 100) return angkaKeTerbilang(Math.floor(num / 10)) + ' Puluh ' + angkaKeTerbilang(num % 10);
    if (num < 200) return 'Seratus ' + angkaKeTerbilang(num - 100);
    if (num < 1000) return angkaKeTerbilang(Math.floor(num / 100)) + ' Ratus ' + angkaKeTerbilang(num % 100);
    if (num < 2000) return 'Seribu ' + angkaKeTerbilang(num - 1000);
    if (num < 1000000) return angkaKeTerbilang(Math.floor(num / 1000)) + ' Ribu ' + angkaKeTerbilang(num % 1000);
    if (num < 1000000000) return angkaKeTerbilang(Math.floor(num / 1000000)) + ' Juta ' + angkaKeTerbilang(num % 1000000);
    return num.toString();
  };

  const drawReceiptToPng = (tx: CashTransaction): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 1480;
    canvas.height = 920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw double border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

    const fontMono = (size: number, bold = false) => `${bold ? 'bold ' : ''}${size}px "Courier New", Courier, monospace`;

    // Header Left: RT Info
    ctx.fillStyle = '#000000';
    ctx.font = fontMono(22, true);
    ctx.textAlign = 'left';
    ctx.fillText(`RT ${profile.rtNumber || '05'}`, 60, 85);

    // Header Center: Title
    ctx.font = fontMono(28, true);
    ctx.textAlign = 'center';
    ctx.fillText('KUITANSI PEMBAYARAN GAJI & HONOR', canvas.width / 2, 85);

    // Header Right: Metadata
    const receiptNo = tx.receiptNumber || `SLR-${tx.id.split('-')[1] || tx.id.slice(-6)}`;
    ctx.font = fontMono(18, false);
    ctx.textAlign = 'right';
    ctx.fillText(`No: ${receiptNo}`, canvas.width - 60, 65);
    ctx.fillText(`RT ${profile.rtNumber || '05'} / RW ${profile.rwNumber || '08'}`, canvas.width - 60, 90);
    ctx.fillText(`Desa ${profile.subdistrict || 'Satriajaya'}`, canvas.width - 60, 115);

    // Header line
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(50, 135);
    ctx.lineTo(canvas.width - 50, 135);
    ctx.stroke();

    // Content rows
    const rowStartY = 200;
    const rowSpacing = 70;
    const drawRow = (y: number, label: string, value: string, isValueBold = false) => {
      ctx.fillStyle = '#000000';
      ctx.font = fontMono(20, true);
      ctx.textAlign = 'left';
      ctx.fillText(label, 60, y);
      ctx.fillText(':', 340, y);

      ctx.font = fontMono(20, isValueBold);
      ctx.fillText(value, 370, y);

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(370, y + 8);
      ctx.lineTo(canvas.width - 60, y + 8);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    drawRow(rowStartY, 'Telah Dibayarkan Kepada', tx.salaryRecipient || tx.description, true);
    drawRow(rowStartY + rowSpacing, 'Untuk Pembayaran', `Pembayaran Gaji / Honorarium bulan ${tx.salaryMonth || 'September 2026'}`);

    const baseAmount = tx.salaryBase || tx.amount;
    const deductionAmount = tx.salaryDeduction || 0;
    let rincianText = `Gaji Pokok: ${formatRupiah(baseAmount)}`;
    if (deductionAmount > 0) {
      rincianText += ` | Potongan: -${formatRupiah(deductionAmount)} (${tx.salaryDeductionType === 'KASBON' ? 'Potong Kasbon' : 'Lainnya'})`;
    }
    drawRow(rowStartY + rowSpacing * 2, 'Rincian Pembayaran', rincianText);

    const terbilangText = `# ${angkaKeTerbilang(tx.amount)} Rupiah #`;
    drawRow(rowStartY + rowSpacing * 3, 'Terbilang', terbilangText, false);

    // Amount Box & Date
    const bottomY = 560;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(60, bottomY, 520, 80);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeRect(60, bottomY, 520, 80);

    ctx.fillStyle = '#000000';
    ctx.font = fontMono(24, true);
    ctx.textAlign = 'left';
    ctx.fillText(`JUMLAH NETTO: ${formatRupiah(tx.amount)}`, 85, bottomY + 48);

    ctx.font = fontMono(20, false);
    ctx.textAlign = 'right';
    ctx.fillText(`Tanggal Bayar: ${formatDateIndo(tx.date)}`, canvas.width - 60, bottomY + 48);

    // Signatures
    const sigY = 700;
    const colWidth = canvas.width / 3;

    const chairpersonOfficer = profile.officers?.find((o) => o.role.toLowerCase().includes('ketua'));
    const chairpersonName = chairpersonOfficer?.name || profile.chairpersonName || 'Ketua RT';
    const treasurerOfficer = profile.officers?.find((o) => o.role.toLowerCase().includes('bendahara'));
    const treasurerName = treasurerOfficer?.name || profile.treasurerName || 'Bendahara RT';
    const receiverName = (tx.salaryRecipient || '').split(' (')[0];

    const drawSignature = (colIndex: number, title1: string, title2: string, name: string) => {
      const centerX = colIndex * colWidth + colWidth / 2;
      ctx.textAlign = 'center';

      ctx.fillStyle = '#000000';
      ctx.font = fontMono(18, false);
      ctx.fillText(title1, centerX, sigY);
      ctx.font = fontMono(18, true);
      ctx.fillText(title2, centerX, sigY + 25);

      ctx.font = fontMono(18, true);
      ctx.fillText(name, centerX, sigY + 130);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      ctx.beginPath();
      const textWidth = ctx.measureText(name).width;
      ctx.moveTo(centerX - textWidth / 2 - 10, sigY + 138);
      ctx.lineTo(centerX + textWidth / 2 + 10, sigY + 138);
      ctx.stroke();
    };

    drawSignature(0, 'Mengetahui,', `Ketua RT ${profile.rtNumber || '05'}`, chairpersonName);
    drawSignature(1, 'Yang Membayar,', 'Bendahara RT', treasurerName);
    drawSignature(2, 'Penerima,', '', receiverName);

    return canvas.toDataURL('image/png');
  };

  const handlePrintSalaryReceipt = (tx: CashTransaction) => {
    try {
      const dataUrl = drawReceiptToPng(tx);
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`
          <html>
            <head>
              <title>KUITANSI GAJI - ${tx.salaryRecipient || tx.description}</title>
              <style>
                body {
                  margin: 0;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  background-color: #f1f5f9;
                  font-family: system-ui, -apple-system, sans-serif;
                  padding: 20px;
                  min-height: 100vh;
                  box-sizing: border-box;
                }
                .container {
                  background: white;
                  padding: 24px;
                  border-radius: 16px;
                  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
                  text-align: center;
                  max-width: 780px;
                  width: 100%;
                  box-sizing: border-box;
                }
                img {
                  max-width: 100%;
                  height: auto;
                  border: 1px solid #e2e8f0;
                  border-radius: 8px;
                  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
                }
                .btn-group {
                  margin-top: 20px;
                  display: flex;
                  gap: 12px;
                  justify-content: center;
                }
                .btn {
                  padding: 10px 20px;
                  font-size: 13px;
                  font-weight: 600;
                  border-radius: 10px;
                  cursor: pointer;
                  border: none;
                  transition: all 0.2s;
                  text-decoration: none;
                  display: inline-flex;
                  align-items: center;
                  gap: 6px;
                }
                .btn-primary {
                  background-color: #0f172a;
                  color: white;
                }
                .btn-primary:hover {
                  background-color: #1e293b;
                }
                .btn-secondary {
                  background-color: #f1f5f9;
                  color: #0f172a;
                  border: 1px solid #e2e8f0;
                }
                .btn-secondary:hover {
                  background-color: #e2e8f0;
                }
                @media print {
                  .btn-group, h3, p {
                    display: none !important;
                  }
                  body {
                    background: none;
                    padding: 0;
                    min-height: auto;
                  }
                  .container {
                    box-shadow: none;
                    padding: 0;
                    max-width: 100%;
                  }
                  img {
                    border: none;
                    box-shadow: none;
                    width: 100%;
                  }
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h3 style="margin: 0 0 6px 0; color: #0f172a; font-size: 16px; font-weight: 700;">Kuitansi Pembayaran Gaji</h3>
                <p style="font-size: 12px; color: #64748b; margin: 0 0 20px 0;">Format PNG siap cetak. Gunakan tombol di bawah atau klik kanan gambar untuk menyimpan.</p>
                <img src="${dataUrl}" alt="Kuitansi Gaji" />
                <div class="btn-group">
                  <button class="btn btn-primary" onclick="window.print()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-printer"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>
                    Cetak Kuitansi (PDF)
                  </button>
                  <a href="${dataUrl}" download="Kuitansi_Gaji_${(tx.salaryRecipient || 'Penerima').replace(/\s+/g, '_')}_${tx.salaryMonth || ''}.png" class="btn btn-secondary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    Unduh Gambar PNG
                  </a>
                </div>
              </div>
            </body>
          </html>
        `);
        win.document.close();
      } else {
        alert('Gagal membuka jendela baru. Pastikan pop-up diperbolehkan.');
      }
    } catch (err) {
      console.error('Failed to generate PNG receipt:', err);
      alert('Gagal membuat gambar kuitansi.');
    }
  };

  useEffect(() => {
    setIsDriveConnected(Boolean(getAccessToken()));
    setFormDriveError(null);
  }, [isModalOpen]);

  const handleConnectGoogleDrive = async () => {
    try {
      setIsUploadingDrive(true);
      setUploadStatus('Menghubungkan Akun Google...');
      const res = await googleSignIn();
      if (res?.accessToken) {
        setIsDriveConnected(true);
        setFormDriveError(null);
      }
    } catch (err: unknown) {
      console.warn('Google connection error:', err);
      setFormDriveError(
        'Gagal menghubungkan Google: ' +
          (err instanceof Error ? err.message : 'Dibatalkan')
      );
    } finally {
      setIsUploadingDrive(false);
      setUploadStatus('');
    }
  };

  // Calculate Running Balance across all transactions sorted chronologically
  const processedTransactions = useMemo(() => {
    // Sort chronologically ascending to compute running balance exactly as in Google Sheet
    const sorted = [...transactions].sort((a, b) => {
      const cmpDate = a.date.localeCompare(b.date);
      if (cmpDate !== 0) return cmpDate;
      return a.id.localeCompare(b.id);
    });

    let runningBalance = 0;

    const withBalance = sorted.map((tx, idx) => {
      if (tx.type === 'MASUK') {
        runningBalance += tx.amount;
      } else {
        runningBalance -= tx.amount;
      }
      return {
        ...tx,
        seqNumber: idx + 1,
        balanceAfter: runningBalance,
      };
    });

    if (sortOrder === 'desc') {
      return [...withBalance].reverse();
    }
    return withBalance;
  }, [transactions, sortOrder]);

  // Overall totals
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach((tx) => {
      if (tx.type === 'MASUK') income += tx.amount;
      else expense += tx.amount;
    });
    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [transactions]);

  // Filtered totals based on active period filter
  const filteredTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    
    processedTransactions.forEach((tx) => {
      let matchesPeriod = true;
      if (periodType === 'TAHUNAN') {
        matchesPeriod = tx.date.startsWith(selectedYear);
      } else if (periodType === 'BULANAN') {
        const mIndex = MONTH_INDEX_MAP[selectedMonth];
        const prefix = `${selectedYear}-${mIndex < 10 ? `0${mIndex}` : mIndex}`;
        matchesPeriod = tx.date.startsWith(prefix);
      } else if (periodType === 'TRIWULAN') {
        const q = QUARTERS.find((item) => item.id === selectedQuarter);
        if (q) {
          const txMonth = tx.date.slice(5, 7);
          matchesPeriod = tx.date.startsWith(selectedYear) && txMonth >= q.startMonth && txMonth <= q.endMonth;
        }
      } else if (periodType === 'RENTANG_TANGGAL') {
        matchesPeriod = (!customStartDate || tx.date >= customStartDate) && (!customEndDate || tx.date <= customEndDate);
      }

      if (matchesPeriod) {
        if (tx.type === 'MASUK') income += tx.amount;
        else expense += tx.amount;
      }
    });

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [processedTransactions, periodType, selectedYear, selectedMonth, selectedQuarter, customStartDate, customEndDate]);

  // Filtered view for the table
  const filteredTransactions = useMemo(() => {
    return processedTransactions.filter((tx) => {
      // 1. Period Type Filter (Time Range & Period)
      if (periodType === 'TAHUNAN') {
        if (!tx.date.startsWith(selectedYear)) return false;
      } else if (periodType === 'BULANAN') {
        const mIndex = MONTH_INDEX_MAP[selectedMonth];
        const prefix = `${selectedYear}-${mIndex < 10 ? `0${mIndex}` : mIndex}`;
        if (!tx.date.startsWith(prefix)) return false;
      } else if (periodType === 'TRIWULAN') {
        const q = QUARTERS.find((item) => item.id === selectedQuarter);
        if (q) {
          const txMonth = tx.date.slice(5, 7);
          const isMatch = tx.date.startsWith(selectedYear) && txMonth >= q.startMonth && txMonth <= q.endMonth;
          if (!isMatch) return false;
        }
      } else if (periodType === 'RENTANG_TANGGAL') {
        if (customStartDate && tx.date < customStartDate) return false;
        if (customEndDate && tx.date > customEndDate) return false;
      }

      // 2. Search, Type, and Category Filters
      const matchSearch =
        tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.receiptNumber && tx.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        tx.category.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
      if (categoryFilter !== 'ALL' && tx.category !== categoryFilter) return false;

      return true;
    });
  }, [processedTransactions, searchTerm, typeFilter, categoryFilter, periodType, selectedYear, selectedMonth, selectedQuarter, customStartDate, customEndDate]);

  const handlePrintCashbook = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Gagal membuka jendela cetak. Pastikan browser Anda tidak memblokir pop-up.');
      return;
    }

    const itemsToPrint = filteredTransactions.slice().reverse(); // Sort chronologically ascending for standard ledger printing
    const rows = itemsToPrint.map((tx, idx) => {
      const isMasuk = tx.type === 'MASUK';
      const masukText = isMasuk ? formatRupiah(tx.amount) : '-';
      const keluarText = !isMasuk ? formatRupiah(tx.amount) : '-';
      return `
        <tr>
          <td style="border: 1px solid #94a3b8; padding: 6px; font-size: 10px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #94a3b8; padding: 6px; font-size: 10px; text-align: center; font-family: monospace;">${formatDateIndo(tx.date)}</td>
          <td style="border: 1px solid #94a3b8; padding: 6px; font-size: 10px; font-weight: bold; color: #0f172a;">${tx.description}</td>
          <td style="border: 1px solid #94a3b8; padding: 6px; font-size: 10px; text-align: center;"><span style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: bold; text-transform: uppercase;">${tx.category}</span></td>
          <td style="border: 1px solid #94a3b8; padding: 6px; font-size: 10px; text-align: right; font-weight: bold; color: #059669;">${masukText}</td>
          <td style="border: 1px solid #94a3b8; padding: 6px; font-size: 10px; text-align: right; font-weight: bold; color: #dc2626;">${keluarText}</td>
          <td style="border: 1px solid #94a3b8; padding: 6px; font-size: 10px; text-align: right; font-family: monospace; font-weight: bold; background-color: #f8fafc;">${formatRupiah(tx.balanceAfter || 0)}</td>
        </tr>
      `;
    }).join('');

    const periodLabel = periodType === 'BULANAN' ? `Bulan ${selectedMonth} ${selectedYear}` :
                        periodType === 'TRIWULAN' ? `Periode ${selectedQuarter} (${selectedYear})` :
                        periodType === 'TAHUNAN' ? `Tahun ${selectedYear}` :
                        periodType === 'RENTANG_TANGGAL' ? `Rentang ${formatDateIndo(customStartDate)} s.d. ${formatDateIndo(customEndDate)}` :
                        'Semua Riwayat Transaksi';

    const timestamp = formatDateTimeJakarta(new Date());
    const treasurerOfficer = profile.officers?.find((o) => o.role.toLowerCase().includes('bendahara'));
    const treasurerName = treasurerOfficer?.name || profile.treasurerName || 'Bendahara RT';
    const chairpersonOfficer = profile.officers?.find((o) => o.role.toLowerCase().includes('ketua'));
    const chairpersonName = chairpersonOfficer?.name || profile.chairpersonName || 'Ketua RT';

    printWindow.document.write(`
      <html>
        <head>
          <title>BUKU KAS RT ${profile.rtNumber} - ${periodLabel}</title>
          <style>
            @media print {
              @page {
                size: A4 portrait;
                margin: 15mm 12mm;
              }
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
            body {
              font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 0;
              font-size: 11px;
              background-color: #ffffff;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 3px double #1e293b;
              padding-bottom: 12px;
            }
            .header h1 {
              margin: 0 0 2px 0;
              font-size: 18px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #0f172a;
            }
            .header p {
              margin: 0;
              font-size: 11px;
              color: #475569;
              font-weight: 500;
            }
            .report-meta {
              display: flex;
              justify-content: space-between;
              margin-bottom: 15px;
              font-size: 10px;
              font-weight: 600;
              color: #334155;
              background-color: #f8fafc;
              padding: 8px 12px;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
            }
            th {
              background-color: #047857;
              color: #ffffff;
              font-weight: bold;
              text-align: center;
              text-transform: uppercase;
              font-size: 9px;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .totals-row td {
              font-weight: bold;
              background-color: #f1f5f9;
              border-top: 2px solid #1e293b;
            }
            .footer-notes {
              display: flex;
              justify-content: space-between;
              margin-top: 35px;
              page-break-inside: avoid;
            }
            .signature-block {
              text-align: center;
              width: 220px;
            }
            .signature-space {
              height: 45px;
            }
            .signature-name {
              font-weight: 700;
              border-bottom: 1.5px solid #1e293b;
              display: inline-block;
              padding: 0 15px;
              margin: 0;
              color: #0f172a;
            }
            .system-note {
              text-align: center;
              font-size: 8px;
              color: #94a3b8;
              margin-top: 30px;
              border-top: 1px dashed #cbd5e1;
              padding-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${getCleanRtRwTitle(profile).toUpperCase()}</h1>
            <p>Desa ${profile.subdistrict}, Kec. ${profile.district}, ${profile.city}, Jawa Barat</p>
            <h2 style="margin: 8px 0 0 0; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; color: #0f172a; text-transform: uppercase;">BUKU KAS OPERASIONAL RT</h2>
          </div>
          
          <div class="report-meta">
            <div>Periode Laporan: <span style="color: #1e3a8a; font-weight: bold;">${periodLabel}</span></div>
            <div>Pemasukan: <span style="color: #059669; font-weight: bold;">${formatRupiah(filteredTotals.income)}</span></div>
            <div>Pengeluaran: <span style="color: #dc2626; font-weight: bold;">${formatRupiah(filteredTotals.expense)}</span></div>
            <div>Tanggal Cetak: <span>${timestamp}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="border: 1px solid #94a3b8; padding: 6px; width: 35px; text-align: center;">NO</th>
                <th style="border: 1px solid #94a3b8; padding: 6px; width: 80px; text-align: center;">TANGGAL</th>
                <th style="border: 1px solid #94a3b8; padding: 6px; text-align: left;">URAIAN KETERANGAN</th>
                <th style="border: 1px solid #94a3b8; padding: 6px; width: 120px; text-align: center;">KATEGORI</th>
                <th style="border: 1px solid #94a3b8; padding: 6px; width: 100px; text-align: right;">PEMASUKAN</th>
                <th style="border: 1px solid #94a3b8; padding: 6px; width: 100px; text-align: right;">PENGELUARAN</th>
                <th style="border: 1px solid #94a3b8; padding: 6px; width: 110px; text-align: right;">SALDO AKHIR</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              <tr class="totals-row">
                <td colspan="4" style="border: 1px solid #94a3b8; padding: 6px; text-align: right; font-weight: bold;">JUMLAH PERIODE INI:</td>
                <td style="border: 1px solid #94a3b8; padding: 6px; text-align: right; font-weight: bold; color: #059669;">${formatRupiah(filteredTotals.income)}</td>
                <td style="border: 1px solid #94a3b8; padding: 6px; text-align: right; font-weight: bold; color: #dc2626;">${formatRupiah(filteredTotals.expense)}</td>
                <td style="border: 1px solid #94a3b8; padding: 6px; text-align: right; font-weight: bold; background-color: #e2e8f0;">${formatRupiah(filteredTotals.balance)}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer-notes">
            <div class="signature-block">
              <p style="margin: 0 0 8px 0; font-size: 10px; color: #475569;">Mengetahui,</p>
              <p style="margin: 0 0 10px 0; font-size: 10px; color: #475569; font-weight: 600;">Ketua RT ${profile.rtNumber},</p>
              <div class="signature-space"></div>
              <p class="signature-name">${chairpersonName}</p>
            </div>
            
            <div class="signature-block">
              <p style="margin: 0 0 2px 0; font-size: 10px; color: #475569;">${profile.city}, ${formatDateJakarta(new Date())}</p>
              <p style="margin: 0 0 10px 0; font-size: 10px; color: #475569; font-weight: 600;">Bendahara Pengurus RT,</p>
              <div class="signature-space"></div>
              <p class="signature-name">${treasurerName}</p>
            </div>
          </div>

          <div class="system-note">
            Laporan Buku Kas resmi warga RT. Dicatat secara transparan, otomatis, dan real-time di Aplikasi Buku Kas RT.
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const debtTotals = useMemo(() => {
    let totalPiutangBelumLunas = 0;
    let totalUtangBelumLunas = 0;
    debts.forEach((d) => {
      if (d.status === 'BELUM_LUNAS') {
        if (d.type === 'PIUTANG') totalPiutangBelumLunas += d.remainingAmount;
        else if (d.type === 'UTANG') totalUtangBelumLunas += d.remainingAmount;
      }
    });
    return { totalPiutangBelumLunas, totalUtangBelumLunas };
  }, [debts]);

  const filteredDebts = useMemo(() => {
    return debts.filter((d) => {
      const matchType = debtTypeFilter === 'ALL' || d.type === debtTypeFilter;
      const matchStatus = debtStatusFilter === 'ALL' || d.status === debtStatusFilter;
      const matchSearch =
        d.personName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.notes && d.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchType && matchStatus && matchSearch;
    });
  }, [debts, debtTypeFilter, debtStatusFilter, searchTerm]);

  const handleOpenDebtModal = (debt?: DebtItem) => {
    if (debt) {
      setEditingDebt(debt);
      setFormDebtType(debt.type);
      setFormDebtPersonName(debt.personName);
      setFormDebtContact(debt.contact || '');
      setFormDebtAmount(debt.adminFee ? debt.amount - debt.adminFee : debt.amount);
      setFormDebtDate(debt.date);
      setFormDebtDueDate(debt.dueDate || '');
      setFormDebtNotes(debt.notes || '');
      setFormDebtAdminFee(debt.adminFee || '');
      setSyncDebtToCashbook(false);
      setSyncDebtAdminToCashbook(false);
      setDebtAdminFeeType('KELUAR');
    } else {
      setEditingDebt(null);
      setFormDebtType('PIUTANG');
      setFormDebtPersonName('');
      setFormDebtContact('');
      setFormDebtAmount('');
      setFormDebtDate(getTodayJakarta());
      setFormDebtDueDate('');
      setFormDebtNotes('');
      setFormDebtAdminFee('');
      setSyncDebtToCashbook(true);
      setSyncDebtAdminToCashbook(true);
      setDebtAdminFeeType('KELUAR');
    }
    setIsDebtModalOpen(true);
  };

  const handleSaveDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDebtPersonName || typeof formDebtAmount !== 'number' || formDebtAmount <= 0) return;

    const numericAdminFee = formDebtAdminFee ? Number(formDebtAdminFee) : 0;
    const finalAmount = formDebtAmount + numericAdminFee;

    if (editingDebt) {
      const updated = debts.map((d) => {
        if (d.id !== editingDebt.id) return d;
        const diff = finalAmount - d.amount;
        const newRemaining = Math.max(0, d.remainingAmount + diff);
        return {
          ...d,
          type: formDebtType,
          personName: formDebtPersonName,
          contact: formDebtContact,
          amount: finalAmount,
          remainingAmount: newRemaining,
          date: formDebtDate,
          dueDate: formDebtDueDate,
          status: newRemaining === 0 ? ('LUNAS' as DebtStatus) : ('BELUM_LUNAS' as DebtStatus),
          notes: formDebtNotes,
          adminFee: numericAdminFee > 0 ? numericAdminFee : undefined,
        };
      });
      onUpdateDebts(updated);
    } else {
      const newDebtId = `debt-${Date.now()}`;
      const newDebt: DebtItem = {
        id: newDebtId,
        type: formDebtType,
        personName: formDebtPersonName,
        contact: formDebtContact,
        amount: finalAmount,
        remainingAmount: finalAmount,
        date: formDebtDate,
        dueDate: formDebtDueDate,
        status: 'BELUM_LUNAS',
        notes: formDebtNotes,
        paymentsHistory: [],
        adminFee: numericAdminFee > 0 ? numericAdminFee : undefined,
      };
      onUpdateDebts([newDebt, ...debts]);

      // Sync Main Debt to Cashbook
      if (syncDebtToCashbook) {
        const mainTxType = formDebtType === 'PIUTANG' ? 'KELUAR' : 'MASUK';
        const mainReceiptNo = `DBT-${Date.now().toString().slice(-6)}`;
        onAddTransaction({
          date: formDebtDate,
          type: mainTxType,
          category: 'Kasbon / Pinjaman',
          description: `${formDebtType === 'PIUTANG' ? 'Pemberian Pinjaman (Piutang)' : 'Penerimaan Pinjaman (Utang)'} Baru - ${formDebtPersonName}${formDebtNotes ? ` (${formDebtNotes})` : ''}`,
          amount: formDebtAmount,
          recordedBy: profile.treasurerName || 'Bendahara RT',
          receiptNumber: mainReceiptNo,
        });
      }

      // Sync Admin Fee to Cashbook
      if (numericAdminFee > 0 && syncDebtAdminToCashbook) {
        const adminReceiptNo = `ADM-${Date.now().toString().slice(-6)}`;
        setTimeout(() => {
          onAddTransaction({
            date: formDebtDate,
            type: debtAdminFeeType,
            category: 'Biaya Bank / Administrasi',
            description: `Biaya Admin Transaksi - ${formDebtType === 'PIUTANG' ? 'Piutang' : 'Utang'} - ${formDebtPersonName}`,
            amount: numericAdminFee,
            recordedBy: profile.treasurerName || 'Bendahara RT',
            receiptNumber: adminReceiptNo,
          });
        }, 100);
      }
    }
    setIsDebtModalOpen(false);
  };

  const handleDeleteDebt = (debt: DebtItem) => {
    setDeleteConfirmDebt({
      id: debt.id,
      name: debt.personName,
      amount: debt.remainingAmount || debt.amount,
      type: debt.type,
    });
  };

  const confirmDeleteDebt = () => {
    if (deleteConfirmDebt) {
      onUpdateDebts(debts.filter((d) => d.id !== deleteConfirmDebt.id));
      setDeleteConfirmDebt(null);
    }
  };

  const handleOpenRepaymentModal = (debt: DebtItem) => {
    setRepayingDebt(debt);
    setRepayAmount(debt.remainingAmount);
    setRepayDate(getTodayJakarta());
    setRepayNote(`Pelunasan / cicilan ${debt.type === 'PIUTANG' ? 'piutang' : 'utang'} ${debt.personName}`);
    setSyncRepayToCashbook(true);
    setIsRepaymentModalOpen(true);
  };

  const handleSubmitRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayingDebt || typeof repayAmount !== 'number' || repayAmount <= 0) return;

    const newRemaining = Math.max(0, repayingDebt.remainingAmount - repayAmount);
    const newStatus: DebtStatus = newRemaining === 0 ? 'LUNAS' : 'BELUM_LUNAS';

    const paymentRecord = {
      id: `pay-${Date.now()}`,
      date: repayDate,
      amount: repayAmount,
      note: repayNote,
    };

    const updatedDebts = debts.map((d) => {
      if (d.id !== repayingDebt.id) return d;
      return {
        ...d,
        remainingAmount: newRemaining,
        status: newStatus,
        paymentsHistory: [...(d.paymentsHistory || []), paymentRecord],
      };
    });

    onUpdateDebts(updatedDebts);

    if (syncRepayToCashbook) {
      const txType = repayingDebt.type === 'PIUTANG' ? 'MASUK' : 'KELUAR';
      const category = 'Kasbon / Pinjaman' as TransactionCategory;
      onAddTransaction({
        date: repayDate,
        type: txType,
        category,
        description: repayNote || `${repayingDebt.type === 'PIUTANG' ? 'Pelunasan Piutang' : 'Pembayaran Utang'} - ${repayingDebt.personName}`,
        amount: repayAmount,
        recordedBy: profile.treasurerName || 'Bendahara RT',
        receiptNumber: `DT-${Date.now().toString().slice(-6)}`,
      });
    }

    setIsRepaymentModalOpen(false);
  };

  const handleOpenModal = (tx?: CashTransaction) => {
    if (tx) {
      setEditingTx(tx);
      setFormDate(tx.date);
      setFormType(tx.type);
      setFormCategory(tx.category);
      setFormDescription(tx.description);
      setFormAmount(tx.amount);
      setFormRecordedBy(tx.recordedBy);
      setFormReceiptNumber(tx.receiptNumber || '');
    } else {
      setEditingTx(null);
      setFormDate(getTodayJakarta());
      setFormType('KELUAR');
      setFormCategory('Kebersihan & Sampah');
      setFormDescription('');
      setFormAmount('');
      setFormRecordedBy(profile.treasurerName || 'Bendahara RT');
      const prefix = formType === 'MASUK' ? 'BKM' : 'BKK';
      const randomNo = Math.floor(100 + Math.random() * 900);
      setFormReceiptNumber(`${prefix}-2609-${randomNo}`);
    }
    setFormFile(null);
    setIsModalOpen(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescription.trim() || !formAmount || Number(formAmount) <= 0) return;

    let attachmentName = editingTx?.attachmentName;
    let attachmentUrl = editingTx?.attachmentUrl;

    if (formFile) {
      try {
        setIsUploadingDrive(true);
        setUploadStatus('Memeriksa akun Google...');
        let token = getAccessToken();

        // If not connected, attempt interactive Google sign-in
        if (!token) {
          setUploadStatus('Menghubungkan akun Google...');
          try {
            const res = await googleSignIn();
            token = res?.accessToken || null;
            if (token) setIsDriveConnected(true);
          } catch (signInErr) {
            console.warn('Google sign-in skipped:', signInErr);
          }
        }

        const formattedFileName = formatAttachmentFileName(
          formDate,
          formDescription || 'Bukti',
          formFile.name
        );

        if (token) {
          setUploadStatus('Mengunggah bukti ke Google Drive...');
          const driveRes = await uploadFileToGoogleDrive(token, formFile, formattedFileName);
          attachmentName = driveRes.name || formattedFileName;
          attachmentUrl = driveRes.webViewLink;
        } else {
          // If user declined Google sign-in, save as persistent Data URL if under 800KB, else blob URL
          attachmentName = formattedFileName;
          if (formFile.size < 800 * 1024) {
            attachmentUrl = await readFileAsDataUrl(formFile);
          } else {
            attachmentUrl = URL.createObjectURL(formFile);
          }
        }
      } catch (err: unknown) {
        console.error('Drive upload error:', err);
        const errMsg = err instanceof Error ? err.message : 'Gagal mengunggah file ke Google Drive.';
        setFormDriveError(errMsg);
        const formattedFileName = formatAttachmentFileName(
          formDate,
          formDescription || 'Bukti',
          formFile.name
        );
        attachmentName = formattedFileName;
        if (formFile.size < 800 * 1024) {
          attachmentUrl = await readFileAsDataUrl(formFile);
        } else {
          attachmentUrl = URL.createObjectURL(formFile);
        }
      } finally {
        setIsUploadingDrive(false);
        setUploadStatus('');
      }
    }

    if (editingTx) {
      onUpdateTransaction({
        ...editingTx,
        date: formDate,
        type: formType,
        category: formCategory,
        description: formDescription,
        amount: Number(formAmount),
        recordedBy: formRecordedBy,
        receiptNumber: formReceiptNumber.trim() || undefined,
        attachmentName,
        attachmentUrl,
      });
    } else {
      onAddTransaction({
        date: formDate,
        type: formType,
        category: formCategory,
        description: formDescription,
        amount: Number(formAmount),
        recordedBy: formRecordedBy,
        receiptNumber: formReceiptNumber.trim() || undefined,
        attachmentName,
        attachmentUrl,
      });

      // Automatically create debt or piutang record if category is Kasbon / Pinjaman
      if (formCategory === 'Kasbon / Pinjaman') {
        const debtType: DebtType = formType === 'KELUAR' ? 'PIUTANG' : 'UTANG';
        const newDebt: DebtItem = {
          id: `debt-${Date.now()}`,
          type: debtType,
          personName: formDescription,
          amount: Number(formAmount),
          remainingAmount: Number(formAmount),
          date: formDate,
          status: 'BELUM_LUNAS',
          notes: `Otomatis dari Kas (${formType === 'KELUAR' ? 'Kasbon Keluar' : 'Pinjaman Masuk'}): ${formDescription}`,
          paymentsHistory: [],
        };
        onUpdateDebts([newDebt, ...debts]);
      }
    }

    setIsModalOpen(false);
    setFormFile(null);
  };

  const handleDelete = (tx: CashTransaction) => {
    setDeleteConfirmTx({
      id: tx.id,
      desc: tx.description,
      amount: tx.amount,
      type: tx.type,
    });
  };

  const confirmDeleteTransaction = () => {
    if (deleteConfirmTx) {
      // Restore debt remainingAmount if this was a salary with a linked Kasbon deduction
      const tx = transactions.find((t) => t.id === deleteConfirmTx.id);
      if (tx && tx.category === 'Gaji & Honor' && tx.salaryDeductionType === 'KASBON' && tx.salaryDeduction) {
        const idsToRestore = tx.linkedDebtIds || (tx.linkedDebtId ? [tx.linkedDebtId] : []);
        if (idsToRestore.length > 0) {
          const updatedDebts = debts.map((d) => {
            if (!idsToRestore.includes(d.id)) return d;
            
            // Find the payment record in paymentsHistory
            const matchingPayment = d.paymentsHistory?.find(p => p.note?.includes(`Gaji ${tx.salaryMonth}`));
            const refundAmount = matchingPayment ? matchingPayment.amount : 0;
            
            const filteredHistory = d.paymentsHistory?.filter(p => p.id !== matchingPayment?.id) || [];
            const newRemaining = d.remainingAmount + refundAmount;
            
            return {
              ...d,
              remainingAmount: newRemaining,
              status: 'BELUM_LUNAS' as DebtStatus,
              paymentsHistory: filteredHistory,
            };
          });
          onUpdateDebts(updatedDebts);
        }
      }

      onDeleteTransaction(deleteConfirmTx.id);
      setDeleteConfirmTx(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Rekening Mandiri RT matching User's Google Sheet */}
      <div className="bg-gradient-to-r from-amber-50 via-orange-50/40 to-white p-4 sm:p-5 rounded-2xl border border-amber-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-16 h-11 sm:h-12 rounded-xl bg-white border border-slate-200/90 p-1 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
            <img
              src="https://blob.cloudcomputing.id/images/49f2ba7c-d5b8-48dc-887e-252ce3a27865/bank-mandiri-logo-l-min.jpg"
              alt="Bank Mandiri"
              className="w-full h-full object-contain"
              loading="lazy"
            />
          </div>
          <div>
            <span className="text-xs text-slate-600 font-medium block">
              Pembayaran Iuran RT dapat dilakukan melalui transfer ke nomor rekening Bendahara berikut:
            </span>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <div className="inline-flex items-center gap-1.5 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="font-mono text-sm sm:text-base font-extrabold text-slate-900 tracking-wider">
                  {profile.bankAccountNo || '1030013542580'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyBankNo}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded text-[11px] font-semibold transition-colors cursor-pointer border border-slate-200"
                  title="Salin nomor rekening ke clipboard"
                >
                  {copiedBankNo ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-bold">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
              <span className="text-xs font-bold text-slate-800">
                atas nama <span className="text-blue-900 font-extrabold">{profile.bankAccountHolder || profile.treasurerName || 'Bendahara RT'}</span>
              </span>
            </div>
            <p className="text-[11px] text-amber-800 italic mt-1">
              * {profile.bankTransferNote || 'Sertakan Nama dan Nomor Rumah pada Keterangan pada saat transfer'}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 self-start md:self-center">
          <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
              SALDO KAS RT
            </span>
            <span className="text-lg font-extrabold font-mono text-emerald-700">
              {formatRupiah(totals.balance)}
            </span>
          </div>
        </div>
      </div>

      {/* Sub-tab Switcher: Buku Kas Operasional vs Pengelolaan Utang Piutang vs Pengelolaan Gaji */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveBookTab('cash')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeBookTab === 'cash'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Wallet className="w-4 h-4 text-emerald-400" />
          <span>Buku Kas Operasional RT</span>
        </button>
        <button
          onClick={() => setActiveBookTab('debts')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeBookTab === 'debts'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>Pengelolaan Utang & Piutang ({debts.filter(d => d.status === 'BELUM_LUNAS').length} Aktif)</span>
        </button>
        <button
          onClick={() => setActiveBookTab('salaries')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeBookTab === 'salaries'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          <span>Pengelolaan Gaji ({transactions.filter(tx => tx.category === 'Gaji & Honor').length} Catatan)</span>
        </button>
      </div>

      {activeBookTab === 'debts' && (
        <div className="space-y-6">
          {/* Debt Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 truncate">Total Piutang Belum Lunas</div>
              <div className="text-lg sm:text-xl lg:text-2xl font-extrabold text-amber-700 font-mono tracking-tight truncate" title={formatRupiah(debtTotals.totalPiutangBelumLunas)}>
                {formatRupiah(debtTotals.totalPiutangBelumLunas)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 truncate">Uang RT yang dipinjamkan ke pihak lain</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 truncate">Total Utang Belum Lunas</div>
              <div className="text-lg sm:text-xl lg:text-2xl font-extrabold text-rose-700 font-mono tracking-tight truncate" title={formatRupiah(debtTotals.totalUtangBelumLunas)}>
                {formatRupiah(debtTotals.totalUtangBelumLunas)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 truncate">Kewajiban pembayaran RT yang belum lunas</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status Pengelolaan</div>
                <div className="text-xl font-extrabold text-slate-900">
                  {debts.filter(d => d.status === 'BELUM_LUNAS').length} Aktif / {debts.length} Total
                </div>
                <div className="text-[11px] text-emerald-600 font-medium mt-1">Terpantau Lunas / Belum Lunas</div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleOpenDebtModal()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Catat Baru</span>
                </button>
              )}
            </div>
          </div>

          {/* Debt Filters & Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setDebtStatusFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  debtStatusFilter === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Semua Status
              </button>
              <button
                onClick={() => setDebtStatusFilter('BELUM_LUNAS')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  debtStatusFilter === 'BELUM_LUNAS'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
              >
                Belum Lunas
              </button>
              <button
                onClick={() => setDebtStatusFilter('LUNAS')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  debtStatusFilter === 'LUNAS'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                Lunas
              </button>
              <div className="h-4 w-px bg-slate-300 mx-1"></div>
              {(['ALL', 'PIUTANG', 'UTANG'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setDebtTypeFilter(t)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    debtTypeFilter === t
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {t === 'ALL' ? 'Semua Jenis' : t === 'PIUTANG' ? 'Piutang (RT Meminjamkan)' : 'Utang (RT Berhutang)'}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama pihak / catatan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Debt Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-emerald-800 text-white font-bold select-none text-[11px]">
                    <th className="py-3 px-3 w-12 text-center border-r border-emerald-700 sticky top-0 z-10 bg-emerald-800">NO.</th>
                    <th className="py-3 px-3.5 w-28 border-r border-emerald-700 sticky top-0 z-10 bg-emerald-800">JENIS</th>
                    <th className="py-3 px-4 min-w-[200px] border-r border-emerald-700 sticky top-0 z-10 bg-emerald-800">NAMA PIHAK / WARGA</th>
                    <th className="py-3 px-3.5 w-28 border-r border-emerald-700 sticky top-0 z-10 bg-emerald-800">TANGGAL</th>
                    <th className="py-3 px-3.5 text-right w-32 border-r border-emerald-700 sticky top-0 z-10 bg-emerald-800">NOMINAL AWAL</th>
                    <th className="py-3 px-3.5 text-right w-32 border-r border-emerald-700 sticky top-0 z-10 bg-emerald-800">SISA BELUM LUNAS</th>
                    <th className="py-3 px-3.5 text-center w-28 border-r border-emerald-700 sticky top-0 z-10 bg-emerald-800">STATUS</th>
                    <th className="py-3 px-4 min-w-[200px] border-r border-emerald-700 sticky top-0 z-10 bg-emerald-800">KETERANGAN</th>
                    {isAdmin && <th className="py-3 px-3 text-center w-24 sticky top-0 z-10 bg-emerald-800">AKSI</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDebts.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 9 : 8} className="text-center py-12 text-slate-400">
                        Belum ada catatan utang atau piutang yang sesuai.
                      </td>
                    </tr>
                  ) : (
                    filteredDebts.map((debt, index) => (
                      <tr key={debt.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 text-center font-mono text-slate-500">{index + 1}</td>
                        <td className="py-3 px-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              debt.type === 'PIUTANG'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-purple-100 text-purple-800 border border-purple-200'
                            }`}
                          >
                            {debt.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div>{debt.personName}</div>
                          {debt.contact && <div className="text-[10px] text-slate-400 font-mono">HP: {debt.contact}</div>}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-slate-600">
                          <div>{formatDateIndo(debt.date)}</div>
                          {debt.dueDate && <div className="text-[10px] text-amber-700">Jatuh Tempo: {formatDateIndo(debt.dueDate)}</div>}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-800">
                          <div>{formatRupiah(debt.amount)}</div>
                          {debt.adminFee && (
                            <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                              Pokok: {formatRupiah(debt.amount - debt.adminFee)} | Admin: {formatRupiah(debt.adminFee)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-extrabold text-slate-900">
                          {formatRupiah(debt.remainingAmount)}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              debt.status === 'LUNAS'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {debt.status === 'LUNAS' ? 'LUNAS' : 'BELUM LUNAS'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{debt.notes || '-'}</div>
                          {debt.paymentsHistory && debt.paymentsHistory.length > 0 && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Riwayat Cicilan: {debt.paymentsHistory.map(p => `${formatRupiah(p.amount)} (${formatDateIndo(p.date)})`).join(', ')}
                            </div>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {debt.status === 'BELUM_LUNAS' && (
                                <button
                                  onClick={() => handleOpenRepaymentModal(debt)}
                                  title="Bayar / Lunasi"
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-semibold cursor-pointer"
                                >
                                  Bayar
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenDebtModal(debt)}
                                title="Edit"
                                className="p-1 text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDebt(debt)}
                                title="Hapus"
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeBookTab === 'cash' && (
        <div className="space-y-6">
          {/* FILTER PANEL JANGKA WAKTU & DATA KEUANGAN */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <Filter className="w-4 h-4 text-emerald-600" />
                <span>Filter Jangka Waktu & Periode Buku Kas</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Pilih jangka waktu untuk menyesuaikan rincian pemasukan, pengeluaran & tabel kas</span>
              </div>
            </div>

            {/* Period Type Selection Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => setPeriodType('TAHUNAN')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                  periodType === 'TAHUNAN'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                📅 Tahunan (2026)
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('BULANAN')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                  periodType === 'BULANAN'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                🗓 Bulanan
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('TRIWULAN')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                  periodType === 'TRIWULAN'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                📊 Triwulan (Kuartal)
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('RENTANG_TANGGAL')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                  periodType === 'RENTANG_TANGGAL'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                ⏱ Rentang Tanggal
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('SEMUA')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center col-span-2 sm:col-span-1 ${
                  periodType === 'SEMUA'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                📁 Semua Riwayat
              </button>
            </div>

            {/* Secondary Detailed Filter Controls */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex flex-wrap items-center gap-3 text-xs">
              {periodType === 'TAHUNAN' && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Pilih Tahun:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="2026">Tahun 2026</option>
                    <option value="2025">Tahun 2025</option>
                  </select>
                </div>
              )}

              {periodType === 'BULANAN' && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Tahun:</span>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    >
                      <option value="2026">2026</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Bulan:</span>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value as MonthKey)}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    >
                      {MONTHS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {periodType === 'TRIWULAN' && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Tahun:</span>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    >
                      <option value="2026">2026</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Pilih Triwulan:</span>
                    <select
                      value={selectedQuarter}
                      onChange={(e) => setSelectedQuarter(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    >
                      {QUARTERS.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {periodType === 'RENTANG_TANGGAL' && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">Dari Tanggal:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">Sampai Tanggal:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              {periodType === 'SEMUA' && (
                <span className="text-slate-600 font-medium">
                  Menampilkan seluruh data pembukuan kas dari awal transaksi hingga saat ini.
                </span>
              )}
            </div>
          </div>

          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Current Cash Balance */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-xs border border-slate-700/50">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Saldo Riil Kas RT
                </span>
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-extrabold font-mono text-emerald-400 tracking-tight">
                {formatRupiah(totals.balance)}
              </div>
              <div className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Kas fisik & rekening kas RT 05 / RW 08 Satriajaya aktual</span>
              </div>
            </div>

            {/* Total Income */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
              <div className="flex items-center justify-between text-slate-500 mb-2 gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider truncate">
                  Pemasukan Periode Ini
                </span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold font-mono text-emerald-600 tracking-tight truncate" title={formatRupiah(filteredTotals.income)}>
                {formatRupiah(filteredTotals.income)}
              </div>
              <div className="text-xs text-slate-500 mt-2 truncate">
                Total pemasukan kas selama periode terpilih
              </div>
            </div>

            {/* Total Expense */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
              <div className="flex items-center justify-between text-slate-500 mb-2 gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider truncate">
                  Pengeluaran Periode Ini
                </span>
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl shrink-0">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold font-mono text-rose-600 tracking-tight truncate" title={formatRupiah(filteredTotals.expense)}>
                {formatRupiah(filteredTotals.expense)}
              </div>
              <div className="text-xs text-slate-500 mt-2 truncate">
                Total pengeluaran kas selama periode terpilih
              </div>
            </div>
          </div>

      {/* Control Bar: Filters & Action Button */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Type & Category Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Type Toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                typeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setTypeFilter('MASUK')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                typeFilter === 'MASUK' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600'
              }`}
            >
              Masuk
            </button>
            <button
              onClick={() => setTypeFilter('KELUAR')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                typeFilter === 'KELUAR' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600'
              }`}
            >
              Keluar
            </button>
          </div>

          {/* Sort Order Toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setSortOrder('asc')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                sortOrder === 'asc' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
              title="Urutkan dari transaksi pertama (No. 1 s/d 19)"
            >
              No. 1 s/d 19
            </button>
            <button
              onClick={() => setSortOrder('desc')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                sortOrder === 'desc' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
              title="Urutkan dari transaksi terbaru"
            >
              Terbaru di Atas
            </button>
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">Semua Kategori</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Right: Search & Add Button */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          <div className="relative flex-1 md:w-56">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari transaksi / no bukti..."
              className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <button
            type="button"
            onClick={handlePrintCashbook}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer border border-rose-700"
            title="Cetak Buku Kas ke PDF / Kertas"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Kas</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Catat Kas Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Transaction List Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-emerald-600 text-white font-bold select-none text-[11px]">
                <th className="py-3 px-3 w-12 text-center border-r border-emerald-500 sticky top-0 z-10 bg-emerald-600">NO.</th>
                <th className="py-3 px-3.5 w-28 border-r border-emerald-500 sticky top-0 z-10 bg-emerald-600">TANGGAL</th>
                <th className="py-3 px-4 min-w-[260px] border-r border-emerald-500 sticky top-0 z-10 bg-emerald-600">KETERANGAN</th>
                <th className="py-3 px-3.5 text-right w-32 border-r border-emerald-500 sticky top-0 z-10 bg-emerald-600">PEMASUKAN</th>
                <th className="py-3 px-3.5 text-right w-32 border-r border-emerald-500 sticky top-0 z-10 bg-emerald-600">PENGELUARAN</th>
                <th className="py-3 px-4 text-right w-36 bg-emerald-700 sticky top-0 z-10">SALDO BERJALAN</th>
                {isAdmin && <th className="py-3 px-3 text-center w-28 bg-emerald-800 sticky top-0 z-10">AKSI</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="py-12 text-center text-slate-400">
                    Tidak ada transaksi yang sesuai kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const [y, m, d] = tx.date.split('-');
                  const displayDate = `${d}-${m}-${y}`;

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-700 font-mono font-bold border-r border-slate-100 bg-slate-50/40">
                        {(tx as any).seqNumber || '-'}
                      </td>

                      <td className="py-3 px-3.5 text-slate-700 font-mono whitespace-nowrap border-r border-slate-100">
                        {displayDate}
                      </td>

                      <td className="py-3 px-4 text-slate-900 font-medium leading-relaxed border-r border-slate-100">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-800">{tx.description}</span>
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 shrink-0">
                            {tx.category}
                          </span>
                        </div>
                        {tx.attachmentUrl && (
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <a
                              href={tx.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border transition-colors ${
                                tx.attachmentUrl.includes('drive.google.com')
                                  ? 'text-emerald-800 hover:text-emerald-950 bg-emerald-50 border-emerald-200'
                                  : tx.attachmentUrl.startsWith('blob:')
                                  ? 'text-amber-800 hover:text-amber-950 bg-amber-50 border-amber-300'
                                  : 'text-blue-700 hover:text-blue-900 bg-blue-50 border-blue-200'
                              }`}
                              title={
                                tx.attachmentUrl.startsWith('blob:')
                                  ? 'Tersimpan sementara (link blob). Klik ikon Edit di kanan untuk mengunggah ulang ke Google Drive.'
                                  : tx.attachmentName || 'Lihat Bukti Lampiran'
                              }
                            >
                              <Paperclip className="w-3 h-3 text-blue-600 shrink-0" />
                              <span className="truncate max-w-[180px]">{tx.attachmentName || 'Bukti Nota / Dokumen'}</span>
                              {tx.attachmentUrl.includes('drive.google.com') && (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/90 px-1 py-0.2 rounded">
                                  Drive
                                </span>
                              )}
                              {tx.attachmentUrl.startsWith('blob:') && (
                                <span className="text-[9px] font-bold text-amber-800 bg-amber-200/90 px-1 py-0.2 rounded">
                                  Lokal (Blob)
                                </span>
                              )}
                            </a>
                            {tx.attachmentUrl.startsWith('blob:') && isAdmin && (
                              <button
                                onClick={() => handleOpenModal(tx)}
                                title="Upload ulang ke Google Drive"
                                className="text-[10px] text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer"
                              >
                                Upload ke Drive
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3.5 text-right font-mono font-semibold text-emerald-700 border-r border-slate-100">
                        {tx.type === 'MASUK' ? formatRupiah(tx.amount) : ''}
                      </td>

                      <td className="py-3 px-3.5 text-right font-mono font-semibold text-rose-700 border-r border-slate-100">
                        {tx.type === 'KELUAR' ? formatRupiah(tx.amount) : ''}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 bg-slate-50/60">
                        {formatRupiah((tx as any).balanceAfter || 0)}
                      </td>

                      {isAdmin && (
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenReceiptModal(tx)}
                              title="Cetak Kuitansi Kas (PNG / PDF / WA)"
                              className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenModal(tx)}
                              title="Edit transaksi"
                              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded cursor-pointer transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(tx)}
                              title="Hapus transaksi"
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>
            Total <strong>{filteredTransactions.length}</strong> transaksi kas tercatat
          </span>
          <span className="text-slate-400">
            Transparansi buku kas terbuka bagi seluruh warga RT
          </span>
        </div>
      </div>
      </div>
      )}

      {activeBookTab === 'salaries' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 truncate">
                Total Gaji Pokok
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono tracking-tight truncate">
                {formatRupiah(salaryStats.baseTotal)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 truncate">
                Total bruto seluruh honor & gaji pengurus
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 truncate">
                Potongan Kasbon / Lain
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-amber-700 font-mono tracking-tight truncate">
                {formatRupiah(salaryStats.deductionTotal)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 truncate">
                Total pemotongan kasbon pengurus RT
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 truncate">
                Kas Bersih Dikeluarkan
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-rose-700 font-mono tracking-tight truncate">
                {formatRupiah(salaryStats.netTotal)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 truncate">
                Realisasi kas keluar bersih setelah potongan
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Penggajian RT
                </div>
                <div className="text-base font-extrabold text-slate-900">
                  {salaryTransactions.length} Transaksi Gaji
                </div>
                <div className="text-[11px] text-emerald-600 font-medium mt-1">
                  Terkoneksi Piutang Warga
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setIsSalaryModalOpen(true)}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Bayar Gaji</span>
                </button>
              )}
            </div>
          </div>

          {/* Salary Records List */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Riwayat Pembayaran Gaji & Honor RT</h3>
                <p className="text-xs text-slate-500">Daftar pembayaran gaji berkala petugas atau pengurus RT</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold select-none text-[11px]">
                    <th className="py-3 px-3 w-12 text-center border-r border-slate-800">NO.</th>
                    <th className="py-3 px-4 border-r border-slate-800">PENERIMA GAJI</th>
                    <th className="py-3 px-3 border-r border-slate-800 text-center w-32">BULAN GAJI</th>
                    <th className="py-3 px-3.5 text-right w-36 border-r border-slate-800">GAJI POKOK (BRUTO)</th>
                    <th className="py-3 px-3.5 text-right w-36 border-r border-slate-800">POTONGAN</th>
                    <th className="py-3 px-3.5 text-right w-36 border-r border-slate-800 bg-slate-800 text-white">GAJI BERSIH (NETTO)</th>
                    <th className="py-3 px-3.5 text-center w-32 border-r border-slate-800">TANGGAL BAYAR</th>
                    <th className="py-3 px-4 border-r border-slate-800">KONEKSI KASBON / PIUTANG</th>
                    {isAdmin && <th className="py-3 px-3 text-center w-20">AKSI</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salaryTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 9 : 8} className="py-12 text-center text-slate-400 font-medium">
                        Belum ada catatan transaksi gaji pengurus. Klik "Bayar Gaji" untuk menambahkan.
                      </td>
                    </tr>
                  ) : (
                    salaryTransactions.map((tx, idx) => {
                      const displayDeduction = tx.salaryDeduction || 0;
                      const displayBase = tx.salaryBase || tx.amount;
                      const displayNet = tx.amount;
                      
                      const linkedDebt = debts.find(d => d.id === tx.linkedDebtId);

                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 text-center text-slate-700 font-mono font-bold border-r border-slate-100 bg-slate-50/40">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4 border-r border-slate-100">
                            <div className="font-semibold text-slate-900">{tx.salaryRecipient || tx.description}</div>
                            {tx.notes && <p className="text-[10px] text-slate-400 font-normal">{tx.notes}</p>}
                          </td>
                          <td className="py-3 px-3 border-r border-slate-100 text-center font-bold text-blue-900">
                            {tx.salaryMonth || 'September 2026'}
                          </td>
                          <td className="py-3 px-3.5 border-r border-slate-100 text-right font-mono text-slate-700">
                            {formatRupiah(displayBase)}
                          </td>
                          <td className="py-3 px-3.5 border-r border-slate-100 text-right font-mono text-amber-700 font-semibold">
                            {displayDeduction > 0 ? (
                              <div className="flex flex-col items-end">
                                <span>-{formatRupiah(displayDeduction)}</span>
                                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">
                                  {tx.salaryDeductionType === 'KASBON' ? 'Kasbon' : 'Lainnya'}
                                </span>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="py-3 px-3.5 border-r border-slate-100 text-right font-mono text-rose-700 font-extrabold bg-slate-50/40">
                            {formatRupiah(displayNet)}
                          </td>
                          <td className="py-3 px-3.5 border-r border-slate-100 text-center font-medium font-mono text-slate-600">
                            {formatDateIndo(tx.date)}
                          </td>
                          <td className="py-3 px-4 border-r border-slate-100">
                            {tx.salaryDeductionType === 'KASBON' && tx.linkedDebtId ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold text-amber-800 bg-amber-50 rounded-full border border-amber-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  Terhubung Kasbon
                                </span>
                                <p className="text-[10px] text-slate-500">
                                  Pihak: <strong>{linkedDebt ? linkedDebt.personName : 'Warga'}</strong>
                                  {linkedDebt && (
                                    <span className="block text-[9px] text-slate-400">
                                      (Sisa Kasbon: {formatRupiah(linkedDebt.remainingAmount)} / {linkedDebt.status === 'LUNAS' ? '✅ Lunas' : '⚠️ Belum Lunas'})
                                    </span>
                                  )}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Tidak ada potongan kasbon</span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleOpenReceiptModal(tx)}
                                  title="Cetak Kuitansi Gaji (PNG / PDF / WA)"
                                  className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(tx)}
                                  title="Hapus catatan gaji"
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>
                Total <strong>{salaryTransactions.length}</strong> transaksi penggajian tercatat
              </span>
              <span className="text-slate-400">
                Pencatatan kas otomatis disinkronkan ke Buku Kas Utama
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal Bayar Gaji (Salary Payment Modal) */}
      {isSalaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base leading-tight">
                    Catat Pembayaran Gaji / Honor Baru
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sistem penggajian internal {getCleanRtRwTitle(profile)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSalaryModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSalary} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Tipe Penerima Gaji */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipe Penerima Gaji *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSalaryRecipientType('OFFICER');
                      setSalaryRecipient('');
                    }}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
                      salaryRecipientType === 'OFFICER'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Pengurus RT Aktif
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSalaryRecipientType('MANUAL');
                      setSalaryRecipient('');
                    }}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
                      salaryRecipientType === 'MANUAL'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Input Manual (Petugas / Lain)
                  </button>
                </div>
              </div>

              {/* Nama Penerima */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Penerima Gaji *</label>
                {salaryRecipientType === 'OFFICER' ? (
                  <select
                    required
                    value={salaryRecipient}
                    onChange={(e) => setSalaryRecipient(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="" disabled>Pilih dari pengurus RT...</option>
                    {profile.officers && profile.officers.length > 0 ? (
                      profile.officers
                        .filter(off => off.isCurrent !== false)
                        .map(off => (
                          <option key={off.id} value={`${off.name} (${off.role})`}>
                            {off.role}: {off.name}
                          </option>
                        ))
                    ) : (
                      <option disabled>Tidak ada data pengurus RT aktif</option>
                    )}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={salaryRecipient}
                    onChange={(e) => setSalaryRecipient(e.target.value)}
                    placeholder="Masukkan nama penerima gaji (cth: Pak Rosam - Petugas Sampah)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                )}
              </div>

              {/* Bulan Gaji & Tanggal Pembayaran */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bulan Gaji *</label>
                  <select
                    value={salaryMonth}
                    onChange={(e) => setSalaryMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Januari 2026">Januari 2026</option>
                    <option value="Februari 2026">Februari 2026</option>
                    <option value="Maret 2026">Maret 2026</option>
                    <option value="April 2026">April 2026</option>
                    <option value="Mei 2026">Mei 2026</option>
                    <option value="Juni 2026">Juni 2026</option>
                    <option value="Juli 2026">Juli 2026</option>
                    <option value="Agustus 2026">Agustus 2026</option>
                    <option value="September 2026">September 2026</option>
                    <option value="Oktober 2026">Oktober 2026</option>
                    <option value="November 2026">November 2026</option>
                    <option value="Desember 2026">Desember 2026</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Pembayaran *</label>
                  <input
                    type="date"
                    required
                    value={salaryDate}
                    onChange={(e) => setSalaryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Gaji Pokok */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nominal Gaji Pokok (Rp) *</label>
                <CurrencyInput
                  required
                  value={salaryBase}
                  onChange={(val) => setSalaryBase(val > 0 ? val : '')}
                  prefix="Rp"
                  placeholder="Contoh: 1.500.000"
                  className="w-full pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-base font-bold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Potongan & Jenis Potongan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nominal Potongan (Rp)</label>
                  <CurrencyInput
                    value={salaryDeduction}
                    onChange={(val) => setSalaryDeduction(val > 0 ? val : '')}
                    prefix="Rp"
                    placeholder="Contoh: 150.000 (Kosongkan jika tidak ada)"
                    className="w-full pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {salaryDeduction !== '' && Number(salaryDeduction) > 0 && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Sumber / Jenis Potongan *</label>
                    <select
                      value={salaryDeductionType}
                      onChange={(e) => setSalaryDeductionType(e.target.value as 'KASBON' | 'LAINNYA')}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="LAINNYA">Potongan Lain-lain</option>
                      <option value="KASBON">Potongan Kasbon / Piutang</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Koneksi Kasbon / Piutang */}
              {salaryDeduction !== '' && Number(salaryDeduction) > 0 && salaryDeductionType === 'KASBON' && (
                <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-amber-900">Pilih Satu atau Lebih Kasbon Aktif *</label>
                    <span className="text-[9px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md font-bold">Multi-Select</span>
                  </div>
                  
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto bg-white p-2 rounded-xl border border-amber-200/60 shadow-inner">
                    {debts.filter(d => d.type === 'PIUTANG' && d.status === 'BELUM_LUNAS').length > 0 ? (
                      debts
                        .filter(d => d.type === 'PIUTANG' && d.status === 'BELUM_LUNAS')
                        .map((p) => {
                          const isChecked = linkedDebtIds.includes(p.id);
                          return (
                            <label key={p.id} className="flex items-start gap-2.5 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setLinkedDebtIds([...linkedDebtIds, p.id]);
                                  } else {
                                    setLinkedDebtIds(linkedDebtIds.filter((id) => id !== p.id));
                                  }
                                }}
                                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer mt-0.5 shrink-0"
                              />
                              <div className="text-[11px] leading-tight">
                                <span className="font-semibold text-slate-800">{p.personName}</span>
                                <span className="block text-[10px] text-slate-500 font-mono">
                                  Sisa: {formatRupiah(p.remainingAmount)} {p.dueDate ? `• Tempo: ${formatDateIndo(p.dueDate)}` : ''}
                                </span>
                              </div>
                            </label>
                          );
                        })
                    ) : (
                      <p className="text-[11px] text-slate-400 italic p-2 text-center">Tidak ada data piutang kasbon aktif</p>
                    )}
                  </div>

                  {linkedDebtIds.length > 0 && (
                    <div className="text-[11px] text-amber-900 font-medium bg-amber-100/40 p-2.5 rounded-lg border border-amber-200 space-y-1">
                      <p className="font-bold border-b border-amber-200/60 pb-1 mb-1 text-[10px] uppercase tracking-wider text-amber-950">SIMULASI ALOKASI POTONGAN KASBON:</p>
                      {(() => {
                        let remainingDeduction = Number(salaryDeduction || 0);
                        const allocationDetails: React.ReactNode[] = [];
                        let totalCovered = 0;

                        linkedDebtIds.forEach((id) => {
                          const d = debts.find(debt => debt.id === id);
                          if (!d) return;

                          const deductFromThis = Math.min(d.remainingAmount, remainingDeduction);
                          remainingDeduction -= deductFromThis;
                          totalCovered += deductFromThis;

                          const finalRemaining = d.remainingAmount - deductFromThis;

                          allocationDetails.push(
                            <div key={d.id} className="flex justify-between items-center text-[10px] py-0.5">
                              <span className="truncate max-w-[150px]">{d.personName}:</span>
                              <span className="font-mono text-slate-700">
                                Sisa {formatRupiah(d.remainingAmount)} → <strong className="text-rose-700">-{formatRupiah(deductFromThis)}</strong> → {finalRemaining === 0 ? <strong className="text-emerald-700 font-extrabold">(Lunas ✅)</strong> : <strong className="text-slate-900 font-bold">{formatRupiah(finalRemaining)}</strong>}
                              </span>
                            </div>
                          );
                        });

                        return (
                          <div className="space-y-1">
                            {allocationDetails}
                            <div className="border-t border-amber-200/60 pt-1 mt-1 flex justify-between font-bold text-amber-950 text-[10px]">
                              <span>TOTAL TERPOTONG:</span>
                              <span>{formatRupiah(totalCovered)} / {formatRupiah(Number(salaryDeduction || 0))}</span>
                            </div>
                            {remainingDeduction > 0 && (
                              <p className="text-[10px] text-rose-700 font-bold mt-1">
                                ⚠️ Sisa potongan {formatRupiah(remainingDeduction)} tidak tercakup karena sisa kasbon tidak mencukupi!
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Total Gaji Bersih Display */}
              {typeof salaryBase === 'number' && salaryBase > 0 && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">TOTAL GAJI BERSIH (YANG DITRANSFER)</span>
                    <span className="text-xl font-extrabold font-mono text-emerald-800">
                      {formatRupiah(salaryBase - Number(salaryDeduction || 0))}
                    </span>
                  </div>
                  <div className="text-right text-[10px] text-emerald-700 font-medium">
                    Pokok: {formatRupiah(salaryBase)}
                    {Number(salaryDeduction || 0) > 0 && <span className="block text-amber-700">Potongan: -{formatRupiah(Number(salaryDeduction))}</span>}
                  </div>
                </div>
              )}

              {/* Keterangan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan / Keterangan Gaji</label>
                <textarea
                  rows={2}
                  value={salaryNotes}
                  onChange={(e) => setSalaryNotes(e.target.value)}
                  placeholder="Contoh: Pembayaran honor bulanan beserta potongan kasbon tahap 1"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSalaryModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-xs cursor-pointer"
                >
                  Bayar Gaji & Potong Kasbon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Transaksi Kas */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base leading-tight">
                    {editingTx ? 'Edit Transaksi Kas' : 'Catat Transaksi Kas Baru'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Buku kas operasional {getCleanRtRwTitle(profile)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Jenis Transaksi */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormType('MASUK')}
                  className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    formType === 'MASUK'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Pemasukan (Masuk)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('KELUAR')}
                  className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    formType === 'KELUAR'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <TrendingDown className="w-4 h-4" />
                  <span>Pengeluaran (Keluar)</span>
                </button>
              </div>

              {/* Tanggal & Nominal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nominal (Rp) *</label>
                  <CurrencyInput
                    required
                    value={formAmount}
                    onChange={(val) => setFormAmount(val > 0 ? val : '')}
                    prefix="Rp"
                    placeholder="Contoh: 650.000"
                    className="w-full pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-base font-bold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Kategori */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kategori Transaksi *</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as TransactionCategory)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Uraian Keterangan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Uraian / Keterangan Transaksi *
                </label>
                <textarea
                  required
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Contoh: Honor petugas kebersihan & angkut sampah bulan September 2026"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Upload Bukti File Foto / PDF */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">
                    Upload Bukti Nota / Kwitansi (Foto / PDF) - Opsional
                  </label>
                  {isDriveConnected ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Google Drive Terhubung
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectGoogleDrive}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline hover:no-underline"
                    >
                      + Hubungkan Google Drive
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                  />
                </div>
                {formFile && (
                  <div className="text-[11px] font-medium mt-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <p className="text-slate-600 truncate">
                      File terpilih: <span className="font-mono text-slate-800">{formFile.name}</span>
                    </p>
                    <p className="text-emerald-800">
                      Nama format di Drive:{' '}
                      <strong className="font-mono bg-emerald-100/90 text-emerald-900 px-1.5 py-0.5 rounded border border-emerald-300 text-xs break-all">
                        {formatAttachmentFileName(formDate, formDescription || 'Bukti', formFile.name)}
                      </strong>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Format: <strong>YYYYMMDD-Keterangan</strong> • {isDriveConnected ? '✅ Siap diunggah ke Drive' : '⚠️ Klik "+ Hubungkan Google Drive" agar tersimpan ke Drive'}
                    </p>
                  </div>
                )}
                {editingTx?.attachmentName && !formFile && (
                  <div className="text-[11px] font-medium mt-1">
                    <span className="text-blue-700">Lampiran saat ini: <strong>{editingTx.attachmentName}</strong></span>
                    {editingTx.attachmentUrl?.startsWith('blob:') && (
                      <span className="text-amber-700 block text-[10px] mt-0.5">
                        ⚠️ File ini tersimpan sementara (link blob). Pilih file ulang di atas agar diunggah secara permanen ke Google Drive.
                      </span>
                    )}
                  </div>
                )}
                {formDriveError && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">
                    {formDriveError}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  {isDriveConnected
                    ? 'File akan otomatis diunggah dan disimpan ke folder "Bukti Kas & Iuran RT" di Google Drive Anda.'
                    : 'Untuk menyimpan bukti permanen ke Google Drive, silakan klik "+ Hubungkan Google Drive".'}
                </p>
              </div>

              {/* Pencatat & No Bukti */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">
                      Nama Pencatat / Penerima
                    </label>
                    {profile.officers && profile.officers.length > 0 && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) setFormRecordedBy(e.target.value);
                        }}
                        className="text-[10px] text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 cursor-pointer"
                        defaultValue=""
                      >
                        <option value="" disabled>Pilih dari Pengurus RT...</option>
                        {profile.officers.map((off) => (
                          <option key={off.id} value={`${off.name} (${off.role})`}>
                            {off.role}: {off.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formRecordedBy}
                    onChange={(e) => setFormRecordedBy(e.target.value)}
                    placeholder="Contoh: Bpk. Hendra Cahyono (Bendahara)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor Nota / Bukti (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formReceiptNumber}
                    onChange={(e) => setFormReceiptNumber(e.target.value)}
                    placeholder="Contoh: BKK-2609-01"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploadingDrive}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {isUploadingDrive ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{uploadStatus || 'Mengunggah...'}</span>
                    </>
                  ) : (
                    <span>Simpan Transaksi</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add/Edit Debt */}
      {isDebtModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base leading-tight">
                    {editingDebt ? 'Edit Catatan Utang / Piutang' : 'Catat Utang / Piutang Baru'}
                  </h3>
                  <p className="text-xs text-slate-400">Pengelolaan keuangan {getCleanRtRwTitle(profile)}</p>
                </div>
              </div>
              <button
                onClick={() => setIsDebtModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDebt} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jenis Catatan *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormDebtType('PIUTANG')}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
                      formDebtType === 'PIUTANG'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Piutang (RT Meminjamkan)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormDebtType('UTANG')}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
                      formDebtType === 'UTANG'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Utang (RT Berhutang)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {formDebtType === 'PIUTANG' ? 'Nama Peminjam / Warga *' : 'Nama Pemberi Pinjaman / Rekanan *'}
                </label>
                <input
                  type="text"
                  required
                  value={formDebtPersonName}
                  onChange={(e) => setFormDebtPersonName(e.target.value)}
                  placeholder="Contoh: Bpk. Rosam / Toko Material"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nominal (Rp) *</label>
                  <CurrencyInput
                    required
                    value={formDebtAmount}
                    onChange={(val) => setFormDebtAmount(val > 0 ? val : '')}
                    prefix="Rp"
                    placeholder="Contoh: 150.000"
                    className="w-full pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kontak / No. HP</label>
                  <input
                    type="text"
                    value={formDebtContact}
                    onChange={(e) => setFormDebtContact(e.target.value)}
                    placeholder="Contoh: 08123456789"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Transaksi *</label>
                  <input
                    type="date"
                    required
                    value={formDebtDate}
                    onChange={(e) => setFormDebtDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Jatuh Tempo</label>
                  <input
                    type="date"
                    value={formDebtDueDate}
                    onChange={(e) => setFormDebtDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keterangan / Catatan</label>
                <textarea
                  rows={2}
                  value={formDebtNotes}
                  onChange={(e) => setFormDebtNotes(e.target.value)}
                  placeholder="Contoh: Pinjaman darurat untuk perbaikan saluran air"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              {/* Biaya Admin & Sync Section */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-700">Biaya Admin (Opsional)</label>
                  <span className="text-[10px] text-slate-400">misal biaya transfer bank, dsb.</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <CurrencyInput
                      value={formDebtAdminFee}
                      onChange={(val) => setFormDebtAdminFee(val > 0 ? val : '')}
                      prefix="Rp"
                      placeholder="Contoh: 6.500"
                      className="w-full pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {formDebtAdminFee !== '' && Number(formDebtAdminFee) > 0 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDebtAdminFeeType('KELUAR')}
                        className={`flex-1 py-1 px-2.5 rounded-lg font-bold border text-center cursor-pointer transition-all ${
                          debtAdminFeeType === 'KELUAR'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Beban (Keluar)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDebtAdminFeeType('MASUK')}
                        className={`flex-1 py-1 px-2.5 rounded-lg font-bold border text-center cursor-pointer transition-all ${
                          debtAdminFeeType === 'MASUK'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Penerimaan (Masuk)
                      </button>
                    </div>
                  )}
                </div>

                {!editingDebt && (
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Auto-Sync Buku Kas</span>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-slate-900">
                        <input
                          type="checkbox"
                          checked={syncDebtToCashbook}
                          onChange={(e) => setSyncDebtToCashbook(e.target.checked)}
                          className="w-4 h-4 text-emerald-600 border-slate-300 rounded-sm focus:ring-emerald-500"
                        />
                        <span>Sync Catatan Utama ({formDebtType === 'PIUTANG' ? 'Keluar' : 'Masuk'})</span>
                      </label>

                      {formDebtAdminFee !== '' && Number(formDebtAdminFee) > 0 && (
                        <label className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-slate-900">
                          <input
                            type="checkbox"
                            checked={syncDebtAdminToCashbook}
                            onChange={(e) => setSyncDebtAdminToCashbook(e.target.checked)}
                            className="w-4 h-4 text-emerald-600 border-slate-300 rounded-sm focus:ring-emerald-500"
                          />
                          <span>Sync Biaya Admin ({debtAdminFeeType === 'KELUAR' ? 'Keluar' : 'Masuk'})</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDebtModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs cursor-pointer"
                >
                  Simpan Catatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Repayment (Bayar / Cicil) */}
      {isRepaymentModalOpen && repayingDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div>
                <h3 className="font-semibold text-base">Bayar / Lunasi {repayingDebt.type}</h3>
                <p className="text-xs text-slate-400">{repayingDebt.personName} (Sisa: {formatRupiah(repayingDebt.remainingAmount)})</p>
              </div>
              <button
                onClick={() => setIsRepaymentModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitRepayment} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nominal Pembayaran / Cicilan (Rp) *</label>
                <CurrencyInput
                  required
                  value={repayAmount}
                  onChange={(val) => setRepayAmount(val > 0 ? val : '')}
                  prefix="Rp"
                  placeholder={`Contoh: ${repayingDebt.remainingAmount.toLocaleString('id-ID')}`}
                  className="w-full pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-base"
                />
                <p className="text-[10px] text-slate-400 mt-1">Maksimal sisa: {formatRupiah(repayingDebt.remainingAmount)}</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tanggal Pembayaran *</label>
                <input
                  type="date"
                  required
                  value={repayDate}
                  onChange={(e) => setRepayDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keterangan / Catatan Cicilan *</label>
                <input
                  type="text"
                  required
                  value={repayNote}
                  onChange={(e) => setRepayNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncRepayToCashbook}
                  onChange={(e) => setSyncRepayToCashbook(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-slate-700 font-medium select-none">
                  Otomatis catat ke Buku Kas {repayingDebt.type === 'PIUTANG' ? '(Pemasukan Kas Masuk)' : '(Pengeluaran Kas Keluar)'}
                </span>
              </label>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRepaymentModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs cursor-pointer"
                >
                  Proses Pembayaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Cash Transaction */}
      {deleteConfirmTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Transaksi Kas?</h3>
              <p className="text-sm text-slate-600 mb-4">
                Apakah Anda yakin ingin menghapus transaksi{' '}
                <span className="font-semibold text-slate-800">"{deleteConfirmTx.desc}"</span> senilai{' '}
                <span className="font-bold font-mono text-slate-900">{formatRupiah(deleteConfirmTx.amount)}</span> ({deleteConfirmTx.type === 'MASUK' ? 'Kas Masuk' : 'Kas Keluar'})? Tindakan ini akan memperbarui saldo berjalan secara otomatis.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTx(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteTransaction}
                  className="px-5 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus Transaksi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Debt/Piutang Item */}
      {deleteConfirmDebt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Hapus Catatan {deleteConfirmDebt.type === 'PIUTANG' ? 'Piutang' : 'Utang RT'}?
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Apakah Anda yakin ingin menghapus catatan {deleteConfirmDebt.type === 'PIUTANG' ? 'piutang' : 'utang'} atas nama{' '}
                <span className="font-semibold text-slate-800">"{deleteConfirmDebt.name}"</span> dengan nilai{' '}
                <span className="font-bold font-mono text-slate-900">{formatRupiah(deleteConfirmDebt.amount)}</span>?
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmDebt(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteDebt}
                  className="px-5 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Digital Cash Receipt Modal */}
      <CashReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setSelectedReceiptTx(null);
        }}
        transaction={selectedReceiptTx}
        profile={profile}
      />
    </div>
  );
};
