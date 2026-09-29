import React, { useState, useMemo } from 'react';
import {
  PlusCircle,
  Trash2,
  CheckCircle2,
  Calendar,
  Users,
  Search,
  RotateCcw,
  AlertTriangle,
  Info,
  X,
  CreditCard,
  Check,
  Pencil,
} from 'lucide-react';
import { Resident, IncidentalDuesProgram, IncidentalDuesPayment, RTProfile, CashTransaction } from '../types';
import { formatRupiah, formatDateIndo, getTodayJakarta } from '../utils/formatters';
import { IncidentalReceiptModal } from './IncidentalReceiptModal';
import { FileText, Share2 } from 'lucide-react';

interface IncidentalDuesViewProps {
  residents: Resident[];
  isAdmin: boolean;
  profile: RTProfile;
  incidentalPrograms: IncidentalDuesProgram[];
  onSaveIncidentalProgram?: (program: IncidentalDuesProgram) => Promise<void>;
  onDeleteIncidentalProgram?: (id: string) => Promise<void>;
  onAddTransaction: (tx: Omit<CashTransaction, 'id'>) => void;
}

export const IncidentalDuesView: React.FC<IncidentalDuesViewProps> = ({
  residents,
  isAdmin,
  profile,
  incidentalPrograms,
  onSaveIncidentalProgram,
  onDeleteIncidentalProgram,
  onAddTransaction,
}) => {
  // Main states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<IncidentalDuesProgram | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  // Form states for Create Program
  const [programTitle, setProgramTitle] = useState('');
  const [programAmount, setProgramAmount] = useState<number>(50000);
  const [programDate, setProgramDate] = useState(() => getTodayJakarta());
  const [programDesc, setProgramDesc] = useState('');

  // Search & Filter inside Manage Modal
  const [residentSearch, setResidentSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');

  // Form states for recording single resident payment
  const [recordingResidentId, setRecordingResidentId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<'Tunai' | 'Transfer Bank' | 'QRIS RT'>('Tunai');
  const [payNote, setPayNote] = useState('');
  const [syncToCashbook, setSyncToCashbook] = useState(true);

  // Form states for Editing Program
  const [editingProgram, setEditingProgram] = useState<IncidentalDuesProgram | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDate, setEditDate] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Receipt Modal state
  const [receiptModalState, setReceiptModalState] = useState<{
    isOpen: boolean;
    resident: Resident | null;
    program: IncidentalDuesProgram | null;
    payment: IncidentalDuesPayment | null;
  }>({
    isOpen: false,
    resident: null,
    program: null,
    payment: null,
  });

  const startEditProgram = (prog: IncidentalDuesProgram) => {
    setEditingProgram(prog);
    setEditTitle(prog.title);
    setEditAmount(prog.amount);
    setEditDate(prog.date);
    setEditDesc(prog.description || '');
  };

  const handleUpdateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProgram || !editTitle.trim() || editAmount <= 0) return;

    const updatedProgram: IncidentalDuesProgram = {
      ...editingProgram,
      title: editTitle.trim(),
      amount: editAmount,
      date: editDate,
      description: editDesc.trim() || undefined,
    };

    if (onSaveIncidentalProgram) {
      await onSaveIncidentalProgram(updatedProgram);
    }

    setEditingProgram(null);
  };

  // Handle program creation
  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programTitle.trim() || programAmount <= 0) return;

    const newProgram: IncidentalDuesProgram = {
      id: `inc-${Date.now()}`,
      title: programTitle.trim(),
      amount: programAmount,
      date: programDate,
      description: programDesc.trim() || undefined,
      payments: {},
    };

    if (onSaveIncidentalProgram) {
      await onSaveIncidentalProgram(newProgram);
    }

    // Reset Form
    setProgramTitle('');
    setProgramAmount(50000);
    setProgramDesc('');
    setIsCreateModalOpen(false);
  };

  // Handle deleting a program
  const handleDeleteProgram = async (id: string, title: string) => {
    if (!window.confirm(`Hapus program iuran "${title}"? Seluruh data pembayaran warga untuk program ini juga akan dihapus.`)) return;
    if (onDeleteIncidentalProgram) {
      await onDeleteIncidentalProgram(id);
    }
  };

  // Handle recording payment
  const handleRecordPayment = async (residentId: string, residentName: string, houseNo: string) => {
    if (!selectedProgram) return;

    const updatedProgram: IncidentalDuesProgram = {
      ...selectedProgram,
      payments: {
        ...selectedProgram.payments,
        [residentId]: {
          paid: true,
          paidAt: getTodayJakarta(),
          paymentMethod: payMethod,
          note: payNote.trim() || undefined,
          receiptNo: `KW-INS-${Date.now().toString().slice(-6)}`,
        },
      },
    };

    if (onSaveIncidentalProgram) {
      await onSaveIncidentalProgram(updatedProgram);
      setSelectedProgram(updatedProgram); // Update modal view state
    }

    // Optional Cashbook sync
    if (syncToCashbook) {
      onAddTransaction({
        date: getTodayJakarta(),
        type: 'MASUK',
        category: 'Donasi / Swadaya',
        description: `Iuran ${selectedProgram.title} No. ${houseNo} (${residentName})`,
        amount: selectedProgram.amount,
        recordedBy: profile.treasurerName || 'Bendahara RT',
        receiptNumber: `KW-INS-${Date.now().toString().slice(-6)}`,
        notes: payNote.trim() || `Iuran insidentil ${selectedProgram.title}`,
      });
    }

    // Reset recording states
    setRecordingResidentId(null);
    setPayNote('');
  };

  // Handle cancelling/reversing payment
  const handleCancelPayment = async (residentId: string, residentName: string) => {
    if (!selectedProgram) return;
    if (!window.confirm(`Batalkan pembayaran untuk ${residentName}? Data pembayaran akan diubah menjadi Belum Lunas.`)) return;

    const updatedPayments = { ...selectedProgram.payments };
    delete updatedPayments[residentId];

    const updatedProgram: IncidentalDuesProgram = {
      ...selectedProgram,
      payments: updatedPayments,
    };

    if (onSaveIncidentalProgram) {
      await onSaveIncidentalProgram(updatedProgram);
      setSelectedProgram(updatedProgram); // Update modal view state
    }
  };

  // Filtered residents list inside Manage Modal
  const manageResidentsList = useMemo(() => {
    if (!selectedProgram) return [];
    
    // Sort residents by house number numerically
    const sorted = [...residents].sort((a, b) =>
      a.houseNo.localeCompare(b.houseNo, undefined, { numeric: true })
    );

    return sorted.filter((r) => {
      // 1. Search term
      const matchesSearch =
        r.name.toLowerCase().includes(residentSearch.toLowerCase()) ||
        r.houseNo.toLowerCase().includes(residentSearch.toLowerCase());
      
      if (!matchesSearch) return false;

      // 2. Filter tabs
      const isPaid = Boolean(selectedProgram.payments[r.id]?.paid);
      if (paymentFilter === 'PAID') return isPaid;
      if (paymentFilter === 'UNPAID') return !isPaid;
      
      return true;
    });
  }, [residents, selectedProgram, residentSearch, paymentFilter]);

  return (
    <div className="space-y-6">
      {/* Header Info & Action */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-3xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
            Iuran Insidentil & Swadaya Warga
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Kelola penggalangan iuran non-rutin bersasaran tunggal seperti program gotong-royong, pengerukan saluran air, fogging, perbaikan fasilitas RT, perayaan HUT RI dan program lainnya.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Tambah Program Baru</span>
          </button>
        )}
      </div>

      {/* Program Grid */}
      {incidentalPrograms.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-12 text-center max-w-lg mx-auto">
          <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="font-bold text-sm text-slate-800">Belum Ada Program Insidentil</h3>
          <p className="text-xs text-slate-500 mt-1">
            Belum ada program iuran insidentil yang aktif saat ini. {isAdmin ? 'Silakan buat program baru untuk mulai menggalang iuran warga.' : 'Hubungi pengurus RT untuk info swadaya.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {incidentalPrograms.map((prog) => {
            const paidCount = Object.values(prog.payments).filter((p) => p.paid).length;
            const totalCount = residents.filter((r) => !r.isVacant).length || 1;
            const percentPaid = Math.round((paidCount / totalCount) * 100);
            const totalAmountCollected = paidCount * prog.amount;

            return (
              <div
                key={prog.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden hover:shadow-xs transition-shadow flex flex-col justify-between"
              >
                {/* Body */}
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        Program Khusus
                      </span>
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 mt-1.5 leading-tight">
                        {prog.title}
                      </h3>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditProgram(prog)}
                          className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                          title="Edit program iuran"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProgram(prog.id, prog.title)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Hapus program"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {prog.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {prog.description}
                    </p>
                  )}

                  {/* Pricing and target */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Iuran per Rumah</span>
                      <span className="text-sm font-extrabold text-slate-800 font-mono">{formatRupiah(prog.amount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Terkumpul</span>
                      <span className="text-sm font-extrabold text-emerald-700 font-mono">{formatRupiah(totalAmountCollected)}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                      <span>Progres Pembayaran Warga</span>
                      <span className="font-mono">{paidCount} / {totalCount} Rumah ({percentPaid}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-500"
                        style={{ width: `${Math.min(100, percentPaid)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Button */}
                <div className="bg-slate-50/80 px-5 py-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Dibuat {formatDateIndo(prog.date)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProgram(prog);
                      setIsManageModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-white hover:bg-emerald-50 border border-slate-200 text-slate-700 hover:text-emerald-700 font-bold text-xs rounded-xl transition-all shadow-3xs cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>{isAdmin ? 'Kelola Pembayaran' : 'Cek Status Bayar'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE NEW PROGRAM MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
            {/* Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm sm:text-base">Buat Program Iuran Baru</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateProgram} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">Nama Program Iuran</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Pengerukan Saluran Selokan Blok A-D"
                  value={programTitle}
                  onChange={(e) => setProgramTitle(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Nominal Iuran (Rp)</label>
                  <input
                    type="number"
                    required
                    min={1000}
                    step={1000}
                    placeholder="50000"
                    value={programAmount}
                    onChange={(e) => setProgramAmount(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-slate-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Tanggal Mulai</label>
                  <input
                    type="date"
                    required
                    value={programDate}
                    onChange={(e) => setProgramDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-slate-50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">Deskripsi / Penjelasan Singkat</label>
                <textarea
                  rows={3}
                  placeholder="Berikan keterangan singkat mengapa iuran insidentil ini diadakan, target pelaksanaan, atau rincian gotong-royong..."
                  value={programDesc}
                  onChange={(e) => setProgramDesc(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-slate-50 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-xs"
                >
                  Simpan Program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE / VIEW RESIDENT PAYMENTS MODAL */}
      {isManageModalOpen && selectedProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[85vh] animate-in zoom-in duration-200">
            {/* Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                  Penggalangan Swadaya Insidentil
                </span>
                <h3 className="font-extrabold text-sm sm:text-base leading-tight mt-0.5">
                  {selectedProgram.title}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsManageModalOpen(false);
                  setSelectedProgram(null);
                  setRecordingResidentId(null);
                  setResidentSearch('');
                  setPaymentFilter('ALL');
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Program Brief Alert Info */}
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-150 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-slate-500" />
                <span>Kewajiban Iuran: <strong>{formatRupiah(selectedProgram.amount)}</strong> per rumah</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 font-mono">
                Total Terkumpul: {formatRupiah(Object.values(selectedProgram.payments).filter(p => p.paid).length * selectedProgram.amount)}
              </span>
            </div>

            {/* Filter controls */}
            <div className="px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row items-center gap-3.5 shrink-0">
              {/* Search */}
              <div className="relative w-full sm:flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama warga / nomor rumah..."
                  value={residentSearch}
                  onChange={(e) => setResidentSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Tabs */}
              <div className="flex border border-slate-200 rounded-xl overflow-hidden shrink-0 w-full sm:w-auto text-xs font-semibold">
                {(['ALL', 'PAID', 'UNPAID'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setPaymentFilter(tab)}
                    className={`flex-1 sm:flex-none px-4 py-2 border-r last:border-r-0 transition-colors cursor-pointer ${
                      paymentFilter === tab
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {tab === 'ALL' ? 'Semua Warga' : tab === 'PAID' ? 'Lunas' : 'Belum Bayar'}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Resident Payment List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {manageResidentsList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Tidak ada data warga ditemukan yang cocok dengan kriteria filter.
                </div>
              ) : (
                <div className="space-y-3">
                  {manageResidentsList.map((res) => {
                    const pay = selectedProgram.payments[res.id];
                    const isPaid = Boolean(pay?.paid);
                    const isRecording = recordingResidentId === res.id;

                    return (
                      <div
                        key={res.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isPaid
                            ? 'bg-emerald-50/40 border-emerald-100'
                            : 'bg-white border-slate-150'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                No. {res.houseNo}
                              </span>
                              <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                {res.name}
                              </h4>
                              {res.isVacant && (
                                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded border">
                                  KOSONG
                                </span>
                              )}
                            </div>
                            
                            {/* Subtitle / Pay Info */}
                            {isPaid && pay && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11px] text-emerald-800">
                                <span className="flex items-center gap-1 font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Lunas ({pay.paymentMethod || 'Tunai'})</span>
                                </span>
                                <span className="text-emerald-600">•</span>
                                <span>Bayar: {formatDateIndo(pay.paidAt || '')}</span>
                                {pay.receiptNo && (
                                  <>
                                    <span className="text-emerald-600">•</span>
                                    <span className="font-mono bg-emerald-100/60 px-1 py-0.1 rounded font-bold text-[10px]">{pay.receiptNo}</span>
                                  </>
                                )}
                                {pay.note && (
                                  <>
                                    <span className="text-emerald-600">•</span>
                                    <span className="italic text-slate-500">"{pay.note}"</span>
                                  </>
                                )}
                                <div className="w-full sm:w-auto flex items-center gap-2 mt-1 sm:mt-0 sm:ml-2">
                                  <button
                                    type="button"
                                    onClick={() => setReceiptModalState({
                                      isOpen: true,
                                      resident: res,
                                      program: selectedProgram,
                                      payment: pay
                                    })}
                                    className="inline-flex items-center gap-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-lg border border-emerald-300 transition-colors cursor-pointer"
                                    title="Lihat kuitansi digital untuk di-print atau di-download"
                                  >
                                    <FileText className="w-3 h-3 text-emerald-700" />
                                    <span>Kuitansi</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {!isPaid && (
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-700 font-semibold">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>Belum membayar • Tagihan: {formatRupiah(selectedProgram.amount)}</span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          {isAdmin && (
                            <div className="shrink-0 flex items-center gap-2">
                              {!isPaid ? (
                                !isRecording ? (
                                  <button
                                    type="button"
                                    onClick={() => setRecordingResidentId(res.id)}
                                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-2xs cursor-pointer"
                                  >
                                    Catat Bayar
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setRecordingResidentId(null)}
                                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                                  >
                                    Batal
                                  </button>
                                )
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleCancelPayment(res.id, res.name)}
                                  className="px-3.5 py-1.5 bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                                >
                                  Batalkan
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Payment Record Capture Form (Expands inline) */}
                        {isRecording && (
                          <div className="mt-3.5 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5 animate-in slide-in-from-top-2 duration-150">
                            <h5 className="font-bold text-[11px] text-slate-700 uppercase flex items-center gap-1.5">
                              <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                              <span>Catat Transaksi Bayar ({formatRupiah(selectedProgram.amount)})</span>
                            </h5>

                            {/* Method */}
                            <div className="grid grid-cols-3 gap-2">
                              {(['Tunai', 'Transfer Bank', 'QRIS RT'] as const).map((method) => (
                                <button
                                  key={method}
                                  type="button"
                                  onClick={() => setPayMethod(method)}
                                  className={`py-1.5 px-2 text-xs font-semibold rounded-lg border text-center transition-colors cursor-pointer ${
                                    payMethod === method
                                      ? 'bg-slate-900 text-white border-slate-900'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {method}
                                </button>
                              ))}
                            </div>

                            {/* Note */}
                            <input
                              type="text"
                              placeholder="Catatan tambahan (opsional)..."
                              value={payNote}
                              onChange={(e) => setPayNote(e.target.value)}
                              className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                            />

                            {/* Sync to Cashbook checkbox */}
                            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={syncToCashbook}
                                onChange={(e) => setSyncToCashbook(e.target.checked)}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span>Sinkronkan ke Buku Kas RT (sebagai MASUK kategori Donasi/Swadaya)</span>
                            </label>

                            {/* Save Button */}
                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => handleRecordPayment(res.id, res.name, res.houseNo)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                              >
                                <Check className="w-4 h-4" />
                                <span>Simpan Pembayaran</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer info counts */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 font-medium flex items-center justify-between shrink-0">
              <span>Warga Lunas: <strong>{Object.values(selectedProgram.payments).filter(p => p.paid).length}</strong> dari total {residents.filter((r) => !r.isVacant).length} rumah</span>
              <button
                onClick={() => {
                  setIsManageModalOpen(false);
                  setSelectedProgram(null);
                  setRecordingResidentId(null);
                  setResidentSearch('');
                  setPaymentFilter('ALL');
                }}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-3xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PROGRAM MODAL */}
      {editingProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
            {/* Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <Pencil className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm sm:text-base">Edit Program Iuran</h3>
              </div>
              <button
                onClick={() => setEditingProgram(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateProgram} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">Nama Program Iuran</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Pengerukan Saluran Selokan Blok A-D"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Nominal Iuran (Rp)</label>
                  <input
                    type="number"
                    required
                    min={1000}
                    step={1000}
                    placeholder="50000"
                    value={editAmount}
                    onChange={(e) => setEditAmount(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-slate-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Tanggal Mulai</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-slate-50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">Deskripsi / Penjelasan Singkat</label>
                <textarea
                  rows={3}
                  placeholder="Berikan keterangan singkat..."
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-slate-50 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3.5">
                <button
                  type="button"
                  onClick={() => setEditingProgram(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-xs"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INCIDENTAL RECEIPTS MODAL */}
      <IncidentalReceiptModal
        isOpen={receiptModalState.isOpen}
        onClose={() => setReceiptModalState({ isOpen: false, resident: null, program: null, payment: null })}
        resident={receiptModalState.resident}
        program={receiptModalState.program}
        payment={receiptModalState.payment}
        profile={profile}
      />
    </div>
  );
};
