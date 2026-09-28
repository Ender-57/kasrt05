import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, Share2, CheckCircle2, ShieldCheck, Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { Resident, RTProfile, IncidentalDuesProgram, IncidentalDuesPayment } from '../types';
import { formatRupiah, formatDateIndo, terbilang, getOfficerForDate } from '../utils/formatters';

interface IncidentalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  resident: Resident | null;
  program: IncidentalDuesProgram | null;
  payment: IncidentalDuesPayment | null;
  profile: RTProfile;
}

export const IncidentalReceiptModal: React.FC<IncidentalReceiptModalProps> = ({
  isOpen,
  onClose,
  resident,
  program,
  payment,
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
        console.error('Error loading logo as base64 in incidental:', err);
      });
  }, [isOpen]);

  if (!isOpen || !resident || !program || !payment) return null;

  const paymentDate = payment.paidAt || program.date;
  const treasurerOfficer = getOfficerForDate(profile, 'Bendahara', paymentDate);
  const receiptNumber = payment.receiptNo || `KW-INS-${Date.now().toString().slice(-6)}`;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    try {
      setIsDownloading(true);
      const dataUrl = await toPng(receiptRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        skipFonts: true,
        cacheBust: true,
        style: {
          width: '650px',
          margin: '0',
          transform: 'none',
        },
        width: 650,
      });
      const link = document.createElement('a');
      const cleanFileName = `Kuitansi_Insidentil_${resident.name.replace(/\s+/g, '_')}_${receiptNumber}.png`;
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
    const message = `*BUKTI PEMBAYARAN IURAN RT (INSIDENTIL)*\n` +
      `No. Kuitansi: ${receiptNumber}\n` +
      `Warga: ${resident.name} (Rumah No. ${resident.houseNo})\n` +
      `Program: ${program.title}\n` +
      `Nominal: ${formatRupiah(program.amount)} (${payment.paymentMethod || 'Tunai'})\n` +
      `Tanggal Bayar: ${formatDateIndo(paymentDate)}\n` +
      `Status: LUNAS / DITERIMA\n` +
      (payment.note ? `Catatan: ${payment.note}\n` : '') + `\n` +
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
      const dataUrl = await toPng(receiptRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        skipFonts: true,
        cacheBust: true,
        style: {
          width: '650px',
          margin: '0',
          transform: 'none',
        },
        width: 650,
      });
      
      const resBlob = await fetch(dataUrl);
      const blob = await resBlob.blob();
      const file = new File([blob], `Kuitansi_Insidentil_${resident.name.replace(/\s+/g, '_')}_${receiptNumber}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Kuitansi RT - ${resident.name}`,
          text: `Bukti Pembayaran Iuran RT (Insidentil) - ${program.title} - ${resident.name} LUNAS`,
        });
      } else {
        // Fallback: Download file, alert instruction, and trigger normal WhatsApp message share
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
            <span className="font-semibold text-sm tracking-wide">Kuitansi Digital RT Resmi (Insidentil)</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
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
              <span>{isDownloading ? 'Mengunduh...' : 'Download'}</span>
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
              <span>Cetak</span>
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
        <div ref={receiptRef} className="p-8 bg-amber-50/30 print:p-6 print:bg-white text-slate-800">
          <div className="border-4 border-double border-slate-700 p-6 rounded-lg bg-white shadow-xs relative overflow-hidden">
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] select-none rotate-[-25deg]">
              <span className="text-8xl font-black text-slate-900">LUNAS</span>
            </div>

            {/* Receipt Header */}
            <div className="border-b-2 border-slate-800 pb-4 mb-5 text-center">
              <div className="flex items-center justify-center gap-3.5 mb-1.5">
                <img
                  src={logoBase64 || "/logo-rt05.png"}
                  crossOrigin="anonymous"
                  alt="Logo RT 05"
                  className="w-14 h-14 object-contain rounded-full border border-slate-300 shadow-2xs shrink-0"
                  onError={(e) => {
                    // Fallback to RT Logo styled element if image fails
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="text-left">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900 uppercase leading-tight">
                    {profile.name}
                  </h2>
                  <p className="text-xs text-slate-500 leading-tight mt-0.5">
                    RT {profile.rtNumber} / RW {profile.rwNumber}, Desa {profile.subdistrict}, Kec. {profile.district}, {profile.city}
                  </p>
                </div>
              </div>
              <div className="inline-block mt-2 px-3 py-1 bg-slate-900 text-white text-xs font-semibold uppercase tracking-wider rounded">
                KUITANSI PEMBAYARAN SWADAYA WARGA
              </div>
            </div>

            {/* Receipt Metadata */}
            <div className="flex justify-between items-center text-xs mb-4 text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
              <div>
                <span className="font-semibold text-slate-700">Nomor Kuitansi:</span>{' '}
                <span className="font-mono font-bold text-slate-900">{receiptNumber}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Tanggal Bayar:</span>{' '}
                <span>{formatDateIndo(paymentDate)}</span>
              </div>
            </div>

            {/* Receipt Content Table */}
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-12 gap-2 py-1.5 border-b border-slate-100">
                <div className="col-span-4 text-slate-500 font-medium">Telah Diterima Dari</div>
                <div className="col-span-8 font-semibold text-slate-900 flex items-center gap-2">
                  <span>{resident.name}</span>
                  <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-full font-mono">
                    Rumah No. {resident.houseNo}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 py-1.5 border-b border-slate-100">
                <div className="col-span-4 text-slate-500 font-medium">Jumlah Pembayaran</div>
                <div className="col-span-8">
                  <span className="text-base font-bold text-emerald-700 font-mono">
                    {formatRupiah(program.amount)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 py-1.5 border-b border-slate-100 bg-amber-50/50 p-2 rounded">
                <div className="col-span-4 text-slate-600 font-medium">Terbilang</div>
                <div className="col-span-8 italic font-serif text-slate-800 text-xs leading-relaxed">
                  "{terbilang(program.amount)} Rupiah"
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 py-1.5 border-b border-slate-100">
                <div className="col-span-4 text-slate-500 font-medium">Untuk Program Iuran</div>
                <div className="col-span-8">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                    ✓ {program.title}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 py-1.5">
                <div className="col-span-4 text-slate-500 font-medium">Metode Pembayaran</div>
                <div className="col-span-8 text-slate-800 font-semibold">
                  {payment.paymentMethod || 'Tunai'}
                </div>
              </div>

              {payment.note && (
                <div className="grid grid-cols-12 gap-2 py-1.5 border-t border-slate-100">
                  <div className="col-span-4 text-slate-500 font-medium">Keterangan</div>
                  <div className="col-span-8 italic text-slate-600 text-xs">
                    "{payment.note}"
                  </div>
                </div>
              )}
            </div>

            {/* Signature & Stamp Section */}
            <div className="mt-8 pt-4 border-t border-slate-200 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-500 mb-12">Warga Pembayar,</p>
                <p className="text-xs font-semibold text-slate-800 border-b border-slate-400 inline-block px-4 pb-0.5">
                  {resident.name}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-2">
                  {profile.city}, {formatDateIndo(paymentDate)}
                </p>
                <p className="text-xs text-slate-500 mb-10">Bendahara Pengurus RT,</p>

                <p className="text-xs font-semibold text-slate-800 border-b border-slate-400 inline-block px-4 pb-0.5">
                  {treasurerOfficer.name}
                </p>
              </div>
            </div>

            {/* Footer note */}
            <div className="mt-6 pt-2 border-t border-slate-100 text-[10px] text-slate-400 text-center">
              Bukti sah kas transaksi lingkungan RT. Dicatat secara transparan di Aplikasi Buku Kas RT.
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          <div className="text-xs text-slate-500">
            Format: Gambar resolusi tinggi PNG
          </div>
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
