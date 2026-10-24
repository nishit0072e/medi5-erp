/**
 * Client Authentication & Session Management Service
 * 
 * Supports:
 * 1. Super Admin platform authentication (for platform monitoring, retail sales oversight, and usage billing).
 * 2. Pharmacy tenant staff/owner authentication (with strict tenant isolation — no tenant sees other tenants).
 * 3. Client session persistence and token validation.
 */

import { AuthSession } from '../types/pharmacy';
import { MOCK_CREDENTIALS } from '../data/mockPharmacies';

export const AUTH_SESSION_KEY = 'medi5_auth_session_v1';

/**
 * Validates login credentials and creates an authenticated session.
 * Throws explicit error on invalid ID or password.
 */
export function authenticateUser(loginId: string, password: string): AuthSession {
  const cleanId = loginId.trim().toLowerCase();
  const cleanPw = password.trim();

  if (!cleanId) {
    throw new Error('Please enter your registered Login ID or Email.');
  }
  if (!cleanPw) {
    throw new Error('Please enter your password.');
  }

  const match = MOCK_CREDENTIALS.find(
    (c) => c.email.toLowerCase() === cleanId && c.password === cleanPw
  );

  if (!match) {
    throw new Error('Invalid Login ID or password. Unauthorized access rejected.');
  }

  const session: AuthSession = {
    user: {
      id: `usr-${match.email.replace(/[^a-z0-9]/g, '')}`,
      email: match.email,
      name: match.name,
      role: match.role,
      pharmacyId: match.pharmacyId,
      pharmacyName: match.pharmacyName
    },
    token: `medi5_token_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  };

  saveStoredSession(session);
  return session;
}

/**
 * Loads stored authentication session from localStorage.
 */
export function getStoredSession(): AuthSession | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (parsed && parsed.user && parsed.user.role && parsed.token) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Saves authenticated session into localStorage.
 */
export function saveStoredSession(session: AuthSession): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.error('Failed to save auth session:', err);
  }
}

/**
 * Purges authentication session from localStorage.
 */
export function clearStoredSession(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // ignore
  }
}
