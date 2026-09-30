import React, { useState } from 'react';
import {
  UserCheck,
  ShieldCheck,
  Phone,
  MessageCircle,
  FileText,
  HeartHandshake,
  Sparkles,
  Award,
  Clock,
  Edit3,
  PlusCircle,
  CheckCircle2,
  Building,
  Users,
  Briefcase,
  Calendar,
  MapPin,
  Check,
  ChevronRight,
  Send,
  Info,
  Trash2,
  X,
  Plus,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';
import { RTProfile, CommitteeOfficer, ProgramKerjaItem } from '../types';
import { getCleanRtRwTitle } from '../utils/formatters';

interface OfficersViewProps {
  profile: RTProfile;
  isAdmin: boolean;
  onOpenSettings?: () => void;
  onUpdateProfile?: (newProfile: RTProfile) => void;
  onOpenGoogleSync?: () => void;
}

export const OfficersView: React.FC<OfficersViewProps> = ({
  profile,
  isAdmin,
  onOpenSettings,
  onUpdateProfile,
  onOpenGoogleSync,
}) => {
  // Get active officers list or fallback
  const officersList: CommitteeOfficer[] =
    profile.officers !== undefined
      ? profile.officers
      : [
          {
            id: 'core-ketua',
            role: `Ketua RT ${profile.rtNumber || '05'}`,
            name: profile.chairpersonName || 'Ketua RT',
            phone: '',
            startPeriod: '2024 - Sekarang',
            isCurrent: true,
            notes: `Penanggung Jawab Utama Wilayah RT ${profile.rtNumber || '05'} / RW ${profile.rwNumber || '08'}`,
          },
          {
            id: 'core-sekretaris',
            role: `Sekretaris RT ${profile.rtNumber || '05'}`,
            name: profile.secretaryName || 'Sekretaris RT',
            phone: '',
            startPeriod: '2024 - Sekarang',
            isCurrent: true,
            notes: 'Administrasi Kependudukan, Persuratan & Dokumentasi Warga',
          },
          {
            id: 'core-bendahara',
            role: `Bendahara RT ${profile.rtNumber || '05'}`,
            name: profile.treasurerName || 'Bendahara RT',
            phone: '',
            startPeriod: '2024 - Sekarang',
            isCurrent: true,
            notes: 'Pengelolaan Kas RT, Iuran Warga & Laporan Keuangan Digital',
          },
          {
            id: 'seksi-1',
            role: 'Seksi Keamanan & Ketertiban',
            name: 'Bpk. Sugeng Riyadi',
            phone: '081766554433',
            startPeriod: '2024-2026',
            isCurrent: true,
            notes: 'Koordinator Pos Ronda, Satpam Lingkungan & Sistem Keamanan Portal',
          },
          {
            id: 'seksi-2',
            role: 'Seksi Kebersihan & Lingkungan',
            name: 'Bpk. Mulyadi',
            phone: '081855443322',
            startPeriod: '2024-2026',
            isCurrent: true,
            notes: 'Koordinator Pengangkutan Sampah, Drainase & Kerja Bakti Berkala',
          },
          {
            id: 'seksi-3',
            role: 'Seksi Sosial, Humas & Keagamaan',
            name: 'Bpk. Ustadz Ahmad Fauzi',
            phone: '081944332211',
            startPeriod: '2024-2026',
            isCurrent: true,
            notes: 'Santunan Duka/Sakit, Informasi Warga, PHBI & Kegiatan Kemasyarakatan',
          },
        ];

  // Get active program kerja list or fallback
  const DEFAULT_PROGRAM_KERJA: ProgramKerjaItem[] = [
    {
      id: 'prog-1',
      title: 'Keamanan 24 Jam & Pos Ronda',
      desc: 'Pengawasan keamanan lingkungan melalui jadwal pos ronda warga, koordinasi satpam portal malam, serta pendataan warga berkunjung / kontrakan.',
    },
    {
      id: 'prog-2',
      title: 'Lingkungan Bersih & Gotong Royong',
      desc: 'Jadwal rutin pengangkutan sampah rumah tangga, pembersihan saluran air god/got secara gotong royong kerja bakti warga secara berkala.',
    },
    {
      id: 'prog-3',
      title: 'Transparansi Kas Digital RT',
      desc: 'Seluruh penerimaan iuran dan pengeluaran kas RT dicatat secara digital dan terbuka. Warga dapat melihat laporan kuitansi dan saldo real-time kapan saja.',
    },
  ];

  const programKerjaList: ProgramKerjaItem[] =
    profile.programKerjaList !== undefined
      ? profile.programKerjaList
      : DEFAULT_PROGRAM_KERJA;

  // Modal State for Officer
  const [isOfficerModalOpen, setIsOfficerModalOpen] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState<CommitteeOfficer | null>(null);
  const [formRole, setFormRole] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPeriod, setFormPeriod] = useState('2024-2026');

  // Modal State for Program Kerja
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ProgramKerjaItem | null>(null);
  const [formProgTitle, setFormProgTitle] = useState('');
  const [formProgDesc, setFormProgDesc] = useState('');

  // Custom Deletion Confirmation Modal States
  const [confirmDeleteProgram, setConfirmDeleteProgram] = useState<ProgramKerjaItem | null>(null);
  const [confirmDeleteOfficer, setConfirmDeleteOfficer] = useState<CommitteeOfficer | null>(null);

  // WhatsApp Helper
  const handleWhatsApp = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('0')
      ? '62' + cleanPhone.slice(1)
      : cleanPhone;
    window.open(
      `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`,
      '_blank'
    );
  };

  // Open Add / Edit Officer Modal
  const handleOpenOfficerModal = (officer?: CommitteeOfficer) => {
    if (officer) {
      setEditingOfficer(officer);
      setFormRole(officer.role);
      setFormName(officer.name);
      setFormPhone(officer.phone || '');
      setFormNotes(officer.notes || '');
      setFormPeriod(officer.startPeriod || '2024-2026');
    } else {
      setEditingOfficer(null);
      setFormRole('Seksi Kerohanian & PHBI');
      setFormName('');
      setFormPhone('');
      setFormNotes('');
      setFormPeriod('2024-2026');
    }
    setIsOfficerModalOpen(true);
  };

  // Save Officer
  const handleSaveOfficer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRole.trim() || !formName.trim()) return;

    let updatedOfficers: CommitteeOfficer[];

    if (editingOfficer) {
      updatedOfficers = officersList.map((off) =>
        off.id === editingOfficer.id
          ? {
              ...off,
              role: formRole.trim(),
              name: formName.trim(),
              phone: formPhone.trim(),
              notes: formNotes.trim(),
              startPeriod: formPeriod.trim(),
              isCurrent: true,
            }
          : off
      );
    } else {
      const newOfficer: CommitteeOfficer = {
        id: `off-${Date.now()}`,
        role: formRole.trim(),
        name: formName.trim(),
        phone: formPhone.trim(),
        notes: formNotes.trim(),
        startPeriod: formPeriod.trim(),
        isCurrent: true,
      };
      updatedOfficers = [...officersList, newOfficer];
    }

    // Also update chairpersonName / secretaryName / treasurerName if core role edited
    let updatedChairperson = profile.chairpersonName;
    let updatedSecretary = profile.secretaryName;
    let updatedTreasurer = profile.treasurerName;

    const lowerRole = formRole.toLowerCase();
    if (lowerRole.includes('ketua')) {
      updatedChairperson = formName.trim();
    } else if (lowerRole.includes('sekretaris')) {
      updatedSecretary = formName.trim();
    } else if (lowerRole.includes('bendahara')) {
      updatedTreasurer = formName.trim();
    }

    const newProfile: RTProfile = {
      ...profile,
      chairpersonName: updatedChairperson,
      secretaryName: updatedSecretary,
      treasurerName: updatedTreasurer,
      officers: updatedOfficers,
    };

    if (onUpdateProfile) {
      onUpdateProfile(newProfile);
    }
    localStorage.setItem('rt_profile_v2', JSON.stringify(newProfile));
    setIsOfficerModalOpen(false);
  };

  // Trigger custom delete dialog for officer
  const handleTriggerDeleteOfficer = (officer: CommitteeOfficer) => {
    setConfirmDeleteOfficer(officer);
  };

  const executeDeleteOfficer = () => {
    if (!confirmDeleteOfficer) return;
    const updatedOfficers = officersList.filter((off) => off.id !== confirmDeleteOfficer.id);
    const newProfile: RTProfile = {
      ...profile,
      officers: updatedOfficers,
    };

    if (onUpdateProfile) {
      onUpdateProfile(newProfile);
    }
    localStorage.setItem('rt_profile_v2', JSON.stringify(newProfile));
    setConfirmDeleteOfficer(null);
  };

  // Open Add / Edit Program Kerja Modal
  const handleOpenProgramModal = (prog?: ProgramKerjaItem) => {
    if (prog) {
      setEditingProgram(prog);
      setFormProgTitle(prog.title);
      setFormProgDesc(prog.desc);
    } else {
      setEditingProgram(null);
      setFormProgTitle('');
      setFormProgDesc('');
    }
    setIsProgramModalOpen(true);
  };

  // Save Program Kerja
  const handleSaveProgram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProgTitle.trim() || !formProgDesc.trim()) return;

    let updatedPrograms: ProgramKerjaItem[];

    if (editingProgram) {
      updatedPrograms = programKerjaList.map((p) =>
        p.id === editingProgram.id
          ? { ...p, title: formProgTitle.trim(), desc: formProgDesc.trim() }
          : p
      );
    } else {
      const newProg: ProgramKerjaItem = {
        id: `prog-${Date.now()}`,
        title: formProgTitle.trim(),
        desc: formProgDesc.trim(),
      };
      updatedPrograms = [...programKerjaList, newProg];
    }

    const newProfile: RTProfile = {
      ...profile,
      programKerjaList: updatedPrograms,
    };

    if (onUpdateProfile) {
      onUpdateProfile(newProfile);
    }
    localStorage.setItem('rt_profile_v2', JSON.stringify(newProfile));
    setIsProgramModalOpen(false);
  };

  // Trigger custom delete dialog for program kerja
  const handleTriggerDeleteProgram = (prog: ProgramKerjaItem) => {
    setConfirmDeleteProgram(prog);
  };

  const executeDeleteProgram = () => {
    if (!confirmDeleteProgram) return;
    const updatedPrograms = programKerjaList.filter((p) => p.id !== confirmDeleteProgram.id);
    const newProfile: RTProfile = {
      ...profile,
      programKerjaList: updatedPrograms,
    };

    if (onUpdateProfile) {
      onUpdateProfile(newProfile);
    }
    localStorage.setItem('rt_profile_v2', JSON.stringify(newProfile));
    setConfirmDeleteProgram(null);
  };

  // Categorize core officers & section heads
  const ketua = officersList.find((o) => o.role.toLowerCase().includes('ketua')) || {
    id: 'core-ketua',
    role: `Ketua RT ${profile.rtNumber || '05'}`,
    name: profile.chairpersonName || 'Ketua RT',
    phone: '',
    startPeriod: '2024 - Sekarang',
    isCurrent: true,
    notes: `Penanggung Jawab Utama Wilayah RT ${profile.rtNumber || '05'} / RW ${profile.rwNumber || '08'}`,
  };

  const sekretaris = officersList.find((o) => o.role.toLowerCase().includes('sekretaris')) || {
    id: 'core-sekretaris',
    role: `Sekretaris RT ${profile.rtNumber || '05'}`,
    name: profile.secretaryName || 'Sekretaris RT',
    phone: '',
    startPeriod: '2024 - Sekarang',
    isCurrent: true,
    notes: 'Administrasi Kependudukan, Persuratan & Dokumentasi Warga',
  };

  const bendahara = officersList.find((o) => o.role.toLowerCase().includes('bendahara')) || {
    id: 'core-bendahara',
    role: `Bendahara RT ${profile.rtNumber || '05'}`,
    name: profile.treasurerName || 'Bendahara RT',
    phone: '',
    startPeriod: '2024 - Sekarang',
    isCurrent: true,
    notes: 'Pengelolaan Kas RT, Iuran Warga & Laporan Keuangan Digital',
  };

  const otherOfficers = officersList.filter(
    (o) =>
      !o.role.toLowerCase().includes('ketua') &&
      !o.role.toLowerCase().includes('sekretaris') &&
      !o.role.toLowerCase().includes('bendahara')
  );

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-teal-400/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-emerald-300 text-xs font-semibold backdrop-blur-md">
              <Building className="w-3.5 h-3.5" />
              <span>Struktur Organisasi Kemasyarakatan</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Pengurus {getCleanRtRwTitle(profile)}
            </h2>

            <p className="text-emerald-100/90 text-sm sm:text-base leading-relaxed">
              Selamat datang di portal informasi resmi Pengurus {getCleanRtRwTitle(profile)} Desa {profile.subdistrict}. Kami berkomitmen melayani warga dengan ikhlas, transparan, dan responsif.
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-emerald-200/90 pt-1">
              <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg backdrop-blur-xs">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>Masa Bakti: 2026 - 2031</span>
              </span>
              <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg backdrop-blur-xs">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>Desa {profile.subdistrict}, {profile.city}</span>
              </span>
            </div>
          </div>

          {isAdmin && (
            <div className="shrink-0 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => handleOpenOfficerModal()}
                className="inline-flex items-center gap-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer text-xs sm:text-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Tambah Komponen Pengurus</span>
              </button>

              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="inline-flex items-center gap-2 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 font-semibold px-3.5 py-2.5 rounded-xl transition-all cursor-pointer text-xs sm:text-sm"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Pengaturan Identitas</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Core Officers Section */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-800">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Pengurus Inti RT 05</h3>
              <p className="text-xs text-slate-500">Pimpinan utama administrasi & pelayanan warga</p>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={() => handleOpenOfficerModal()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Komponen</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Ketua RT Card */}
          <div className="bg-white border-2 border-emerald-200 hover:border-emerald-500 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-6 -mt-6 transition-all group-hover:scale-110 pointer-events-none"></div>

            <div className="relative z-10 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <span className="px-3 py-1 bg-emerald-800 text-white font-extrabold text-xs rounded-lg shadow-2xs">
                  {ketua.role}
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Aktif</span>
                  </span>

                  {isAdmin && (
                    <button
                      onClick={() => handleOpenOfficerModal(ketua)}
                      className="p-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg text-xs cursor-pointer transition-colors"
                      title="Edit Ketua RT"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                  {ketua.name}
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {ketua.notes || 'Penanggung Jawab Utama Wilayah RT 05 / RW 08'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-400">Kontak WA:</span>
                  <span className="font-mono font-bold text-slate-800">{ketua.phone || '081288990011'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-400">Masa Bakti:</span>
                  <span className="font-medium text-slate-700 text-right">{ketua.startPeriod || '2024 - 2026'}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-3 relative z-10">
              <button
                onClick={() =>
                  handleWhatsApp(
                    ketua.phone || '081288990011',
                    `Halo ${ketua.name} (Ketua RT 05), saya warga RT 05 ingin bertanya/berkonsultasi mengenai:`
                  )
                }
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer shadow-2xs"
              >
                <MessageCircle className="w-4 h-4 fill-white/20" />
                <span>Hubungi Ketua RT via WA</span>
              </button>
            </div>
          </div>

          {/* Sekretaris RT Card */}
          <div className="bg-white border border-slate-200 hover:border-emerald-400 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-6 -mt-6 transition-all group-hover:scale-110 pointer-events-none"></div>

            <div className="relative z-10 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <span className="px-3 py-1 bg-blue-800 text-white font-extrabold text-xs rounded-lg shadow-2xs">
                  {sekretaris.role}
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    <CheckCircle2 className="w-3 h-3 text-blue-600" />
                    <span>Aktif</span>
                  </span>

                  {isAdmin && (
                    <button
                      onClick={() => handleOpenOfficerModal(sekretaris)}
                      className="p-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg text-xs cursor-pointer transition-colors"
                      title="Edit Sekretaris RT"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-900 group-hover:text-blue-800 transition-colors">
                  {sekretaris.name}
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {sekretaris.notes || 'Administrasi Warga, Persuratan & Dokumentasi'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-400">Kontak WA:</span>
                  <span className="font-mono font-bold text-slate-800">{sekretaris.phone || '081577665544'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-400">Masa Bakti:</span>
                  <span className="font-medium text-slate-700 text-right">{sekretaris.startPeriod || '2024 - 2026'}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-3 relative z-10">
              <button
                onClick={() =>
                  handleWhatsApp(
                    sekretaris.phone || '081577665544',
                    `Halo ${sekretaris.name} (Sekretaris RT 05), saya warga RT 05 ingin mengurus surat pengantar/administrasi warga:`
                  )
                }
                className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer shadow-2xs"
              >
                <MessageCircle className="w-4 h-4 fill-white/20" />
                <span>Pengurusan Surat Pengantar</span>
              </button>
            </div>
          </div>

          {/* Bendahara RT Card */}
          <div className="bg-white border border-slate-200 hover:border-emerald-400 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-6 -mt-6 transition-all group-hover:scale-110 pointer-events-none"></div>

            <div className="relative z-10 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <span className="px-3 py-1 bg-amber-700 text-white font-extrabold text-xs rounded-lg shadow-2xs">
                  {bendahara.role}
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    <CheckCircle2 className="w-3 h-3 text-amber-600" />
                    <span>Aktif</span>
                  </span>

                  {isAdmin && (
                    <button
                      onClick={() => handleOpenOfficerModal(bendahara)}
                      className="p-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg text-xs cursor-pointer transition-colors"
                      title="Edit Bendahara RT"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                  {bendahara.name}
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {bendahara.notes || 'Pengelolaan Iuran Warga & Laporan Keuangan Digital'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-400">Kontak WA:</span>
                  <span className="font-mono font-bold text-slate-800">{bendahara.phone || '081399887766'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-400">Masa Bakti:</span>
                  <span className="font-medium text-slate-700 text-right">{bendahara.startPeriod || '2024 - 2026'}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-3 relative z-10">
              <button
                onClick={() =>
                  handleWhatsApp(
                    bendahara.phone || '081399887766',
                    `Halo ${bendahara.name} (Bendahara RT 05), saya warga RT 05 mau konfirmasi pembayaran iuran / info keuangan:`
                  )
                }
                className="w-full inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer shadow-2xs"
              >
                <MessageCircle className="w-4 h-4 fill-white/20" />
                <span>Konfirmasi Iuran / Kas</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section Coordinators (Seksi-Seksi Lapangan) */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 rounded-xl text-slate-800">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Seksi-Seksi & Komnemonic Koordinator Lapangan</h3>
              <p className="text-xs text-slate-500">Petugas pelaksana bidang keamanan, kebersihan, sosial & keagamaan</p>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={() => handleOpenOfficerModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
            >
              <PlusCircle className="w-4 h-4 text-emerald-300" />
              <span>+ Tambah Komponen Seksi</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {otherOfficers.map((seksi) => (
            <div
              key={seksi.id || seksi.role}
              className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-emerald-300 hover:shadow-sm transition-all flex flex-col justify-between group relative"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 font-bold text-xs rounded-md border border-slate-200">
                    {seksi.role}
                  </span>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenOfficerModal(seksi)}
                        className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit Komponen"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleTriggerDeleteOfficer(seksi)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Komponen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <h5 className="font-bold text-slate-900 text-base group-hover:text-emerald-800 transition-colors">
                    {seksi.name}
                  </h5>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {seksi.notes || 'Koordinator Pelaksana Lapangan RT 05'}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-semibold text-slate-700">
                  {seksi.phone || '-'}
                </span>

                {seksi.phone && (
                  <button
                    onClick={() =>
                      handleWhatsApp(
                        seksi.phone || '',
                        `Halo ${seksi.name} (${seksi.role} RT 05), saya warga RT 05 hendak melapor / bertanya mengenai:`
                      )
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs rounded-lg transition-colors cursor-pointer border border-emerald-200"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Lapor / Hubungi</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Program Kerja & Komitmen Pengurus RT 05 */}
      <div className="bg-gradient-to-r from-emerald-50 via-slate-50 to-teal-50 border border-emerald-200/80 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-xs">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Visi & Program Kerja Pengurus RT 05</h3>
              <p className="text-xs text-slate-600">
                Mewujudkan lingkungan RT 05 Satriajaya yang aman, bersih, tertib dan transparan
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              {onOpenGoogleSync && (
                <button
                  type="button"
                  onClick={onOpenGoogleSync}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-2xs border border-slate-300 hover:border-slate-400"
                  title="Sinkronkan Visi, Program Kerja & Susunan Pengurus ke Google Sheets"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Sinkron ke Google Sheets</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleOpenProgramModal()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Program Kerja</span>
              </button>
            </div>
          )}
        </div>

        {programKerjaList.length === 0 ? (
          <div className="bg-white/80 p-6 rounded-2xl border border-dashed border-emerald-300 text-center space-y-2">
            <p className="text-slate-600 font-semibold text-xs">
              Belum ada program kerja Visi & Misi yang ditambahkan.
            </p>
            {isAdmin && (
              <button
                onClick={() => handleOpenProgramModal()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tambah Program Kerja</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {programKerjaList.map((prog) => (
              <div
                key={prog.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2 flex flex-col justify-between relative group hover:border-emerald-300 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{prog.title}</span>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenProgramModal(prog)}
                          className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Program Kerja"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleTriggerDeleteProgram(prog)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Program Kerja"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-slate-600 leading-relaxed">{prog.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Form Edit / Tambah Officer */}
      {isOfficerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  {editingOfficer ? 'Edit Komponen Pengurus' : 'Tambah Komponen Pengurus / Seksi'}
                </h3>
              </div>
              <button
                onClick={() => setIsOfficerModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOfficer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jabatan / Komponen Pengurus <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  placeholder="Contoh: Seksi Keamanan, Seksi Kebersihan, Ketua RT, dll."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap Pengurus / Koordinator <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Bpk. H. Bambang Sudiro"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    No. WhatsApp / Telepon
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="081234567890"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Masa Bakti / Periode
                  </label>
                  <input
                    type="text"
                    value={formPeriod}
                    onChange={(e) => setFormPeriod(e.target.value)}
                    placeholder="2024 - 2026"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tugas Utama / Catatan Deskripsi
                </label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Deskripsi tugas atau ruang lingkup tanggung jawab..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOfficerModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  Simpan Komponen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Form Edit / Tambah Program Kerja */}
      {isProgramModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  {editingProgram ? 'Edit Program Kerja' : 'Tambah Program Kerja Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsProgramModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProgram} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Program Kerja <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formProgTitle}
                  onChange={(e) => setFormProgTitle(e.target.value)}
                  placeholder="Contoh: Keamanan Portal Malam & Pos Ronda"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi Kegiatan & Penjelasan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={formProgDesc}
                  onChange={(e) => setFormProgDesc(e.target.value)}
                  placeholder="Jelaskan secara singkat mengenai program kerja dan tujuannya untuk warga..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProgramModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  Simpan Program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Program Kerja Deletion */}
      {confirmDeleteProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 relative">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-900 text-base">Hapus Program Kerja?</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Apakah Anda yakin ingin menghapus program kerja <strong className="text-slate-800">"{confirmDeleteProgram.title}"</strong>? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteProgram(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeDeleteProgram}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Hapus Program Kerja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Officer/Seksi Deletion */}
      {confirmDeleteOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 relative">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-900 text-base">Hapus Komponen Pengurus?</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Apakah Anda yakin ingin menghapus jabatan/seksi <strong className="text-slate-800">"{confirmDeleteOfficer.role}"</strong> yang dipegang oleh <strong className="text-slate-800">{confirmDeleteOfficer.name}</strong>? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteOfficer(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeDeleteOfficer}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Hapus Komponen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
