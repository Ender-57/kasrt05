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
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Resident,
  CashTransaction,
  RTProfile,
  DebtItem,
  GoogleSyncState,
  IncidentalDuesProgram,
} from '../types';
import {
  INITIAL_RESIDENTS,
  INITIAL_TRANSACTIONS,
  INITIAL_RT_PROFILE,
  INITIAL_DEBTS,
} from '../data/initialData';
import { resolveAdminPin, isSha256 } from '../utils/crypto';

// Initialize Firebase App safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Test Firestore connection on boot with graceful offline resilience
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('the client is offline') ||
        error.message.includes('offline') ||
        error.message.includes('suspended') ||
        error.message.includes('Permission denied'))
    ) {
      console.warn('Firestore notice: Application is running in resilient local-first mode.');
    }
  }
}
testConnection();

const PROFILE_DOC_ID = 'rt05_profile';
const SYNC_STATE_DOC_ID = 'rt05_sync';

// Local storage keys for resilient offline-first persistence
const STORAGE_KEYS = {
  PROFILE: 'rt05_local_profile',
  SYNC_STATE: 'rt05_local_sync_state',
  RESIDENTS: 'rt05_local_residents',
  TRANSACTIONS: 'rt05_local_transactions',
  DEBTS: 'rt05_local_debts',
  INCIDENTAL: 'rt05_local_incidental',
};

function getLocalData<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function setLocalData<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Could not cache to localStorage:', err);
  }
}

// Reactive listeners to sync state across the app immediately
const profileListeners = new Set<(profile: RTProfile) => void>();
const residentsListeners = new Set<(residents: Resident[]) => void>();
const transactionsListeners = new Set<(transactions: CashTransaction[]) => void>();
const debtsListeners = new Set<(debts: DebtItem[]) => void>();
const syncStateListeners = new Set<(syncState: GoogleSyncState) => void>();
const incidentalListeners = new Set<(programs: IncidentalDuesProgram[]) => void>();

function notifyProfile(profile: RTProfile) {
  profileListeners.forEach((fn) => fn(profile));
}

function notifyResidents(residents: Resident[]) {
  residentsListeners.forEach((fn) => fn(residents));
}

function notifyTransactions(txs: CashTransaction[]) {
  transactionsListeners.forEach((fn) => fn(txs));
}

function notifyDebts(debts: DebtItem[]) {
  debtsListeners.forEach((fn) => fn(debts));
}

function notifySyncState(syncState: GoogleSyncState) {
  syncStateListeners.forEach((fn) => fn(syncState));
}

function notifyIncidental(programs: IncidentalDuesProgram[]) {
  incidentalListeners.forEach((fn) => fn(programs));
}

/**
 * Helper to recursively remove undefined fields from data before saving to Firestore.
 */
