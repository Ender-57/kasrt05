import { useState, useEffect, useCallback, useRef } from 'react';

const SESSION_KEY = 'rt_officer_session';
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

export interface OfficerSession {
  role: 'admin' | 'secretary';
  lastActivity: number;
}

export function useOfficerSession() {
  const [role, setRoleState] = useState<'admin' | 'secretary' | null>(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) return null;
      const parsed: OfficerSession = JSON.parse(stored);
      const elapsed = Date.now() - parsed.lastActivity;
      if (elapsed < INACTIVITY_TIMEOUT) {
        // Session is still valid on page load/refresh
        return parsed.role;
      } else {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  });

  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const throttleRef = useRef<number>(0);

  // Function to set role and start/persist session
  const loginAs = useCallback((newRole: 'admin' | 'secretary') => {
    const now = Date.now();
    lastActivityRef.current = now;
    const session: OfficerSession = { role: newRole, lastActivity: now };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      console.warn('Failed to save officer session to localStorage:', e);
    }
    setRoleState(newRole);
    setSessionExpiredNotice(false);
  }, []);

  // Function to explicitly logout
  const logout = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.warn('Failed to clear officer session:', e);
    }
    setRoleState(null);
  }, []);

  // Update last activity timestamp (throttled to avoid performance impact)
  const touchActivity = useCallback(() => {
    if (!role) return;
    const now = Date.now();
    lastActivityRef.current = now;

    // Throttle updating localStorage to at most once every 5 seconds
    if (now - throttleRef.current > 5000) {
      throttleRef.current = now;
      const session: OfficerSession = { role, lastActivity: now };
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch (e) {
        console.warn('Failed to refresh officer session in localStorage:', e);
      }
    }
  }, [role]);

  // Activity listeners & inactivity check timer
  useEffect(() => {
    if (!role) return;

    // Refresh activity on user interaction
    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart', 'pointerdown'];

    const handleUserActivity = () => {
      touchActivity();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Periodically check if 30 minutes of inactivity has passed
    const checkInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      if (elapsed >= INACTIVITY_TIMEOUT) {
        // Auto logout after 30 minutes of inactivity
        try {
          localStorage.removeItem(SESSION_KEY);
        } catch {
          // ignore
        }
        setRoleState(null);
        setSessionExpiredNotice(true);
      }
    }, 5000); // Check every 5 seconds

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
      clearInterval(checkInterval);
    };
  }, [role, touchActivity]);

  return {
    role,
    isAdmin: role === 'admin',
    isSecretary: role === 'secretary',
    loginAs,
    logout,
    sessionExpiredNotice,
    clearSessionExpiredNotice: () => setSessionExpiredNotice(false),
  };
}
