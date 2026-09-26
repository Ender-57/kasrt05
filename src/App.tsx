import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DuesTable } from './components/DuesTable';
import { Cashbook } from './components/Cashbook';
import { ResidentsDirectory } from './components/ResidentsDirectory';
import { MonthlyReport } from './components/MonthlyReport';
import { SettingsView } from './components/SettingsView';
import { OfficersView } from './components/OfficersView';
import { ReceiptModal } from './components/ReceiptModal';
import { GoogleSyncModal } from './components/GoogleSyncModal';
import { AdminAuthModal } from './components/AdminAuthModal';
import {
  Resident,
  CashTransaction,
  RTProfile,
  MonthKey,
  GoogleSyncState,
  DebtItem,
} from './types';
import {
  INITIAL_RESIDENTS,
  INITIAL_TRANSACTIONS,
  INITIAL_RT_PROFILE,
  INITIAL_DEBTS,
} from './data/initialData';
import { initAuth, googleSignIn } from './services/auth';
import { SyncResult } from './services/googleSheets';
import {
  seedInitialDataIfEmpty,
  subscribeToProfile,
  subscribeToResidents,
  subscribeToTransactions,
  subscribeToDebts,
  subscribeToSyncState,
  saveProfile,
  saveTransaction,
  deleteTransaction,
  saveSyncState,
  resetDatabaseToInitial,
  restoreDatabaseFromBackup,
  db,
} from './services/db';
import { writeBatch, doc } from 'firebase/firestore';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dues' | 'residents' | 'cashbook' | 'report' | 'officers' | 'settings'>('dues');

  // Role: Viewer (Warga) vs Admin (Pengurus RT)
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);

  // Core Data States (synchronized in real-time with Firestore)
  const [residents, setResidents] = useState<Resident[]>(INITIAL_RESIDENTS);
  const [transactions, setTransactions] = useState<CashTransaction[]>(INITIAL_TRANSACTIONS);
  const [debts, setDebts] = useState<DebtItem[]>(INITIAL_DEBTS);
  const [profile, setProfile] = useState<RTProfile>(INITIAL_RT_PROFILE);
  const [syncState, setSyncState] = useState<GoogleSyncState>({
    spreadsheetId: null,
    spreadsheetUrl: null,
    lastSyncedAt: null,
    syncInProgress: false,
  });

  // Google User / Auth
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isGoogleSyncModalOpen, setIsGoogleSyncModalOpen] = useState(false);

  // Digital Receipt Modal State
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<{
    resident: Resident | null;
    months: MonthKey[];
    amount: number;
    method: string;
    receiptNo: string;
    date: string;
  }>({
    resident: null,
    months: [],
    amount: 0,
    method: 'Tunai',
    receiptNo: '',
    date: '',
  });

  // Setup Firestore real-time subscriptions and seeding on mount
  useEffect(() => {
    let active = true;
    let unsubProfile: (() => void) | null = null;
    let unsubResidents: (() => void) | null = null;
    let unsubTransactions: (() => void) | null = null;
    let unsubDebts: (() => void) | null = null;
    let unsubSyncState: (() => void) | null = null;

    const setupFirebaseAndSubscribe = async () => {
      try {
        await seedInitialDataIfEmpty();
        if (!active) return;

        unsubProfile = subscribeToProfile((updatedProfile) => {
          if (active) setProfile(updatedProfile);
        });

        unsubResidents = subscribeToResidents((updatedResidents) => {
          if (active) setResidents(updatedResidents);
        });

        unsubTransactions = subscribeToTransactions((updatedTransactions) => {
          if (active) setTransactions(updatedTransactions);
        });

        unsubDebts = subscribeToDebts((updatedDebts) => {
          if (active) setDebts(updatedDebts);
        });

        unsubSyncState = subscribeToSyncState((updatedSyncState) => {
          if (active) setSyncState(updatedSyncState);
        });
      } catch (err) {
        console.error('Failed to initialize Firestore subscription:', err);
      }
    };

    setupFirebaseAndSubscribe();

    return () => {
      active = false;
      if (unsubProfile) unsubProfile();
      if (unsubResidents) unsubResidents();
      if (unsubTransactions) unsubTransactions();
      if (unsubDebts) unsubDebts();
      if (unsubSyncState) unsubSyncState();
    };
  }, []);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setUserEmail(user.email);
        setIsAdmin(true); // Automatically grant admin if signed in with Google
      },
      () => {
        setUserEmail(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Google Sign In handler
  const handleGoogleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUserEmail(res.user.email);
        setIsAdmin(true);
      }
    } catch (err: unknown) {
      console.error('Google Sign In failed:', err);
    }
  };

  // Helper to sync whole residents array to Firestore cleanly (handles add, edit, and delete)
  const handleUpdateResidents = async (newResidents: Resident[]) => {
    try {
      const currentMap = new Map(residents.map((r) => [r.id, r]));
      const newMap = new Map(newResidents.map((r) => [r.id, r]));

      const batch = writeBatch(db);

      // Save/Update new or changed ones
      newResidents.forEach((nr) => {
        const cr = currentMap.get(nr.id);
        if (!cr || JSON.stringify(cr) !== JSON.stringify(nr)) {
          batch.set(doc(db, 'residents', nr.id), nr);
        }
      });

      // Delete removed ones
      residents.forEach((cr) => {
        if (!newMap.has(cr.id)) {
          batch.delete(doc(db, 'residents', cr.id));
        }
      });

      await batch.commit();
    } catch (err) {
      console.error('Error updating residents in Firestore:', err);
    }
  };

  // Helper to sync whole debts array to Firestore cleanly (handles add, edit, and delete)
  const handleUpdateDebts = async (newDebts: DebtItem[]) => {
    try {
      const currentMap = new Map(debts.map((d) => [d.id, d]));
      const newMap = new Map(newDebts.map((d) => [d.id, d]));

      const batch = writeBatch(db);

      // Save/Update new or changed ones
      newDebts.forEach((nd) => {
        const cd = currentMap.get(nd.id);
        if (!cd || JSON.stringify(cd) !== JSON.stringify(nd)) {
          batch.set(doc(db, 'debts', nd.id), nd);
        }
      });

      // Delete removed ones
      debts.forEach((cd) => {
        if (!newMap.has(cd.id)) {
          batch.delete(doc(db, 'debts', cd.id));
        }
      });

      await batch.commit();
    } catch (err) {
      console.error('Error updating debts in Firestore:', err);
    }
  };

  // Profile Update (writes to Firestore)
  const handleUpdateProfile = async (newProfile: RTProfile) => {
    try {
      await saveProfile(newProfile);
    } catch (err) {
      console.error('Error updating profile in Firestore:', err);
    }
  };

  // Add transaction helper (writes to Firestore)
  const handleAddTransaction = async (newTx: Omit<CashTransaction, 'id'>) => {
    try {
      const tx: CashTransaction = {
        ...newTx,
        id: `tx-${Date.now()}`,
      };
      await saveTransaction(tx);
    } catch (err) {
      console.error('Error adding transaction in Firestore:', err);
    }
  };

  const handleUpdateTransaction = async (updatedTx: CashTransaction) => {
    try {
      await saveTransaction(updatedTx);
    } catch (err) {
      console.error('Error updating transaction in Firestore:', err);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteTransaction(id);
    } catch (err) {
      console.error('Error deleting transaction in Firestore:', err);
    }
  };

  // Open Receipt
  const handleViewReceipt = (
    resident: Resident,
    months: MonthKey[],
    amount: number,
    method: string,
    receiptNo: string,
    date: string
  ) => {
    setActiveReceipt({
      resident,
      months,
      amount,
      method,
      receiptNo,
      date,
    });
    setIsReceiptModalOpen(true);
  };

  // Reset Data to Initial (writes to Firestore)
  const handleResetData = async () => {
    try {
      await resetDatabaseToInitial();
    } catch (err) {
      console.error('Error resetting Firestore database:', err);
    }
  };

  // Bulk Restore from Backup File (writes to Firestore)
  const handleRestoreData = async (
    restoredResidents: Resident[],
    restoredTransactions: CashTransaction[],
    restoredProfile: RTProfile
  ) => {
    try {
      await restoreDatabaseFromBackup(restoredResidents, restoredTransactions, restoredProfile);
    } catch (err) {
      console.error('Error restoring backup to Firestore:', err);
    }
  };

  // Update Sync Success (writes to Firestore)
  const handleSyncSuccess = async (result: SyncResult) => {
    try {
      await saveSyncState({
        spreadsheetId: result.spreadsheetId,
        spreadsheetUrl: result.spreadsheetUrl,
        lastSyncedAt: result.createdAt,
        syncInProgress: false,
      });
    } catch (err) {
      console.error('Error updating Google sync state in Firestore:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-800 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Navbar with Role Mode indicator & Google Auth */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdmin={isAdmin}
        onRequestAdmin={() => setIsAdminAuthModalOpen(true)}
        onExitAdmin={() => setIsAdmin(false)}
        profile={profile}
        userEmail={userEmail}
        onGoogleSignIn={handleGoogleSignIn}
        onOpenGoogleSync={() => setIsGoogleSyncModalOpen(true)}
        syncState={syncState}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-4 pb-20 md:py-6">
        {activeTab === 'dues' && (
          <DuesTable
            residents={residents}
            transactions={transactions}
            isAdmin={isAdmin}
            profile={profile}
            onUpdateResidents={handleUpdateResidents}
            onAddTransaction={handleAddTransaction}
            onViewReceipt={handleViewReceipt}
          />
        )}

        {activeTab === 'cashbook' && (
          <Cashbook
            transactions={transactions}
            debts={debts}
            isAdmin={isAdmin}
            profile={profile}
            onAddTransaction={handleAddTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onUpdateDebts={handleUpdateDebts}
          />
        )}

        {activeTab === 'residents' && (
          <ResidentsDirectory
            residents={residents}
            isAdmin={isAdmin}
            profile={profile}
            onUpdateResidents={handleUpdateResidents}
            onNavigateToDues={() => setActiveTab('dues')}
          />
        )}

        {activeTab === 'report' && (
          <MonthlyReport
            residents={residents}
            transactions={transactions}
            debts={debts}
            profile={profile}
          />
        )}

        {activeTab === 'officers' && (
          <OfficersView
            profile={profile}
            isAdmin={isAdmin}
            onOpenSettings={() => setActiveTab('settings')}
            onUpdateProfile={handleUpdateProfile}
            onOpenGoogleSync={() => setIsGoogleSyncModalOpen(true)}
          />
        )}

        {activeTab === 'settings' && isAdmin && (
          <SettingsView
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            residents={residents}
            transactions={transactions}
            onResetData={handleResetData}
            onRestoreData={handleRestoreData}
            onOpenGoogleSync={() => setIsGoogleSyncModalOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 print:hidden mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>{profile.name}</strong> • RT {profile.rtNumber} / RW {profile.rwNumber} Desa {profile.subdistrict}, {profile.city}
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Sistem Transparansi Keuangan Lingkungan Warga</span>
            {isAdmin && syncState.spreadsheetUrl && (
              <a
                href={syncState.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline font-medium"
              >
                Buka Google Sheets
              </a>
            )}
          </div>
        </div>
      </footer>

      {/* Digital Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        resident={activeReceipt.resident}
        monthsPaid={activeReceipt.months}
        totalAmount={activeReceipt.amount}
        paymentMethod={activeReceipt.method}
        receiptNumber={activeReceipt.receiptNo}
        paymentDate={activeReceipt.date}
        profile={profile}
      />

      {/* Google Sheets & Drive Sync Confirmation Modal */}
      <GoogleSyncModal
        isOpen={isGoogleSyncModalOpen}
        onClose={() => setIsGoogleSyncModalOpen(false)}
        profile={profile}
        residents={residents}
        transactions={transactions}
        existingSpreadsheetId={syncState.spreadsheetId}
        onSyncSuccess={handleSyncSuccess}
        currentUserEmail={userEmail}
      />

      {/* Admin Authentication Modal */}
      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => setIsAdminAuthModalOpen(false)}
        onSuccess={() => setIsAdmin(true)}
        profile={profile}
        onGoogleSignIn={handleGoogleSignIn}
      />
    </div>
  );
}
