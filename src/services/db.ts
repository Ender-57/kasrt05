import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  onSnapshot,
  writeBatch,
  deleteDoc,
  updateDoc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Resident, CashTransaction, RTProfile, DebtItem, GoogleSyncState } from '../types';
import {
  INITIAL_RESIDENTS,
  INITIAL_TRANSACTIONS,
  INITIAL_RT_PROFILE,
  INITIAL_DEBTS,
} from '../data/initialData';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Test Firestore connection on boot as requested by Firebase Integration Skill guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or network status.");
    }
  }
}
testConnection();

const PROFILE_DOC_ID = 'rt05_profile';
const SYNC_STATE_DOC_ID = 'rt05_sync';

/**
 * Seeds Firestore collections if they are empty
 */
export const seedInitialDataIfEmpty = async () => {
  try {
    const profileRef = doc(db, 'profile', PROFILE_DOC_ID);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      console.log('Database empty. Seeding initial RT data into Firestore...');
      const batch = writeBatch(db);

      // 1. Seed Profile
      batch.set(profileRef, INITIAL_RT_PROFILE);

      // 2. Seed Sync State
      const syncRef = doc(db, 'syncState', SYNC_STATE_DOC_ID);
      batch.set(syncRef, {
        spreadsheetId: null,
        spreadsheetUrl: null,
        lastSyncedAt: null,
        syncInProgress: false,
      });

      // 3. Seed Residents
      INITIAL_RESIDENTS.forEach((r) => {
        const ref = doc(db, 'residents', r.id);
        batch.set(ref, r);
      });

      // 4. Seed Transactions
      INITIAL_TRANSACTIONS.forEach((t) => {
        const ref = doc(db, 'transactions', t.id);
        batch.set(ref, t);
      });

      // 5. Seed Debts
      INITIAL_DEBTS.forEach((d) => {
        const ref = doc(db, 'debts', d.id);
        batch.set(ref, d);
      });

      await batch.commit();
      console.log('Successfully seeded initial data to Firestore!');
    } else {
      // If document currently holds old dummy chairperson name, auto-update it to Bpk. Wagiman
      const currentProfileData = profileSnap.data();
      if (currentProfileData?.chairpersonName === 'Bpk. H. Bambang Sudiro') {
        const updatedOfficers = Array.isArray(currentProfileData.officers)
          ? currentProfileData.officers.map((off: { id: string; name: string; role: string }) =>
              off.name === 'Bpk. H. Bambang Sudiro'
                ? { ...off, name: 'Bpk. Wagiman' }
                : off
            )
          : INITIAL_RT_PROFILE.officers;

        await updateDoc(profileRef, {
          chairpersonName: 'Bpk. Wagiman',
          officers: updatedOfficers,
        });
      }
    }
  } catch (err) {
    console.error('Failed to seed initial data:', err);
  }
};

/**
 * Real-time subscribers
 */
export const subscribeToProfile = (onUpdate: (profile: RTProfile) => void) => {
  const ref = doc(db, 'profile', PROFILE_DOC_ID);
  return onSnapshot(ref, (docSnap) => {
    if (docSnap.exists()) {
      onUpdate(docSnap.data() as RTProfile);
    }
  });
};

export const subscribeToSyncState = (onUpdate: (syncState: GoogleSyncState) => void) => {
  const ref = doc(db, 'syncState', SYNC_STATE_DOC_ID);
  return onSnapshot(ref, (docSnap) => {
    if (docSnap.exists()) {
      onUpdate(docSnap.data() as GoogleSyncState);
    }
  });
};

export const subscribeToResidents = (onUpdate: (residents: Resident[]) => void) => {
  const ref = collection(db, 'residents');
  return onSnapshot(ref, (snap) => {
    const list: Resident[] = [];
    snap.forEach((doc) => {
      list.push(doc.data() as Resident);
    });
    // Keep it ordered nicely or sort by houseNo
    list.sort((a, b) => a.houseNo.localeCompare(b.houseNo, undefined, { numeric: true }));
    onUpdate(list);
  });
};

export const subscribeToTransactions = (onUpdate: (transactions: CashTransaction[]) => void) => {
  const ref = collection(db, 'transactions');
  return onSnapshot(ref, (snap) => {
    const list: CashTransaction[] = [];
    snap.forEach((doc) => {
      list.push(doc.data() as CashTransaction);
    });
    // Sort transactions descending by date, then id
    list.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    onUpdate(list);
  });
};