export function sanitizeData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeData) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeData(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

const DATA_VERSION = 'v4_mutasi_rekening_lengkap_67_transaksi';
const DATA_VERSION_KEY = 'rt05_data_version';

/**
 * Initializes local storage cache with initial data if empty or outdated
 */
function initLocalStorageIfEmpty() {
  if (typeof window === 'undefined') return;

  const currentVersion = localStorage.getItem(DATA_VERSION_KEY);
  const isOutdated = currentVersion !== DATA_VERSION;

  if (!localStorage.getItem(STORAGE_KEYS.PROFILE)) {
    setLocalData(STORAGE_KEYS.PROFILE, INITIAL_RT_PROFILE);
    notifyProfile(INITIAL_RT_PROFILE);
  }
  if (!localStorage.getItem(STORAGE_KEYS.SYNC_STATE)) {
    setLocalData(STORAGE_KEYS.SYNC_STATE, {
      spreadsheetId: null,
      spreadsheetUrl: null,
      lastSyncedAt: null,
      syncInProgress: false,
    });
  }
  if (!localStorage.getItem(STORAGE_KEYS.RESIDENTS) || isOutdated) {
    setLocalData(STORAGE_KEYS.RESIDENTS, INITIAL_RESIDENTS);
    notifyResidents(INITIAL_RESIDENTS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || isOutdated) {
    setLocalData(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
    notifyTransactions(INITIAL_TRANSACTIONS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.DEBTS)) {
    setLocalData(STORAGE_KEYS.DEBTS, INITIAL_DEBTS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.INCIDENTAL)) {
    setLocalData(STORAGE_KEYS.INCIDENTAL, []);
  }

  if (isOutdated) {
    localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION);
  }
}

/**
 * Seeds Firestore collections if they are empty, with resilient fallback to local cache
 */
export const seedInitialDataIfEmpty = async () => {
  initLocalStorageIfEmpty();

  try {
    const profileRef = doc(db, 'profile', PROFILE_DOC_ID);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
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
    } else {
      // Profile exists: merge and preserve user's customized PINs, officers, and settings
      const currentProfileData = profileSnap.data() as Partial<RTProfile>;
      const currentPin = currentProfileData?.adminPin
        ? resolveAdminPin(currentProfileData.adminPin)
        : INITIAL_RT_PROFILE.adminPin;
      const currentSecPin = currentProfileData?.secretaryPin
        ? resolveAdminPin(currentProfileData.secretaryPin)
        : (INITIAL_RT_PROFILE.secretaryPin || '654321');

      const mergedProfile: RTProfile = {
        ...INITIAL_RT_PROFILE,
        ...currentProfileData,
        adminPin: currentPin,
        secretaryPin: currentSecPin,
        officers:
          currentProfileData?.officers && currentProfileData.officers.length > 0
            ? currentProfileData.officers
            : INITIAL_RT_PROFILE.officers,
        programKerjaList:
          currentProfileData?.programKerjaList && currentProfileData.programKerjaList.length > 0
            ? currentProfileData.programKerjaList
            : INITIAL_RT_PROFILE.programKerjaList,
      };

      await setDoc(profileRef, sanitizeData(mergedProfile), { merge: true });

      // Ensure debts collection in Firestore is initialized if empty
      const debtSnap = await getDocs(collection(db, 'debts'));
      if (debtSnap.empty) {
        const debtBatch = writeBatch(db);
        INITIAL_DEBTS.forEach((d) => {
          debtBatch.set(doc(db, 'debts', d.id), sanitizeData(d));
        });
        await debtBatch.commit();
      }

      // Ensure residents collection in Firestore contains all 34 residents from the latest data
      const resSnap = await getDocs(collection(db, 'residents'));
      if (resSnap.empty || resSnap.size < INITIAL_RESIDENTS.length) {
        const resBatch = writeBatch(db);
        INITIAL_RESIDENTS.forEach((r) => {
          resBatch.set(doc(db, 'residents', r.id), sanitizeData(r));
        });
        await resBatch.commit();
      }

      // Ensure transactions collection in Firestore matches the exact 67 transactions from mutasi rekening
      const txSnap = await getDocs(collection(db, 'transactions'));
      const existingTxIds = new Set(txSnap.docs.map((d) => d.id));
      const targetTxIds = new Set(INITIAL_TRANSACTIONS.map((t) => t.id));

      const needsSync =
        txSnap.size !== INITIAL_TRANSACTIONS.length ||
        INITIAL_TRANSACTIONS.some((t) => !existingTxIds.has(t.id));

      if (needsSync) {
        const txBatch = writeBatch(db);
        // Delete any old transactions not in INITIAL_TRANSACTIONS
        for (const docSnap of txSnap.docs) {
          if (!targetTxIds.has(docSnap.id)) {
            txBatch.delete(docSnap.ref);
          }
        }
        // Write all 67 transactions
        INITIAL_TRANSACTIONS.forEach((t) => {
          txBatch.set(doc(db, 'transactions', t.id), sanitizeData(t));
        });
        await txBatch.commit();
      }
    }
  } catch (err: unknown) {
    // Graceful offline fallback: log warning instead of throwing fatal console error
    console.warn(
      'Database seed note: operating with persistent local cache. Reason:',
      err instanceof Error ? err.message : String(err)
    );
  }
};

/**
 * Real-time subscribers with immediate local cache return + Firestore sync
 */
export const subscribeToProfile = (onUpdate: (profile: RTProfile) => void) => {
  // 1. Immediately provide local data
  const cached = getLocalData<RTProfile>(STORAGE_KEYS.PROFILE, INITIAL_RT_PROFILE);
  onUpdate(cached);

  profileListeners.add(onUpdate);

  // 2. Attach Firestore listener with error handler
  const ref = doc(db, 'profile', PROFILE_DOC_ID);
  const unsub = onSnapshot(
    ref,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as RTProfile;
        if (data.adminPin && (isSha256(data.adminPin) || data.adminPin.length > 10)) {
          const plainPin = resolveAdminPin(data.adminPin);
          data.adminPin = plainPin;
          updateDoc(ref, { adminPin: plainPin }).catch(() => {});
        }
        if (data.secretaryPin && (isSha256(data.secretaryPin) || data.secretaryPin.length > 10)) {
          const plainSecPin = resolveAdminPin(data.secretaryPin);
          data.secretaryPin = plainSecPin;
          updateDoc(ref, { secretaryPin: plainSecPin }).catch(() => {});
        }
        setLocalData(STORAGE_KEYS.PROFILE, data);
        notifyProfile(data);
      }
    },
    (error) => {
      console.warn('Profile subscription notice:', error.message);
    }
  );

  return () => {
    profileListeners.delete(onUpdate);
    unsub();
  };
};

