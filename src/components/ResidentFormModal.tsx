import React, { useState, useEffect } from 'react';
import {
  X,
  Home,
  User,
  Users,
  FileText,
  Plus,
  Trash2,
  Check,
  ShieldCheck,
  Phone,
  MessageCircle,
  Heart,
  Sliders,
  Tag,
  Percent,
} from 'lucide-react';
import { Resident, RTProfile, FamilyMemberItem } from '../types';
import { formatRupiah, getBaseRateForMonth, getWhatsAppUrl, getMemberName, getMemberNik, getMemberPhone, getMemberRelation } from '../utils/formatters';
import { CurrencyInput } from './CurrencyInput';

interface ResidentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Resident>) => void;
  resident: Resident | null;
  profile?: RTProfile;
  canEditDues?: boolean;
}

export const ResidentFormModal: React.FC<ResidentFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  resident,
  profile,
  canEditDues = true,
}) => {
  const [activeTab, setActiveTab] = useState<'house' | 'id' | 'family' | 'dues'>('house');

  // Form State
  const [houseNo, setHouseNo] = useState('');
  const [name, setName] = useState('');
  const [isVacant, setIsVacant] = useState(false);
  const [houseStatus, setHouseStatus] = useState<Resident['houseStatus']>('Milik Sendiri');
  const [phone, setPhone] = useState('');

  // Identitas KTP & KK
  const [kkNumber, setKkNumber] = useState('');
  const [nik, setNik] = useState('');

  // Keluarga
  const [spouseName, setSpouseName] = useState('');
  const [spouseNik, setSpouseNik] = useState('');
  const [spousePhone, setSpousePhone] = useState('');

  // Anak
  const [children, setChildren] = useState<FamilyMemberItem[]>([]);
  const [newChildName, setNewChildName] = useState('');
  const [newChildNik, setNewChildNik] = useState('');
  const [newChildPhone, setNewChildPhone] = useState('');

  // Anggota Lain
  const [otherFamilyMembers, setOtherFamilyMembers] = useState<FamilyMemberItem[]>([]);
  const [newOtherMemberName, setNewOtherMemberName] = useState('');
  const [newOtherMemberRelation, setNewOtherMemberRelation] = useState('Famili');
  const [newOtherMemberNik, setNewOtherMemberNik] = useState('');
  const [newOtherMemberPhone, setNewOtherMemberPhone] = useState('');

  // Tarif, Pembayaran Khusus & Tunggakan
  const [arrearsAmount, setArrearsAmount] = useState<number>(0);
  const [customMonthlyRate, setCustomMonthlyRate] = useState<number | ''>('');
  const [customRateReason, setCustomRateReason] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Sync state when resident prop changes
  useEffect(() => {
    if (resident) {
      setHouseNo(resident.houseNo || '');
      setName(resident.name || '');
      setIsVacant(resident.isVacant || false);
      setHouseStatus(resident.houseStatus || 'Milik Sendiri');
      setPhone(resident.phone || '');
      setKkNumber(resident.kkNumber || '');
      setNik(resident.nik || '');
      setSpouseName(resident.spouseName || '');
      setSpouseNik(resident.spouseNik || '');
      setSpousePhone(resident.spousePhone || '');
      
      if (resident.children && Array.isArray(resident.children)) {
        setChildren(
          resident.children.map((c) =>
            typeof c === 'string' ? { name: c, relation: 'Anak' } : { ...c, relation: c.relation || 'Anak' }
          )
        );
      } else {
        setChildren([]);
      }

      if (resident.otherFamilyMembers && Array.isArray(resident.otherFamilyMembers)) {
        setOtherFamilyMembers(
          resident.otherFamilyMembers.map((m) =>
            typeof m === 'string' ? { name: m, relation: 'Famili' } : { ...m, relation: m.relation || 'Famili' }
          )
        );
      } else {
        setOtherFamilyMembers([]);
      }

      setArrearsAmount(resident.arrearsAmount || 0);
      setCustomMonthlyRate(resident.customMonthlyRate !== undefined ? resident.customMonthlyRate : (resident.discountAmount ? Math.max(0, 70000 - resident.discountAmount) : ''));
      setCustomRateReason(resident.customRateReason || resident.discountReason || '');
      setNotes(resident.notes || '');
    } else {
      setHouseNo('');
      setName('');
      setIsVacant(false);
      setHouseStatus('Milik Sendiri');
      setPhone('');
      setKkNumber('');
      setNik('');
      setSpouseName('');
      setSpouseNik('');
      setSpousePhone('');
      setChildren([]);
      setOtherFamilyMembers([]);
      setArrearsAmount(0);
      setCustomMonthlyRate('');
      setCustomRateReason('');
      setNotes('');
    }
    setNewChildName('');
    setNewChildNik('');
    setNewChildPhone('');
    setNewOtherMemberName('');
    setNewOtherMemberRelation('Famili');
    setNewOtherMemberNik('');
    setNewOtherMemberPhone('');
    setActiveTab('house');
  }, [resident, isOpen]);

  if (!isOpen) return null;

  // Total Occupants count calculation
  const calculatedTotalOccupants = isVacant
    ? 0
    : 1 + (spouseName ? 1 : 0) + children.length + otherFamilyMembers.length;

  const handleAddChild = () => {
    if (!newChildName.trim()) return;
    const cleanNik = newChildNik.replace(/[^0-9]/g, '');
    const cleanPhone = newChildPhone.trim();
    setChildren([
      ...children,
      {
        name: newChildName.trim(),
        nik: cleanNik || undefined,
        phone: cleanPhone || undefined,
        relation: 'Anak',
      },
    ]);
    setNewChildName('');
    setNewChildNik('');
    setNewChildPhone('');
  };

  const handleRemoveChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index));
  };

  const handleAddOtherMember = () => {
    if (!newOtherMemberName.trim()) return;
    const cleanNik = newOtherMemberNik.replace(/[^0-9]/g, '');
    const cleanPhone = newOtherMemberPhone.trim();
    setOtherFamilyMembers([
      ...otherFamilyMembers,
      {
        name: newOtherMemberName.trim(),
        relation: newOtherMemberRelation.trim() || 'Famili',
        nik: cleanNik || undefined,
        phone: cleanPhone || undefined,
      },
    ]);
    setNewOtherMemberName('');
    setNewOtherMemberRelation('Famili');
    setNewOtherMemberNik('');
    setNewOtherMemberPhone('');
  };

  const handleRemoveOtherMember = (index: number) => {
    setOtherFamilyMembers(otherFamilyMembers.filter((_, i) => i !== index));
  };

  const standardMonthlyRate = getBaseRateForMonth('Oktober', profile);
  const isCustomRateSet = customMonthlyRate !== '' && Number(customMonthlyRate) >= 0;
  const calculatedFinalRate = isCustomRateSet ? Number(customMonthlyRate) : standardMonthlyRate;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!houseNo.trim()) {
      setActiveTab('house');
      return;
    }

    const duesDataToSave = canEditDues
      ? {
          arrearsAmount: isVacant ? 0 : Number(arrearsAmount),
          customMonthlyRate: isCustomRateSet ? Number(customMonthlyRate) : undefined,
          customRateReason: isCustomRateSet && customRateReason.trim() ? customRateReason.trim() : undefined,
          discountAmount: undefined,
          discountReason: undefined,
        }
      : {
          arrearsAmount: resident ? resident.arrearsAmount : 0,
          customMonthlyRate: resident ? resident.customMonthlyRate : undefined,
          customRateReason: resident ? resident.customRateReason : undefined,
          discountAmount: resident ? resident.discountAmount : undefined,
          discountReason: resident ? resident.discountReason : undefined,
        };

    const finalName = name.trim() || (isVacant ? 'Rumah Kosong' : 'Warga');

    onSave({
      houseNo: houseNo.trim(),
      name: finalName,
      isVacant,
      houseStatus: houseStatus || 'Milik Sendiri',
      phone: phone.trim() || undefined,
      kkNumber: kkNumber.trim() || undefined,
      nik: nik.trim() || undefined,
      spouseName: spouseName.trim() || undefined,
      spouseNik: spouseNik.trim() || undefined,
      spousePhone: spousePhone.trim() || undefined,
      children: children,
      otherFamilyMembers: otherFamilyMembers,
      totalOccupants: calculatedTotalOccupants,
      ...duesDataToSave,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[85vh] animate-in fade-in zoom-in duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm leading-tight">
                {resident ? `Edit Data Warga & Keluarga (No. ${resident.houseNo})` : 'Tambah Rumah & Warga Baru'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Pencatatan data kependudukan, KK, KTP, dan susunan keluarga RT
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

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-3 shrink-0 overflow-x-auto text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('house')}
            className={`py-2 px-3 border-b-2 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'house'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>1. Rumah & KK</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('id')}
            className={`py-2 px-3 border-b-2 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'id'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>2. KTP & No. KK</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('family')}
            className={`py-2 px-3 border-b-2 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'family'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>3. Istri & Anak ({children.length})</span>
          </button>

          {canEditDues && (
            <button
              type="button"
              onClick={() => setActiveTab('dues')}
              className={`py-2 px-3 border-b-2 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'dues'
                  ? 'border-emerald-600 text-emerald-700 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>4. Iuran</span>
            </button>
          )}
        </div>

        {/* Scrollable Form Body */}
        <form id="resident-form" onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3.5 text-xs">
          {/* TAB 1: DATA POKOK & RUMAH */}
          {activeTab === 'house' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor Rumah *
                  </label>
                  <input
                    type="text"
                    required
                    value={houseNo}
                    onChange={(e) => setHouseNo(e.target.value)}
                    placeholder="Contoh: 81"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Kepala Keluarga (KK) / Pemilik Rumah *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isVacant ? 'Contoh: Bpk. Budi (Pemilik Rumah)' : 'Contoh: Rian Amirul Hakim'}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Rumah Kosong Checkbox */}
              <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={isVacant}
                  onChange={(e) => setIsVacant(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="font-semibold text-slate-800 select-none block">
                    Status Rumah Kosong (Tidak Berpenghuni)
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Centang jika rumah ini tidak ditempati. Informasi pemilik / pemegang kunci tetap dapat diisi lengkap.
                  </span>
                </div>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Status Tempat Tinggal
                  </label>
                  <select
                    value={houseStatus}
                    onChange={(e) => setHouseStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Milik Sendiri">Milik Sendiri</option>
                    <option value="Kontrak / Sewa">Kontrak / Sewa</option>
                    <option value="Kos">Kos</option>
                    <option value="Rumah Dinas">Rumah Dinas</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>No. WhatsApp / HP Pemilik (Opsional)</span>
                    </label>
                    {phone.trim() && (
                      <a
                        href={getWhatsAppUrl(phone, `Yth. Bapak/Ibu ${name.trim() || 'Warga'}, `)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                        title={`Kirim pesan WhatsApp ke ${phone}`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Hubungi WA</span>
                      </a>
                    )}
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Contoh: 08123456789"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Summary preview */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-900">
                <div>
                  <span className="font-semibold block">Estimasi Jumlah Jiwa Penghuni:</span>
                  <span className="text-[11px] text-emerald-700">
                    {isVacant
                      ? 'Status Rumah Kosong (0 Jiwa Berpenghuni)'
                      : `KK: 1 ${spouseName ? '+ Istri' : ''} ${children.length > 0 ? `+ ${children.length} Anak` : ''} ${otherFamilyMembers.length > 0 ? `+ ${otherFamilyMembers.length} Lainnya` : ''}`}
                  </span>
                </div>
                <span className="text-base font-bold font-mono bg-emerald-100 px-3 py-1 rounded-lg text-emerald-800">
                  {calculatedTotalOccupants} Jiwa
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: DOKUMEN IDENTITAS KTP & KK */}
          {activeTab === 'id' && (
            <div className="space-y-3.5">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
                Nomor KTP & Nomor KK digunakan untuk arsip pendataan sensus RT resmi. Data disimpan aman di peramban dan sinkronisasi Google Sheets.
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nomor Kartu Keluarga (No. KK) — 16 Digit
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={kkNumber}
                  onChange={(e) => setKkNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Contoh: 3201012304900001"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-sm tracking-wider focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {kkNumber.length}/16 digit terisi
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nomor Induk Kependudukan (NIK / No. KTP) Kepala Keluarga — 16 Digit
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={nik}
                  onChange={(e) => setNik(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Contoh: 3201011508850002"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-sm tracking-wider focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {nik.length}/16 digit terisi
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: SUSUNAN ANGGOTA KELUARGA (ISTRI & ANAK) */}
          {activeTab === 'family' && (
            <div className="space-y-4">
              {/* Pasangan (Istri / Suami) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between font-bold text-slate-800 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    <span>Data Istri / Suami (Pasangan)</span>
                  </div>
                  {spousePhone.trim() && (
                    <a
                      href={getWhatsAppUrl(spousePhone, `Yth. Ibu/Bpk ${spouseName.trim() || 'Pasangan Warga'}, `)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-md text-[10px] font-semibold transition-colors"
                      title={`Hubungi WA ${spouseName || 'Pasangan'}`}
                    >
                      <MessageCircle className="w-3 h-3 text-emerald-600" />
                      <span>Hubungi WA</span>
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      Nama Lengkap Pasangan
                    </label>
                    <input
                      type="text"
                      value={spouseName}
                      onChange={(e) => setSpouseName(e.target.value)}
                      placeholder="Contoh: Siti Rahmawati"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      No. KTP / NIK (Opsional)
                    </label>
                    <input
                      type="text"
                      maxLength={16}
                      value={spouseNik}
                      onChange={(e) => setSpouseNik(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="16 digit NIK"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      No. WhatsApp / HP (Opsional)
                    </label>
                    <input
                      type="tel"
                      value={spousePhone}
                      onChange={(e) => setSpousePhone(e.target.value)}
                      placeholder="Contoh: 08123456789"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Daftar Anak */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Daftar Anak ({children.length} Terdaftar)</span>
                  </label>
                </div>

                {/* Form Input Tambah Anak */}
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Nama Lengkap Anak *
                      </label>
                      <input
                        type="text"
                        value={newChildName}
                        onChange={(e) => setNewChildName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddChild();
                          }
                        }}
                        placeholder="Contoh: Fathan Al-Ghifari"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        No. KTP / NIK Anak (Opsional)
                      </label>
                      <input
                        type="text"
                        maxLength={16}
                        value={newChildNik}
                        onChange={(e) => setNewChildNik(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="16 digit NIK"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        No. WhatsApp / HP (Opsional)
                      </label>
                      <input
                        type="tel"
                        value={newChildPhone}
                        onChange={(e) => setNewChildPhone(e.target.value)}
                        placeholder="Contoh: 08123456789"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddChild}
                      disabled={!newChildName.trim()}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Anak</span>
                    </button>
                  </div>
                </div>

                {/* List of Children */}
                {children.length === 0 ? (
                  <div className="p-2.5 text-center text-slate-400 text-[11px] bg-white rounded-xl border border-dashed border-slate-200">
                    Belum ada nama anak yang ditambahkan.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {children.map((child, idx) => {
                      const childName = getMemberName(child);
                      const childNik = getMemberNik(child);
                      const childPhone = getMemberPhone(child);
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 text-xs transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            <span className="font-semibold text-slate-800">
                              {idx + 1}. {childName}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                              {childNik && (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 font-mono rounded">
                                  KTP: {childNik}
                                </span>
                              )}
                              {childPhone && (
                                <div className="flex items-center gap-1">
                                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-mono rounded border border-emerald-200">
                                    HP: {childPhone}
                                  </span>
                                  <a
                                    href={getWhatsAppUrl(childPhone, `Yth. ${childName}, `)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-medium transition-colors"
                                    title={`Hubungi WA ${childName}`}
                                  >
                                    <MessageCircle className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>WA</span>
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveChild(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0 ml-2"
                            title="Hapus data anak"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Anggota Keluarga Lain */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-700" />
                    <span>Anggota Keluarga Lain ({otherFamilyMembers.length} Terdaftar)</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Orang tua, mertua, famili, ART, dll</span>
                </div>

                {/* Form Input Tambah Anggota Lain */}
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Nama Lengkap *
                      </label>
                      <input
                        type="text"
                        value={newOtherMemberName}
                        onChange={(e) => setNewOtherMemberName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddOtherMember();
                          }
                        }}
                        placeholder="Contoh: Bpk. Sugeng"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Hubungan
                      </label>
                      <select
                        value={newOtherMemberRelation}
                        onChange={(e) => setNewOtherMemberRelation(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Orang Tua">Orang Tua</option>
                        <option value="Mertua">Mertua</option>
                        <option value="Famili">Famili / Kerabat</option>
                        <option value="ART">ART / Asisten</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        No. KTP / NIK (Opsional)
                      </label>
                      <input
                        type="text"
                        maxLength={16}
                        value={newOtherMemberNik}
                        onChange={(e) => setNewOtherMemberNik(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="16 digit NIK"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        No. WhatsApp / HP (Opsional)
                      </label>
                      <input
                        type="tel"
                        value={newOtherMemberPhone}
                        onChange={(e) => setNewOtherMemberPhone(e.target.value)}
                        placeholder="Contoh: 08123456789"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddOtherMember}
                      disabled={!newOtherMemberName.trim()}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Anggota</span>
                    </button>
                  </div>
                </div>

                {/* List of Other Members */}
                {otherFamilyMembers.length > 0 && (
                  <div className="space-y-1.5">
                    {otherFamilyMembers.map((member, idx) => {
                      const mName = getMemberName(member);
                      const mNik = getMemberNik(member);
                      const mPhone = getMemberPhone(member);
                      const mRel = getMemberRelation(member) || 'Famili';
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            <span className="font-semibold text-slate-800">
                              • {mName}
                            </span>
                            <span className="px-1.5 py-0.2 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-medium w-fit">
                              {mRel}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                              {mNik && (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 font-mono rounded">
                                  KTP: {mNik}
                                </span>
                              )}
                              {mPhone && (
                                <div className="flex items-center gap-1">
                                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-mono rounded border border-emerald-200">
                                    HP: {mPhone}
                                  </span>
                                  <a
                                    href={getWhatsAppUrl(mPhone, `Yth. ${mName}, `)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-medium transition-colors"
                                    title={`Hubungi WA ${mName}`}
                                  >
                                    <MessageCircle className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>WA</span>
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveOtherMember(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0 ml-2"
                            title="Hapus data anggota"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: IURAN & TARIF KHUSUS */}
          {activeTab === 'dues' && canEditDues && (
            <div className="space-y-4">
              {!isVacant ? (
                <>
                  {/* Live Calculation Preview Banner */}
                  <div className={`p-3.5 rounded-xl border ${
                    isCustomRateSet 
                      ? 'bg-purple-50/80 border-purple-200' 
                      : 'bg-emerald-50 border-emerald-200'
                  }`}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-800">
                        {isCustomRateSet ? 'Nominal Pembayaran Khusus Warga:' : 'Kewajiban Iuran Warga Tiap Bulan:'}
                      </span>
                      <span className={`font-mono font-extrabold text-sm ${
                        isCustomRateSet ? 'text-purple-900' : 'text-emerald-800'
                      }`}>
                        {formatRupiah(calculatedFinalRate)} / bulan
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 flex items-center justify-between border-t border-slate-200/80 pt-1.5 mt-1">
                      <span>Tarif Standar Umum RT: <strong>{formatRupiah(standardMonthlyRate)}</strong></span>
                      {isCustomRateSet ? (
                        <span className="text-purple-700 font-semibold flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          Tarif Khusus Aktif (Hanya bayar {formatRupiah(Number(customMonthlyRate))})
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium">
                          Mengikuti tarif bulanan standar
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Section: Pengaturan Nominal Pembayaran Khusus */}
                  <div className="p-3.5 bg-purple-50/50 border border-purple-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-purple-700" />
                        <span className="text-xs font-bold text-purple-950 uppercase tracking-wide">
                          Nominal Pembayaran Khusus (Tarif Khusus)
                        </span>
                      </div>
                      {isCustomRateSet && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomMonthlyRate('');
                            setCustomRateReason('');
                          }}
                          className="text-[10px] font-semibold text-rose-600 hover:text-rose-800 underline cursor-pointer"
                        >
                          Reset ke Standar ({formatRupiah(standardMonthlyRate)})
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nominal Pembayaran yang Harus Dibayar per Bulan (Rp)
                      </label>
                      <CurrencyInput
                        value={customMonthlyRate}
                        onChange={(val) => setCustomMonthlyRate(val > 0 ? val : '')}
                        prefix="Rp"
                        placeholder={`Standar RT: ${standardMonthlyRate.toLocaleString('id-ID')} (atau isi misal: 45.000)`}
                        className="w-full pr-3 py-2 bg-white border border-purple-200 rounded-xl text-slate-900 font-mono text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Contoh: Jika rumah nomor 83 hanya bayar <strong>Rp 45.000</strong> per bulan, ketik <strong>45.000</strong>. Kosongkan jika membayar tarif standar umum RT.
                      </span>

                      {/* Quick Presets */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[10px] text-slate-400 font-medium mr-1">Preset Cepat:</span>
                        <button
                          type="button"
                          onClick={() => setCustomMonthlyRate(45000)}
                          className="px-2 py-1 text-[11px] font-mono font-semibold bg-white border border-purple-200 hover:bg-purple-100 text-purple-800 rounded-lg transition-colors cursor-pointer"
                        >
                          Rp 45.000
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomMonthlyRate(30000)}
                          className="px-2 py-1 text-[11px] font-mono font-semibold bg-white border border-purple-200 hover:bg-purple-100 text-purple-800 rounded-lg transition-colors cursor-pointer"
                        >
                          Rp 30.000
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomMonthlyRate(50000)}
                          className="px-2 py-1 text-[11px] font-mono font-semibold bg-white border border-purple-200 hover:bg-purple-100 text-purple-800 rounded-lg transition-colors cursor-pointer"
                        >
                          Rp 50.000
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomMonthlyRate('');
                            setCustomRateReason('');
                          }}
                          className="px-2 py-1 text-[11px] font-medium bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                        >
                          Standar ({formatRupiah(standardMonthlyRate)})
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Keterangan / Alasan Pembayaran Khusus (Opsional)
                      </label>
                      <input
                        type="text"
                        value={customRateReason}
                        onChange={(e) => setCustomRateReason(e.target.value)}
                        placeholder="Contoh: Kesepakatan Khusus Rumah No. 83 / Lansia / Tokoh Warga"
                        className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-slate-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 text-xs">
                      Tunggakan Awal (Rp)
                    </label>
                    <CurrencyInput
                      value={arrearsAmount}
                      onChange={(val) => setArrearsAmount(val)}
                      prefix="Rp"
                      placeholder="0 jika sudah lunas"
                      className="w-full pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 text-xs">
                      Catatan Tambahan (Opsional)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Catatan pengurus terkait warga/rumah ini..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
                  Rumah berstatus kosong tidak dibebankan iuran bulanan dan tunggakan.
                </div>
              )}
            </div>
          )}
        </form>

        {/* PINNED / FIXED BOTTOM FOOTER */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 z-10">
          <div className="text-[11px] text-slate-500">
            {!isVacant && (
              <span>
                Total: <strong>{calculatedTotalOccupants}</strong> Jiwa Penghuni
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              form="resident-form"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan Data Warga</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
