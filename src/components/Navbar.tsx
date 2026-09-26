import React, { useState } from 'react';
import { RTLogo } from './RTLogo';
import {
  Shield,
  Eye,
  FileSpreadsheet,
  LogOut,
  Sliders,
  Wallet,
  Users,
  BarChart3,
  Menu,
  X,
  Lock,
  CreditCard,
  Contact,
} from 'lucide-react';
import { RTProfile, GoogleSyncState } from '../types';
import { logoutGoogle } from '../services/auth';

interface NavbarProps {
  activeTab: 'dues' | 'residents' | 'cashbook' | 'report' | 'officers' | 'settings';
  setActiveTab: (tab: 'dues' | 'residents' | 'cashbook' | 'report' | 'officers' | 'settings') => void;
  isAdmin: boolean;
  onRequestAdmin: () => void;
  onExitAdmin: () => void;
  profile: RTProfile;
  userEmail: string | null;
  onGoogleSignIn: () => void;
  onOpenGoogleSync: () => void;
  syncState: GoogleSyncState;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isAdmin,
  onRequestAdmin,
  onExitAdmin,
  profile,
  userEmail,
  onGoogleSignIn,
  onOpenGoogleSync,
  syncState,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logoutGoogle();
    onExitAdmin();
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      {/* Top Banner indicating Role Mode */}
      <div
        className={`px-3 sm:px-4 py-1 text-xs font-medium transition-colors ${
          isAdmin ? 'bg-emerald-800 text-white' : 'bg-slate-800 text-slate-200'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate">
            {isAdmin ? (
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse shrink-0"></span>
                <span className="truncate font-medium">
                  <span className="hidden sm:inline">Selamat Datang </span>
                  Pengurus RT {profile.rtNumber} / RW {profile.rwNumber} Desa {profile.subdistrict}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-300 truncate">
                <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate font-medium">
                  <span className="hidden sm:inline">Selamat Datang </span>
                  Warga RT {profile.rtNumber} / RW {profile.rwNumber} Desa {profile.subdistrict}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin ? (
              <button
                onClick={onExitAdmin}
                className="inline-flex items-center gap-1 text-[11px] bg-emerald-900/90 hover:bg-emerald-950 px-2.5 py-0.5 rounded cursor-pointer transition-colors font-medium border border-emerald-600/40"
                title="Kembali ke Mode Warga biasa"
              >
                <Eye className="w-3 h-3 text-emerald-300" />
                <span className="whitespace-nowrap">Lihat Sebagai Warga</span>
              </button>
            ) : (
              <button
                onClick={onRequestAdmin}
                className="inline-flex items-center gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-0.5 rounded border border-emerald-500/50 cursor-pointer transition-colors font-medium shadow-2xs"
              >
                <Lock className="w-3 h-3" />
                <span className="whitespace-nowrap">Login Pengurus RT</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-16 gap-2 lg:gap-4">
          {/* Logo & RT Title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <RTLogo className="w-10 h-10 border border-slate-200 shadow-2xs shrink-0" />
            <div className="shrink-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-slate-900 text-sm sm:text-base leading-tight whitespace-nowrap">
                  {profile.name}
                </h1>
                <span className="px-1.5 py-0.2 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md whitespace-nowrap">
                  2026
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight whitespace-nowrap">
                Desa {profile.subdistrict} • {profile.city}
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs (Responsive for md, lg, xl) */}
          <nav className="hidden md:flex items-center gap-1 xl:gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setActiveTab('dues')}
              className={`flex items-center gap-1.5 px-2.5 xl:px-3.5 py-2 rounded-xl text-xs xl:text-sm transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'dues'
                  ? 'bg-emerald-800 text-white font-bold shadow-2xs border border-emerald-900'
                  : 'bg-emerald-100/70 text-emerald-950 hover:bg-emerald-200/80 font-semibold border border-emerald-200/60'
              }`}
            >
              <CreditCard className="w-4 h-4 shrink-0" />
              <span>Iuran Warga</span>
            </button>

            <button
              onClick={() => setActiveTab('cashbook')}
              className={`flex items-center gap-1.5 px-2.5 xl:px-3.5 py-2 rounded-xl text-xs xl:text-sm transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'cashbook'
                  ? 'bg-emerald-800 text-white font-bold shadow-2xs border border-emerald-900'
                  : 'bg-emerald-100/70 text-emerald-950 hover:bg-emerald-200/80 font-semibold border border-emerald-200/60'
              }`}
            >
              <Wallet className="w-4 h-4 shrink-0" />
              <span>Buku Kas</span>
            </button>

            <button
              onClick={() => setActiveTab('residents')}
              className={`flex items-center gap-1.5 px-2.5 xl:px-3.5 py-2 rounded-xl text-xs xl:text-sm transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'residents'
                  ? 'bg-emerald-800 text-white font-bold shadow-2xs border border-emerald-900'
                  : 'bg-emerald-100/70 text-emerald-950 hover:bg-emerald-200/80 font-semibold border border-emerald-200/60'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Data Warga</span>
            </button>

            <button
              onClick={() => setActiveTab('report')}
              className={`flex items-center gap-1.5 px-2.5 xl:px-3.5 py-2 rounded-xl text-xs xl:text-sm transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'report'
                  ? 'bg-emerald-800 text-white font-bold shadow-2xs border border-emerald-900'
                  : 'bg-emerald-100/70 text-emerald-950 hover:bg-emerald-200/80 font-semibold border border-emerald-200/60'
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>Laporan</span>
            </button>

            <button
              onClick={() => setActiveTab('officers')}
              className={`flex items-center gap-1.5 px-2.5 xl:px-3.5 py-2 rounded-xl text-xs xl:text-sm transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'officers'
                  ? 'bg-emerald-800 text-white font-bold shadow-2xs border border-emerald-900'
                  : 'bg-emerald-100/70 text-emerald-950 hover:bg-emerald-200/80 font-semibold border border-emerald-200/60'
              }`}
            >
              <Contact className="w-4 h-4 shrink-0" />
              <span>Pengurus RT</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-1.5 px-2.5 xl:px-3.5 py-2 rounded-xl text-xs xl:text-sm transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'bg-emerald-800 text-white font-bold shadow-2xs border border-emerald-900'
                    : 'bg-emerald-100/70 text-emerald-950 hover:bg-emerald-200/80 font-semibold border border-emerald-200/60'
                }`}
              >
                <Sliders className="w-4 h-4 shrink-0" />
                <span>Pengaturan</span>
              </button>
            )}
          </nav>

          {/* Right Actions: Google Workspace integration & Auth */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {/* Google Drive / Sheets Sync Button */}
            {isAdmin && (
              <button
                onClick={onOpenGoogleSync}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 rounded-xl shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                title="Sinkronkan data kas ke Google Sheets & Drive"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Google Sheets</span>
                {syncState.spreadsheetId && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Tersinkronkan"></span>
                )}
              </button>
            )}

            {/* Google User Profile (when signed in) */}
            {userEmail && (
              <div className="flex items-center gap-1.5 pl-1">
                <div
                  className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 max-w-[120px] xl:max-w-[150px] truncate"
                  title={userEmail}
                >
                  {userEmail}
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Keluar Google"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="flex md:hidden items-center gap-2 shrink-0">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-700 bg-slate-100 hover:text-slate-900 hover:bg-slate-200 cursor-pointer transition-colors"
              aria-label="Menu Navigasi"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-200 space-y-1.5 animate-fade-in">
            <button
              onClick={() => {
                setActiveTab('dues');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                activeTab === 'dues'
                  ? 'bg-emerald-800 text-white font-bold shadow-2xs'
                  : 'bg-emerald-100/80 text-emerald-950 font-medium'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Iuran Warga</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('cashbook');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                activeTab === 'cashbook'
                  ? 'bg-emerald-800 text-white font-bold shadow-2xs'
                  : 'bg-emerald-100/80 text-emerald-950 font-medium'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Buku Kas</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('residents');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                activeTab === 'residents'
                  ? 'bg-emerald-800 text-white font-bold shadow-2xs'
                  : 'bg-emerald-100/80 text-emerald-950 font-medium'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Data Warga</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('report');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                activeTab === 'report'
                  ? 'bg-emerald-800 text-white font-bold shadow-2xs'
                  : 'bg-emerald-100/80 text-emerald-950 font-medium'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Laporan Keuangan</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('officers');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                activeTab === 'officers'
                  ? 'bg-emerald-800 text-white font-bold shadow-2xs'
                  : 'bg-emerald-100/80 text-emerald-950 font-medium'
              }`}
            >
              <Contact className="w-4 h-4" />
              <span>Pengurus RT 05</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => {
                  setActiveTab('settings');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                  activeTab === 'settings'
                    ? 'bg-emerald-800 text-white font-bold shadow-2xs'
                    : 'bg-emerald-100/80 text-emerald-950 font-medium'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>Pengaturan RT</span>
              </button>
            )}

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              {isAdmin && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenGoogleSync();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Google Drive / Sheets</span>
                </button>
              )}

              {!isAdmin && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onRequestAdmin();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl shadow-xs"
                >
                  <Shield className="w-4 h-4" />
                  <span>Login Pengurus RT</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Mobile Bottom Navigation Bar for iOS & Android */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-2 py-1.5 flex items-center justify-around pb-safe mobile-bottom-nav">
        <button
          onClick={() => setActiveTab('dues')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'dues' ? 'text-emerald-700 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className={`w-5 h-5 ${activeTab === 'dues' ? 'text-emerald-600' : 'text-slate-400'}`} />
          <span className="text-[10px] leading-tight">Iuran</span>
        </button>

        <button
          onClick={() => setActiveTab('cashbook')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'cashbook' ? 'text-emerald-700 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wallet className={`w-5 h-5 ${activeTab === 'cashbook' ? 'text-emerald-600' : 'text-slate-400'}`} />
          <span className="text-[10px] leading-tight">Buku Kas</span>
        </button>

        <button
          onClick={() => setActiveTab('residents')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'residents' ? 'text-emerald-700 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className={`w-5 h-5 ${activeTab === 'residents' ? 'text-emerald-600' : 'text-slate-400'}`} />
          <span className="text-[10px] leading-tight">Warga</span>
        </button>

        <button
          onClick={() => setActiveTab('report')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'report' ? 'text-emerald-700 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className={`w-5 h-5 ${activeTab === 'report' ? 'text-emerald-600' : 'text-slate-400'}`} />
          <span className="text-[10px] leading-tight">Laporan</span>
        </button>

        <button
          onClick={() => setActiveTab('officers')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'officers' ? 'text-emerald-700 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Contact className={`w-5 h-5 ${activeTab === 'officers' ? 'text-emerald-600' : 'text-slate-400'}`} />
          <span className="text-[10px] leading-tight">Pengurus</span>
        </button>
      </div>
    </header>
  );
};