export const subscribeToDebts = (onUpdate: (debts: DebtItem[]) => void) => {
  const ref = collection(db, 'debts');
  return onSnapshot(ref, (snap) => {
    const list: DebtItem[] = [];
    snap.forEach((doc) => {
      list.push(doc.data() as DebtItem);
    });
    list.sort((a, b) => b.date.localeCompare(a.date));
    onUpdate(list);
  });
};

/**
 * Mutator functions (saves single/multiple documents)
 */
export const saveProfile = async (profile: RTProfile) => {
  const ref = doc(db, 'profile', PROFILE_DOC_ID);
  await setDoc(ref, profile);
};

export const saveSyncState = async (syncState: GoogleSyncState) => {
  const ref = doc(db, 'syncState', SYNC_STATE_DOC_ID);
  await setDoc(ref, syncState);
};

export const saveResident = async (resident: Resident) => {
  const ref = doc(db, 'residents', resident.id);
  await setDoc(ref, resident);
};

export const saveResidentsBatch = async (residents: Resident[]) => {
  const batch = writeBatch(db);
  residents.forEach((r) => {
    const ref = doc(db, 'residents', r.id);
    batch.set(ref, r);
  });
  await batch.commit();
};

export const saveTransaction = async (tx: CashTransaction) => {
  const ref = doc(db, 'transactions', tx.id);
  await setDoc(ref, tx);
};

export const deleteTransaction = async (id: string) => {
  const ref = doc(db, 'transactions', id);
  await deleteDoc(ref);
};

export const saveDebt = async (debt: DebtItem) => {
  const ref = doc(db, 'debts', debt.id);
  await setDoc(ref, debt);
};

export const saveDebtsBatch = async (debts: DebtItem[]) => {
  const batch = writeBatch(db);
  debts.forEach((d) => {
    const ref = doc(db, 'debts', d.id);
    batch.set(ref, d);
  });
  await batch.commit();
};

/**
 * Complete Database Reset / Overwrite
 */
export const resetDatabaseToInitial = async () => {
  // Clear collections and re-seed
  const batch = writeBatch(db);

  // 1. Reset Profile
  const profileRef = doc(db, 'profile', PROFILE_DOC_ID);
  batch.set(profileRef, INITIAL_RT_PROFILE);

  // 2. Reset Sync State
  const syncRef = doc(db, 'syncState', SYNC_STATE_DOC_ID);
  batch.set(syncRef, {
    spreadsheetId: null,
    spreadsheetUrl: null,
    lastSyncedAt: null,
    syncInProgress: false,
  });

  // Since we cannot delete whole collections easily in client SDK without listing them,
  // we can get all current docs and delete them or write over them.
  const resSnap = await getDocs(collection(db, 'residents'));
  resSnap.forEach((doc) => {
    batch.delete(doc.ref);
  });

  const txSnap = await getDocs(collection(db, 'transactions'));
  txSnap.forEach((doc) => {
    batch.delete(doc.ref);
  });

  const debtSnap = await getDocs(collection(db, 'debts'));
  debtSnap.forEach((doc) => {
    batch.delete(doc.ref);
  });

  // Write initial data back
  INITIAL_RESIDENTS.forEach((r) => {
    const ref = doc(db, 'residents', r.id);
    batch.set(ref, r);
  });

  INITIAL_TRANSACTIONS.forEach((t) => {
    const ref = doc(db, 'transactions', t.id);
    batch.set(ref, t);
  });

  INITIAL_DEBTS.forEach((d) => {
    const ref = doc(db, 'debts', d.id);
    batch.set(ref, d);
  });

  await batch.commit();
};

/**
 * Bulk restore from JSON backup file
 */
export const restoreDatabaseFromBackup = async (
  restoredResidents: Resident[],
  restoredTransactions: CashTransaction[],
  restoredProfile: RTProfile
) => {
  const batch = writeBatch(db);

  // Delete current data first
  const resSnap = await getDocs(collection(db, 'residents'));
  resSnap.forEach((doc) => batch.delete(doc.ref));

  const txSnap = await getDocs(collection(db, 'transactions'));
  txSnap.forEach((doc) => batch.delete(doc.ref));

  // Write Profile
  const profileRef = doc(db, 'profile', PROFILE_DOC_ID);
  batch.set(profileRef, restoredProfile);

  // Write Residents
  restoredResidents.forEach((r) => {
    const ref = doc(db, 'residents', r.id);
    batch.set(ref, r);
  });

  // Write Transactions
  restoredTransactions.forEach((t) => {
    const ref = doc(db, 'transactions', t.id);
    batch.set(ref, t);
  });

  await batch.commit();
};
