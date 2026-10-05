import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  PlusCircle,
  Home,
  User,
  Heart,
  Phone,
  MessageCircle,
  FileText,
  Printer,
  Edit2,
  Trash2,
  CheckCircle2,
  Building,
  UserCheck,
  Eye,
  Filter,
  X,
  CreditCard,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { Resident, RTProfile, FamilyMemberItem } from '../types';
import {
  formatRupiah,
  getCleanRtRwTitle,
  getCleanProfileName,
  formatDateTimeJakarta,
  formatDateJakarta,
  formatDateIndo,
  getWhatsAppUrl,
  getMemberName,
  getMemberNik,
  getMemberPhone,
  getMemberRelation,
} from '../utils/formatters';
import { ResidentFormModal } from './ResidentFormModal';

interface ResidentsDirectoryProps {
  residents: Resident[];
  isAdmin: boolean;
  isSecretary?: boolean;
  canEditDues?: boolean;
  profile: RTProfile;
  onUpdateResidents: (newResidents: Resident[]) => void;
  onNavigateToDues?: (residentId: string) => void;
}

export const ResidentsDirectory: React.FC<ResidentsDirectoryProps> = ({
  residents,
  isAdmin,
  isSecretary = false,
  canEditDues,
  profile,
  onUpdateResidents,
  onNavigateToDues,
}) => {
  // If canEditDues is explicitly passed, use it; otherwise true for full admin and false for secretary
  const effectiveCanEditDues = canEditDues !== undefined ? canEditDues : (isAdmin && !isSecretary);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OWNER' | 'RENT' | 'VACANT'>('ALL');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');

  // Modal State for Edit / Add Resident
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);

  // Detail Modal for specific Family
  const [selectedFamily, setSelectedFamily] = useState<Resident | null>(null);
  const [confirmDeleteResident, setConfirmDeleteResident] = useState<{ id: string; name: string } | null>(null);

  // Helper to mask sensitive identity numbers (NIK & No. KK) for non-admin viewers
  const renderMaskedId = (idStr: string | undefined, type: 'KTP' | 'KK') => {
    if (!idStr || idStr.trim() === '-' || idStr.trim() === '') {
      return <span className="text-slate-400 font-mono">-</span>;
    }

    if (isAdmin) {
      return <span className="font-mono font-semibold text-slate-800">{idStr}</span>;
    }

    // Viewer warga mode: masked with lock badge
    const clean = idStr.trim();
    const masked =
      clean.length >= 10
        ? `${clean.slice(0, 4)}********${clean.slice(-2)}`
        : clean.length >= 6
        ? `${clean.slice(0, 2)}******${clean.slice(-2)}`
        : '••••••••••••';

    return (
      <span
        className="inline-flex items-center gap-1 font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] select-none"
        title={`Nomor ${type} disensor demi privasi warga. Hanya Pengurus RT yang berwenang melihat data lengkap.`}
      >
        <Lock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
        <span>{masked}</span>
      </span>
    );
  };

  // Filtered residents list
  const filteredResidents = useMemo(() => {
    return residents.filter((r) => {
      // Search matching across family fields (only search full NIK/KK if admin)
      const q = searchTerm.toLowerCase();
      const matchBasic =
        r.houseNo.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (isAdmin && r.nik && r.nik.toLowerCase().includes(q)) ||
        (isAdmin && r.kkNumber && r.kkNumber.toLowerCase().includes(q)) ||
        (r.phone && r.phone.toLowerCase().includes(q)) ||
        (r.spouseName && r.spouseName.toLowerCase().includes(q)) ||
        (isAdmin && r.spouseNik && r.spouseNik.toLowerCase().includes(q)) ||
        (r.spousePhone && r.spousePhone.toLowerCase().includes(q));

      const matchChildren = r.children?.some((c) => {
        const nameMatch = getMemberName(c).toLowerCase().includes(q);
        const nikMatch = isAdmin && getMemberNik(c)?.toLowerCase().includes(q);
        const phoneMatch = getMemberPhone(c)?.toLowerCase().includes(q);
        return nameMatch || nikMatch || phoneMatch;
      });

      const matchOther = r.otherFamilyMembers?.some((m) => {
        const nameMatch = getMemberName(m).toLowerCase().includes(q);
        const nikMatch = isAdmin && getMemberNik(m)?.toLowerCase().includes(q);
        const phoneMatch = getMemberPhone(m)?.toLowerCase().includes(q);
        const relMatch = getMemberRelation(m)?.toLowerCase().includes(q);
        return nameMatch || nikMatch || phoneMatch || relMatch;
      });

      const matchesSearch = matchBasic || matchChildren || matchOther;
      if (!matchesSearch) return false;

      if (filterStatus === 'VACANT') return r.isVacant;
      if (filterStatus === 'OWNER') return !r.isVacant && r.houseStatus === 'Milik Sendiri';
      if (filterStatus === 'RENT') return !r.isVacant && r.houseStatus === 'Kontrak / Sewa';

      return true;
    });
  }, [residents, searchTerm, filterStatus]);

  // Aggregate population statistics
  const stats = useMemo(() => {
    let totalKK = 0;
    let totalVacant = 0;
    let totalOccupants = 0;
    let totalChildren = 0;
    let totalOwner = 0;
    let totalRent = 0;

    residents.forEach((r) => {
      if (r.isVacant) {
        totalVacant++;
      } else {
        totalKK++;
        if (r.houseStatus === 'Milik Sendiri') totalOwner++;
        if (r.houseStatus === 'Kontrak / Sewa') totalRent++;

        // Count occupants: Kepala Keluarga (1) + Pasangan + Anak + Lainnya
        const occupants = r.totalOccupants || (
          1 +
          (r.spouseName ? 1 : 0) +
          (r.children ? r.children.length : 0) +
          (r.otherFamilyMembers ? r.otherFamilyMembers.length : 0)
        );
        totalOccupants += occupants;
        totalChildren += r.children ? r.children.length : 0;
      }
    });

    return {
      totalHouses: residents.length,
      totalKK,
      totalVacant,
      totalOccupants,
      totalChildren,
      totalOwner,
      totalRent,
    };
  }, [residents]);

  const handleOpenAddModal = () => {
    setEditingResident(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (res: Resident) => {
    setEditingResident(res);
    setIsFormModalOpen(true);
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
        customRateReason: data.customRateReason,
        discountAmount: data.discountAmount,
        discountReason: data.discountReason,
        phone: data.phone,
        nik: data.nik,
        kkNumber: data.kkNumber,
        spouseName: data.spouseName,
        spouseNik: data.spouseNik,
        spousePhone: data.spousePhone,
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
    setConfirmDeleteResident({ id, name });
  };

  const executeDeleteResident = () => {
    if (!confirmDeleteResident) return;
    onUpdateResidents(residents.filter((r) => r.id !== confirmDeleteResident.id));
    if (selectedFamily?.id === confirmDeleteResident.id) {
      setSelectedFamily(null);
    }
    setConfirmDeleteResident(null);
  };

  const handlePrintCensus = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Gagal membuka jendela cetak. Pastikan browser Anda tidak memblokir pop-up.');
      return;
    }

    const formatMaskedForPrint = (idStr: string | undefined, type: 'KTP' | 'KK') => {
      if (!idStr || idStr.trim() === '-' || idStr.trim() === '') return '-';
      if (isAdmin) return idStr;
      const clean = idStr.trim();
      return clean.length >= 10
        ? `${clean.slice(0, 4)}********${clean.slice(-2)}`
        : clean.length >= 6
        ? `${clean.slice(0, 2)}******${clean.slice(-2)}`
        : '••••••••••••';
    };

    const itemsToPrint = filteredResidents;

    const rows = itemsToPrint.map((r) => {
      const occupantsCount = r.isVacant ? 0 : (r.totalOccupants || (
        1 + (r.spouseName ? 1 : 0) + (r.children?.length || 0) + (r.otherFamilyMembers?.length || 0)
      ));
      
      const familyDetailList = [];
      if (r.spouseName) familyDetailList.push(`Istri/Suami: ${r.spouseName}`);
      if (r.children && r.children.length > 0) {
        familyDetailList.push(`Anak: ${r.children.map(getMemberName).join(', ')}`);
      }
      if (r.otherFamilyMembers && r.otherFamilyMembers.length > 0) {
        familyDetailList.push(`Lainnya: ${r.otherFamilyMembers.map((m) => {
          const mName = getMemberName(m);
          const mRel = getMemberRelation(m);
          return mRel ? `${mName} (${mRel})` : mName;
        }).join(', ')}`);
      }
      const familyDetailText = familyDetailList.length > 0 ? familyDetailList.join('<br/>') : '-';
      const statusText = r.isVacant ? '<span style="color: #94a3b8; font-style: italic;">Kosong</span>' : (r.houseStatus || 'Milik Sendiri');

      return `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 10px; text-align: center; font-weight: bold; font-family: monospace;">${r.houseNo}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 10px; font-weight: bold;">${r.isVacant ? '<em>RUMAH KOSONG</em>' : r.name}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 10px; text-align: center;">${statusText}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 10px; font-family: monospace; text-align: center;">${r.isVacant ? '-' : formatMaskedForPrint(r.nik, 'KTP')}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 10px; font-family: monospace; text-align: center;">${r.isVacant ? '-' : formatMaskedForPrint(r.kkNumber, 'KK')}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 9.5px; line-height: 1.3;">${r.isVacant ? '-' : familyDetailText}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 10px; text-align: center; font-weight: bold; font-family: monospace;">${r.isVacant ? '-' : occupantsCount} Jiwa</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 10px; font-family: monospace; text-align: center;">${r.phone || '-'}</td>
        </tr>
      `;
    }).join('');

    const timestamp = formatDateTimeJakarta(new Date());
    const chairpersonOfficer = profile.officers?.find((o) => o.role.toLowerCase().includes('ketua'));
    const chairpersonName = chairpersonOfficer?.name || profile.chairpersonName || 'Ketua RT';

    const secretaryOfficer = profile.officers?.find((o) => o.role.toLowerCase().includes('sekretaris'));
    const secretaryName = secretaryOfficer?.name || profile.secretaryName || 'Sekretaris RT';

    printWindow.document.write(`
      <html>
        <head>
          <title>DAFTAR INDUK WARGA - ${getCleanRtRwTitle(profile)}</title>
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
              font-size: 10.5px;
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
              background-color: #0f172a;
              color: #ffffff;
              font-weight: bold;
              text-align: center;
              text-transform: uppercase;
              font-size: 9px;
              padding: 6px;
              border: 1px solid #475569;
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
            <h1>${getCleanRtRwTitle(profile).toUpperCase()}</h1>
            <p>Desa ${profile.subdistrict}, Kec. ${profile.district}, ${profile.city}, Jawa Barat</p>
            <h2 style="margin: 8px 0 0 0; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; color: #0f172a; text-transform: uppercase;">LAPORAN DATA INDUK WARGA & SENSUS PENDUDUK</h2>
          </div>
          
          <div class="report-meta">
            <div>Total Terdaftar: <span style="color: #0284c7; font-weight: bold;">${stats.totalKK} Kepala Keluarga (KK)</span></div>
            <div>Total Jiwa Penghuni: <span style="color: #047857; font-weight: bold;">${stats.totalOccupants} Jiwa</span></div>
            <div>Rumah Kosong: <span style="color: #ef4444; font-weight: bold;">${stats.totalVacant} Unit</span></div>
            <div>Tanggal Cetak: <span>${timestamp}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 50px;">NO. RMH</th>
                <th style="width: 140px; text-align: left;">KEPALA KELUARGA</th>
                <th style="width: 90px;">STATUS RUMAH</th>
                <th style="width: 110px;">NIK KEPALA KELUARGA</th>
                <th style="width: 110px;">NOMOR KARTU KELUARGA</th>
                <th style="text-align: left;">DETAIL ANGGOTA KELUARGA (PASANGAN/ANAK/LAIN)</th>
                <th style="width: 70px;">JML JIWA</th>
                <th style="width: 100px;">NO. HP WARGA</th>
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
              <p style="margin: 0 0 10px 0; font-size: 10px; color: #475569; font-weight: 600;">Sekretaris Pengurus RT,</p>
              <div class="signature-space"></div>
              <p class="signature-name">${secretaryName}</p>
            </div>
          </div>

          <div class="system-note">
            Laporan kependudukan resmi RT. Dicatat secara transparan, aman, dan akuntabel di Aplikasi Buku Kas RT.
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <span>Data Kependudukan & Warga RT</span>
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
              {stats.totalKK} Kepala Keluarga
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Buku induk kependudukan {getCleanRtRwTitle(profile)} (No. KTP, No. KK, nama istri, anak, dan anggota keluarga)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintCensus}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Cetak Data Warga</span>
          </button>

          {isAdmin && (
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tambah Warga Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Privacy Notice Banner for Viewer (Warga) */}
      {!isAdmin && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3.5 sm:p-4 flex items-start sm:items-center gap-3 text-xs text-amber-900 shadow-2xs print:hidden">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-amber-950 flex items-center gap-1.5">
            </p>
            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
              Nomor KTP (NIK) dan Nomor Kartu Keluarga (KK) sengaja <strong>ditutup / disensor</strong> demi menjaga privasi dan keamanan data kependudukan seluruh warga RT. Akses data lengkap hanya untuk Pengurus RT yang berwenang.
            </p>
          </div>
        </div>
      )}

      {/* Population KPI Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1 gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">Total Rumah</span>
            <Home className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono truncate">
            {stats.totalHouses} <span className="text-xs font-normal text-slate-500">Unit</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 truncate">
            <span className="text-emerald-600 font-semibold">{stats.totalKK} Berpenghuni</span>
            <span>•</span>
            <span className="text-slate-400">{stats.totalVacant} Kosong</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1 gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">Total Penduduk</span>
            <Users className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-700 font-mono truncate">
            {stats.totalOccupants} <span className="text-xs font-normal text-slate-500">Jiwa</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1 truncate">
            Termasuk {stats.totalChildren} anak & balita
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1 gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">Status Hunian</span>
            <Building className="w-4 h-4 text-blue-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono truncate">
            {stats.totalOwner} <span className="text-xs font-normal text-slate-500">Milik Sendiri</span>
          </div>
          <div className="text-[11px] text-blue-600 font-medium mt-1 truncate">
            {stats.totalRent} Rumah Kontrak / Sewa
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1 gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">Kepala Keluarga</span>
            <UserCheck className="w-4 h-4 text-indigo-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-indigo-700 font-mono truncate">
            {stats.totalKK} <span className="text-xs font-normal text-slate-500">KK</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            RT {profile.rtNumber} / RW {profile.rwNumber}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 print:hidden">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              filterStatus === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Semua Rumah ({residents.length})
          </button>
          <button
            onClick={() => setFilterStatus('OWNER')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              filterStatus === 'OWNER'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Milik Sendiri ({stats.totalOwner})
          </button>
          <button
            onClick={() => setFilterStatus('RENT')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              filterStatus === 'RENT'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-blue-700 hover:bg-blue-50'
            }`}
          >
            Kontrak / Sewa ({stats.totalRent})
          </button>
          <button
            onClick={() => setFilterStatus('VACANT')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              filterStatus === 'VACANT'
                ? 'bg-slate-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Rumah Kosong ({stats.totalVacant})
          </button>
        </div>

        {/* Search input & view toggle */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama warga, No. KTP, No. KK, istri, anak..."
              className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-colors"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 p-1 shrink-0">
            <button
              onClick={() => setViewMode('card')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                viewMode === 'card' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              Kartu
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              Tabel
            </button>
          </div>
        </div>
      </div>

      {/* PRINT-ONLY HEADER */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-6 text-center">
        <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
          BUKU INDUK DATA WARGA & KEPENDUDUKAN
        </h1>
        <p className="text-sm font-semibold text-slate-700 mt-1 uppercase">
          {getCleanRtRwTitle(profile)}
        </p>
        <p className="text-xs text-slate-500">
          Desa {profile.subdistrict}, Kec. {profile.district}, {profile.city}
        </p>
      </div>

      {/* CARD VIEW MODE */}
      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResidents.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              Tidak ada data warga yang cocok dengan kriteria pencarian.
            </div>
          ) : (
            filteredResidents.map((r) => {
              const totalFamilyOccupants = r.totalOccupants || (
                1 +
                (r.spouseName ? 1 : 0) +
                (r.children ? r.children.length : 0) +
                (r.otherFamilyMembers ? r.otherFamilyMembers.length : 0)
              );

              return (
                <div
                  key={r.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                    r.isVacant
                      ? 'border-slate-200/80 bg-slate-50/50 opacity-75'
                      : 'border-slate-200 hover:border-emerald-300 hover:shadow-md'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center shrink-0 font-mono">
                        <span className="text-[9px] uppercase tracking-tighter text-slate-400 leading-none">
                          NO
                        </span>
                        <span className="text-base font-bold leading-tight">{r.houseNo}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm leading-tight">
                          {r.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {r.isVacant ? (
                            <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-200 text-slate-700 rounded-md">
                              Rumah Kosong
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                              {r.houseStatus || 'Milik Sendiri'}
                            </span>
                          )}
                          {!r.isVacant && (
                            <span className="text-[11px] text-slate-500 font-semibold font-mono">
                              {totalFamilyOccupants} Jiwa
                            </span>
                          )}
                          {r.customMonthlyRate !== undefined && r.customMonthlyRate > 0 ? (
                            <span 
                              className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 rounded-md font-mono shadow-2xs"
                              title={r.customRateReason ? `Tarif Khusus: ${r.customRateReason} (Rp ${r.customMonthlyRate.toLocaleString('id-ID')}/bln)` : `Tarif Khusus: Rp ${r.customMonthlyRate.toLocaleString('id-ID')}/bln`}
                            >
                              Khusus Rp{(r.customMonthlyRate / 1000).toLocaleString('id-ID')}k/bln
                            </span>
                          ) : r.discountAmount && r.discountAmount > 0 ? (
                            <span 
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 rounded-md font-mono"
                              title={r.discountReason ? `Diskon: ${r.discountReason}` : 'Mendapat Potongan Diskon Iuran'}
                            >
                              Diskon -Rp{(r.discountAmount / 1000).toLocaleString('id-ID')}k
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {!r.isVacant && r.phone && (
                      <a
                        href={getWhatsAppUrl(r.phone, `Yth. Bapak/Ibu ${r.name}, `)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg transition-colors shrink-0"
                        title={`Kirim pesan WhatsApp ke ${r.name}`}
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Hubungi WA</span>
                      </a>
                    )}
                  </div>

                  {/* Card Body: Identitas & Susunan Keluarga */}
                  <div className="p-4 space-y-3 text-xs flex-1">
                    {!r.isVacant ? (
                      <>
                        {/* KTP & KK */}
                        <div className="bg-slate-50 p-2.5 rounded-xl space-y-1.5 text-[11px]">
                          <div className="flex justify-between items-center text-slate-600">
                            <span className="text-[10px] text-slate-400 font-sans">No. KK:</span>
                            {renderMaskedId(r.kkNumber, 'KK')}
                          </div>
                          <div className="flex justify-between items-center text-slate-600">
                            <span className="text-[10px] text-slate-400 font-sans">NIK Kepala:</span>
                            {renderMaskedId(r.nik, 'KTP')}
                          </div>
                        </div>

                        {/* Istri / Pasangan */}
                        {r.spouseName ? (
                          <div className="flex items-center justify-between text-slate-700">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span className="text-slate-500 text-[11px]">Istri/Pasangan:</span>
                              <span className="font-semibold text-slate-800 truncate">{r.spouseName}</span>
                            </div>
                            {r.spousePhone && (
                              <a
                                href={getWhatsAppUrl(r.spousePhone, `Yth. Ibu/Bpk ${r.spouseName}, `)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[9px] font-medium transition-colors shrink-0"
                                title={`Hubungi WA ${r.spouseName}`}
                              >
                                <MessageCircle className="w-2.5 h-2.5 text-emerald-600" />
                                <span>WA</span>
                              </a>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 italic">
                            Belum ada data istri/pasangan
                          </div>
                        )}

                        {/* Anak */}
                        <div>
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                            <User className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Anak ({r.children?.length || 0}):</span>
                          </div>

                          {r.children && r.children.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {r.children.map((child, idx) => {
                                const cName = getMemberName(child);
                                const cNik = getMemberNik(child);
                                const cPhone = getMemberPhone(child);
                                return (
                                  <div
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-medium"
                                  >
                                    <span>{cName}</span>
                                    {cNik && (
                                      <span className="text-[9px] text-slate-400 font-mono">
                                        ({renderMaskedId(cNik, 'KTP')})
                                      </span>
                                    )}
                                    {cPhone && (
                                      <a
                                        href={getWhatsAppUrl(cPhone, `Yth. ${cName}, `)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-emerald-700 hover:text-emerald-800"
                                        title={`Hubungi WA ${cName}`}
                                      >
                                        <MessageCircle className="w-2.5 h-2.5 inline text-emerald-600" />
                                      </a>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Tidak ada anak terdaftar
                            </span>
                          )}
                        </div>

                        {/* Anggota Lain */}
                        {r.otherFamilyMembers && r.otherFamilyMembers.length > 0 && (
                          <div className="pt-1 text-[11px] text-slate-600">
                            <span className="text-slate-400">Famili lain: </span>
                            <div className="inline-flex flex-wrap gap-1 mt-0.5">
                              {r.otherFamilyMembers.map((m, idx) => {
                                const mName = getMemberName(m);
                                const mRel = getMemberRelation(m);
                                const mPhone = getMemberPhone(m);
                                return (
                                  <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-slate-100 rounded text-[10px] text-slate-700">
                                    <span>{mName}{mRel ? ` (${mRel})` : ''}</span>
                                    {mPhone && (
                                      <a
                                        href={getWhatsAppUrl(mPhone, `Yth. ${mName}, `)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-emerald-700 hover:text-emerald-800"
                                        title={`Hubungi WA ${mName}`}
                                      >
                                        <MessageCircle className="w-2.5 h-2.5 inline text-emerald-600" />
                                      </a>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-6 text-center text-slate-400 italic text-xs">
                        Rumah tidak berpenghuni.
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="px-4 py-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
                    <button
                      onClick={() => setSelectedFamily(r)}
                      className="text-emerald-700 hover:text-emerald-800 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat KK</span>
                    </button>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(r)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="Edit data keluarga & KK"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteResident(r.id, r.name)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus data warga"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* TABLE VIEW MODE */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-slate-100/90 text-slate-800 font-bold border-b border-slate-200 select-none">
                  <th className="py-3 px-3 w-16 text-center border-r border-slate-200">NO. RMH</th>
                  <th className="py-3 px-3.5 min-w-[160px] border-r border-slate-200">KEPALA KELUARGA</th>
                  <th className="py-3 px-3 min-w-[130px] border-r border-slate-200">NO. KK</th>
                  <th className="py-3 px-3 min-w-[130px] border-r border-slate-200">NIK / KTP</th>
                  <th className="py-3 px-3.5 min-w-[140px] border-r border-slate-200">ISTRI / PASANGAN</th>
                  <th className="py-3 px-3.5 min-w-[160px] border-r border-slate-200">ANAK & KELUARGA</th>
                  <th className="py-3 px-2 text-center w-20 border-r border-slate-200">JIWA</th>
                  <th className="py-3 px-3 w-28 border-r border-slate-200">STATUS HUNIAN</th>
                  {isAdmin && <th className="py-3 px-3 text-center w-20">AKSI</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {filteredResidents.map((r) => {
                  const occupants = r.totalOccupants || (
                    1 +
                    (r.spouseName ? 1 : 0) +
                    (r.children ? r.children.length : 0) +
                    (r.otherFamilyMembers ? r.otherFamilyMembers.length : 0)
                  );

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        r.isVacant ? 'bg-slate-50/50 text-slate-400' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 border-r border-slate-100 bg-slate-50/30">
                        {r.houseNo}
                      </td>

                      <td className="py-3 px-3.5 border-r border-slate-100">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-900">{r.name}</span>
                          {r.customMonthlyRate !== undefined && r.customMonthlyRate > 0 ? (
                            <span 
                              className="px-1.5 py-0.5 text-[9px] font-mono bg-purple-100 text-purple-800 border border-purple-300 rounded font-bold shadow-2xs"
                              title={r.customRateReason ? `Tarif Khusus: ${r.customRateReason}` : 'Tarif Pembayaran Khusus'}
                            >
                              Khusus Rp{(r.customMonthlyRate / 1000).toLocaleString('id-ID')}k
                            </span>
                          ) : r.discountAmount && r.discountAmount > 0 ? (
                            <span 
                              className="px-1.5 py-0.2 text-[9px] font-mono bg-amber-50 text-amber-800 border border-amber-300 rounded font-bold"
                              title={r.discountReason ? `Diskon: ${r.discountReason}` : 'Mendapat Potongan Diskon Iuran'}
                            >
                              Diskon -Rp{(r.discountAmount / 1000).toLocaleString('id-ID')}k
                            </span>
                          ) : null}
                        </div>
                        {r.phone && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-500 font-mono">
                              {r.phone}
                            </span>
                            <a
                              href={getWhatsAppUrl(r.phone, `Yth. Bapak/Ibu ${r.name}, `)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[9px] font-medium rounded transition-colors"
                              title={`Hubungi WA ${r.name}`}
                            >
                              <MessageCircle className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Hubungi WA</span>
                            </a>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 border-r border-slate-100">
                        {renderMaskedId(r.kkNumber, 'KK')}
                      </td>

                      <td className="py-3 px-3 border-r border-slate-100">
                        {renderMaskedId(r.nik, 'KTP')}
                      </td>

                      <td className="py-3 px-3.5 border-r border-slate-100 text-slate-800">
                        {r.spouseName ? (
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5">
                              <Heart className="w-3 h-3 text-rose-500 shrink-0" />
                              <span>{r.spouseName}</span>
                            </div>
                            {r.spousePhone && (
                              <a
                                href={getWhatsAppUrl(r.spousePhone, `Yth. Ibu/Bpk ${r.spouseName}, `)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[9px] font-medium transition-colors shrink-0"
                                title={`Hubungi WA ${r.spouseName}`}
                              >
                                <MessageCircle className="w-2 h-2 text-emerald-600" />
                                <span>WA</span>
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      <td className="py-3 px-3.5 border-r border-slate-100">
                        {r.children && r.children.length > 0 ? (
                          <div className="space-y-0.5">
                            <div className="text-slate-800 font-medium flex flex-wrap gap-1">
                              {r.children.map((c, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1">
                                  <span>{getMemberName(c)}</span>
                                  {getMemberPhone(c) && (
                                    <a
                                      href={getWhatsAppUrl(getMemberPhone(c), `Yth. ${getMemberName(c)}, `)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-emerald-700 hover:text-emerald-800"
                                      title={`Hubungi WA ${getMemberName(c)}`}
                                    >
                                      <MessageCircle className="w-2.5 h-2.5 inline text-emerald-600" />
                                    </a>
                                  )}
                                  {idx < (r.children?.length || 0) - 1 ? ',' : ''}
                                </span>
                              ))}
                            </div>
                            {r.otherFamilyMembers && r.otherFamilyMembers.length > 0 && (
                              <div className="text-[10px] text-slate-400">
                                Famili: {r.otherFamilyMembers.map(getMemberName).join(', ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-2 text-center font-mono font-bold text-slate-800 border-r border-slate-100">
                        {r.isVacant ? '-' : occupants}
                      </td>

                      <td className="py-3 px-3 border-r border-slate-100">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                          {r.isVacant ? 'Kosong' : r.houseStatus || 'Milik Sendiri'}
                        </span>
                      </td>

                      {isAdmin && (
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEditModal(r)}
                              title="Edit data warga"
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
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FAMILY DETAIL CARD MODAL */}
      {selectedFamily && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-sm">
                  Kartu Data Keluarga RT (Rumah No. {selectedFamily.houseNo})
                </h3>
              </div>
              <button
                onClick={() => setSelectedFamily(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="border-2 border-slate-300 p-4 rounded-xl bg-slate-50/50 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">
                      Nomor Kartu Keluarga
                    </span>
                    <div className="mt-0.5">
                      {renderMaskedId(selectedFamily.kkNumber, 'KK')}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-lg">
                    Rumah No. {selectedFamily.houseNo}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                    <span className="text-slate-500">Kepala Keluarga (KK):</span>
                    <span className="font-bold text-slate-900">{selectedFamily.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200 text-[11px]">
                    <span className="text-slate-500 font-sans text-xs">NIK Kepala Keluarga:</span>
                    {renderMaskedId(selectedFamily.nik, 'KTP')}
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                    <span className="text-slate-500">Istri / Pasangan:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{selectedFamily.spouseName || '-'}</span>
                      {selectedFamily.spousePhone && (
                        <a
                          href={getWhatsAppUrl(selectedFamily.spousePhone, `Yth. Ibu/Bpk ${selectedFamily.spouseName}, `)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-semibold transition-colors shadow-xs"
                          title={`Kirim pesan WhatsApp ke ${selectedFamily.spouseName}`}
                        >
                          <MessageCircle className="w-2.5 h-2.5" />
                          <span>Hubungi WA</span>
                        </a>
                      )}
                    </div>
                  </div>
                  {selectedFamily.spouseNik && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-200 text-[11px]">
                      <span className="text-slate-500 font-sans text-xs">NIK Istri / Pasangan:</span>
                      {renderMaskedId(selectedFamily.spouseNik, 'KTP')}
                    </div>
                  )}
                  {selectedFamily.spousePhone && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-200 text-[11px]">
                      <span className="text-slate-500 font-sans text-xs">No. WA Istri / Pasangan:</span>
                      <span className="font-mono text-slate-800">{selectedFamily.spousePhone}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Status Rumah:</span>
                    <span className="font-medium text-slate-800">{selectedFamily.houseStatus || 'Milik Sendiri'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                    <span className="text-slate-500">Nomor WhatsApp:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-800">{selectedFamily.phone || '-'}</span>
                      {selectedFamily.phone && (
                        <a
                          href={getWhatsAppUrl(selectedFamily.phone, `Yth. Bapak/Ibu ${selectedFamily.name}, `)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-semibold transition-colors shadow-xs"
                          title={`Kirim pesan WhatsApp ke ${selectedFamily.name}`}
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>Hubungi WA</span>
                        </a>
                      )}
                    </div>
                  </div>
                  {selectedFamily.customMonthlyRate !== undefined && selectedFamily.customMonthlyRate > 0 ? (
                    <div className="flex justify-between items-center py-2 border-b border-purple-200 bg-purple-50 px-2.5 rounded-lg">
                      <div>
                        <span className="text-purple-900 font-bold block text-xs">Nominal Pembayaran Khusus:</span>
                        {selectedFamily.customRateReason && (
                          <span className="text-[10px] text-purple-700 italic">{selectedFamily.customRateReason}</span>
                        )}
                      </div>
                      <span className="font-mono font-extrabold text-purple-900 text-sm">{formatRupiah(selectedFamily.customMonthlyRate)} / bln</span>
                    </div>
                  ) : selectedFamily.discountAmount && selectedFamily.discountAmount > 0 ? (
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-200 bg-amber-50/60 px-2 rounded-lg">
                      <div>
                        <span className="text-amber-800 font-bold block">Keringanan Diskon Iuran:</span>
                        {selectedFamily.discountReason && (
                          <span className="text-[10px] text-amber-700 italic">{selectedFamily.discountReason}</span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-amber-900">-Rp{(selectedFamily.discountAmount / 1000).toLocaleString('id-ID')}k / bln</span>
                    </div>
                  ) : null}
                </div>

                {/* Anak-anak */}
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">
                    Daftar Nama Anak:
                  </span>
                  {selectedFamily.children && selectedFamily.children.length > 0 ? (
                    <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                      {selectedFamily.children.map((child, idx) => {
                        const cName = getMemberName(child);
                        const cNik = getMemberNik(child);
                        const cPhone = getMemberPhone(child);
                        return (
                          <div key={idx} className="flex items-center justify-between text-slate-800">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium">• {cName}</span>
                              {cNik && (
                                <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.2 rounded">
                                  KTP: {renderMaskedId(cNik, 'KTP')}
                                </span>
                              )}
                            </div>
                            {cPhone && (
                              <a
                                href={getWhatsAppUrl(cPhone, `Yth. ${cName}, `)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-medium rounded transition-colors"
                                title={`Hubungi WA ${cName}`}
                              >
                                <MessageCircle className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Hubungi WA</span>
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">Tidak ada anak terdaftar</span>
                  )}
                </div>

                {/* Anggota Lain */}
                {selectedFamily.otherFamilyMembers && selectedFamily.otherFamilyMembers.length > 0 && (
                  <div>
                    <span className="font-semibold text-slate-700 block mb-1">
                      Anggota Keluarga Lainnya:
                    </span>
                    <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                      {selectedFamily.otherFamilyMembers.map((m, idx) => {
                        const mName = getMemberName(m);
                        const mRel = getMemberRelation(m);
                        const mNik = getMemberNik(m);
                        const mPhone = getMemberPhone(m);
                        return (
                          <div key={idx} className="flex items-center justify-between text-slate-800">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium">• {mName}</span>
                              {mRel && (
                                <span className="text-[10px] text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded font-medium">
                                  {mRel}
                                </span>
                              )}
                              {mNik && (
                                <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.2 rounded">
                                  KTP: {renderMaskedId(mNik, 'KTP')}
                                </span>
                              )}
                            </div>
                            {mPhone && (
                              <a
                                href={getWhatsAppUrl(mPhone, `Yth. ${mName}, `)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-medium rounded transition-colors"
                                title={`Hubungi WA ${mName}`}
                              >
                                <MessageCircle className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Hubungi WA</span>
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              {isAdmin && (
                <button
                  onClick={() => {
                    const fam = selectedFamily;
                    setSelectedFamily(null);
                    handleOpenEditModal(fam);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Edit Data Keluarga Ini
                </button>
              )}
              <button
                onClick={() => setSelectedFamily(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-medium cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE RESIDENT FORM MODAL */}
      <ResidentFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveResident}
        resident={editingResident}
        profile={profile}
        canEditDues={effectiveCanEditDues}
      />

      {/* Custom Delete Confirmation Modal (In-App Dialog) */}
      {confirmDeleteResident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Hapus Data Warga?
                </h3>
                <p className="text-xs text-slate-500 truncate max-w-[240px]">
                  {confirmDeleteResident.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Seluruh data kependudukan, susunan keluarga, dan riwayat iuran untuk rumah <strong>{confirmDeleteResident.name}</strong> akan dihapus secara permanen.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteResident(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeDeleteResident}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
