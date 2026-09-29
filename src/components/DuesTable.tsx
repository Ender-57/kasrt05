import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  PlusCircle,
  Home,
  Check,
  CreditCard,
  Edit2,
  Trash2,
  Eye,
  Info,
  RotateCcw,
  Edit3,
  Paperclip,
  Copy,
  ShieldCheck,
  X,
  MessageCircle,
  Printer,
  Share2,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { Resident, MonthKey, MONTHS, RTProfile, CashTransaction, IncidentalDuesProgram } from '../types';
import { formatRupiah, formatAttachmentFileName, getTodayJakarta, formatDateTimeJakarta, formatDateJakarta } from '../utils/formatters';
import { runSelfHealing } from '../utils/selfHealing';
import { PaymentCorrectionModal } from './PaymentCorrectionModal';
import { ResidentFormModal } from './ResidentFormModal';
import { IncidentalDuesView } from './IncidentalDuesView';
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

interface DuesTableProps {
  residents: Resident[];
  transactions: CashTransaction[];
  isAdmin: boolean;
  profile: RTProfile;
  onUpdateResidents: (newResidents: Resident[]) => void;
  onAddTransaction: (tx: Omit<CashTransaction, 'id'>) => void;
  onViewReceipt: (
    resident: Resident,
    months: MonthKey[],
    amount: number,
    method: string,
    receiptNo: string,
    date: string
  ) => void;
  incidentalPrograms?: IncidentalDuesProgram[];
  onSaveIncidentalProgram?: (program: IncidentalDuesProgram) => Promise<void>;
  onDeleteIncidentalProgram?: (id: string) => Promise<void>;
}