export const subscribeToSyncState = (onUpdate: (syncState: GoogleSyncState) => void) => {
  const cached = getLocalData<GoogleSyncState>(STORAGE_KEYS.SYNC_STATE, {
    spreadsheetId: null,
    spreadsheetUrl: null,
    lastSyncedAt: null,
    syncInProgress: false,
  });
  onUpdate(cached);

  syncStateListeners.add(onUpdate);

  const ref = doc(db, 'syncState', SYNC_STATE_DOC_ID);
  const unsub = onSnapshot(
    ref,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as GoogleSyncState;
        setLocalData(STORAGE_KEYS.SYNC_STATE, data);
        notifySyncState(data);
      }
    },
    (error) => {
      console.warn('Sync state subscription notice:', error.message);
    }
  );

  return () => {
    syncStateListeners.delete(onUpdate);
    unsub();
  };
};

export const subscribeToResidents = (onUpdate: (residents: Resident[]) => void) => {
  const cached = getLocalData<Resident[]>(STORAGE_KEYS.RESIDENTS, INITIAL_RESIDENTS);
  cached.sort((a, b) => a.houseNo.localeCompare(b.houseNo, undefined, { numeric: true }));
  onUpdate(cached);

  residentsListeners.add(onUpdate);

  const ref = collection(db, 'residents');
  const unsub = onSnapshot(
    ref,
    (snap) => {
      if (!snap.empty) {
        const list: Resident[] = [];
        snap.forEach((d) => {
          list.push(d.data() as Resident);
        });
        list.sort((a, b) => a.houseNo.localeCompare(b.houseNo, undefined, { numeric: true }));
        setLocalData(STORAGE_KEYS.RESIDENTS, list);
        notifyResidents(list);
      }
    },
    (error) => {
      console.warn('Residents subscription notice:', error.message);
    }
  );

  return () => {
    residentsListeners.delete(onUpdate);
    unsub();
  };
};

export const subscribeToTransactions = (onUpdate: (transactions: CashTransaction[]) => void) => {
  const cached = getLocalData<CashTransaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
  cached.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  onUpdate(cached);

  transactionsListeners.add(onUpdate);

  const ref = collection(db, 'transactions');
  const unsub = onSnapshot(
    ref,
    (snap) => {
      if (!snap.empty) {
        const list: CashTransaction[] = [];
        snap.forEach((d) => {
          list.push(d.data() as CashTransaction);
        });
        list.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
        setLocalData(STORAGE_KEYS.TRANSACTIONS, list);
        notifyTransactions(list);
      }
    },
    (error) => {
      console.warn('Transactions subscription notice:', error.message);
    }
  );

  return () => {
    transactionsListeners.delete(onUpdate);
    unsub();
  };
};

