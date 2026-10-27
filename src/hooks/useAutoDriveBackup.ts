import { useState, useEffect, useCallback, useRef } from 'react';
import { RTProfile, Resident, CashTransaction, DebtItem, IncidentalDuesProgram } from '../types';
import { getAccessToken } from '../services/auth';
import {
  saveBackupJsonToDrive,
  BACKUP_DRIVE_FILENAME,
  DriveBackupResult,
} from '../services/googleDrive';
import { getTodayJakarta } from '../utils/formatters';

const STORAGE_KEY_LAST_TIME = 'rt05_drive_backup_last_time';
const STORAGE_KEY_LAST_DATE = 'rt05_drive_backup_last_date';
const STORAGE_KEY_FILE_URL = 'rt05_drive_backup_file_url';
const STORAGE_KEY_AUTO_ENABLED = 'rt05_drive_autobackup_enabled';
const STORAGE_KEY_OVERWRITTEN = 'rt05_drive_backup_overwritten';

interface UseAutoDriveBackupProps {
  profile: RTProfile;
  residents: Resident[];
  transactions: CashTransaction[];
  debts: DebtItem[];
  incidentalPrograms: IncidentalDuesProgram[];
  userEmail: string | null;
}

export function useAutoDriveBackup({
  profile,
  residents,
  transactions,
  debts,
  incidentalPrograms,
  userEmail,
}: UseAutoDriveBackupProps) {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_LAST_TIME) : null;
  });
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_LAST_DATE) : null;
  });
  const [lastFileUrl, setLastFileUrl] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_FILE_URL) : null;
  });
  const [lastOverwritten, setLastOverwritten] = useState<boolean>(() => {
    return typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY_OVERWRITTEN) === 'true'
      : false;
  });
  const [autoBackupEnabled, setAutoBackupEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(STORAGE_KEY_AUTO_ENABLED);
    return stored === null ? true : stored === 'true';
  });
  const [lastError, setLastError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<{
    message: string;
    fileUrl: string;
    isOverwritten: boolean;
  } | null>(null);

  // Keep references to latest data for scheduled execution
  const dataRef = useRef({
    profile,
    residents,
    transactions,
    debts,
    incidentalPrograms,
  });

  useEffect(() => {
    dataRef.current = {
      profile,
      residents,
      transactions,
      debts,
      incidentalPrograms,
    };
  }, [profile, residents, transactions, debts, incidentalPrograms]);

  const setAutoBackupEnabled = (val: boolean) => {
    setAutoBackupEnabledState(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_AUTO_ENABLED, String(val));
    }
  };

  const executeBackup = useCallback(
    async (isManual: boolean = false): Promise<DriveBackupResult | null> => {
      const token = getAccessToken();
      if (!token) {
        if (isManual) {
          setLastError(
            'Akun Google Drive belum terhubung atau token telah kedaluwarsa. Silakan klik "Hubungkan Google Drive".'
          );
        }
        return null;
      }

      setIsBackingUp(true);
      setLastError(null);

      try {
        const currentData = dataRef.current;
        const backupPayload = {
          appName: 'Buku Kas, Iuran & Program Kerja RT 05 / RW 08 Satriajaya',
          exportedAt: new Date().toISOString(),
          version: '2.0',
          backupMode: isManual ? 'manual_overwrite' : 'auto_daily_00_overwrite',
          fileName: BACKUP_DRIVE_FILENAME,
          data: {
            profile: currentData.profile,
            residents: currentData.residents,
            transactions: currentData.transactions,
            debts: currentData.debts,
            incidentalPrograms: currentData.incidentalPrograms,
          },
        };

        const result = await saveBackupJsonToDrive(
          token,
          backupPayload,
          BACKUP_DRIVE_FILENAME
        );

        const nowIso = new Date().toISOString();
        const todayStr = getTodayJakarta();

        setLastBackupTime(nowIso);
        setLastBackupDate(todayStr);
        setLastFileUrl(result.webViewLink);
        setLastOverwritten(result.overwritten);

        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_LAST_TIME, nowIso);
          localStorage.setItem(STORAGE_KEY_LAST_DATE, todayStr);
          localStorage.setItem(STORAGE_KEY_FILE_URL, result.webViewLink);
          localStorage.setItem(STORAGE_KEY_OVERWRITTEN, String(result.overwritten));
        }

        setSuccessToast({
          message: result.overwritten
            ? 'Cadangan JSON berhasil diperbarui & menimpa file lama di Google Drive tanpa duplikasi versi!'
            : 'File cadangan JSON baru berhasil dibuat di Google Drive!',
          fileUrl: result.webViewLink,
          isOverwritten: result.overwritten,
        });

        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal menyimpan cadangan ke Google Drive.';
        console.error('Drive Backup Error:', err);
        setLastError(msg);
        return null;
      } finally {
        setIsBackingUp(false);
      }
    },
    []
  );

  // Automatic Daily 00:00 Scheduler
  useEffect(() => {
    if (!autoBackupEnabled) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const scheduleNextMidnight = () => {
      const now = new Date();
      // Next midnight 00:00:00
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        0
      );
      const delayMs = Math.max(1000, nextMidnight.getTime() - now.getTime());

      timeoutId = setTimeout(async () => {
        const token = getAccessToken();
        if (token) {
          await executeBackup(false);
        }
        // Chain for the next midnight
        scheduleNextMidnight();
      }, delayMs);
    };

    // Heartbeat check every 60 seconds (catches resume from computer sleep or open tab)
    const checkMidnightPass = async () => {
      const todayStr = getTodayJakarta();
      const storedLastDate =
        typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_LAST_DATE) : null;
      const token = getAccessToken();

      // If today is a new day and backup has not run today yet, and user has token
      if (token && storedLastDate !== todayStr && !isBackingUp) {
        await executeBackup(false);
      }
    };

    scheduleNextMidnight();
    intervalId = setInterval(checkMidnightPass, 60000);

    // Initial check on mount
    checkMidnightPass();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoBackupEnabled, executeBackup, isBackingUp]);

  return {
    isBackingUp,
    lastBackupTime,
    lastBackupDate,
    lastFileUrl,
    lastOverwritten,
    autoBackupEnabled,
    setAutoBackupEnabled,
    lastError,
    successToast,
    clearSuccessToast: () => setSuccessToast(null),
    triggerManualBackup: () => executeBackup(true),
    fileName: BACKUP_DRIVE_FILENAME,
    isConnectedToGoogle: !!getAccessToken() || !!userEmail,
  };
}
