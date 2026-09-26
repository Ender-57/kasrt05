import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  HardDrive,
  Check,
} from 'lucide-react';
import { RTProfile, Resident, CashTransaction } from '../types';
import { syncToGoogleSheets, SyncResult } from '../services/googleSheets';
import { getAccessToken, googleSignIn } from '../services/auth';

interface GoogleSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: RTProfile;
  residents: Resident[];
  transactions: CashTransaction[];
  existingSpreadsheetId: string | null;
  onSyncSuccess: (result: SyncResult) => void;
  currentUserEmail?: string | null;
}

export const GoogleSyncModal: React.FC<GoogleSyncModalProps> = ({
  isOpen,
  onClose,
  profile,
  residents,
  transactions,
  existingSpreadsheetId,
  onSyncSuccess,
  currentUserEmail,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  const handleExecuteSync = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      let token = getAccessToken();

      // If token expired or not in memory, re-authenticate via Google popup
      if (!token) {
        const signResult = await googleSignIn();
        token = signResult?.accessToken || null;
      }

      if (!token) {
        throw new Error('Akses Google Workspace belum diizinkan. Silakan login dengan Google terlebih dahulu.');
      }

      const syncRes = await syncToGoogleSheets(
        token,
        profile,
        residents,
        transactions,
        existingSpreadsheetId
      );

      setResult(syncRes);
      onSyncSuccess(syncRes);
    } catch (err: unknown) {
      console.error('Sync failed:', err);
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat menyinkronkan data.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetModal = () => {
    setResult(null);
    setError(null);
    setConfirmed(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">
                Sinkronisasi Google Drive & Sheets
              </h3>
              <p className="text-xs text-slate-400">
                Pembaruan lembar kerja kas & iuran RT secara transparan
              </p>
            </div>
          </div>
          <button
            onClick={handleResetModal}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {result ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900">
                  Sinkronisasi Berhasil!
                </h4>
                <p className="text-sm text-slate-600 mt-1 max-w-sm mx-auto">
                  Data iuran {residents.length} rumah dan {transactions.length} transaksi kas berhasil diperbarui di Google Sheets Anda.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs font-mono text-slate-600 break-all">
                <span className="font-semibold text-slate-700 block font-sans mb-1">
                  ID Spreadsheet Google:
                </span>
                {result.spreadsheetId}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <a
                  href={result.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Buka di Google Sheets</span>
                </a>
                <button
                  onClick={handleResetModal}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Mandatory Confirmation Notice */}
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex gap-3 text-amber-900 text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Konfirmasi Pembaruan Data Spreadsheet</p>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Operasi ini akan {existingSpreadsheetId ? 'memperbarui isi data' : 'membuat file baru'} di Google Drive Anda:
                  </p>
                  <ul className="text-xs text-amber-800 list-disc list-inside space-y-0.5 pt-1">
                    <li>Sheet 1: <strong>Iuran Warga 2026</strong> ({residents.length} data rumah)</li>
                    <li>Sheet 2: <strong>Buku Kas Transaksi</strong> ({transactions.length} baris mutasi)</li>
                    <li>Sheet 3: <strong>Ringkasan Bulanan</strong> (Januari - Desember)</li>
                    <li>Sheet 4: <strong>Data Warga & KK</strong> (Kepala Keluarga & Silsilah)</li>
                    <li>Sheet 5: <strong>Visi & Program Kerja</strong> (Visi, Misi & Susunan Pengurus RT)</li>
                  </ul>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                    Target Akun Google:
                  </span>
                  <span className="font-semibold text-slate-800">
                    {currentUserEmail || 'Akun Google Anda'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">Status File:</span>
                  <span className="font-medium text-emerald-700">
                    {existingSpreadsheetId ? 'Akan ditimpa/diperbarui dengan data terbaru' : 'Akan dibuat otomatis di Google Drive'}
                  </span>
                </div>
              </div>

              {/* Explicit Confirmation Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-slate-700 select-none">
                  Saya setuju untuk menulis/memperbarui data kas dan iuran RT pada akun Google Drive & Sheets tersebut.
                </span>
              </label>

              {error && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleResetModal}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSync}
                  disabled={!confirmed || isSubmitting}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg text-white transition-all cursor-pointer ${
                    !confirmed || isSubmitting
                      ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-xs'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyinkronkan ke Google...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Konfirmasi & Sinkronkan Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