export const subscribeToDebts = (onUpdate: (debts: DebtItem[]) => void) => {
  const cached = getLocalData<DebtItem[]>(STORAGE_KEYS.DEBTS, INITIAL_DEBTS);
  cached.sort((a, b) => b.date.localeCompare(a.date));
  onUpdate(cached);

  debtsListeners.add(onUpdate);

  const ref = collection(db, 'debts');
  const unsub = onSnapshot(
    ref,
    (snap) => {
      const list: DebtItem[] = [];
      snap.forEach((d) => {
        list.push(d.data() as DebtItem);
      });
      list.sort((a, b) => b.date.localeCompare(a.date));
      setLocalData(STORAGE_KEYS.DEBTS, list);
      notifyDebts(list);
    },
    (error) => {
      console.warn('Debts subscription notice:', error.message);
    }
  );

  return () => {
    debtsListeners.delete(onUpdate);
    unsub();
  };
};

export const subscribeToIncidentalDues = (onUpdate: (programs: IncidentalDuesProgram[]) => void) => {
  const cached = getLocalData<IncidentalDuesProgram[]>(STORAGE_KEYS.INCIDENTAL, []);
  cached.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  onUpdate(cached);

  incidentalListeners.add(onUpdate);

  const ref = collection(db, 'incidentalDues');
  const unsub = onSnapshot(
    ref,
    (snap) => {
      if (!snap.empty) {
        const list: IncidentalDuesProgram[] = [];
        snap.forEach((d) => {
          list.push(d.data() as IncidentalDuesProgram);
        });
        list.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
        setLocalData(STORAGE_KEYS.INCIDENTAL, list);
        notifyIncidental(list);
      }
    },
    (error) => {
      console.warn('Incidental dues subscription notice:', error.message);
    }
  );

  return () => {
    incidentalListeners.delete(onUpdate);
    unsub();
  };
};

/**
 * Mutator functions: Update local storage and dispatch to listeners immediately,
 * then sync to Firestore in background.
 */
export const saveProfile = async (profile: RTProfile) => {
  const cleanProfile: RTProfile = {
    ...profile,
    adminPin: resolveAdminPin(profile.adminPin),
    secretaryPin: profile.secretaryPin ? resolveAdminPin(profile.secretaryPin) : '654321',
  };

  setLocalData(STORAGE_KEYS.PROFILE, cleanProfile);
  notifyProfile(cleanProfile);

  try {
    const ref = doc(db, 'profile', PROFILE_DOC_ID);
    await setDoc(ref, sanitizeData(cleanProfile));
  } catch (err) {
    console.warn('Firestore profile save note:', err);
  }
};

export const saveSyncState = async (syncState: GoogleSyncState) => {
  setLocalData(STORAGE_KEYS.SYNC_STATE, syncState);
  notifySyncState(syncState);

  try {
    const ref = doc(db, 'syncState', SYNC_STATE_DOC_ID);
    await setDoc(ref, sanitizeData(syncState));
  } catch (err) {
    console.warn('Firestore sync state save note:', err);
  }
};

export const saveResident = async (resident: Resident) => {
  const current = getLocalData<Resident[]>(STORAGE_KEYS.RESIDENTS, INITIAL_RESIDENTS);
  const idx = current.findIndex((r) => r.id === resident.id);
  const updated = [...current];
  if (idx >= 0) {
    updated[idx] = resident;
  } else {
    updated.push(resident);
  }
  updated.sort((a, b) => a.houseNo.localeCompare(b.houseNo, undefined, { numeric: true }));

  setLocalData(STORAGE_KEYS.RESIDENTS, updated);
  notifyResidents(updated);

  try {
    const ref = doc(db, 'residents', resident.id);
    await setDoc(ref, sanitizeData(resident));
  } catch (err) {
    console.warn('Firestore resident save note:', err);
  }
};

export const deleteResident = async (id: string) => {
  const current = getLocalData<Resident[]>(STORAGE_KEYS.RESIDENTS, INITIAL_RESIDENTS);
  const updated = current.filter((r) => r.id !== id);

  setLocalData(STORAGE_KEYS.RESIDENTS, updated);
  notifyResidents(updated);

  try {
    const ref = doc(db, 'residents', id);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('Firestore resident delete note:', err);
  }
};

