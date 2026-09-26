import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  RotateCcw,
  Edit3,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { Resident, MonthKey, MONTHS, RTProfile } from '../types';
import { formatRupiah, formatDateIndo } from '../utils/formatters';

interface PaymentCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  resident: Resident | null;
  initialMonth?: MonthKey | null;
  profile: RTProfile;
  onApplyCorrection: (
    residentId: string,
    month: MonthKey,
    action: 'UPDATE' | 'VOID',
    newData?: {
      amount: number;
      paymentMethod: 'Tunai' | 'Transfer Bank' | 'QRIS RT';
      paidAt: string;
      reason: string;
    },
    cashAdjustment?: {
      adjustCashbook: boolean;
      amountDifference: number;
      reason: string;
    }
  ) => void;
}

export const PaymentCorrectionModal: React.FC<PaymentCorrectionModalProps> = ({
  isOpen,
  onClose,
  resident,
  initialMonth,
  profile,
  onApplyCorrection,
}) => {
  if (!isOpen || !resident) return null;

  // Find all months with existing payments
  const paidMonths = MONTHS.filter((m) => resident.payments[m]?.paid);

  const [selectedMonth, setSelectedMonth] = useState<MonthKey>(() => {
    if (initialMonth && resident.payments[initialMonth]?.paid) {
      return initialMonth;
    }
    return paidMonths[0] || 'Januari';
  });

  const [activeMode, setActiveMode] = useState<'UPDATE' | 'VOID'>('UPDATE');

  // Edit fields
  const currentPayment = resident.payments[selectedMonth];
  const [editAmount, setEditAmount] = useState<number>(currentPayment?.amount || 0);
  const [editMethod, setEditMethod] = useState<'Tunai' | 'Transfer Bank' | 'QRIS RT'>(
    currentPayment?.paymentMethod || 'Tunai'
  );
  const [editPaidAt, setEditPaidAt] = useState<string>(
    currentPayment?.paidAt || new Date().toISOString().split('T')[0]
  );
  const [correctionReason, setCorrectionReason] = useState('Salah ketik nominal pembayaran');
  const [customReasonText, setCustomReasonText] = useState('');
  const [adjustCashbook, setAdjustCashbook] = useState(true);

  // Sync month selection when modal opens or initialMonth/resident changes
  useEffect(() => {
    if (!isOpen || !resident) return;
    if (initialMonth && resident.payments[initialMonth]?.paid) {
      setSelectedMonth(initialMonth);
    } else {
      const validPaid = MONTHS.filter((m) => resident.payments[m]?.paid);
      if (validPaid.length > 0 && (!resident.payments[selectedMonth]?.paid)) {
        setSelectedMonth(validPaid[0]);
      }
    }
  }, [isOpen, initialMonth, resident]);

  // Sync state when selectedMonth changes
  useEffect(() => {
    if (!resident) return;
    const p = resident.payments[selectedMonth];
    if (p) {
      setEditAmount(p.amount);
      setEditMethod(p.paymentMethod || 'Tunai');
      setEditPaidAt(p.paidAt || new Date().toISOString().split('T')[0]);
    }
  }, [selectedMonth, resident]);

  const finalReason =
    correctionReason === 'Lainnya' ? customReasonText || 'Koreksi pengurus' : correctionReason;

  // Handle Update
  const handleSaveUpdate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentPayment || editAmount <= 0) return;

    const diff = editAmount - currentPayment.amount;

    onApplyCorrection(
      resident.id,
      selectedMonth,
      'UPDATE',
      {
        amount: Number(editAmount),
        paymentMethod: editMethod,
        paidAt: editPaidAt,
        reason: finalReason,
      },
      {
        adjustCashbook,
        amountDifference: diff,
        reason: `[Koreksi Iuran] Warga No. ${resident.houseNo} (${resident.name}) - Bulan ${selectedMonth}: penyesuaian nominal dari ${formatRupiah(currentPayment.amount)} menjadi ${formatRupiah(editAmount)} (${finalReason})`,
      }
    );

    onClose();
  };

  // Handle Void (Fixed: No window.confirm to avoid iframe suppression, executed directly)
  const handleExecuteVoid = () => {
    if (!currentPayment) return;

    onApplyCorrection(
      resident.id,
      selectedMonth,
      'VOID',
      undefined,
      {
        adjustCashbook,
        amountDifference: -currentPayment.amount, // decrease cashbook by voided amount
        reason: `[Pembatalan Iuran] Warga No. ${resident.houseNo} (${resident.name}) - Bulan ${selectedMonth}: dibatalkan sebesar ${formatRupiah(currentPayment.amount)} (${finalReason})`,
      }
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[82vh] animate-in fade-in zoom-in duration-150">
        {/* Compact Header (Always Pinned at Top) */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm leading-tight">
                Koreksi / Batalkan Input Iuran
              </h3>
              <p className="text-[10px] text-slate-400 leading-tight">
                Rumah No. {resident.houseNo} — {resident.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-2.5 text-xs">
          {/* Month Selector */}
          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-700">
                Pilih Bulan Yang Dikoreksi:
              </label>
              <span className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.5 border border-slate-200 text-slate-600 rounded">
                RT {profile.rtNumber}
              </span>
            </div>
            {paidMonths.length === 0 ? (
              <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                Rumah ini belum memiliki catatan pembayaran iuran untuk dikoreksi.
              </div>
            ) : (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value as MonthKey)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                {paidMonths.map((m) => (
                  <option key={m} value={m}>
                    {m} 2026 — Terbayar {formatRupiah(resident.payments[m]?.amount || 0)} (
                    {resident.payments[m]?.paymentMethod || 'Tunai'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {currentPayment ? (
            <>
              {/* Existing Payment Summary Banner */}
              <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-900 text-xs">
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Data Saat Ini ({selectedMonth} 2026):
                  </span>
                  <span className="font-mono text-xs text-emerald-800 font-bold">
                    {formatRupiah(currentPayment.amount)}
                  </span>
                </div>
                <div className="text-[10px] text-emerald-700 flex items-center justify-between pt-1">
                  <span>Metode: {currentPayment.paymentMethod || 'Tunai'}</span>
                  <span>Tgl: {formatDateIndo(currentPayment.paidAt || '')}</span>
                  {currentPayment.receiptNo && (
                    <span className="font-mono">#{currentPayment.receiptNo}</span>
                  )}
                </div>
              </div>

              {/* Mode Tabs */}
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveMode('UPDATE')}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs ${
                    activeMode === 'UPDATE'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Koreksi Nominal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMode('VOID')}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs ${
                    activeMode === 'VOID'
                      ? 'bg-rose-600 text-white shadow-2xs font-bold'
                      : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Batalkan Pembayaran</span>
                </button>
              </div>

              {/* TAB 1: UPDATE NOMINAL / DATA */}
              {activeMode === 'UPDATE' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Nominal Sebenarnya (Rp) *
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={editAmount}
                        onChange={(e) => setEditAmount(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Metode Pembayaran
                      </label>
                      <select
                        value={editMethod}
                        onChange={(e) => setEditMethod(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="Tunai">Tunai</option>
                        <option value="Transfer Bank">Transfer Bank</option>
                        <option value="QRIS RT">QRIS RT</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      Tanggal Pembayaran
                    </label>
                    <input
                      type="date"
                      value={editPaidAt}
                      onChange={(e) => setEditPaidAt(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      Alasan Koreksi *
                    </label>
                    <select
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 mb-1"
                    >
                      <option value="Salah ketik nominal pembayaran">Salah ketik nominal pembayaran</option>
                      <option value="Warga membayar sebagian / cicil">Warga membayar sebagian / cicil</option>
                      <option value="Perubahan metode pembayaran">Perubahan metode pembayaran</option>
                      <option value="Koreksi tanggal transaksi">Koreksi tanggal transaksi</option>
                      <option value="Lainnya">Lainnya (Tulis alasan khusus)</option>
                    </select>

                    {correctionReason === 'Lainnya' && (
                      <input
                        type="text"
                        required
                        value={customReasonText}
                        onChange={(e) => setCustomReasonText(e.target.value)}
                        placeholder="Ketik alasan koreksi..."
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    )}
                  </div>

                  {editAmount !== currentPayment.amount && (
                    <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px] space-y-1">
                      <div className="flex items-center justify-between font-semibold">
                        <span>Selisih Kas RT:</span>
                        <span className="font-mono font-bold">
                          {editAmount > currentPayment.amount
                            ? `+${formatRupiah(editAmount - currentPayment.amount)} (Bertambah)`
                            : `-${formatRupiah(currentPayment.amount - editAmount)} (Berkurang)`}
                        </span>
                      </div>
                      <label className="flex items-center gap-1.5 pt-0.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={adjustCashbook}
                          onChange={(e) => setAdjustCashbook(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="text-[10px] text-amber-800">
                          Sesuaikan selisih otomatis pada Buku Kas RT
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: VOID / BATALKAN PEMBAYARAN */}
              {activeMode === 'VOID' && (
                <div className="space-y-2.5">
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-800 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                      <span>Konfirmasi Pembatalan Input Iuran</span>
                    </div>
                    <p className="text-[10px] leading-relaxed text-rose-700">
                      Tindakan ini akan <strong>menghapus tanda lunas</strong> bulan{' '}
                      <strong>{selectedMonth} 2026</strong> untuk <strong>Rumah No. {resident.houseNo}</strong>.
                      Status rumah ini akan kembali menjadi <strong>Belum Bayar / Menunggak</strong>.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      Alasan Pembatalan *
                    </label>
                    <select
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 mb-1"
                    >
                      <option value="Uang iuran belum diterima / batal bayar">
                        Uang iuran belum diterima / batal bayar
                      </option>
                      <option value="Salah pilih nama warga / rumah">Salah pilih nama warga / rumah</option>
                      <option value="Salah klik bulan iuran">Salah klik bulan iuran</option>
                      <option value="Input ganda / duplikat">Input ganda / duplikat</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>

                    {correctionReason === 'Lainnya' && (
                      <input
                        type="text"
                        value={customReasonText}
                        onChange={(e) => setCustomReasonText(e.target.value)}
                        placeholder="Ketik alasan pembatalan..."
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                      />
                    )}
                  </div>

                  <label className="flex items-start gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adjustCashbook}
                      onChange={(e) => setAdjustCashbook(e.target.checked)}
                      className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-700 leading-tight">
                      <strong>Catat penyesuaian di Buku Kas:</strong> Mengurangi kas RT sebesar{' '}
                      <span className="font-mono font-bold text-rose-700">
                        {formatRupiah(currentPayment.amount)}
                      </span>{' '}
                      agar saldo kas fisik/rekening tetap sinkron dan akurat.
                    </span>
                  </label>
                </div>
              )}
            </>
          ) : (
            <div className="py-6 text-center text-slate-400 text-xs">
              Pilih bulan yang memiliki catatan pembayaran di atas untuk dikoreksi.
            </div>
          )}
        </div>

        {/* PINNED / FIXED BOTTOM FOOTER (Always 100% visible on screen) */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Batal
          </button>

          {currentPayment && (
            <>
              {activeMode === 'UPDATE' ? (
                <button
                  type="button"
                  onClick={() => handleSaveUpdate()}
                  disabled={editAmount <= 0}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  Simpan Koreksi
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleExecuteVoid}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Batalkan Pembayaran Bulan Ini</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
