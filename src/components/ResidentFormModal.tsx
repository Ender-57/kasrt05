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
  Heart,
  Sliders,
} from 'lucide-react';
import { Resident } from '../types';

interface ResidentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Resident>) => void;
  resident: Resident | null;
}

export const ResidentFormModal: React.FC<ResidentFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  resident,
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
  const [children, setChildren] = useState<string[]>([]);
  const [newChildName, setNewChildName] = useState('');
  const [otherFamilyMembers, setOtherFamilyMembers] = useState<string[]>([]);
  const [newOtherMemberName, setNewOtherMemberName] = useState('');

  // Tarif & Tunggakan
  const [arrearsAmount, setArrearsAmount] = useState<number>(0);
  const [customMonthlyRate, setCustomMonthlyRate] = useState<number | ''>('');
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
      setChildren(resident.children ? [...resident.children] : []);
      setOtherFamilyMembers(resident.otherFamilyMembers ? [...resident.otherFamilyMembers] : []);
      setArrearsAmount(resident.arrearsAmount || 0);
      setCustomMonthlyRate(resident.customMonthlyRate || '');
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
      setChildren([]);
      setOtherFamilyMembers([]);
      setArrearsAmount(0);
      setCustomMonthlyRate('');
      setNotes('');
    }
    setActiveTab('house');
  }, [resident, isOpen]);

  if (!isOpen) return null;

  // Total Occupants count calculation
  const calculatedTotalOccupants = isVacant
    ? 0
    : 1 + (spouseName ? 1 : 0) + children.length + otherFamilyMembers.length;

  const handleAddChild = () => {
    if (!newChildName.trim()) return;
    setChildren([...children, newChildName.trim()]);
    setNewChildName('');
  };

  const handleRemoveChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index));
  };

  const handleAddOtherMember = () => {
    if (!newOtherMemberName.trim()) return;
    setOtherFamilyMembers([...otherFamilyMembers, newOtherMemberName.trim()]);
    setNewOtherMemberName('');
  };

  const handleRemoveOtherMember = (index: number) => {
    setOtherFamilyMembers(otherFamilyMembers.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!houseNo.trim()) {
      setActiveTab('house');
      return;
    }

    onSave({
      houseNo: houseNo.trim(),
      name: isVacant ? 'KOSONG' : name.trim() || 'KOSONG',
      isVacant,
      houseStatus: isVacant ? undefined : houseStatus,
      phone: isVacant ? undefined : phone.trim() || undefined,
      kkNumber: isVacant ? undefined : kkNumber.trim() || undefined,
      nik: isVacant ? undefined : nik.trim() || undefined,
      spouseName: isVacant ? undefined : spouseName.trim() || undefined,
      spouseNik: isVacant ? undefined : spouseNik.trim() || undefined,
      children: isVacant ? [] : children,
      otherFamilyMembers: isVacant ? [] : otherFamilyMembers,
      totalOccupants: calculatedTotalOccupants,
      arrearsAmount: isVacant ? 0 : Number(arrearsAmount),
      customMonthlyRate: customMonthlyRate !== '' ? Number(customMonthlyRate) : undefined,
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
            disabled={isVacant}
            className={`py-2 px-3 border-b-2 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'id'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : isVacant
                ? 'border-transparent text-slate-300 cursor-not-allowed'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>2. KTP & No. KK</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('family')}
            disabled={isVacant}
            className={`py-2 px-3 border-b-2 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'family'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : isVacant
                ? 'border-transparent text-slate-300 cursor-not-allowed'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>3. Istri & Anak ({children.length})</span>
          </button>

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
                    Nama Kepala Keluarga (KK) *
                  </label>
                  <input
                    type="text"
                    required={!isVacant}
                    disabled={isVacant}
                    value={isVacant ? 'KOSONG' : name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Rian Amirul Hakim"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
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
                    Rumah Kosong / Tidak Berpenghuni
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Centang jika rumah ini dalam keadaan kosong (tanpa data KK/penghuni)
                  </span>
                </div>
              </label>

              {!isVacant && (
                <>
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
                      <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        <span>No. WhatsApp / HP (Opsional)</span>
                      </label>
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
                      <span className="font-semibold block">Estimasi Jumlah Jiwa di Rumah:</span>
                      <span className="text-[11px] text-emerald-700">
                        KK: 1 {spouseName ? '+ Istri' : ''} {children.length > 0 ? `+ ${children.length} Anak` : ''} {otherFamilyMembers.length > 0 ? `+ ${otherFamilyMembers.length} Lainnya` : ''}
                      </span>
                    </div>
                    <span className="text-base font-bold font-mono bg-emerald-100 px-3 py-1 rounded-lg text-emerald-800">
                      {calculatedTotalOccupants} Jiwa
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: DOKUMEN IDENTITAS KTP & KK */}
          {activeTab === 'id' && !isVacant && (
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
          {activeTab === 'family' && !isVacant && (
            <div className="space-y-4">
              {/* Pasangan (Istri / Suami) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  <span>Data Istri / Suami (Pasangan)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      Nama Lengkap Istri / Pasangan
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
                      NIK / KTP Pasangan (Opsional)
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
                </div>
              </div>

              {/* Daftar Anak */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs">
                    Daftar Nama Anak ({children.length} Anak Terdaftar)
                  </label>
                </div>

                {/* Input Add Child */}
                <div className="flex items-center gap-2">
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
                    placeholder="Ketik nama anak (contoh: Fathan - 5 thn)..."
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddChild}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>

                {/* List of Children */}
                {children.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-[11px] bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Belum ada nama anak yang ditambahkan.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {children.map((child, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-xs transition-colors"
                      >
                        <span className="font-medium text-slate-800">
                          {idx + 1}. {child}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveChild(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Hapus nama anak"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Anggota Keluarga Lain */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="font-bold text-slate-800 text-xs block">
                  Anggota Keluarga Lain (Orang tua, mertua, famili, dll)
                </label>

                <div className="flex items-center gap-2">
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
                    placeholder="Contoh: Bpk. Sugeng (Orang tua)..."
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddOtherMember}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>

                {otherFamilyMembers.length > 0 && (
                  <div className="space-y-1.5">
                    {otherFamilyMembers.map((member, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                      >
                        <span className="font-medium text-slate-700">
                          • {member}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveOtherMember(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: IURAN & TARIF */}
          {activeTab === 'dues' && (
            <div className="space-y-3.5">
              {!isVacant ? (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Tunggakan Awal (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={arrearsAmount}
                      onChange={(e) => setArrearsAmount(Number(e.target.value))}
                      placeholder="0 jika sudah lunas"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Tarif Khusus Bulanan (Opsional)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={customMonthlyRate}
                      onChange={(e) =>
                        setCustomMonthlyRate(e.target.value !== '' ? Number(e.target.value) : '')
                      }
                      placeholder="Kosongkan jika normal (60k Jan-Mei, 70k Jun-Des)"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Contoh: 30000 untuk subsidi khusus (seperti rumah No. 373)
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
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