export const saveResidentsBatch = async (newResidents: Resident[]) => {
  const sorted = [...newResidents].sort((a, b) =>
    a.houseNo.localeCompare(b.houseNo, undefined, { numeric: true })
  );
  setLocalData(STORAGE_KEYS.RESIDENTS, sorted);
  notifyResidents(sorted);

  try {
    const resSnap = await getDocs(collection(db, 'residents'));
    const targetIds = new Set(newResidents.map((r) => r.id));
    const batch = writeBatch(db);

    // Delete any residents from Firestore that are no longer in newResidents
    resSnap.forEach((docSnap) => {
      if (!targetIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
      }
    });

    newResidents.forEach((r) => {
      const ref = doc(db, 'residents', r.id);
      batch.set(ref, sanitizeData(r));
    });
    await batch.commit();
  } catch (err) {
    console.warn('Firestore residents batch save note:', err);
  }
};

export const saveTransaction = async (tx: CashTransaction) => {
  const current = getLocalData<CashTransaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
  const idx = current.findIndex((t) => t.id === tx.id);
  const updated = [...current];
  if (idx >= 0) {
    updated[idx] = tx;
  } else {
    updated.unshift(tx);
  }
  updated.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  setLocalData(STORAGE_KEYS.TRANSACTIONS, updated);
  notifyTransactions(updated);

  try {
    const ref = doc(db, 'transactions', tx.id);
    await setDoc(ref, sanitizeData(tx));
  } catch (err) {
    console.warn('Firestore transaction save note:', err);
  }
};

export const deleteTransaction = async (id: string) => {
  const current = getLocalData<CashTransaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
  const updated = current.filter((t) => t.id !== id);

  setLocalData(STORAGE_KEYS.TRANSACTIONS, updated);
  notifyTransactions(updated);

  try {
    const ref = doc(db, 'transactions', id);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('Firestore transaction delete note:', err);
  }
};

export const saveDebt = async (debt: DebtItem) => {
  const current = getLocalData<DebtItem[]>(STORAGE_KEYS.DEBTS, INITIAL_DEBTS);
  const idx = current.findIndex((d) => d.id === debt.id);
  const updated = [...current];
  if (idx >= 0) {
    updated[idx] = debt;
  } else {
    updated.unshift(debt);
  }
  updated.sort((a, b) => b.date.localeCompare(a.date));

  setLocalData(STORAGE_KEYS.DEBTS, updated);
  notifyDebts(updated);

  try {
    const ref = doc(db, 'debts', debt.id);
    await setDoc(ref, sanitizeData(debt));
  } catch (err) {
    console.warn('Firestore debt save note:', err);
  }
};

export const deleteDebt = async (id: string) => {
  const current = getLocalData<DebtItem[]>(STORAGE_KEYS.DEBTS, INITIAL_DEBTS);
  const updated = current.filter((d) => d.id !== id);

  setLocalData(STORAGE_KEYS.DEBTS, updated);
  notifyDebts(updated);

  try {
    const ref = doc(db, 'debts', id);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('Firestore debt delete note:', err);
  }
};

export const saveDebtsBatch = async (debts: DebtItem[]) => {
  const sorted = [...debts].sort((a, b) => b.date.localeCompare(a.date));
  setLocalData(STORAGE_KEYS.DEBTS, sorted);
  notifyDebts(sorted);

  try {
    const debtSnap = await getDocs(collection(db, 'debts'));
    const targetIds = new Set(debts.map((d) => d.id));
    const batch = writeBatch(db);

    // Delete any debts from Firestore that were deleted in UI
    debtSnap.forEach((docSnap) => {
      if (!targetIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
      }
    });

    // Save/update all debts
    debts.forEach((d) => {
      const ref = doc(db, 'debts', d.id);
      batch.set(ref, sanitizeData(d));
    });

    await batch.commit();
  } catch (err) {
    console.warn('Firestore debts batch save note:', err);
  }
};

