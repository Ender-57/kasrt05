import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Shield,
  Save,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  FileSpreadsheet,
  Building,
  Users,
  Plus,
  Trash2,
  Calendar,
  UserCheck,
  Edit2,
  Phone,
  Info,
  X,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { RTProfile, Resident, CashTransaction, CommitteeOfficer } from '../types';
import { INITIAL_RESIDENTS, INITIAL_TRANSACTIONS, INITIAL_RT_PROFILE } from '../data/initialData';
import { formatDateIndo, getTodayJakarta, getCleanRtRwTitle } from '../utils/formatters';
import { resolveAdminPin } from '../utils/crypto';

interface SettingsViewProps {
  profile: RTProfile;
  onUpdateProfile: (newProfile: RTProfile) => void;
  residents: Resident[];
  transactions: CashTransaction[];
  onResetData: () => void;
  onRestoreData: (residents: Resident[], transactions: CashTransaction[], profile: RTProfile) => void;
  onOpenGoogleSync: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  onUpdateProfile,
  residents,
  transactions,
  onResetData,
  onRestoreData,
  onOpenGoogleSync,
}) => {
  const [form, setForm] = useState<RTProfile>({ 
    ...profile,
    officers: profile.officers !== undefined ? profile.officers : INITIAL_RT_PROFILE.officers,
  });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [pinInput, setPinInput] = useState(() => resolveAdminPin(profile.adminPin));
  const [showPin, setShowPin] = useState(false);

  // Backup Restore Modal & Notification States (No window.alert/confirm)
  const [restoreModalData, setRestoreModalData] = useState<{
    profile: RTProfile;
    residents: Resident[];
    transactions: CashTransaction[];
    fileName: string;
  } | null>(null);
  const [restoreNotification, setRestoreNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Synchronize form when parent profile changes
  useEffect(() => {
    setForm({
      ...profile,
      officers: profile.officers !== undefined ? profile.officers : INITIAL_RT_PROFILE.officers,
    });
    setPinInput(resolveAdminPin(profile.adminPin));
  }, [profile]);

  // New Officer form state
  const [newOfficerRole, setNewOfficerRole] = useState<string>('Ketua RT');
  const [customRoleInput, setCustomRoleInput] = useState<string>('');
  const [newOfficerName, setNewOfficerName] = useState<string>('');
  const [newOfficerPhone, setNewOfficerPhone] = useState<string>('');
  const [newOfficerStart, setNewOfficerStart] = useState<string>('2024-01-01');
  const [newOfficerEnd, setNewOfficerEnd] = useState<string>('');
  const [newOfficerNotes, setNewOfficerNotes] = useState<string>('');

  // Edit Officer Modal state
  const [isEditOfficerModalOpen, setIsEditOfficerModalOpen] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState<CommitteeOfficer | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editCustomRole, setEditCustomRole] = useState('');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Delete Officer Modal state
  const [deletingOfficer, setDeletingOfficer] = useState<CommitteeOfficer | null>(null);

  const handleConfirmDeleteOfficer = () => {
    if (!deletingOfficer) return;
    const targetId = deletingOfficer.id;
    const updatedOfficers = currentOfficers.filter((off) => off.id !== targetId);
    const updatedForm = {
      ...form,
      officers: updatedOfficers,
    };
    setForm(updatedForm);
    onUpdateProfile(updatedForm);
    setDeletingOfficer(null);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const currentOfficers = form.officers || [];

  const handleAddOfficer = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRole = newOfficerRole === 'Lainnya' ? (customRoleInput.trim() || 'Seksi Lainnya') : newOfficerRole;
    if (!newOfficerName.trim()) return;

    const newOfficer: CommitteeOfficer = {
      id: `off-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      role: finalRole,
      name: newOfficerName.trim(),
      phone: newOfficerPhone.trim() || undefined,
      startPeriod: newOfficerStart,
      endPeriod: newOfficerEnd.trim() || undefined,
      isCurrent: !newOfficerEnd.trim(),
      notes: newOfficerNotes.trim() || undefined,
    };

    const updatedOfficers = [...currentOfficers, newOfficer];
    
    // Sinkronkan nama ke field utama jika role adalah Ketua RT / Bendahara / Sekretaris dan berstatus aktif
    let updatedChairperson = form.chairpersonName;
    let updatedTreasurer = form.treasurerName;
    let updatedSecretary = form.secretaryName;

    if (!newOfficerEnd.trim()) {
      if (finalRole.toLowerCase().includes('ketua')) updatedChairperson = newOfficerName.trim();
      if (finalRole.toLowerCase().includes('bendahara')) updatedTreasurer = newOfficerName.trim();
      if (finalRole.toLowerCase().includes('sekretaris')) updatedSecretary = newOfficerName.trim();
    }

    const updatedForm = {
      ...form,
      chairpersonName: updatedChairperson,
      treasurerName: updatedTreasurer,
      secretaryName: updatedSecretary,
      officers: updatedOfficers,
    };

    setForm(updatedForm);
    onUpdateProfile(updatedForm);
    
    // Reset form input
    setNewOfficerName('');
    setNewOfficerPhone('');
    setNewOfficerEnd('');
    setNewOfficerNotes('');
    setCustomRoleInput('');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleOpenEditOfficer = (officer: CommitteeOfficer) => {
    setEditingOfficer(officer);
    const standardRoles = [
      'Ketua RT',
      'Sekretaris',
      'Bendahara',
      'Seksi Keamanan & Ketertiban',
      'Seksi Kebersihan & Lingkungan',
      'Seksi Sosial, Humas & Keagamaan',
      'Seksi Pembangunan & Sarana',
      'Seksi Pemuda & Olahraga',
    ];
    if (standardRoles.includes(officer.role)) {
      setEditRole(officer.role);
      setEditCustomRole('');
    } else {
      setEditRole('Lainnya');
      setEditCustomRole(officer.role);
    }
    setEditName(officer.name);
    setEditPhone(officer.phone || '');
    setEditStart(officer.startPeriod);
    setEditEnd(officer.endPeriod || '');
    setEditNotes(officer.notes || '');
    setIsEditOfficerModalOpen(true);
  };

  const handleSaveEditOfficer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOfficer || !editName.trim()) return;

    const finalRole = editRole === 'Lainnya' ? (editCustomRole.trim() || 'Seksi Lainnya') : editRole;

    const updatedOfficers = currentOfficers.map((off) => {
      if (off.id !== editingOfficer.id) return off;
      return {
        ...off,
        role: finalRole,
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
        startPeriod: editStart,
        endPeriod: editEnd.trim() || undefined,
        isCurrent: !editEnd.trim(),
        notes: editNotes.trim() || undefined,
      };
    });

    // Update profil utama jika masih aktif
    let updatedChairperson = form.chairpersonName;
    let updatedTreasurer = form.treasurerName;
    let updatedSecretary = form.secretaryName;

    if (!editEnd.trim()) {
      if (finalRole.toLowerCase().includes('ketua')) updatedChairperson = editName.trim();
      if (finalRole.toLowerCase().includes('bendahara')) updatedTreasurer = editName.trim();
      if (finalRole.toLowerCase().includes('sekretaris')) updatedSecretary = editName.trim();
    }

    const updatedForm = {
      ...form,
      chairpersonName: updatedChairperson,
      treasurerName: updatedTreasurer,
      secretaryName: updatedSecretary,
      officers: updatedOfficers,
    };

    setForm(updatedForm);
    onUpdateProfile(updatedForm);
    setIsEditOfficerModalOpen(false);
    setEditingOfficer(null);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleDeleteOfficer = (e: React.MouseEvent, officer: CommitteeOfficer) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingOfficer(officer);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmed = pinInput.trim();
    const finalPin = trimmed !== '' ? resolveAdminPin(trimmed) : (resolveAdminPin(profile.adminPin) || '123456');

    const updatedProfile = {
      ...form,
      adminPin: finalPin,
    };

    onUpdateProfile(updatedProfile);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExportBackup = () => {
    const backupData = {
      profile,
      residents,
      transactions,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-kas-rt-${getTodayJakarta()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);

        // Smart flexible extraction
        let parsedProfile: RTProfile = { ...profile };
        if (json.profile && typeof json.profile === 'object') {
          parsedProfile = { ...profile, ...json.profile };
        } else if (json.chairpersonName || json.rtNumber) {
          parsedProfile = { ...profile, ...json };
        }

        let parsedResidents: Resident[] = residents;
        if (Array.isArray(json.residents)) {
          parsedResidents = json.residents;
        } else if (Array.isArray(json)) {
          parsedResidents = json;
        }

        let parsedTransactions: CashTransaction[] = transactions;
        if (Array.isArray(json.transactions)) {
          parsedTransactions = json.transactions;
        }

        // Validate that we have recognizable data
        if (
          (json.profile && typeof json.profile === 'object') ||
          Array.isArray(json.residents) ||
          Array.isArray(json.transactions) ||
          json.chairpersonName
        ) {
          setRestoreModalData({
            profile: parsedProfile,
            residents: parsedResidents,
            transactions: parsedTransactions,
            fileName: file.name,
          });
        } else {
          setRestoreNotification({
            type: 'error',
            message: 'Format file tidak dikenali. Pastikan file JSON cadangan Kas RT yang benar.',
          });
        }
      } catch (err) {
        setRestoreNotification({
          type: 'error',
          message: 'Gagal membaca file JSON. Pastikan file tidak rusak atau korup.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = () => {
    if (!restoreModalData) return;
    onRestoreData(
      restoreModalData.residents,
      restoreModalData.transactions,
      restoreModalData.profile
    );
    setRestoreNotification({
      type: 'success',
      message: `Data dari file "${restoreModalData.fileName}" berhasil dipulihkan dan disinkronkan ke Firebase Firestore!`,
    });
    setRestoreModalData(null);
  };

  const handleConfirmReset = () => {
    onResetData();
    setIsResetConfirmOpen(false);
    setRestoreNotification({
      type: 'success',
      message: 'Data kas RT berhasil dikembalikan ke data awal!',
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Identitas Form */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm">Identitas Wilayah RT</h3>
              <p className="text-xs text-slate-400">
                Nama RT, nomor RW, desa, kecamatan, kabupaten, dan PIN akses mode pengurus
              </p>
            </div>
          </div>
          {savedSuccess && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-950 px-2.5 py-1 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Tersimpan
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Nama Lingkungan RT / Rukun Tetangga
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nomor RT / RW
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={form.rtNumber}
                  onChange={(e) => setForm({ ...form, rtNumber: e.target.value })}
                  placeholder="RT"
                  className="w-1/2 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-center font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-slate-400">/</span>
                <input
                  type="text"
                  required
                  value={form.rwNumber}
                  onChange={(e) => setForm({ ...form, rwNumber: e.target.value })}
                  placeholder="RW"
                  className="w-1/2 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-center font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Desa
              </label>
              <input
                type="text"
                value={form.subdistrict}
                onChange={(e) => setForm({ ...form, subdistrict: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kecamatan</label>
              <input
                type="text"
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Kota / Kabupaten
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">
                  PIN Akses Pengurus (Mode Admin)
                </label>
                <span className="text-[10px] text-slate-400 font-normal">
                  Default: 123456
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  type={showPin ? 'text' : 'password'}
                  maxLength={10}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Ketik 6 digit PIN..."
                  className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-center tracking-widest focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPin(!showPin);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer focus:outline-hidden"
                  title={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                  aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                >
                  {showPin ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Rekening Kas RT untuk Transfer Warga (Bank, No. Rek, & Nama Pemilik)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={form.bankName || ''}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  placeholder="Bank Mandiri / BCA / BRI"
                  className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="text"
                  value={form.bankAccountNo || ''}
                  onChange={(e) => setForm({ ...form, bankAccountNo: e.target.value })}
                  placeholder="Nomor Rekening"
                  className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="text"
                  value={form.bankAccountHolder || ''}
                  onChange={(e) => setForm({ ...form, bankAccountHolder: e.target.value })}
                  placeholder="Nama Pemilik Rekening (a.n)"
                  className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Pengaturan Wilayah RT</span>
            </button>
          </div>
        </form>
      </div>

      {/* Susunan Pengurus & Periode Menjabat Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-emerald-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-emerald-300" />
            <div>
              <h3 className="font-bold text-sm">Susunan Pengurus RT & Periode Menjabat</h3>
              <p className="text-xs text-emerald-200/80">
                Kelola Ketua RT, Sekretaris, Bendahara, dan Seksi lainnya (Free Text) beserta periode aktif tanda tangan kuitansi
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-800 text-emerald-100 rounded-lg w-fit">
            {currentOfficers.length} Pejabat Terdaftar
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* Info Banner */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900">
            <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <strong>Kesesuaian Tanda Tangan Kuitansi Otomatis:</strong> Saat kuitansi dicetak atau diunduh, sistem secara otomatis mencocokkan tanggal pembayaran/input kuitansi dengan pejabat Bendahara yang menjabat pada tanggal tersebut.
            </div>
          </div>

          {/* Form Tambah / Input Pengurus Baru */}
          <form onSubmit={handleAddOfficer} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-3">
            <div className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>Tambah Pejabat Pengurus / Seksi RT Baru</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Jabatan / Posisi Pengurus
                </label>
                <select
                  value={newOfficerRole}
                  onChange={(e) => setNewOfficerRole(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500 font-medium cursor-pointer"
                >
                  <option value="Ketua RT">Ketua RT</option>
                  <option value="Sekretaris">Sekretaris RT</option>
                  <option value="Bendahara">Bendahara RT (Penandatangan Kuitansi)</option>
                  <option value="Seksi Keamanan & Ketertiban">Seksi Keamanan & Ketertiban</option>
                  <option value="Seksi Kebersihan & Lingkungan">Seksi Kebersihan & Lingkungan</option>
                  <option value="Seksi Sosial, Humas & Keagamaan">Seksi Sosial, Humas & Keagamaan</option>
                  <option value="Seksi Pembangunan & Sarana">Seksi Pembangunan & Sarana</option>
                  <option value="Seksi Pemuda & Olahraga">Seksi Pemuda & Olahraga</option>
                  <option value="Lainnya">Lainnya (Ketik Bebas / Free Text)...</option>
                </select>
                {newOfficerRole === 'Lainnya' && (
                  <input
                    type="text"
                    required
                    value={customRoleInput}
                    onChange={(e) => setCustomRoleInput(e.target.value)}
                    placeholder="Ketik nama seksi / jabatan..."
                    className="w-full mt-2 px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lengkap Pejabat Pengurus
                </label>
                <input
                  type="text"
                  required
                  value={newOfficerName}
                  onChange={(e) => setNewOfficerName(e.target.value)}
                  placeholder="Contoh: Bpk. Hendra Cahyono"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nomor HP / WhatsApp (Opsional)
                </label>
                <input
                  type="text"
                  value={newOfficerPhone}
                  onChange={(e) => setNewOfficerPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mulai Menjabat (Tgl / Periode)</span>
                </label>
                <input
                  type="date"
                  required
                  value={newOfficerStart}
                  onChange={(e) => setNewOfficerStart(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Akhir Menjabat (Kosongkan jika aktif)</span>
                </label>
                <input
                  type="date"
                  value={newOfficerEnd}
                  onChange={(e) => setNewOfficerEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan / Keterangan Jabatan
                </label>
                <input
                  type="text"
                  value={newOfficerNotes}
                  onChange={(e) => setNewOfficerNotes(e.target.value)}
                  placeholder="Contoh: SK No. 01/RT05/2024"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan Pejabat Pengurus</span>
              </button>
            </div>
          </form>

          {/* Tabel Daftar Pengurus RT & Masa Jabatan */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto touch-pan-x shadow-2xs">
            <table className="w-full text-left text-xs border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 select-none">
                  <th className="py-2.5 px-3">Jabatan & Seksi</th>
                  <th className="py-2.5 px-3">Nama Pejabat</th>
                  <th className="py-2.5 px-3">Periode Menjabat</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Kontak / Catatan</th>
                  <th className="py-2.5 px-3 text-center w-16">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentOfficers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Belum ada data susunan pengurus. Tambahkan pengurus di formulir di atas.
                    </td>
                  </tr>
                ) : (
                  currentOfficers.map((off) => {
                    const isRoleTreasurer = off.role.toLowerCase().includes('bendahara');
                    const isRoleChair = off.role.toLowerCase().includes('ketua');
                    const isRoleSecretary = off.role.toLowerCase().includes('sekretaris');
                    const isActive = !off.endPeriod || off.endPeriod >= getTodayJakarta();

                    return (
                      <tr key={off.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            {isRoleChair && <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded font-bold">PIMPINAN</span>}
                            {isRoleTreasurer && <span className="px-1.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 rounded font-bold">KUITANSI</span>}
                            {isRoleSecretary && <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-800 rounded font-bold">SURAT</span>}
                            <span>{off.role}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800">
                          {off.name}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600">
                          <div>
                            {formatDateIndo(off.startPeriod)} s/d {off.endPeriod ? formatDateIndo(off.endPeriod) : 'Sekarang'}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Aktif Menjabat
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-full">
                              Masa Jabatan Selesai
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {off.phone && <div className="font-mono text-[11px] text-slate-700">📞 {off.phone}</div>}
                          {off.notes && <div className="text-[11px] italic text-slate-500">{off.notes}</div>}
                          {!off.phone && !off.notes && <span className="text-slate-300">-</span>}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditOfficer(off)}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title={`Edit pengurus ${off.name}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteOfficer(e, off)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title={`Hapus pengurus ${off.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 bg-rose-900 text-white">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-300" />
                <h3 className="font-semibold text-sm">Konfirmasi Hapus Pengurus</h3>
              </div>
              <button
                onClick={() => setDeletingOfficer(null)}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <p>
                Apakah Anda yakin ingin menghapus pejabat pengurus berikut dari riwayat kepengurusan RT?
              </p>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                <div className="font-bold text-slate-900 text-sm">{deletingOfficer.name}</div>
                <div className="text-rose-700 font-semibold">{deletingOfficer.role}</div>
                <div className="text-slate-500 font-mono text-[11px]">
                  Periode: {formatDateIndo(deletingOfficer.startPeriod)} s/d {deletingOfficer.endPeriod ? formatDateIndo(deletingOfficer.endPeriod) : 'Sekarang'}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingOfficer(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteOfficer}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Ya, Hapus Pengurus</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Officer Modal */}
      {isEditOfficerModalOpen && editingOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-sm">Edit Data Pejabat Pengurus RT</h3>
              </div>
              <button
                onClick={() => {
                  setIsEditOfficerModalOpen(false);
                  setEditingOfficer(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditOfficer} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Jabatan / Posisi Pengurus
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500 font-medium cursor-pointer"
                >
                  <option value="Ketua RT">Ketua RT</option>
                  <option value="Sekretaris">Sekretaris RT</option>
                  <option value="Bendahara">Bendahara RT (Penandatangan Kuitansi)</option>
                  <option value="Seksi Keamanan & Ketertiban">Seksi Keamanan & Ketertiban</option>
                  <option value="Seksi Kebersihan & Lingkungan">Seksi Kebersihan & Lingkungan</option>
                  <option value="Seksi Sosial, Humas & Keagamaan">Seksi Sosial, Humas & Keagamaan</option>
                  <option value="Seksi Pembangunan & Sarana">Seksi Pembangunan & Sarana</option>
                  <option value="Seksi Pemuda & Olahraga">Seksi Pemuda & Olahraga</option>
                  <option value="Lainnya">Lainnya (Ketik Bebas / Free Text)...</option>
                </select>
                {editRole === 'Lainnya' && (
                  <input
                    type="text"
                    required
                    value={editCustomRole}
                    onChange={(e) => setEditCustomRole(e.target.value)}
                    placeholder="Ketik nama seksi / jabatan..."
                    className="w-full mt-2 px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lengkap Pejabat Pengurus *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Contoh: Bpk. Hendra Cahyono"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nomor HP / WhatsApp
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Mulai Menjabat *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Akhir Menjabat</span>
                  </label>
                  <input
                    type="date"
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Kosongkan jika aktif</p>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan / Keterangan Jabatan
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Contoh: SK No. 01/RT05/2024"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditOfficerModalOpen(false);
                    setEditingOfficer(null);
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Workspace & Cloud Sync Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Integrasi Google Drive & Google Sheets
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Sinkronkan data iuran 34 rumah dan buku kas ke spreadsheet di Google Drive untuk arsip & transparansi warga.
            </p>
          </div>
        </div>

        <button
          onClick={onOpenGoogleSync}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Buka Dialog Sinkronisasi</span>
        </button>
      </div>

      {/* Backup and Restore Data */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900">
            Cadangkan & Pulihkan Data Kas RT (JSON)
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Simpan file cadangan ke komputer atau pulihkan dari file cadangan sebelumnya.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportBackup}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Unduh File Cadangan (JSON)</span>
          </button>

          <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer">
            <Upload className="w-4 h-4 text-slate-600" />
            <span>Pulihkan dari File Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setIsResetConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl transition-colors ml-auto cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset ke Data Bawaan</span>
          </button>
        </div>
      </div>

      {/* Modal Konfirmasi Pulihkan Data Backup (In-App Dialog - Bebas Blokir Iframe) */}
      {restoreModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-in">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Pulihkan Data Cadangan?
                  </h3>
                  <p className="text-xs text-slate-500 font-mono truncate max-w-[260px]">
                    {restoreModalData.fileName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRestoreModalData(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5 text-xs text-slate-700">
              <div className="font-semibold text-slate-900 pb-1.5 border-b border-slate-200 flex items-center justify-between">
                <span>Ringkasan Isi File Cadangan:</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                  Siap Dipulihkan
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Ketua RT di File:</span>
                <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {restoreModalData.profile.chairpersonName || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nama RT / Wilayah:</span>
                <span className="font-medium text-slate-900">
                  {getCleanRtRwTitle(restoreModalData.profile)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Data Warga (KK):</span>
                <span className="font-medium text-slate-900">{restoreModalData.residents.length} Rumah</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Buku Kas (Transaksi):</span>
                <span className="font-medium text-slate-900">{restoreModalData.transactions.length} Catatan Transaksi</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                Seluruh data di aplikasi dan database <strong>Firebase Firestore</strong> akan diperbarui dengan data dari file cadangan ini.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRestoreModalData(null)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Ya, Pulihkan ke Firebase</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Reset Bawaan (In-App Dialog) */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Reset ke Data Awal?
                </h3>
                <p className="text-xs text-slate-500">
                  Kembalikan ke data bawaan awal sistem
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Seluruh perubahan dan catatan baru akan digantikan kembali ke konfigurasi awal (September 2026). Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {restoreNotification && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in max-w-md">
          <div
            className={`p-4 rounded-2xl shadow-xl border flex items-center gap-3 text-xs ${
              restoreNotification.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-700'
                : 'bg-rose-900 text-white border-rose-700'
            }`}
          >
            {restoreNotification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <p className="flex-1 font-medium">{restoreNotification.message}</p>
            <button
              onClick={() => setRestoreNotification(null)}
              className="p-1 text-slate-300 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
