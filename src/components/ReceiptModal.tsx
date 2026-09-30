import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, Share2, CheckCircle2, Building, ShieldCheck, Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { Resident, MonthKey, RTProfile } from '../types';
import { formatRupiah, formatDateIndo, terbilang, getOfficerForDate, getCleanRtRwTitle, getCleanProfileName } from '../utils/formatters';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  resident: Resident | null;
  monthsPaid: MonthKey[];
  totalAmount: number;
  paymentMethod: string;
  receiptNumber: string;
  paymentDate: string;
  profile: RTProfile;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  resident,
  monthsPaid,
  totalAmount,
  paymentMethod,
  receiptNumber,
  paymentDate,
  profile,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    fetch('/logo-rt05.png')
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoBase64(reader.result as string);
        };
        reader.readAsDataURL(blob);
      })
      .catch(err => {
        console.error('Error loading logo as base64:', err);
      });
  }, [isOpen]);

  if (!isOpen || !resident) return null;

  // Mendapatkan pejabat bendahara yang aktif pada tanggal kuitansi / pembayaran diinput
  const treasurerOfficer = getOfficerForDate(profile, 'Bendahara', paymentDate);

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
          }
        });
        if (i < 2) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }

      const link = document.createElement('a');
      const cleanFileName = `Kuitansi_${resident.name.replace(/\s+/g, '_')}_${receiptNumber}.png`;
      link.download = cleanFileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating receipt image:', error);
      alert(`Gagal mengunduh kuitansi gambar: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareWhatsApp = () => {
    const monthsText = monthsPaid.join(', ');
    const message = `*BUKTI PEMBAYARAN IURAN RT*\n` +
      `No. Kuitansi: ${receiptNumber}\n` +
      `Warga: ${resident.name} (Rumah No. ${resident.houseNo})\n` +
      `Iuran Bulan: ${monthsText} 2026\n` +
      `Nominal: ${formatRupiah(totalAmount)} (${paymentMethod})\n` +
      `Tanggal: ${formatDateIndo(paymentDate)}\n` +
      `Status: LUNAS / DITERIMA\n\n` +
      `Terima kasih atas partisipasi aktif Bapak/Ibu demi kemajuan lingkungan ${profile.name}.\n\n` +
      `_Salam hangat,_\n` +
      `*Pengurus ${profile.name}*`;

    const encoded = encodeURIComponent(message);
    const url = resident.phone 
      ? `https://wa.me/${resident.phone.replace(/[^0-9]/g, '')}?text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    
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
          }
        });
        if (i < 2) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }
      
      const resBlob = await fetch(dataUrl);
      const blob = await resBlob.blob();
      const file = new File([blob], `Kuitansi_${resident.name.replace(/\s+/g, '_')}_${receiptNumber}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Kuitansi RT - ${resident.name}`,
          text: `Bukti Pembayaran Iuran RT - ${monthsPaid.join(', ')} - ${resident.name} LUNAS`,
        });
      } else {
        const link = document.createElement('a');
        link.download = file.name;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert("Gambar Kuitansi PNG berhasil diunduh ke perangkat Anda.\n\nSistem akan mengarahkan Anda ke WhatsApp. Silakan pilih warga & lampirkan gambar kuitansi yang baru saja terunduh.");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in duration-200">
        {/* Modal Top Actions (Hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-sm tracking-wide">Kuitansi Digital RT Resmi</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
              title="Unduh kuitansi sebagai gambar PNG"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isDownloading ? 'Mengunduh...' : 'Download Kuitansi'}</span>
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Kirim bukti ke WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="overflow-x-auto bg-amber-50/30 p-4 sm:p-6 flex justify-start sm:justify-center text-slate-800 print:bg-white print:p-0">
          <div 
            ref={receiptRef} 
            className="w-[600px] h-[800px] shrink-0 border-4 border-double border-slate-700 p-6 rounded-lg bg-white shadow-xs relative overflow-hidden flex flex-col justify-between"
            style={{ width: '600px', height: '800px', aspectRatio: '3/4' }}
          >
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] select-none rotate-[-25deg]">
              <span className="text-8xl font-black text-slate-900">LUNAS</span>
            </div>

            {/* Top section */}
            <div className="flex-1 flex flex-col justify-start">
              {/* Receipt Header */}
              <div className="border-b-2 border-slate-800 pb-3 mb-3 text-center">
                <div className="flex items-center justify-center gap-3 mb-1">
                  <img
                    src={logoBase64 || "/logo-rt05.png"}
                    crossOrigin="anonymous"
                    alt="Logo RT 05"
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
                  KUITANSI PEMBAYARAN IURAN WARGA
                </div>
              </div>

              {/* Receipt Metadata */}
              <div className="flex justify-between items-center text-xs mb-3 text-slate-600 bg-slate-50 px-3 py-2 rounded border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-700">Nomor Kuitansi:</span>{' '}
                  <span className="font-mono font-bold text-slate-900">{receiptNumber}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Tanggal:</span>{' '}
                  <span>{formatDateIndo(paymentDate)}</span>
                </div>
              </div>

              {/* Receipt Content Table */}
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-12 gap-2 py-1.5 border-b border-slate-100">
                  <div className="col-span-4 text-slate-500 font-medium">Telah Diterima Dari</div>
                  <div className="col-span-8 font-semibold text-slate-900 flex items-center gap-2">
                    <span>{resident.name}</span>
                    <span className="px-2 py-0.5 text-[11px] bg-slate-100 text-slate-700 rounded-full font-mono">
                      Rumah No. {resident.houseNo}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 py-1.5 border-b border-slate-100">
                  <div className="col-span-4 text-slate-500 font-medium">Jumlah Pembayaran</div>
                  <div className="col-span-8">
                    <span className="text-base font-bold text-emerald-700 font-mono">
                      {formatRupiah(totalAmount)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 py-2 border-b border-slate-100 bg-amber-50/50 px-2.5 rounded">
                  <div className="col-span-4 text-slate-600 font-medium">Terbilang</div>
                  <div className="col-span-8 italic font-serif text-slate-800 text-xs leading-relaxed">
                    "{terbilang(totalAmount)} Rupiah"
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 py-1.5 border-b border-slate-100">
                  <div className="col-span-4 text-slate-500 font-medium">Untuk Iuran Bulan</div>
                  <div className="col-span-8">
                    <div className="flex flex-wrap gap-1.5">
                      {monthsPaid.map((m) => (
                        <span
                          key={m}
                          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800"
                        >
                          ✓ {m} 2026
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 py-1.5">
                  <div className="col-span-4 text-slate-500 font-medium">Metode Pembayaran</div>
                  <div className="col-span-8 text-slate-800 font-medium">
                    {paymentMethod}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom section: Signature & Footer */}
            <div className="mt-auto pt-4 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-500 mb-14">Warga Pembayar,</p>
                  <p className="text-xs font-semibold text-slate-800 border-b border-slate-400 inline-block px-4 pb-0.5">
                    {resident.name}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 mb-2">
                    {profile.city}, {formatDateIndo(paymentDate)}
                  </p>
                  <p className="text-xs text-slate-500 mb-12">Bendahara Pengurus RT,</p>

                  <p className="text-xs font-semibold text-slate-800 border-b border-slate-400 inline-block px-4 pb-0.5">
                    {treasurerOfficer.name}
                  </p>
                </div>
              </div>

              {/* Footer note */}
              <div className="mt-4 pt-2 border-t border-slate-100 text-[10px] text-slate-400 text-center">
                Bukti sah kas transaksi lingkungan RT. Dicatat secara transparan di Aplikasi Buku Kas RT. (Ukuran Rasio 3:4)
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isDownloading ? 'Mengunduh...' : 'Download Kuitansi'}</span>
            </button>
            <button
              onClick={handleShareWhatsAppPNG}
              disabled={isDownloading}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 disabled:bg-emerald-800 text-white border border-emerald-800 rounded-lg transition-colors cursor-pointer"
              title="Kirim gambar kuitansi PNG ke WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share WA (PNG)</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