export const saveIncidentalDuesProgram = async (program: IncidentalDuesProgram) => {
  const current = getLocalData<IncidentalDuesProgram[]>(STORAGE_KEYS.INCIDENTAL, []);
  const idx = current.findIndex((p) => p.id === program.id);
  const updated = [...current];
  if (idx >= 0) {
    updated[idx] = program;
  } else {
    updated.unshift(program);
  }
  updated.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  setLocalData(STORAGE_KEYS.INCIDENTAL, updated);
  notifyIncidental(updated);

  try {
    const ref = doc(db, 'incidentalDues', program.id);
    await setDoc(ref, sanitizeData(program));
  } catch (err) {
    console.warn('Firestore incidental dues save note:', err);
  }
};

export const deleteIncidentalDuesProgram = async (id: string) => {
  const current = getLocalData<IncidentalDuesProgram[]>(STORAGE_KEYS.INCIDENTAL, []);
  const updated = current.filter((p) => p.id !== id);

  setLocalData(STORAGE_KEYS.INCIDENTAL, updated);
  notifyIncidental(updated);

  try {
    const ref = doc(db, 'incidentalDues', id);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('Firestore incidental dues delete note:', err);
  }
};

/**
 * Complete Database Reset / Overwrite
 */
export const resetDatabaseToInitial = async () => {
  setLocalData(STORAGE_KEYS.PROFILE, INITIAL_RT_PROFILE);
  setLocalData(STORAGE_KEYS.SYNC_STATE, {
    spreadsheetId: null,
    spreadsheetUrl: null,
    lastSyncedAt: null,
    syncInProgress: false,
  });
  setLocalData(STORAGE_KEYS.RESIDENTS, INITIAL_RESIDENTS);
  setLocalData(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
  setLocalData(STORAGE_KEYS.DEBTS, INITIAL_DEBTS);
  setLocalData(STORAGE_KEYS.INCIDENTAL, []);

  notifyProfile(INITIAL_RT_PROFILE);
  notifyResidents(INITIAL_RESIDENTS);
  notifyTransactions(INITIAL_TRANSACTIONS);
  notifyDebts(INITIAL_DEBTS);
  notifyIncidental([]);

  try {
    const batch = writeBatch(db);
    const profileRef = doc(db, 'profile', PROFILE_DOC_ID);
    batch.set(profileRef, INITIAL_RT_PROFILE);

    const syncRef = doc(db, 'syncState', SYNC_STATE_DOC_ID);
    batch.set(syncRef, {
      spreadsheetId: null,
      spreadsheetUrl: null,
      lastSyncedAt: null,
      syncInProgress: false,
    });

    const resSnap = await getDocs(collection(db, 'residents'));
    resSnap.forEach((d) => batch.delete(d.ref));

    const txSnap = await getDocs(collection(db, 'transactions'));
    txSnap.forEach((d) => batch.delete(d.ref));

    const debtSnap = await getDocs(collection(db, 'debts'));
    debtSnap.forEach((d) => batch.delete(d.ref));

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
  } catch (err) {
    console.warn('Firestore database reset note:', err);
  }
};

/**
 * Bulk restore from JSON backup file
 */
export const restoreDatabaseFromBackup = async (
  restoredResidents: Resident[],
  restoredTransactions: CashTransaction[],
  restoredProfile: RTProfile
) => {
  setLocalData(STORAGE_KEYS.PROFILE, restoredProfile);
  setLocalData(STORAGE_KEYS.RESIDENTS, restoredResidents);
  setLocalData(STORAGE_KEYS.TRANSACTIONS, restoredTransactions);

  notifyProfile(restoredProfile);
  notifyResidents(restoredResidents);
  notifyTransactions(restoredTransactions);

  try {
    const batch = writeBatch(db);

    const resSnap = await getDocs(collection(db, 'residents'));
    resSnap.forEach((d) => batch.delete(d.ref));

    const txSnap = await getDocs(collection(db, 'transactions'));
    txSnap.forEach((d) => batch.delete(d.ref));

    const profileRef = doc(db, 'profile', PROFILE_DOC_ID);
    batch.set(profileRef, restoredProfile);

    restoredResidents.forEach((r) => {
      const ref = doc(db, 'residents', r.id);
      batch.set(ref, r);
    });

    restoredTransactions.forEach((t) => {
      const ref = doc(db, 'transactions', t.id);
      batch.set(ref, t);
    });

    await batch.commit();
  } catch (err) {
    console.warn('Firestore database restore note:', err);
  }
};
