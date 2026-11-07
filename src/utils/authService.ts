/**
 * Client Authentication & Session Management Service
 * 
 * Supports:
 * 1. Super Admin platform authentication (for platform monitoring, retail sales oversight, and usage billing).
 * 2. Pharmacy tenant staff/owner authentication (with strict tenant isolation — no tenant sees other tenants).
 * 3. Dynamic User ID & Password generation, provisioning, and persistence for store owners and staff.
 * 4. Client session persistence and token validation.
 */

import { AuthSession } from '../types/pharmacy';
import { MOCK_CREDENTIALS, MockCredential } from '../data/mockPharmacies';

export const AUTH_SESSION_KEY = 'medi5_auth_session_v1';
export const CREDENTIALS_STORAGE_KEY = 'medi5_credentials_registry_v1';

/**
 * Generates a clean, readable, secure temporary password (e.g. Medi5@7412).
 */
export function generateSecurePassword(prefix = 'Medi5@'): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${num}`;
}

/**
 * Retrieves all registered credentials, merging dynamic browser registrations with defaults.
 */
export function getRegisteredCredentials(): MockCredential[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [...MOCK_CREDENTIALS];
  }
  try {
    const raw = window.localStorage.getItem(CREDENTIALS_STORAGE_KEY);
    if (!raw) {
      return [...MOCK_CREDENTIALS];
    }
    const stored = JSON.parse(raw) as MockCredential[];
    if (Array.isArray(stored)) {
      const storedEmails = new Set(stored.map((c) => c.email.toLowerCase()));
      const defaults = MOCK_CREDENTIALS.filter((c) => !storedEmails.has(c.email.toLowerCase()));
      return [...stored, ...defaults];
    }
  } catch (err) {
    console.error('Failed to load registered credentials from storage:', err);
  }
  return [...MOCK_CREDENTIALS];
}

/**
 * Registers or updates user credentials in local registry storage.
 */
export function registerUserCredential(credential: MockCredential): void {
  const currentList = getRegisteredCredentials();
  const cleanEmail = credential.email.trim().toLowerCase();
  const updatedCred: MockCredential = {
    ...credential,
    email: cleanEmail
  };

  const existingIdx = currentList.findIndex((c) => c.email.toLowerCase() === cleanEmail);
  let nextList: MockCredential[];
  if (existingIdx >= 0) {
    nextList = [...currentList];
    nextList[existingIdx] = updatedCred;
  } else {
    nextList = [updatedCred, ...currentList];
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(nextList));
    } catch (err) {
      console.error('Failed to save user credentials:', err);
    }
  }
}

/**
 * Removes a user's credential from local registry storage (e.g. on staff member removal).
 */
export function removeUserCredential(email: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const currentList = getRegisteredCredentials();
    const cleanEmail = email.trim().toLowerCase();
    const nextList = currentList.filter((c) => c.email.toLowerCase() !== cleanEmail);
    window.localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(nextList));
  } catch (err) {
    console.error('Failed to remove user credential:', err);
  }
}

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

  const credentials = getRegisteredCredentials();
  const match = credentials.find(
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