export const DuesTable: React.FC<DuesTableProps> = ({
  residents,
  transactions,
  isAdmin,
  profile,
  onUpdateResidents,
  onAddTransaction,
  onViewReceipt,
  incidentalPrograms = [],
  onSaveIncidentalProgram,
  onDeleteIncidentalProgram,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDuesTab, setActiveDuesTab] = useState<'MONTHLY' | 'INCIDENTAL'>('MONTHLY');
  const [filterTab, setFilterTab] = useState<'ALL' | 'LUNAS' | 'NUNGGAK' | 'KOSONG'>('ALL');
  const [copiedBankNo, setCopiedBankNo] = useState(false);
  const [selectedArrearsResident, setSelectedArrearsResident] = useState<Resident | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const handleCopyBankNo = () => {
    const accountNo = profile.bankAccountNo || '1030013542580';
    navigator.clipboard.writeText(accountNo);
    setCopiedBankNo(true);
    setTimeout(() => setCopiedBankNo(false), 2000);
  };

  const handleShareWhatsApp = async (resident: Resident, totalArrears: number, unpaidMonths: any[]) => {
    setIsSharing(true);
    try {
      const element = document.getElementById('arrears-card-to-capture');
      if (element) {
        const originalStyle = element.style.cssText;
        element.style.padding = '24px';
        element.style.width = '420px';
        element.style.minHeight = '560px';
        element.style.aspectRatio = '3/4';
        element.style.maxWidth = '100%';
        element.style.borderRadius = '16px';
        element.style.backgroundColor = '#ffffff';
        element.style.display = 'flex';
        element.style.flexDirection = 'column';
        element.style.justifyContent = 'space-between';

        const dataUrl = await toPng(element, {
          backgroundColor: '#ffffff',
          style: {
            transform: 'scale(1)',
            borderRadius: '16px',
            width: '420px',
            minHeight: '560px',
            aspectRatio: '3/4',
          },
          cacheBust: true,
        });

        element.style.cssText = originalStyle;

        const link = document.createElement('a');
        link.download = `Tagihan_Iuran_No_${resident.houseNo}_${resident.name}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (error) {
      console.error('Error generating billing image:', error);
    } finally {
      setIsSharing(false);
    }

    const unpaidMonthsStr = unpaidMonths.map((u) => u.month).join(', ');
    const waMessage =
      `📢 *PENGINGAT PEMBAYARAN IURAN WARGA RT ${profile.rtNumber}*\n\n` +
      `Yth. Bapak/Ibu *${resident.name}* (Rumah No. *${resident.houseNo}*),\n\n` +
      `Kami menyampaikan pesan pengingat iuran rutin bulanan warga s.d. bulan *${cutoffMonth} 2026*:\n` +
      `• *Nama Warga:* ${resident.name}\n` +
      `• *Total Tunggakan:* *${formatRupiah(totalArrears)}*\n` +
      `• *Bulan Tunggakan:* ${unpaidMonthsStr}\n\n` +
      `Mohon agar segera melakukan pembayaran transfer ke rekening Bendahara RT:\n` +
      `• *Bank:* ${profile.bankName || 'Mandiri'}\n` +
      `• *No. Rekening:* *${profile.bankAccountNo || '1030013542580'}*\n` +
      `• *Atas Nama:* ${profile.bankAccountHolder || profile.treasurerName || 'Bendahara RT'}\n\n` +
      `Terima kasih banyak atas kerja sama, partisipasi, dan kepedulian Anda dalam menjaga kenyamanan lingkungan kita bersama. 🙏✨`;

    const cleanPhone = resident.phone ? resident.phone.replace(/\D/g, '') : '';
    let formatPhone = cleanPhone;
    if (formatPhone.startsWith('0')) {
      formatPhone = '62' + formatPhone.slice(1);
    }

    const waUrl = formatPhone
      ? `https://api.whatsapp.com/send?phone=${formatPhone}&text=${encodeURIComponent(waMessage)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(waMessage)}`;

    window.open(waUrl, '_blank');
  };

  const balance = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    transactions.forEach((tx) => {
      if (tx.type === 'MASUK') masuk += tx.amount;
      else keluar += tx.amount;
    });
    return masuk - keluar;
  }, [transactions]);

  const [isSelfHealingSyncing, setIsSelfHealingSyncing] = useState(false);
  const healingSummary = useMemo(() => {
    return runSelfHealing(residents, transactions);
  }, [residents, transactions]);

  // Quick Payment Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState<string>('');
  const [selectedMonths, setSelectedMonths] = useState<MonthKey[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'Tunai' | 'Transfer Bank' | 'QRIS RT'>('Tunai');
  const [customPayAmount, setCustomPayAmount] = useState<number | null>(null);
  const [paymentNote, setPaymentNote] = useState('');
  const [syncToCashbook, setSyncToCashbook] = useState(true);
  const [formFile, setFormFile] = useState<File | null>(null);
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(() => Boolean(getAccessToken()));

  useEffect(() => {
    setIsDriveConnected(Boolean(getAccessToken()));
  }, [isPayModalOpen]);

  const handleConnectGoogleDrive = async () => {
    try {
      setIsUploadingDrive(true);
      setUploadStatus('Menghubungkan Akun Google...');
      const res = await googleSignIn();
      if (res?.accessToken) {
        setIsDriveConnected(true);
      }
    } catch (err) {
      console.warn('Google sign-in error:', err);
    } finally {
      setIsUploadingDrive(false);
      setUploadStatus('');
    }
  };

  // Edit / Add Resident Modal State
  const [isResidentModalOpen, setIsResidentModalOpen] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);

  // Payment Correction Modal State
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionResident, setCorrectionResident] = useState<Resident | null>(null);
  const [correctionInitialMonth, setCorrectionInitialMonth] = useState<MonthKey | null>(null);

  // Helper for Indonesian 3-letter month abbreviation
  const getMonthAbbr = (m: MonthKey): string => {
    if (m === 'Agustus') return 'AGS';
    if (m === 'Oktober') return 'OKT';
    if (m === 'Desember') return 'DES';
    return m.slice(0, 3).toUpperCase();
  };

  // Dynamic cutoff month: defaults to current month (e.g. September/Oktober) and automatically updates when month changes
  const [cutoffMonth, setCutoffMonth] = useState<MonthKey>(() => {
    const currentMonthIdx = new Date().getMonth();
    return MONTHS[currentMonthIdx] || 'September';
  });

  // Dynamic calculation of resident arrears based on unpaid months through selected cutoffMonth
  const calculateArrearsForResident = (
    r: Resident,
    paymentsMap: Resident['payments'],
    targetCutoff: MonthKey = cutoffMonth
  ): number => {
    if (r.isVacant) return 0;
    const cutoffIndex = MONTHS.indexOf(targetCutoff);
    const monthsToCheck = cutoffIndex >= 0 ? MONTHS.slice(0, cutoffIndex + 1) : MONTHS.slice(0, 9);

    let arrears = 0;
    monthsToCheck.forEach((m) => {
      const expectedRate =
        r.customMonthlyRate && r.customMonthlyRate > 0
          ? r.customMonthlyRate
          : ['Januari', 'Februari', 'Maret', 'April', 'Mei'].includes(m)
          ? 60000
          : 70000;

      const p = paymentsMap[m];
      if (!p || !p.paid) {
        arrears += expectedRate;
      } else if (p.amount < expectedRate) {
        arrears += expectedRate - p.amount;
      }
    });
    return arrears;
  };

  // Helper for detailed unpaid months breakdown for a resident
  const getUnpaidMonthsDetails = (r: Resident, targetCutoff: MonthKey = cutoffMonth) => {
    if (r.isVacant) return [];
    const cutoffIndex = MONTHS.indexOf(targetCutoff);
    const monthsToCheck = cutoffIndex >= 0 ? MONTHS.slice(0, cutoffIndex + 1) : MONTHS.slice(0, 9);

    const result: Array<{ month: MonthKey; expected: number; paid: number; arrears: number }> = [];

    monthsToCheck.forEach((m) => {
      const expectedRate =
        r.customMonthlyRate && r.customMonthlyRate > 0
          ? r.customMonthlyRate
          : ['Januari', 'Februari', 'Maret', 'April', 'Mei'].includes(m)
          ? 60000
          : 70000;

      const p = r.payments[m];
      const paidAmount = p && p.paid ? p.amount : 0;
      if (!p || !p.paid || p.amount < expectedRate) {
        result.push({
          month: m,
          expected: expectedRate,
          paid: paidAmount,
          arrears: expectedRate - paidAmount,
        });
      }
    });

    return result;
  };

  const handleOpenCorrectionModal = (resident: Resident, month?: MonthKey) => {
    setCorrectionResident(resident);
    setCorrectionInitialMonth(month || null);
    setIsCorrectionModalOpen(true);
  };

  const handleApplyCorrection = (
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
  ) => {
    const today = getTodayJakarta();

    const updated = residents.map((r) => {
      if (r.id !== residentId) return r;

      const newPayments = { ...r.payments };

      if (action === 'VOID') {
        delete newPayments[month];
      } else if (action === 'UPDATE' && newData) {
        const existing = newPayments[month];
        newPayments[month] = {
          paid: true,
          amount: newData.amount,
          paidAt: newData.paidAt,
          paymentMethod: newData.paymentMethod,
          receiptNo: existing?.receiptNo || `KW-KOR-${r.houseNo}`,
          note: newData.reason ? `Koreksi: ${newData.reason}` : existing?.note,
          isCorrected: true,
          correctionNote: newData.reason,
          correctedAt: today,
        };
      }

      const recalculatedArrears = calculateArrearsForResident(r, newPayments);

      return {
        ...r,
        arrearsAmount: recalculatedArrears,
        arrearsStatusText: recalculatedArrears === 0 ? 'LUNAS' : formatRupiah(recalculatedArrears),
        payments: newPayments,
      };
    });

    onUpdateResidents(updated);

    // Apply Cashbook adjustment if requested
    if (cashAdjustment && cashAdjustment.adjustCashbook && cashAdjustment.amountDifference !== 0) {
      const isIncrease = cashAdjustment.amountDifference > 0;
      onAddTransaction({
        date: today,
        type: isIncrease ? 'MASUK' : 'KELUAR',
        category: 'Iuran Warga',
        description: cashAdjustment.reason,
        amount: Math.abs(cashAdjustment.amountDifference),
        recordedBy: profile.treasurerName || 'Bendahara',
        receiptNumber: `KOR-${Date.now().toString().slice(-4)}`,
      });
    }
  };

  // Default monthly rate helper
  const getRateForMonth = (resident: Resident, month: MonthKey): number => {
    if (resident.customMonthlyRate && resident.customMonthlyRate > 0) {
      return resident.customMonthlyRate;
    }
    const janToMay: MonthKey[] = ['Januari', 'Februari', 'Maret', 'April', 'Mei'];
    return janToMay.includes(month) ? 60000 : 70000;
  };

  // Filtered residents list
  const filteredResidents = useMemo(() => {
    return residents.filter((r) => {
      const matchSearch =
        r.houseNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.name.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      const dynamicArrears = calculateArrearsForResident(r, r.payments, cutoffMonth);

      if (filterTab === 'KOSONG') return r.isVacant;
      if (filterTab === 'LUNAS') return !r.isVacant && dynamicArrears === 0;
      if (filterTab === 'NUNGGAK') return !r.isVacant && dynamicArrears > 0;

      return true;
    });
  }, [residents, searchTerm, filterTab, cutoffMonth]);

  const handlePrintTable = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Gagal membuka jendela cetak. Pastikan browser Anda tidak memblokir pop-up.');
      return;
    }

    const itemsToPrint = filteredResidents;
    const monthHeaders = MONTHS.map(m => `<th style="border: 1px solid #94a3b8; padding: 6px; font-size: 10px; text-align: center;">${m.slice(0, 3)}</th>`).join('');

    const rows = itemsToPrint.map((r) => {
      const isVacant = r.isVacant;
      const dynamicArrears = isVacant ? 0 : calculateArrearsForResident(r, r.payments, cutoffMonth);
      const tunggakanText = isVacant ? '-' : formatRupiah(dynamicArrears);
      
      const monthlyCells = MONTHS.map(m => {
        const p = r.payments[m];
        if (p?.paid) {
          return `<td style="border: 1px solid #94a3b8; padding: 4px 6px; font-size: 9px; text-align: center; color: #059669; font-weight: bold;">Lunas<br/><span style="font-size: 8px; font-weight: normal; color: #475569;">${formatRupiah(p.amount)}</span></td>`;
        } else {
          return `<td style="border: 1px solid #94a3b8; padding: 4px 6px; font-size: 11px; text-align: center; color: #dc2626; font-weight: bold;">-</td>`;
        }
      }).join('');

      return `
        <tr>
          <td style="border: 1px solid #94a3b8; padding: 6px; font-size: 10px; text-align: center; font-weight: bold;">${r.houseNo}</td>
          <td style="border: 1px solid #94a3b8; padding: 6px; font-size: 10px; font-weight: 500;">${isVacant ? '<em>KOSONG (Rumah Kosong)</em>' : r.name}</td>
          <td style="border: 1px solid #94a3b8; padding: 6px; font-size: 10px; text-align: right; font-weight: bold; color: ${dynamicArrears > 0 ? '#b45309' : '#1e293b'}">${tunggakanText}</td>
          ${monthlyCells}
        </tr>
      `;
    }).join('');

    const titleText = filterTab === 'LUNAS' ? 'LAPORAN REKAPITULASI WARGA - STATUS LUNAS' :
                    filterTab === 'NUNGGAK' ? 'LAPORAN REKAPITULASI WARGA - STATUS MENUNGGAK' :
                    filterTab === 'KOSONG' ? 'LAPORAN REKAPITULASI - DAFTAR RUMAH KOSONG' :
                    'LAPORAN REKAPITULASI BULANAN IURAN RUTIN WARGA';

    const timestamp = formatDateTimeJakarta(new Date());
    const treasurerOfficer = profile.officers?.find((o) => o.role.toLowerCase().includes('bendahara'));
    const treasurerName = treasurerOfficer?.name || profile.treasurerName || 'Bendahara RT';

    const chairpersonOfficer = profile.officers?.find((o) => o.role.toLowerCase().includes('ketua'));
    const chairpersonName = chairpersonOfficer?.name || profile.chairpersonName || 'Ketua RT';

    printWindow.document.write(`
      <html>
        <head>
          <title>${titleText} - RT ${profile.rtNumber}</title>
          <style>
            @media print {
              @page {
                size: A4 landscape;
                margin: 10mm 15mm;
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
              margin-bottom: 15px;
              border-bottom: 3px double #1e293b;
              padding-bottom: 10px;
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
              margin-bottom: 12px;
              font-size: 10px;
              font-weight: 600;
              color: #334155;
              background-color: #f8fafc;
              padding: 6px 10px;
              border-radius: 6px;
              border: 1px solid #e2e8f0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th {
              background-color: #f1f5f9;
              color: #0f172a;
              font-weight: bold;
              text-align: center;
              text-transform: uppercase;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .footer-notes {
              display: flex;
              justify-content: space-between;
              margin-top: 30px;
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
              margin-top: 25px;
              border-top: 1px dashed #cbd5e1;
              padding-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>RT ${profile.rtNumber} / RW ${profile.rwNumber} ${profile.name.toUpperCase()}</h1>
            <p>Desa ${profile.subdistrict}, Kec. ${profile.district}, ${profile.city}, Jawa Barat</p>
            <h2 style="margin: 8px 0 0 0; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; color: #0f172a; text-transform: uppercase;">${titleText} (TAHUN 2026)</h2>
          </div>
          
          <div class="report-meta">
            <div>Kategori Filter: <span style="color: #0284c7; font-weight: bold;">${filterTab === 'ALL' ? 'Semua Rumah' : filterTab === 'LUNAS' ? 'Lunas' : filterTab === 'NUNGGAK' ? 'Menunggak' : 'Rumah Kosong'}</span></div>
            <div>Tunggakan s.d. Bulan: <span style="color: #b45309; font-weight: bold;">${cutoffMonth} 2026</span></div>
            <div>Tanggal Cetak: <span>${timestamp}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 10px; width: 55px; text-align: center;">NO. RMH</th>
                <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 10px; text-align: left;">NAMA WARGA</th>
                <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 10px; text-align: right; width: 110px;">TUNGGAKAN</th>
                ${monthHeaders}
              </tr>
            </thead>
            <tbody>
              ${rows}
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
            Laporan resmi kas lingkungan RT. Dicatat secara transparan, otomatis, dan akuntabel di Aplikasi Buku Kas RT.
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

  // Aggregate stats
  const stats = useMemo(() => {
    let totalCollected = 0;
    let totalArrears = 0;
    let lunasCount = 0;
    let nunggakCount = 0;
    let vacantCount = 0;

    residents.forEach((r) => {
      if (r.isVacant) {
        vacantCount++;
        return;
      }

      const dynamicArrears = calculateArrearsForResident(r, r.payments, cutoffMonth);
      totalArrears += dynamicArrears;
      if (dynamicArrears === 0) {
        lunasCount++;
      } else {
        nunggakCount++;
      }

      Object.values(r.payments).forEach((p) => {
        if (p?.paid) {
          totalCollected += p.amount;
        }
      });
    });

    const populatedCount = residents.length - vacantCount;
    const complianceRate = populatedCount > 0 ? Math.round((lunasCount / populatedCount) * 100) : 0;

    return {
      totalCollected,
      totalArrears,
      lunasCount,
      nunggakCount,
      vacantCount,
      totalHouses: residents.length,
      complianceRate,
    };
  }, [residents, cutoffMonth]);

  // Open Pay Modal for a specific resident
  const handleOpenPayModal = (resident: Resident, preselectMonth?: MonthKey) => {
    setSelectedResidentId(resident.id);
    if (preselectMonth) {
      setSelectedMonths([preselectMonth]);
    } else {
      // Find first incomplete month (either unpaid or partially paid)
      const firstIncomplete = MONTHS.find((m) => {
        const p = resident.payments[m];
        const rate = getRateForMonth(resident, m);
        return !p?.paid || p.amount < rate;
      });
      setSelectedMonths(firstIncomplete ? [firstIncomplete] : []);
    }
    setCustomPayAmount(null);
    setPaymentNote('');
    setIsPayModalOpen(true);
  };

  // Calculate calculated amount for selected months, taking into account partial payments/shortfall
  const selectedResident = residents.find((r) => r.id === selectedResidentId);
  const calculatedPayAmount = useMemo(() => {
    if (!selectedResident) return 0;
    if (customPayAmount !== null && customPayAmount >= 0) return customPayAmount;
    return selectedMonths.reduce((sum, m) => {
      const fullRate = getRateForMonth(selectedResident, m);
      const existingPayment = selectedResident.payments[m];
      const existingAmount = existingPayment?.paid ? existingPayment.amount : 0;
      const shortfall = Math.max(0, fullRate - existingAmount);
      return sum + (shortfall > 0 ? shortfall : fullRate);
    }, 0);
  }, [selectedResident, selectedMonths, customPayAmount]);

  // Submit payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResident || selectedMonths.length === 0) return;

    let attachmentName = undefined;
    let attachmentUrl = undefined;

    const today = getTodayJakarta();
    
    // Generate receipt number based on input date (DDMM) and houseNo
    const [yStr, mStr, dStr] = today.split('-');
    const dd = dStr;
    const mm = mStr;
    const baseReceiptNo = `KW-${dd}${mm}-${selectedResident.houseNo}`;

    // Scan for existing payments in the system to assign a sequence suffix if paid on the same day
    const existingReceiptNumbers = new Set<string>();
    residents.forEach((r) => {
      if (r.payments) {
        Object.values(r.payments).forEach((p) => {
          if (p && p.receiptNo) {
            existingReceiptNumbers.add(p.receiptNo);
          }
        });
      }
    });

    let receiptNo = baseReceiptNo;
    let counter = 1;
    while (existingReceiptNumbers.has(receiptNo)) {
      counter++;
      receiptNo = `${baseReceiptNo}-${counter}`;
    }

    const duesDescription = `Iuran warga No. ${selectedResident.houseNo} (${selectedResident.name}) - Bulan ${selectedMonths.join(', ')} 2026`;

    if (formFile) {
      try {
        setIsUploadingDrive(true);
        setUploadStatus('Memeriksa akun Google...');
        let token = getAccessToken();

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

        const formattedFileName = formatAttachmentFileName(today, duesDescription, formFile.name);

        if (token) {
          setUploadStatus('Mengunggah bukti ke Google Drive...');
          const driveRes = await uploadFileToGoogleDrive(token, formFile, formattedFileName);
          attachmentName = driveRes.name || formattedFileName;
          attachmentUrl = driveRes.webViewLink;
        } else {
          attachmentName = formattedFileName;
          if (formFile.size < 800 * 1024) {
            attachmentUrl = await readFileAsDataUrl(formFile);
          } else {
            attachmentUrl = URL.createObjectURL(formFile);
          }
        }
      } catch (err: unknown) {
        console.error('Drive upload error:', err);
        const formattedFileName = formatAttachmentFileName(today, duesDescription, formFile.name);
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

    const updated = residents.map((r) => {
      if (r.id !== selectedResident.id) return r;

      const newPayments = { ...r.payments };
      const perMonthNominal = calculatedPayAmount / selectedMonths.length;

      selectedMonths.forEach((m) => {
        const existing = newPayments[m];
        const existingAmount = existing?.paid ? existing.amount : 0;
        const totalAmountForMonth = existingAmount + Math.round(perMonthNominal);

        const paymentNoteValue = paymentNote 
          ? (existing?.note ? `${existing.note}; ${paymentNote}` : paymentNote)
          : existingAmount > 0 
          ? `Pelunasan cicilan (sebelumnya titip ${formatRupiah(existingAmount)})`
          : null;

        newPayments[m] = {
          paid: true,
          amount: totalAmountForMonth,
          paidAt: today,
          receiptNo,
          paymentMethod,
        };

        if (paymentNoteValue !== null) {
          newPayments[m].note = paymentNoteValue;
        }
      });

      const recalculatedArrears = calculateArrearsForResident(r, newPayments, cutoffMonth);

      return {
        ...r,
        arrearsAmount: recalculatedArrears,
        arrearsStatusText: recalculatedArrears === 0 ? 'LUNAS' : formatRupiah(recalculatedArrears),
        payments: newPayments,
      };
    });

    onUpdateResidents(updated);

    // Optionally sync into Cashbook as MASUK transaction
    if (syncToCashbook) {
      const txPayload: Omit<CashTransaction, 'id'> = {
        date: today,
        type: 'MASUK',
        category: 'Iuran Warga',
        description: `Iuran warga No. ${selectedResident.houseNo} (${selectedResident.name}) - Bulan ${selectedMonths.join(', ')} 2026`,
        amount: calculatedPayAmount,
        recordedBy: profile.treasurerName || 'Bendahara RT',
        receiptNumber: receiptNo,
      };

      if (attachmentName !== undefined) {
        txPayload.attachmentName = attachmentName;
      }
      if (attachmentUrl !== undefined) {
        txPayload.attachmentUrl = attachmentUrl;
      }

      onAddTransaction(txPayload);
    }

    setIsPayModalOpen(false);
    setFormFile(null);

    // Open receipt modal right away
    onViewReceipt(
      selectedResident,
      selectedMonths,
      calculatedPayAmount,
      paymentMethod,
      receiptNo,
      today
    );
  };

  // Open Edit or Add Resident Modal
  const handleOpenResidentModal = (res?: Resident) => {
    setEditingResident(res || null);
    setIsResidentModalOpen(true);
  };

  const handleSaveResident = (data: Partial<Resident>) => {
    if (editingResident) {
      const updated = residents.map((r) =>
        r.id === editingResident.id
          ? {
              ...r,
              ...data,
            }
          : r
      );
      onUpdateResidents(updated);
    } else {
      const newRes: Resident = {
        id: `res-${Date.now()}`,
        houseNo: data.houseNo || '00',
        name: data.name || 'Warga Baru',
        isVacant: data.isVacant || false,
        arrearsAmount: data.arrearsAmount || 0,
        arrearsStatusText: data.arrearsAmount === 0 ? 'LUNAS' : formatRupiah(data.arrearsAmount || 0),
        customMonthlyRate: data.customMonthlyRate,
        phone: data.phone,
        nik: data.nik,
        kkNumber: data.kkNumber,
        spouseName: data.spouseName,
        spouseNik: data.spouseNik,
        children: data.children || [],
        otherFamilyMembers: data.otherFamilyMembers || [],
        houseStatus: data.houseStatus || 'Milik Sendiri',
        totalOccupants: data.totalOccupants || 1,
        notes: data.notes,
        payments: {},
      };
      onUpdateResidents([...residents, newRes]);
    }
  };

  const handleDeleteResident = (id: string, name: string) => {
    if (window.confirm(`Hapus data rumah/warga ${name}? Tindakan ini tidak dapat dibatalkan.`)) {
      onUpdateResidents(residents.filter((r) => r.id !== id));
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
              {formatRupiah(balance)}
            </span>
          </div>
        </div>
      </div>

      {/* Self-Healing / Data Synchronization Banner */}
      {healingSummary.healedCount > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                Sinkronisasi Pembayaran Diperlukan ({healingSummary.healedCount} Rekod)
              </h4>
              <p className="text-[11px] text-slate-600 mt-1">
                Terdapat {healingSummary.healedCount} transaksi pembayaran iuran di Buku Kas yang belum tercatat pada daftar Iuran Warga (karena kendala penulisan database sebelumnya).
              </p>
            </div>
          </div>
          {isAdmin ? (
            <button
              type="button"
              disabled={isSelfHealingSyncing}
              onClick={async () => {
                try {
                  setIsSelfHealingSyncing(true);
                  await onUpdateResidents(healingSummary.healedResidents);
                  alert(`Berhasil menyelaraskan ${healingSummary.healedCount} pembayaran iuran warga secara aman!`);
                } catch (err) {
                  alert("Gagal melakukan sinkronisasi: " + (err instanceof Error ? err.message : String(err)));
                } finally {
                  setIsSelfHealingSyncing(false);
                }
              }}
              className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isSelfHealingSyncing ? 'animate-spin' : ''}`} />
              <span>{isSelfHealingSyncing ? 'Menyinkronkan...' : 'Sinkronkan & Amankan Data'}</span>
            </button>
          ) : (
            <div className="text-[11px] font-semibold text-amber-800 bg-amber-100/50 px-2.5 py-1 rounded-lg border border-amber-200">
              Menunggu Pengurus menyelaraskan...
            </div>
          )}
        </div>
      )}

      {/* Tab Switcher: Iuran Rutin vs Iuran Insidentil */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveDuesTab('MONTHLY')}
          className={`flex-1 sm:flex-initial py-3 px-6 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeDuesTab === 'MONTHLY'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Iuran Bulanan (Rutin)
        </button>
        <button
          type="button"
          onClick={() => setActiveDuesTab('INCIDENTAL')}
          className={`flex-1 sm:flex-initial py-3 px-6 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeDuesTab === 'INCIDENTAL'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Iuran Insidentil (Khusus)
        </button>
      </div>

      {activeDuesTab === 'MONTHLY' ? (
        <>
          {/* Quick Resident Search Dropdown Section */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-emerald-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
            <Search className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
              Cek Data Tunggakan Anda di sini !!
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Pilih nomor rumah & nama warga untuk melihat status pembayaran iuran
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-80 shrink-0">
          <select
            value=""
            onChange={(e) => {
              const resId = e.target.value;
              if (resId) {
                const found = residents.find((r) => r.id === resId);
                if (found) {
                  setSelectedArrearsResident(found);
                }
              }
            }}
            className="w-full pl-3.5 pr-8 py-2.5 bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-950 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer transition-colors shadow-2xs"
          >
            <option value="" disabled>
              Klik untuk cari data anda!
            </option>
            {residents
              .slice()
              .sort((a, b) => a.houseNo.localeCompare(b.houseNo, undefined, { numeric: true }))
              .map((r) => (
                <option key={r.id} value={r.id}>
                  No. {r.houseNo} - {r.name} {r.isVacant ? '(Rumah Kosong)' : ''}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Top Statistic Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1 gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">Total Rumah</span>
            <Home className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono truncate">
            {stats.totalHouses} <span className="text-xs font-normal text-slate-500">Rumah</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 truncate">
            <span className="text-emerald-600 font-semibold">{stats.totalHouses - stats.vacantCount} Terisi</span>
            <span>•</span>
            <span className="text-slate-400">{stats.vacantCount} Kosong</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1 gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">Iuran Terkumpul</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-emerald-700 font-mono tracking-tight truncate" title={formatRupiah(stats.totalCollected)}>
            {formatRupiah(stats.totalCollected)}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1 truncate">
            Tahun 2026 Berjalan
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1 gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">Total Tunggakan</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-amber-700 font-mono tracking-tight truncate" title={formatRupiah(stats.totalArrears)}>
            {formatRupiah(stats.totalArrears)}
          </div>
          <div className="text-[11px] text-amber-600 font-medium mt-1 truncate">
            {stats.nunggakCount} Rumah Menunggak (s.d. {cutoffMonth})
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1 gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">Kepatuhan Warga</span>
            <span className="text-xs font-bold text-indigo-600 font-mono shrink-0">{stats.complianceRate}%</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-indigo-700 font-mono truncate">
            {stats.lunasCount} <span className="text-xs font-normal text-slate-500">LUNAS</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${stats.complianceRate}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Official Tariff Notice */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-slate-200 text-sm">Tarif Iuran Rutin Bulanan Warga Th 2026</p>
            <p className="text-slate-400 mt-0.5">
              • <strong>Januari s.d. Mei:</strong> Rp 60.000 / bulan &nbsp;|&nbsp; • <strong>Juni s.d. Desember:</strong> Rp 70.000 / bulan
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                const first = residents.find((r) => !r.isVacant);
                if (first) handleOpenPayModal(first);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>Catat Iuran Baru</span>
            </button>
            <button
              onClick={() => {
                const firstWithPayment = residents.find((r) =>
                  MONTHS.some((m) => r.payments[m]?.paid)
                );
                if (firstWithPayment) {
                  handleOpenCorrectionModal(firstWithPayment);
                } else {
                  alert('Belum ada data pembayaran yang tersimpan untuk dikoreksi.');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600/90 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors shadow-2xs cursor-pointer"
              title="Koreksi nominal atau batalkan pembayaran yang salah diinput"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Koreksi Iuran</span>
            </button>
            <button
              onClick={() => handleOpenResidentModal()}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tambah Rumah</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              filterTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Semua Rumah ({residents.length})
          </button>
          <button
            onClick={() => setFilterTab('LUNAS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              filterTab === 'LUNAS'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Lunas ({stats.lunasCount})
          </button>
          <button
            onClick={() => setFilterTab('NUNGGAK')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              filterTab === 'NUNGGAK'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            Menunggak ({stats.nunggakCount})
          </button>
          <button
            onClick={() => setFilterTab('KOSONG')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              filterTab === 'KOSONG'
                ? 'bg-slate-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Rumah Kosong ({stats.vacantCount})
          </button>
        </div>

        {/* Search & Print actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari no. rumah / nama warga..."
              className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          </div>
          <button
            type="button"
            onClick={handlePrintTable}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-2xs border border-rose-700 cursor-pointer whitespace-nowrap"
            title="Cetak tabel rekap iuran ke PDF/Kertas"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak PDF</span>
          </button>
        </div>
      </div>

      {/* Main Dues Table (Exact matrix matching user CSV) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="bg-emerald-50/90 border-b border-emerald-200 px-3 py-2 text-[11px] text-emerald-900 flex items-center justify-between sm:hidden font-semibold">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 shrink-0 text-emerald-700 animate-pulse" />
            <span>Geser tabel ke samping (kiri/kanan) untuk melihat bulan lainnya ↔</span>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-emerald-600 text-white font-bold border-b border-emerald-500 select-none text-[11px]">
                <th className="py-3 px-3 w-16 text-center border-r border-emerald-500 sticky top-0 left-0 z-20 bg-emerald-600 shadow-[1px_0_0_0_#10b981]">NO. RMH</th>
                <th className="py-3 px-3.5 min-w-[150px] border-r border-emerald-500 sticky top-0 left-16 z-20 bg-emerald-600 shadow-[1px_0_0_0_#10b981]">NAMA WARGA</th>
                <th className="py-2.5 px-3 min-w-[160px] border-r border-emerald-500 sticky top-0 z-10 bg-emerald-600">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-bold text-white uppercase tracking-tight">
                      TUNGGAKAN Sd. {getMonthAbbr(cutoffMonth)}
                    </span>
                    <select
                      value={cutoffMonth}
                      onChange={(e) => setCutoffMonth(e.target.value as MonthKey)}
                      title="Pilih batas bulan perhitungan tunggakan"
                      className="text-[10px] font-normal py-0.5 px-1.5 bg-emerald-700 border border-emerald-500 rounded text-white hover:bg-emerald-800 focus:outline-hidden cursor-pointer"
                    >
                      {MONTHS.map((m) => (
                        <option key={m} value={m} className="bg-emerald-800 text-white">
                          Sd. {getMonthAbbr(m)}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                {MONTHS.map((m) => (
                  <th
                    key={m}
                    className="py-3 px-2 text-center min-w-[80px] border-r border-emerald-500 last:border-r-0 sticky top-0 z-10 bg-emerald-600"
                  >
                    <span className="block text-white">{m.slice(0, 3)}</span>
                    <span className="block text-[9px] font-normal text-emerald-200">
                      {['Januari', 'Februari', 'Maret', 'April', 'Mei'].includes(m) ? '60k' : '70k'}
                    </span>
                  </th>
                ))}
                <th className="py-3 px-3.5 text-right min-w-[110px] border-l border-emerald-500 sticky top-0 z-10 bg-emerald-600 text-white">
                  TOTAL BAYAR
                </th>
                {isAdmin && <th className="py-3 px-3 text-center w-24 sticky top-0 z-10 bg-emerald-600 text-white">AKSI</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredResidents.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-slate-400">
                    Tidak ada data warga yang cocok dengan pencarian.
                  </td>
                </tr>
              ) : (
                filteredResidents.map((r, idx) => {
                  let totalPaid = 0;
                  const currentArrears = calculateArrearsForResident(r, r.payments, cutoffMonth);
                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        r.isVacant ? 'bg-slate-50/50 text-slate-400' : ''
                      }`}
                    >
                      {/* House Number (Sticky Left for Mobile) */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 border-r border-slate-100 sticky left-0 z-10 bg-white group-hover:bg-slate-50 shadow-[1px_0_0_0_#f1f5f9]">
                        {r.houseNo}
                      </td>

                      {/* Resident Name (Sticky Left for Mobile) */}
                      <td className="py-2.5 px-3.5 border-r border-slate-100 font-medium sticky left-16 z-10 bg-white group-hover:bg-slate-50 shadow-[1px_0_0_0_#f1f5f9]">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className={r.isVacant ? 'italic text-slate-400' : 'text-slate-800'}>
                            {r.name}
                          </span>
                          {r.customMonthlyRate && (
                            <span className="px-1.5 py-0.2 text-[9px] font-mono bg-purple-50 text-purple-700 border border-purple-200 rounded">
                              Khusus Rp{r.customMonthlyRate / 1000}k
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Arrears Status */}
                      <td className="py-2.5 px-3 border-r border-slate-100">
                        {r.isVacant ? (
                          <span className="text-slate-400 text-center block">-</span>
                        ) : currentArrears === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <Check className="w-3 h-3" />
                            <span>LUNAS</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 font-mono">
                            {formatRupiah(currentArrears)}
                          </span>
                        )}
                      </td>

                      {/* Month Matrix (Jan - Des) */}
                      {MONTHS.map((m) => {
                        const payment = r.payments[m];
                        const rate = getRateForMonth(r, m);
                        const isPartial = payment?.paid && payment.amount < rate;
                        const shortfall = rate - (payment?.amount || 0);

                        if (payment?.paid) {
                          totalPaid += payment.amount;
                        }

                        return (
                          <td
                            key={m}
                            className="py-1.5 px-1.5 text-center border-r border-slate-100 font-mono text-[11px]"
                          >
                            {r.isVacant ? (
                              <span className="text-slate-300">-</span>
                            ) : payment?.paid ? (
                              <div
                                className={`w-full py-1 px-1 rounded border flex flex-col items-center justify-center transition-all ${
                                  isPartial
                                    ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs'
                                    : payment.isCorrected
                                    ? 'bg-amber-50/70 text-amber-900 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}
                                title={
                                  isPartial
                                    ? `Cicil/Titip: Terbayar Rp${payment.amount.toLocaleString()} dari Rp${rate.toLocaleString()} (Kurang Rp${shortfall.toLocaleString()})`
                                    : `Lunas Rp${payment.amount.toLocaleString()}`
                                }
                              >
                                <div className="flex items-center gap-0.5">
                                  <span className="font-semibold text-[10px]">
                                    Rp{(payment.amount / 1000).toFixed(0)}k
                                  </span>
                                  {isPartial ? (
                                    <span
                                      className="text-[8px] font-bold text-amber-700 bg-amber-200/80 px-1 py-0.2 rounded font-sans leading-none"
                                      title={`Kurang Rp${shortfall.toLocaleString()}`}
                                    >
                                      Cicil
                                    </span>
                                  ) : payment.isCorrected ? (
                                    <span
                                      className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                                      title={`Pernah dikoreksi: ${payment.correctionNote || ''}`}
                                    ></span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <button
                                    onClick={() =>
                                      onViewReceipt(
                                        r,
                                        [m],
                                        payment.amount,
                                        payment.paymentMethod || 'Tunai',
                                        payment.receiptNo || 'KW-AUTO',
                                        payment.paidAt || '2026-09-01'
                                      )
                                    }
                                    title="Lihat kuitansi resmi"
                                    className="p-0.5 text-emerald-700 hover:text-emerald-950 hover:bg-emerald-100 rounded transition-colors cursor-pointer"
                                  >
                                    <Receipt className="w-2.5 h-2.5" />
                                  </button>

                                  {/* If partial, show quick button to pay remainder */}
                                  {isAdmin && isPartial && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenPayModal(r, m);
                                      }}
                                      title={`Masukkan pelunasan kekurangan ${m} (Kurang Rp${shortfall.toLocaleString()})`}
                                      className="p-0.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-200/60 rounded transition-colors cursor-pointer font-bold text-[10px]"
                                    >
                                      +
                                    </button>
                                  )}

                                  {isAdmin && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenCorrectionModal(r, m);
                                      }}
                                      title={`Koreksi / batalkan iuran ${m} 2026`}
                                      className="p-0.5 text-amber-600 hover:text-amber-900 hover:bg-amber-100 rounded transition-colors cursor-pointer"
                                    >
                                      <RotateCcw className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : isAdmin ? (
                              <button
                                onClick={() => handleOpenPayModal(r, m)}
                                title={`Catat bayar ${m} 2026`}
                                className="w-full py-1 text-slate-300 hover:text-emerald-700 hover:bg-emerald-50/50 rounded transition-colors text-center cursor-pointer"
                              >
                                +
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Total Paid */}
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-800 border-l border-slate-100 bg-slate-50/30">
                        {r.isVacant ? '-' : formatRupiah(totalPaid)}
                      </td>

                      {/* Actions for Admin */}
                      {isAdmin && (
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {!r.isVacant && (
                              <>
                                <button
                                  onClick={() => handleOpenPayModal(r)}
                                  title="Catat pembayaran iuran"
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleOpenCorrectionModal(r)}
                                  title="Koreksi / Batalkan Pembayaran Rumah Ini"
                                  className="p-1 text-amber-600 hover:bg-amber-50 rounded cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleOpenResidentModal(r)}
                              title="Edit data rumah/warga"
                              className="p-1 text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteResident(r.id, r.name)}
                              title="Hapus data"
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
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

        {/* Table footer count */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>
            Menampilkan <strong>{filteredResidents.length}</strong> dari total {residents.length} rumah
          </span>
          <span className="text-slate-400">
            Klik nomor nominal iuran hijau untuk melihat Kuitansi Digital RT
          </span>
        </div>
      </div>
    </>
      ) : (
        <IncidentalDuesView
          residents={residents}
          isAdmin={isAdmin}
          profile={profile}
          onAddTransaction={onAddTransaction}
          incidentalPrograms={incidentalPrograms}
          onSaveIncidentalProgram={onSaveIncidentalProgram}
          onDeleteIncidentalProgram={onDeleteIncidentalProgram}
        />
      )}

      {/* QUICK PAYMENT MODAL (for Admin) */}
      {isPayModalOpen && selectedResident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Catat Pembayaran Iuran</h3>
                  <p className="text-xs text-slate-400">
                    No. Rumah {selectedResident.houseNo} • {selectedResident.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Select Resident if needed */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Warga / Rumah
                </label>
                <select
                  value={selectedResidentId}
                  onChange={(e) => {
                    setSelectedResidentId(e.target.value);
                    setSelectedMonths([]);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {residents
                    .filter((r) => !r.isVacant)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        No. {r.houseNo} — {r.name} ({r.arrearsAmount === 0 ? 'LUNAS' : `Tunggakan: ${formatRupiah(r.arrearsAmount)}`})
                      </option>
                    ))}
                </select>
              </div>

              {/* Month Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pilih Bulan yang Dibayar
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {MONTHS.map((m) => {
                    const payment = selectedResident.payments[m];
                    const rate = getRateForMonth(selectedResident, m);
                    const existingAmount = payment?.paid ? payment.amount : 0;
                    const isFullyPaid = existingAmount >= rate;
                    const isPartial = payment?.paid && existingAmount > 0 && existingAmount < rate;
                    const shortfall = Math.max(0, rate - existingAmount);
                    const isChecked = selectedMonths.includes(m);

                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          if (isFullyPaid) return;
                          if (isChecked) {
                            setSelectedMonths(selectedMonths.filter((x) => x !== m));
                          } else {
                            setSelectedMonths([...selectedMonths, m]);
                          }
                        }}
                        disabled={isFullyPaid}
                        className={`p-2 rounded-xl text-xs font-medium border text-left transition-all ${
                          isFullyPaid
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : isChecked
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-semibold cursor-pointer'
                            : isPartial
                            ? 'bg-amber-50/90 text-amber-900 border-amber-300 hover:border-amber-400 cursor-pointer'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{m}</span>
                          {isFullyPaid ? (
                            <Check className="w-3 h-3 text-slate-400" />
                          ) : isPartial ? (
                            <span className="text-[9px] font-bold px-1 py-0.2 bg-amber-200 text-amber-800 rounded">
                              Cicil
                            </span>
                          ) : null}
                        </div>
                        <div
                          className={`text-[10px] mt-0.5 font-mono ${
                            isChecked
                              ? 'text-emerald-100'
                              : isPartial
                              ? 'text-amber-700 font-bold'
                              : 'text-slate-400'
                          }`}
                        >
                          {isFullyPaid
                            ? 'Sudah Lunas'
                            : isPartial
                            ? `Titip Rp${(existingAmount / 1000).toFixed(0)}k (Kurang Rp${(shortfall / 1000).toFixed(0)}k)`
                            : `Rp${rate / 1000}rb`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Method */}
              <div className="grid grid-cols-3 gap-2">
                {(['Tunai', 'Transfer Bank', 'QRIS RT'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border text-center transition-colors cursor-pointer ${
                      paymentMethod === method
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>

              {/* Total Calculation Display */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-emerald-800 font-medium block">
                    Total Yang Diterima ({selectedMonths.length} Bulan):
                  </span>
                  <span className="text-lg font-bold text-emerald-900 font-mono">
                    {formatRupiah(calculatedPayAmount)}
                  </span>
                </div>
                <div className="text-right">
                  <label className="text-[10px] text-emerald-700 block">Ubah nominal khusus?</label>
                  <input
                    type="number"
                    value={customPayAmount !== null ? customPayAmount : ''}
                    placeholder="Contoh: 140000"
                    onChange={(e) =>
                      setCustomPayAmount(e.target.value !== '' ? Number(e.target.value) : null)
                    }
                    className="w-28 px-2 py-1 bg-white border border-emerald-300 rounded text-xs text-slate-900 font-mono text-right"
                  />
                </div>
              </div>

              {/* Note / Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Kuitansi (Opsional)
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Contoh: Titip lewat Pak Bambang / Transfer BCA"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Upload Bukti File Foto / PDF */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Upload Bukti Transfer / Kwitansi (Foto / PDF) - Opsional
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
                  <p className="text-[11px] text-emerald-700 font-medium mt-1">
                    Terpilih: <strong>{formFile.name}</strong>{' '}
                    {isDriveConnected
                      ? '(Akan diunggah ke Google Drive)'
                      : '(Akan disimpan langsung)'}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  {isDriveConnected
                    ? 'File akan otomatis diunggah dan disimpan ke folder "Bukti Kas & Iuran RT" di Google Drive Anda.'
                    : 'Untuk menyimpan bukti permanen ke Google Drive, silakan klik "+ Hubungkan Google Drive".'}
                </p>
              </div>

              {/* Checkbox: Auto-sync to Cashbook */}
              <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncToCashbook}
                  onChange={(e) => setSyncToCashbook(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-slate-700 font-medium select-none">
                  Otomatis catat ke Buku Kas Masuk (Pemasukan RT)
                </span>
              </label>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={selectedMonths.length === 0 || isUploadingDrive}
                  className={`px-5 py-2.5 text-xs font-semibold text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 ${
                    selectedMonths.length === 0
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isUploadingDrive ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{uploadStatus || 'Mengunggah...'}</span>
                    </>
                  ) : (
                    <span>Simpan & Terbitkan Kuitansi</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE EDIT / ADD RESIDENT MODAL */}
      <ResidentFormModal
        isOpen={isResidentModalOpen}
        onClose={() => setIsResidentModalOpen(false)}
        resident={editingResident}
        onSave={handleSaveResident}
      />

      {/* PAYMENT CORRECTION / VOID MODAL */}
      <PaymentCorrectionModal
        isOpen={isCorrectionModalOpen}
        onClose={() => setIsCorrectionModalOpen(false)}
        resident={correctionResident}
        initialMonth={correctionInitialMonth}
        profile={profile}
        onApplyCorrection={handleApplyCorrection}
      />

      {/* MODAL: INFORMASI DETAIL TUNGGAKAN / STATUS LUNAS */}
      {selectedArrearsResident && (() => {
        const totalArrears = calculateArrearsForResident(
          selectedArrearsResident,
          selectedArrearsResident.payments,
          cutoffMonth
        );
        const unpaidMonths = getUnpaidMonthsDetails(selectedArrearsResident, cutoffMonth);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight">
                      Informasi Detail Tunggakan
                    </h3>
                    <p className="text-xs text-slate-300">
                      Rumah No. {selectedArrearsResident.houseNo} • {selectedArrearsResident.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedArrearsResident(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                {totalArrears > 0 ? (
                  <>
                    {/* WRAPPER FOR IMAGE CAPTURE */}
                    <div id="arrears-card-to-capture" className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3.5 shadow-xs">
                      {/* Header Slip Tagihan */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div>
                          <span className="text-[10px] font-extrabold text-emerald-700 tracking-wider uppercase block">
                            Kartu Tagihan Resmi
                          </span>
                          <h4 className="font-bold text-slate-800 text-xs uppercase leading-tight">
                            RT {profile.rtNumber} / RW {profile.rwNumber} {profile.name}
                          </h4>
                        </div>
                        <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded">
                          PENGINGAT PEMBAYARAN
                        </span>
                      </div>

                      {/* Data Resident */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-semibold text-slate-800">
                        <div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase">Nama Warga</div>
                          <div className="text-slate-900">{selectedArrearsResident.name}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase">No. Rumah</div>
                          <div className="text-slate-900">Rumah No. {selectedArrearsResident.houseNo}</div>
                        </div>
                      </div>

                      {/* Summary Card */}
                      <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-center space-y-1">
                        <span className="text-[9px] font-extrabold text-amber-900 uppercase tracking-wider block">
                          TOTAL TUNGGAKAN (S.D. {cutoffMonth.toUpperCase()})
                        </span>
                        <div className="text-xl font-black text-amber-700 font-mono">
                          {formatRupiah(totalArrears)}
                        </div>
                        <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-200/80 text-amber-900 rounded-md inline-block">
                          {unpaidMonths.length} Bulan Belum Lunas
                        </span>
                      </div>

                      {/* Rincian Bulan */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Rincian Bulan Belum Dibayar:
                        </div>
                        <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 text-[11px]">
                          {unpaidMonths.map((item) => (
                            <div key={item.month} className="px-2.5 py-1.5 flex items-center justify-between bg-slate-50/30">
                              <span className="font-semibold text-slate-800">{item.month}</span>
                              <span className="font-mono font-bold text-amber-700">{formatRupiah(item.arrears)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Rekening Transfer */}
                      <div className="p-3 bg-slate-900 text-white rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-emerald-400 uppercase font-bold tracking-wider">
                            Penyaluran Transfer Iuran:
                          </span>
                          <span className="text-[9px] text-slate-300 font-bold bg-slate-800 px-2 py-0.5 rounded">
                            {profile.bankName || 'Mandiri'}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-between gap-2">
                          <div>
                            <div className="text-[10px] text-slate-400">Nomor Rekening Bendahara:</div>
                            <div className="font-mono font-extrabold text-sm text-emerald-300 tracking-wider">
                              {profile.bankAccountNo || '1030013542580'}
                            </div>
                            <div className="text-[10px] text-slate-300">
                              a.n {profile.bankAccountHolder || profile.treasurerName || 'Bendahara RT'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleCopyBankNo}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer shrink-0 border border-emerald-500"
                          >
                            {copiedBankNo ? 'Tersalin!' : 'Salin'}
                          </button>
                        </div>
                      </div>

                      <div className="text-[9px] text-slate-400 italic text-center">
                        * Harap lampirkan bukti transfer saat melakukan konfirmasi.
                      </div>
                    </div>

                    {/* Community Appeal & Instructions */}
                    <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs leading-relaxed space-y-1.5">
                      <div className="font-bold flex items-center gap-1.5 text-blue-950">
                        <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                        <span>Pentingnya Iuran Untuk Lingkungan Kita</span>
                      </div>
                      <p>
                        Mohon untuk dapat <strong>segera melakukan pembayaran iuran warga</strong>, karena kas RT ini digunakan secara penuh untuk kepentingan bersama dalam menjaga <strong>keamanan (siskamling), kebersihan lingkungan, penerangan jalan</strong>, serta operasional warga RT {profile.rtNumber} / RW {profile.rwNumber} Desa {profile.subdistrict}.
                      </p>
                    </div>

                    {/* WhatsApp Confirmation Link to Treasurer */}
                    {(() => {
                      const treasurerOfficer = profile.officers?.find((o) =>
                        o.role.toLowerCase().includes('bendahara') && (!o.endPeriod || o.endPeriod >= new Date().toISOString().slice(0, 10))
                      ) || profile.officers?.find((o) => o.role.toLowerCase().includes('bendahara'));

                      const treasurerName = treasurerOfficer?.name || profile.treasurerName || 'Bendahara RT';
                      const treasurerPhone = treasurerOfficer?.phone || '081399887766';

                      const formatWaPhone = (phoneStr: string) => {
                        let cleaned = phoneStr.replace(/\D/g, '');
                        if (cleaned.startsWith('0')) {
                          cleaned = '62' + cleaned.slice(1);
                        }
                        return cleaned || '6281399887766';
                      };

                      const waMessage =
                        `Halo ${treasurerName},\n` +
                        `Saya *${selectedArrearsResident.name}* (Rumah No. *${selectedArrearsResident.houseNo}*) ingin melakukan konfirmasi pembayaran iuran RT.\n\n` +
                        `• Total Tunggakan: *${formatRupiah(totalArrears)}* (s.d. ${cutoffMonth})\n` +
                        `• Rincian Bulan: ${unpaidMonths.map((u) => u.month).join(', ')}\n\n` +
                        `Mohon verifikasi & catat pembayaran iuran kami. Terima kasih!`;

                      const waUrl = `https://api.whatsapp.com/send?phone=${formatWaPhone(treasurerPhone)}&text=${encodeURIComponent(waMessage)}`;

                      return (
                        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                              <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Konfirmasi Pembayaran via WhatsApp</span>
                            </span>
                            <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                              Bendahara RT
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-900 leading-relaxed">
                            Setelah melakukan transfer, silakan klik tombol di bawah ini untuk mengirimkan konfirmasi & bukti pembayaran langsung kepada Bendahara Pengurus RT (<strong>{treasurerName}</strong>).
                          </p>
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer border border-emerald-500 hover:shadow-md"
                          >
                            <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                              <path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.124.553 4.197 1.605 6.02L0 24l6.182-1.576a11.976 11.976 0 005.849 1.511h.005c6.645 0 12.03-5.385 12.03-12.031A11.97 11.97 0 0012.031 0zM12.03 21.942h-.004a9.932 9.932 0 01-5.063-1.385l-.363-.215-3.761.958.973-3.664-.236-.375a9.923 9.923 0 01-1.528-5.228C2.048 6.516 6.52 2.044 12.031 2.044c2.67 0 5.179 1.04 7.067 2.928 1.888 1.888 2.927 4.398 2.927 7.068-.001 5.512-4.474 9.902-9.995 9.902zm5.48-7.481c-.301-.15-1.782-.88-2.058-.98-.276-.1-.477-.15-.678.15-.201.3-.777.98-.953 1.18-.175.2-.351.226-.652.075-.301-.15-1.272-.469-2.423-1.5-1.152-1.028-1.928-2.298-2.154-2.686-.226-.388-.024-.598.126-.748.135-.135.301-.351.452-.527.15-.175.201-.301.301-.502.1-.201.05-.376-.025-.527-.075-.15-.678-1.631-.928-2.234-.244-.588-.493-.509-.678-.518-.175-.01-.376-.01-.577-.01s-.527.075-.803.376c-.276.301-1.054 1.03-1.054 2.51 0 1.48 1.08 2.91 1.23 3.11.15.2 2.124 3.243 5.145 4.548.718.311 1.279.497 1.716.638.721.229 1.377.197 1.896.115.578-.092 1.782-.728 2.033-1.431.251-.703.251-1.305.176-1.43-.075-.126-.276-.201-.577-.352z"/>
                            </svg>
                            <span>Konfirmasi WA ke Bendahara ({treasurerName})</span>
                          </a>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  /* Lunas Success Celebration */
                  <div className="py-6 text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs border border-emerald-200">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <div className="space-y-1.5 max-w-sm mx-auto">
                      <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider">
                        Status: LUNAS
                      </span>
                      <h4 className="text-base sm:text-lg font-extrabold text-slate-900 pt-1">
                        Terima Kasih Telah Tertib Membayar!
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Terima kasih banyak kepada Bpk/Ibu <strong>{selectedArrearsResident.name}</strong> (Rumah No. {selectedArrearsResident.houseNo}) yang telah <strong>tertib dan selalu disiplin membayar iuran warga</strong> s.d. bulan {cutoffMonth} 2026.
                      </p>
                    </div>
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs leading-relaxed text-left max-w-md mx-auto space-y-2">
                      <p className="font-bold flex items-center gap-1.5 text-emerald-950">
                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        <span>Kontribusi Anda Sangat Berharga!</span>
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        Kedisiplinan pembayaran iuran Anda sangat mendukung kelancaran operasional, kebersihan, penerangan, serta keamanan lingkungan tempat tinggal kita bersama di RT {profile.rtNumber} / RW {profile.rwNumber} Desa {profile.subdistrict}.
                      </p>
                    </div>

                    {/* WhatsApp Contact for Lunas Residents */}
                    {(() => {
                      const treasurerOfficer = profile.officers?.find((o) =>
                        o.role.toLowerCase().includes('bendahara') && (!o.endPeriod || o.endPeriod >= new Date().toISOString().slice(0, 10))
                      ) || profile.officers?.find((o) => o.role.toLowerCase().includes('bendahara'));

                      const treasurerName = treasurerOfficer?.name || profile.treasurerName || 'Bendahara RT';
                      const treasurerPhone = treasurerOfficer?.phone || '081399887766';

                      const formatWaPhone = (phoneStr: string) => {
                        let cleaned = phoneStr.replace(/\D/g, '');
                        if (cleaned.startsWith('0')) {
                          cleaned = '62' + cleaned.slice(1);
                        }
                        return cleaned || '6281399887766';
                      };

                      const waMessage =
                        `Halo ${treasurerName},\n` +
                        `Saya *${selectedArrearsResident.name}* (Rumah No. *${selectedArrearsResident.houseNo}*).\n` +
                        `Status iuran warga kami terpantau LUNAS. Terima kasih!`;

                      const waUrl = `https://api.whatsapp.com/send?phone=${formatWaPhone(treasurerPhone)}&text=${encodeURIComponent(waMessage)}`;

                      return (
                        <div className="pt-2 max-w-md mx-auto">
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold text-xs rounded-xl transition-colors cursor-pointer border border-emerald-300"
                          >
                            <MessageCircle className="w-4 h-4 text-emerald-700" />
                            <span>Hubungi Bendahara RT ({treasurerName})</span>
                          </a>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                  RT {profile.rtNumber} / RW {profile.rwNumber} Desa {profile.subdistrict}
                </span>
                <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
                  {totalArrears > 0 && (
                    <button
                      type="button"
                      disabled={isSharing}
                      onClick={() => handleShareWhatsApp(selectedArrearsResident, totalArrears, unpaidMonths)}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer border border-emerald-500"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.124.553 4.197 1.605 6.02L0 24l6.182-1.576a11.976 11.976 0 005.849 1.511h.005c6.645 0 12.03-5.385 12.03-12.031A11.97 11.97 0 0012.031 0zM12.03 21.942h-.004a9.932 9.932 0 01-5.063-1.385l-.363-.215-3.761.958.973-3.664-.236-.375a9.923 9.923 0 01-1.528-5.228C2.048 6.516 6.52 2.044 12.031 2.044c2.67 0 5.179 1.04 7.067 2.928 1.888 1.888 2.927 4.398 2.927 7.068-.001 5.512-4.474 9.902-9.995 9.902zm5.48-7.481c-.301-.15-1.782-.88-2.058-.98-.276-.1-.477-.15-.678.15-.201.3-.777.98-.953 1.18-.175.2-.351.226-.652.075-.301-.15-1.272-.469-2.423-1.5-1.152-1.028-1.928-2.298-2.154-2.686-.226-.388-.024-.598.126-.748.135-.135.301-.351.452-.527.15-.175.201-.301.301-.502.1-.201.05-.376-.025-.527-.075-.15-.678-1.631-.928-2.234-.244-.588-.493-.509-.678-.518-.175-.01-.376-.01-.577-.01s-.527.075-.803.376c-.276.301-1.054 1.03-1.054 2.51 0 1.48 1.08 2.91 1.23 3.11.15.2 2.124 3.243 5.145 4.548.718.311 1.279.497 1.716.638.721.229 1.377.197 1.896.115.578-.092 1.782-.728 2.033-1.431.251-.703.251-1.305.176-1.43-.075-.126-.276-.201-.577-.352z"/>
                      </svg>
                      <span>{isSharing ? 'Memproses...' : 'Kirim Pengingat WA'}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedArrearsResident(null)}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    Tutup Informasi
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
