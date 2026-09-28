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
} from 'lucide-react';
import {
  CashTransaction,
  TransactionType,
  TransactionCategory,
  RTProfile,
  DebtItem,
  DebtType,
  DebtStatus,
} from '../types';
import { formatRupiah, formatDateIndo, formatAttachmentFileName } from '../utils/formatters';
import { uploadFileToGoogleDrive } from '../services/googleDrive';
import { getAccessToken, googleSignIn } from '../services/auth';

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
  const [activeBookTab, setActiveBookTab] = useState<'cash' | 'debts'>('cash');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | TransactionCategory>('ALL');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
  const [formDebtDate, setFormDebtDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDebtDueDate, setFormDebtDueDate] = useState('');
  const [formDebtNotes, setFormDebtNotes] = useState('');

  // Repayment Modal State
  const [isRepaymentModalOpen, setIsRepaymentModalOpen] = useState(false);
  const [repayingDebt, setRepayingDebt] = useState<DebtItem | null>(null);
  const [repayAmount, setRepayAmount] = useState<number | ''>('');
  const [repayDate, setRepayDate] = useState(new Date().toISOString().split('T')[0]);
  const [repayNote, setRepayNote] = useState('');
  const [syncRepayToCashbook, setSyncRepayToCashbook] = useState(true);

  // Modal State for adding/editing transaction
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);

  // Form Fields
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
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

  // Filtered view for the table
  const filteredTransactions = useMemo(() => {
    return processedTransactions.filter((tx) => {
      const matchSearch =
        tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.receiptNumber && tx.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        tx.category.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
      if (categoryFilter !== 'ALL' && tx.category !== categoryFilter) return false;

      return true;
    });
  }, [processedTransactions, searchTerm, typeFilter, categoryFilter]);

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
      setFormDebtAmount(debt.amount);
      setFormDebtDate(debt.date);
      setFormDebtDueDate(debt.dueDate || '');
      setFormDebtNotes(debt.notes || '');
    } else {
      setEditingDebt(null);
      setFormDebtType('PIUTANG');
      setFormDebtPersonName('');
      setFormDebtContact('');
      setFormDebtAmount('');
      setFormDebtDate(new Date().toISOString().split('T')[0]);
      setFormDebtDueDate('');
      setFormDebtNotes('');
    }
    setIsDebtModalOpen(true);
  };

  const handleSaveDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDebtPersonName || typeof formDebtAmount !== 'number' || formDebtAmount <= 0) return;

    if (editingDebt) {
      const updated = debts.map((d) => {
        if (d.id !== editingDebt.id) return d;
        const diff = formDebtAmount - d.amount;
        const newRemaining = Math.max(0, d.remainingAmount + diff);
        return {
          ...d,
          type: formDebtType,
          personName: formDebtPersonName,
          contact: formDebtContact,
          amount: formDebtAmount,
          remainingAmount: newRemaining,
          date: formDebtDate,
          dueDate: formDebtDueDate,
          status: newRemaining === 0 ? ('LUNAS' as DebtStatus) : ('BELUM_LUNAS' as DebtStatus),
          notes: formDebtNotes,
        };
      });
      onUpdateDebts(updated);
    } else {
      const newDebt: DebtItem = {
        id: `debt-${Date.now()}`,
        type: formDebtType,
        personName: formDebtPersonName,
        contact: formDebtContact,
        amount: formDebtAmount,
        remainingAmount: formDebtAmount,
        date: formDebtDate,
        dueDate: formDebtDueDate,
        status: 'BELUM_LUNAS',
        notes: formDebtNotes,
        paymentsHistory: [],
      };
      onUpdateDebts([newDebt, ...debts]);
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
    setRepayDate(new Date().toISOString().split('T')[0]);
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
      setFormDate(new Date().toISOString().split('T')[0]);
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
              <span className="font-mono text-sm sm:text-base font-extrabold text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs tracking-wider">
                {profile.bankAccountNo || '1030013542580'}
              </span>
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

      {/* Sub-tab Switcher: Buku Kas Operasional vs Pengelolaan Utang Piutang */}
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
      </div>

      {activeBookTab === 'debts' ? (
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
                  <tr className="bg-slate-900 text-white font-bold select-none text-[11px]">
                    <th className="py-3 px-3 w-12 text-center border-r border-slate-800 sticky top-0 z-10 bg-slate-900">NO.</th>
                    <th className="py-3 px-3.5 w-28 border-r border-slate-800 sticky top-0 z-10 bg-slate-900">JENIS</th>
                    <th className="py-3 px-4 min-w-[200px] border-r border-slate-800 sticky top-0 z-10 bg-slate-900">NAMA PIHAK / WARGA</th>
                    <th className="py-3 px-3.5 w-28 border-r border-slate-800 sticky top-0 z-10 bg-slate-900">TANGGAL</th>
                    <th className="py-3 px-3.5 text-right w-32 border-r border-slate-800 sticky top-0 z-10 bg-slate-900">NOMINAL AWAL</th>
                    <th className="py-3 px-3.5 text-right w-32 border-r border-slate-800 sticky top-0 z-10 bg-slate-900">SISA BELUM LUNAS</th>
                    <th className="py-3 px-3.5 text-center w-28 border-r border-slate-800 sticky top-0 z-10 bg-slate-900">STATUS</th>
                    <th className="py-3 px-4 min-w-[200px] border-r border-slate-800 sticky top-0 z-10 bg-slate-900">KETERANGAN</th>
                    {isAdmin && <th className="py-3 px-3 text-center w-24 sticky top-0 z-10 bg-slate-900">AKSI</th>}
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
                          {formatRupiah(debt.amount)}
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
      ) : (
        <div className="space-y-6">
          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Current Cash Balance */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-xs border border-slate-700/50">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Saldo Kas RT Saat Ini
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
                <span>Kas fisik & rekening kas RT 05 / RW 08 Satriajaya per September 2026</span>
              </div>
            </div>

            {/* Total Income */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
              <div className="flex items-center justify-between text-slate-500 mb-2 gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider truncate">
                  Total Pemasukan Kas
                </span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold font-mono text-emerald-600 tracking-tight truncate" title={formatRupiah(totals.income)}>
                {formatRupiah(totals.income)}
              </div>
              <div className="text-xs text-slate-500 mt-2 truncate">
                Saldo awal, iuran warga & sumbangan dana kades
              </div>
            </div>

            {/* Total Expense */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
              <div className="flex items-center justify-between text-slate-500 mb-2 gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider truncate">
                  Total Pengeluaran Kas
                </span>
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl shrink-0">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold font-mono text-rose-600 tracking-tight truncate" title={formatRupiah(totals.expense)}>
                {formatRupiah(totals.expense)}
              </div>
              <div className="text-xs text-slate-500 mt-2 truncate">
                Iuran RW, kasbon & biaya administrasi bank
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
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari transaksi / no bukti..."
              className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          </div>

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
              <tr className="bg-blue-600 text-white font-bold select-none text-[11px]">
                <th className="py-3 px-3 w-12 text-center border-r border-blue-500 sticky top-0 z-10 bg-blue-600">NO.</th>
                <th className="py-3 px-3.5 w-28 border-r border-blue-500 sticky top-0 z-10 bg-blue-600">TANGGAL</th>
                <th className="py-3 px-4 min-w-[260px] border-r border-blue-500 sticky top-0 z-10 bg-blue-600">KETERANGAN</th>
                <th className="py-3 px-3.5 text-right w-32 border-r border-blue-500 sticky top-0 z-10 bg-blue-600">PEMASUKAN</th>
                <th className="py-3 px-3.5 text-right w-32 border-r border-blue-500 sticky top-0 z-10 bg-blue-600">PENGELUARAN</th>
                <th className="py-3 px-4 text-right w-36 bg-blue-700 sticky top-0 z-10">SALDO BERJALAN</th>
                {isAdmin && <th className="py-3 px-3 text-center w-20 bg-blue-800 sticky top-0 z-10">AKSI</th>}
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
                              onClick={() => handleOpenModal(tx)}
                              title="Edit transaksi"
                              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(tx)}
                              title="Hapus transaksi"
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
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
                    Buku kas operasional lingkungan {profile.name}
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
                  <input
                    type="number"
                    required
                    min={1}
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value !== '' ? Number(e.target.value) : '')}
                    placeholder="Contoh: 650000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-base font-bold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
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
                  <p className="text-xs text-slate-400">Pengelolaan keuangan {profile.name}</p>
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
                  <input
                    type="number"
                    required
                    min={1}
                    value={formDebtAmount}
                    onChange={(e) => setFormDebtAmount(e.target.value !== '' ? Number(e.target.value) : '')}
                    placeholder="Contoh: 150000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
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
                <input
                  type="number"
                  required
                  min={1}
                  max={repayingDebt.remainingAmount}
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value !== '' ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-base"
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
    </div>
  );
};
