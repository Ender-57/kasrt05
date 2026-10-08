import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, Share2, ShieldCheck, Download, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { CashTransaction, RTProfile } from '../types';
import { formatRupiah, formatDateIndo, terbilang, getOfficerForDate, getCleanRtRwTitle } from '../utils/formatters';

interface CashReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: CashTransaction | null;
  profile: RTProfile;
}

export const CashReceiptModal: React.FC<CashReceiptModalProps> = ({
  isOpen,
  onClose,
  transaction,
  profile,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string>('');
  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    if (!isOpen) return;

    const updateScale = () => {
      if (containerRef.current) {
        const availableWidth = containerRef.current.clientWidth - 24;
        if (availableWidth < 600 && availableWidth > 0) {
          setScale(Math.max(0.45, availableWidth / 600));
        } else {
          setScale(1);
        }
      }
    };

    updateScale();
    const timer = setTimeout(updateScale, 50);
    window.addEventListener('resize', updateScale);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateScale);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/logo-rt05.png')
      .then((res) => res.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoBase64(reader.result as string);
        };
        reader.readAsDataURL(blob);
      })
      .catch((err) => {
        console.error('Error loading logo as base64 in CashReceiptModal:', err);
      });
  }, [isOpen]);

  if (!isOpen || !transaction) return null;

  const txDate = transaction.date;
  const treasurerOfficer = getOfficerForDate(profile, 'Bendahara', txDate);
  const chairpersonOfficer = getOfficerForDate(profile, 'Ketua RT', txDate);
  
  const isIncome = transaction.type === 'MASUK';
  const isSalary = !!transaction.salaryRecipient || transaction.category === 'Gaji & Honor';
  
  const receiptNumber = transaction.receiptNumber || (isSalary ? `SLR-${transaction.id.slice(-6)}` : isIncome ? `BKM-${transaction.id.slice(-6)}` : `BKK-${transaction.id.slice(-6)}`);

  const receiptTitle = isSalary
    ? 'KUITANSI PEMBAYARAN GAJI & HONOR'
    : isIncome
    ? 'BUKTI KAS MASUK (BKM)'
    : 'BUKTI KAS KELUAR (BKK)';

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    try {
      setIsDownloading(true);

      // Safari/iOS Chrome multi-pass warmup render loop
      let dataUrl = '';
      for (let i = 0; i < 3; i++) {
        dataUrl = await toPng(receiptRef.current, {
          quality: 0.95,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          skipFonts: true,
          cacheBust: true,
          style: {
            transform: 'none',
            width: '600px',
            height: '800px',
          },
        });
        if (i < 2) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }

      const link = document.createElement('a');
      const cleanName = (transaction.salaryRecipient || transaction.description || 'Transaksi').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
      const cleanFileName = `Kuitansi_Kas_${cleanName}_${receiptNumber}.png`;
      link.download = cleanFileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating cash receipt image:', error);
      alert(`Gagal mengunduh kuitansi gambar: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareWhatsApp = () => {
    let message = `*${receiptTitle}*\n` +
      `No. Dokumen: ${receiptNumber}\n` +
      `Tanggal: ${formatDateIndo(txDate)}\n` +
      `Kategori: ${transaction.category}\n` +
      `Uraian: ${transaction.description}\n`;

    if (isSalary) {
      message += `Penerima Gaji: ${transaction.salaryRecipient || '-'}\n` +
        `Bulan Gaji: ${transaction.salaryMonth || '-'}\n` +
        `Gaji Pokok: ${formatRupiah(transaction.salaryBase || transaction.amount)}\n`;
      if (transaction.salaryDeduction && transaction.salaryDeduction > 0) {
        message += `Potongan: -${formatRupiah(transaction.salaryDeduction)} (${transaction.salaryDeductionType || 'Kasbon'})\n`;
      }
      message += `Jumlah Bersih (Netto): ${formatRupiah(transaction.amount)}\n`;
    } else {
      message += `Jenis: ${isIncome ? 'Pemasukan Kas' : 'Pengeluaran Kas'}\n` +
        `Nominal: ${formatRupiah(transaction.amount)}\n`;
    }

    message += `Terbilang: _${terbilang(transaction.amount)} Rupiah_\n` +
      `Dicatat Oleh: ${transaction.recordedBy || 'Pengurus RT'}\n` +
      (transaction.notes ? `Catatan: ${transaction.notes}\n` : '') +
      `Status: *SAH / DIBUKUKAN*\n\n` +
      `Kuitansi digital ini diterbitkan secara transparan melalui *Aplikasi Kas ${profile.name}*.\n\n` +
      `_Salam hormat,_\n` +
      `*Pengurus ${profile.name}*`;

    const encoded = encodeURIComponent(message);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleShareWhatsAppPNG = async () => {
    if (!receiptRef.current) return;
    try {
      setIsDownloading(true);

      // Safari/iOS Chrome multi-pass warmup render loop
      let dataUrl = '';
      for (let i = 0; i < 3; i++) {
        dataUrl = await toPng(receiptRef.current, {
          quality: 0.95,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          skipFonts: true,
          cacheBust: true,
          style: {
            transform: 'none',
            width: '600px',
            height: '800px',
          },
        });
        if (i < 2) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }

      const resBlob = await fetch(dataUrl);
      const blob = await resBlob.blob();
      const cleanName = (transaction.salaryRecipient || transaction.description || 'Transaksi').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
      const file = new File([blob], `Kuitansi_Kas_${cleanName}_${receiptNumber}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${receiptTitle} - ${receiptNumber}`,
          text: `Bukti Kuitansi Kas RT: ${transaction.description} (${formatRupiah(transaction.amount)}) - ${receiptNumber}`,
        });
      } else {
        // Fallback: Download file, alert instruction, and trigger normal WhatsApp message share
        const link = document.createElement('a');
        link.download = file.name;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert("Gambar Kuitansi PNG berhasil diunduh ke perangkat Anda.\n\nSistem akan mengarahkan Anda ke WhatsApp. Silakan pilih kontak & lampirkan file kuitansi yang baru saja terunduh.");
        handleShareWhatsApp();
      }
    } catch (error) {
      console.error('Error sharing receipt image:', error);
      alert(`Gagal memproses gambar kuitansi: ${error instanceof Error ? error.message : String(error)}`);
      handleShareWhatsApp();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-2 sm:p-4">
      <div className="min-h-full flex items-center justify-center p-0 sm:p-2 text-center">
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in duration-200 text-left">
          {/* Modal Header */}
          <div className="px-4 sm:px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between print:hidden">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">Kuitansi Kas</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Printable Receipt Body */}
          <div
            ref={containerRef}
            className="w-full bg-amber-50/30 p-3 sm:p-6 flex items-center justify-center text-slate-800 print:bg-white print:p-0 overflow-hidden"
          >
            <div
              style={{
                width: `${Math.round(600 * scale)}px`,
                height: `${Math.round(800 * scale)}px`,
              }}
              className="relative flex items-center justify-center shrink-0 transition-all duration-150"
            >
              <div
                ref={receiptRef}
                className="w-[600px] h-[800px] border-4 border-double border-slate-700 p-6 rounded-lg bg-white shadow-xs relative overflow-hidden flex flex-col justify-between origin-top-left"
                style={{
                  transform: `scale(${scale})`,
                  width: '600px',
                  height: '800px',
                  aspectRatio: '3/4',
                }}
              >
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] select-none rotate-[-25deg]">
              <span className="text-8xl font-black text-slate-900">
                {isSalary ? 'LUNAS' : isIncome ? 'KAS MASUK' : 'KAS KELUAR'}
              </span>
            </div>

            {/* Top section */}
            <div className="flex-1 flex flex-col justify-start">
              {/* Receipt Header */}
              <div className="border-b-2 border-slate-800 pb-3 mb-3 text-center">
                <div className="flex items-center justify-center gap-3 mb-1">
                  <img
                    src={logoBase64 || "/logo-rt05.png"}
                    crossOrigin="anonymous"
                    alt="Logo RT"
                    className="w-13 h-13 object-contain rounded-full border border-slate-300 shadow-2xs shrink-0"
                  />
                  <div className="text-left">
                    <h2 className="text-base font-bold tracking-tight text-slate-900 uppercase leading-tight">
                      {getCleanRtRwTitle(profile)}
                    </h2>
                    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                      Desa {profile.subdistrict}, Kec. {profile.district}, {profile.city}
                    </p>
                  </div>
                </div>
                <div className="inline-block mt-1 px-3 py-0.5 bg-slate-900 text-white text-[11px] font-semibold uppercase tracking-wider rounded">
                  {receiptTitle}
                </div>
              </div>

              {/* Receipt Metadata */}
              <div className="flex justify-between items-center text-xs mb-3 text-slate-600 bg-slate-50 px-3 py-2 rounded border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-700">No. Bukti:</span>{' '}
                  <span className="font-mono font-bold text-slate-900">{receiptNumber}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Tanggal:</span>{' '}
                  <span className="font-mono font-medium">{formatDateIndo(txDate)}</span>
                </div>
              </div>

              {/* Receipt Content Table */}
              <div className="space-y-2 text-xs">
                {isSalary ? (
                  <>
                    <div className="grid grid-cols-12 gap-2 py-1.5 border-b border-slate-100">
                      <div className="col-span-4 text-slate-500 font-medium">Telah Dibayarkan Kepada</div>
                      <div className="col-span-8 font-semibold text-slate-900 flex items-center gap-2">
                        <span>{transaction.salaryRecipient || transaction.description}</span>
                        <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded-full font-bold">
                          Pengurus / Petugas RT
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2 py-1.5 border-b border-slate-100">
                      <div className="col-span-4 text-slate-500 font-medium">Periode Bulan Gaji</div>
                      <div className="col-span-8 font-semibold text-slate-800">
                        {transaction.salaryMonth || 'Bulan Berjalan'}
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2 py-1.5 border-b border-slate-100">
                      <div className="col-span-4 text-slate-500 font-medium">Gaji Pokok (Bruto)</div>
                      <div className="col-span-8 font-mono font-bold text-slate-800">
                        {formatRupiah(transaction.salaryBase || transaction.amount)}
                      </div>
                    </div>

                    {transaction.salaryDeduction && transaction.salaryDeduction > 0 ? (
                      <div className="grid grid-cols-12 gap-2 py-1.5 border-b border-slate-100 bg-amber-50/50 px-2 rounded">
                        <div className="col-span-4 text-amber-800 font-medium">
                          Potongan ({transaction.salaryDeductionType === 'KASBON' ? 'Kasbon' : 'Lainnya'})
                        </div>
                        <div className="col-span-8 font-mono font-bold text-amber-700">
                          - {formatRupiah(transaction.salaryDeduction)}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-12 gap-2 py-1.5 border-b border-slate-100">
                      <div className="col-span-4 text-slate-500 font-medium">Kategori Transaksi</div>
                      <div className="col-span-8 font-semibold text-slate-900 flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium text-[11px]">
                          {transaction.category}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${isIncome ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {isIncome ? 'KAS MASUK' : 'KAS KELUAR'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2 py-1.5 border-b border-slate-100">
                      <div className="col-span-4 text-slate-500 font-medium">Uraian / Keterangan</div>
                      <div className="col-span-8 font-medium text-slate-900 leading-relaxed">
                        {transaction.description}
                      </div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-12 gap-2 py-1.5 border-b border-slate-100">
                  <div className="col-span-4 text-slate-500 font-medium">
                    {isSalary ? 'Gaji Bersih Diterima' : 'Jumlah Nominal'}
                  </div>
                  <div className="col-span-8 flex items-center justify-between">
                    <span className={`text-base font-bold font-mono ${isIncome ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {formatRupiah(transaction.amount)}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      ID: {transaction.id.slice(-8)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 py-2 border-b border-slate-100 bg-amber-50/50 px-2.5 rounded">
                  <div className="col-span-4 text-slate-600 font-medium">Terbilang</div>
                  <div className="col-span-8 italic font-serif text-slate-800 text-xs leading-relaxed">
                    "{terbilang(transaction.amount)} Rupiah"
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 py-1.5 border-b border-slate-100">
                  <div className="col-span-4 text-slate-500 font-medium">Tercatat Oleh</div>
                  <div className="col-span-8 text-slate-800 font-medium">
                    {transaction.recordedBy || 'Bendahara / Pengurus RT'}
                  </div>
                </div>

                {transaction.notes && (
                  <div className="grid grid-cols-12 gap-2 py-1.5">
                    <div className="col-span-4 text-slate-500 font-medium">Catatan Khusus</div>
                    <div className="col-span-8 text-slate-600 text-[11px] italic">
                      {transaction.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom section: Signature & Footer */}
            <div className="mt-auto pt-4 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Mengetahui,</p>
                  <p className="text-xs text-slate-500 mb-12">Ketua RT {profile.rtNumber || '05'},</p>
                  <p className="text-xs font-semibold text-slate-800 border-b border-slate-400 inline-block px-4 pb-0.5">
                    {chairpersonOfficer.name || profile.chairpersonName || 'Ketua RT'}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 mb-1">
                    {profile.city}, {formatDateIndo(txDate)}
                  </p>
                  <p className="text-xs text-slate-500 mb-12">
                    {isSalary ? 'Penerima Gaji,' : 'Bendahara Pengurus RT,'}
                  </p>

                  <p className="text-xs font-semibold text-slate-800 border-b border-slate-400 inline-block px-4 pb-0.5">
                    {isSalary
                      ? (transaction.salaryRecipient || 'Penerima').split(' (')[0]
                      : treasurerOfficer.name || profile.treasurerName || 'Bendahara RT'}
                  </p>
                </div>
              </div>

              {/* Footer note */}
              <div className="mt-4 pt-2 border-t border-slate-100 text-[10px] text-slate-400 text-center">
                Bukti sah kas transaksi lingkungan RT. Dicatat secara transparan di Aplikasi Buku Kas RT.
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Modal Bottom Actions */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{isDownloading ? 'Mengunduh...' : 'Download PNG'}</span>
            </button>
            <button
              onClick={handleShareWhatsAppPNG}
              disabled={isDownloading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 disabled:bg-emerald-800 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
              title="Kirim gambar kuitansi PNG ke WhatsApp"
            >
              <Share2 className="w-4 h-4 text-emerald-300" />
              <span>Share WA</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);
};
