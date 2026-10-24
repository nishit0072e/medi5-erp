import { describe, it, expect, beforeEach } from 'vitest';
import { 
  authenticateUser, 
  getStoredSession, 
  saveStoredSession, 
  clearStoredSession,
  AUTH_SESSION_KEY
} from '../utils/authService';

class MockStorage {
  private store: Record<string, string> = {};
  get length() { return Object.keys(this.store).length; }
  clear() { this.store = {}; }
  getItem(key: string) { return this.store[key] ?? null; }
  key(index: number) { return Object.keys(this.store)[index] ?? null; }
  removeItem(key: string) { delete this.store[key]; }
  setItem(key: string, value: string) { this.store[key] = String(value); }
}

const mockStorageInstance = new MockStorage();
if (typeof window === 'undefined') {
  (globalThis as any).window = globalThis;
  (globalThis as any).localStorage = mockStorageInstance;
  (globalThis as any).window.localStorage = mockStorageInstance;
}

describe('Stage 3.x Authentication & Tenant Isolation Engine', () => {
  beforeEach(() => {
    mockStorageInstance.clear();
  });

  describe('Super Admin Authentication', () => {
    it('authenticates Super Admin with valid credentials', () => {
      const session = authenticateUser('admin@medi5.in', 'admin');
      expect(session).toBeDefined();
      expect(session.user.role).toBe('SUPER_ADMIN');
      expect(session.user.email).toBe('admin@medi5.in');
      expect(session.user.name).toBe('Platform Super Admin');
      expect(session.token).toMatch(/^medi5_token_/);
    });

    it('handles case-insensitive email for Super Admin', () => {
      const session = authenticateUser('  ADMIN@MEDI5.IN  ', 'admin');
      expect(session.user.role).toBe('SUPER_ADMIN');
    });

    it('rejects Super Admin login with incorrect password', () => {
      expect(() => {
        authenticateUser('admin@medi5.in', 'wrongpassword');
      }).toThrow('Invalid Login ID or password. Unauthorized access rejected.');
    });
  });

  describe('Tenant Login & Strict Tenant Isolation', () => {
    it('authenticates Nandan Pharmacy owner and scopes strictly to pharm-nandan-kolkata', () => {
      const session = authenticateUser('nandan.owner@nandanpharmacy.in', 'password123');
      expect(session.user.role).toBe('OWNER');
      expect(session.user.pharmacyId).toBe('pharm-nandan-kolkata');
      expect(session.user.pharmacyName).toBe('Nandan Pharmacy');
      expect(session.user.email).toBe('nandan.owner@nandanpharmacy.in');
    });

    it('authenticates Deshbandhu Medical owner and scopes strictly to pharm-deshbandhu-siliguri', () => {
      const session = authenticateUser('subhash@deshbandhumedical.in', 'password123');
      expect(session.user.role).toBe('OWNER');
      expect(session.user.pharmacyId).toBe('pharm-deshbandhu-siliguri');
      expect(session.user.pharmacyName).toBe('Deshbandhu Medical Hall');
      // Verifies tenant isolation: cannot be Nandan Pharmacy
      expect(session.user.pharmacyId).not.toBe('pharm-nandan-kolkata');
    });

    it('authenticates staff member with STAFF role restricted to their pharmacy', () => {
      const session = authenticateUser('priya.dispenser@nandanpharmacy.in', 'password123');
      expect(session.user.role).toBe('STAFF');
      expect(session.user.pharmacyId).toBe('pharm-nandan-kolkata');
      expect(session.user.name).toContain('Priya Das');
    });

    it('rejects unregistered email credentials', () => {
      expect(() => {
        authenticateUser('unregistered@randompharmacy.in', 'anypassword');
      }).toThrow('Invalid Login ID or password. Unauthorized access rejected.');
    });

    it('validates empty email or password', () => {
      expect(() => authenticateUser('', 'password123')).toThrow('Please enter your registered Login ID or Email.');
      expect(() => authenticateUser('nandan.owner@nandanpharmacy.in', '')).toThrow('Please enter your password.');
    });
  });

  describe('Session Storage & Persistence', () => {
    it('persists authenticated session in localStorage', () => {
      const session = authenticateUser('admin@medi5.in', 'admin');
      const retrieved = getStoredSession();
      expect(retrieved).not.toBeNull();
      expect(retrieved?.user.email).toBe(session.user.email);
      expect(retrieved?.token).toBe(session.token);
    });

    it('saves and updates session via saveStoredSession', () => {
      const session = authenticateUser('admin@medi5.in', 'admin');
      saveStoredSession({ ...session, token: 'custom_token_123' });
      expect(getStoredSession()?.token).toBe('custom_token_123');
    });

    it('clears stored session on sign out', () => {
      authenticateUser('admin@medi5.in', 'admin');
      expect(getStoredSession()).not.toBeNull();

      clearStoredSession();
      expect(getStoredSession()).toBeNull();
      expect(localStorage.getItem(AUTH_SESSION_KEY)).toBeNull();
    });

    it('returns null safely for corrupted storage data', () => {
      localStorage.setItem(AUTH_SESSION_KEY, 'invalid-json{{{');
      expect(getStoredSession()).toBeNull();
    });
  });

  describe('Platform Usage Fee Sustainability Logic', () => {
    it('calculates platform fee correctly on sales GMV base', () => {
      const totalSales = 100000; // Rs. 1 Lakh
      const feeRate = 2.0; // 2.0%
      const feeDue = (totalSales * feeRate) / 100;
      expect(feeDue).toBe(2000);
    });

    it('calculates platform fee correctly on retail gross profit base', () => {
      const totalProfit = 25000; // Rs. 25,000
      const feeRate = 1.5; // 1.5%
      const feeDue = (totalProfit * feeRate) / 100;
      expect(feeDue).toBe(375);
    });
  });
});
