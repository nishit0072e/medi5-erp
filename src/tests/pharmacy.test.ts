import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getInitialSeedState, 
  loadDemoInventory, 
  saveDemoInventory, 
  updatePharmacyProfile, 
  switchPharmacyTenant, 
  createPharmacyTenant, 
  addPharmacyStaffMember, 
  removePharmacyStaffMember,
  InventoryState
} from '../data/demoRepository';

class MockStorage {
  private store: Record<string, string> = {};
  get length() { return Object.keys(this.store).length; }
  clear() { this.store = {}; }
  getItem(key: string) { return this.store[key] ?? null; }
  key(index: number) { return Object.keys(this.store)[index] ?? null; }
  removeItem(key: string) { delete this.store[key]; }
  setItem(key: string, value: string) { this.store[key] = String(value); }
}

if (typeof window === 'undefined') {
  (globalThis as any).window = globalThis;
  (globalThis as any).localStorage = new MockStorage();
}

describe('Phase 2: Multi-Tenant Pharmacy Profile & RBAC Settings', () => {
  let initialState: InventoryState;

  beforeEach(() => {
    window.localStorage.clear();
    initialState = getInitialSeedState();
  });

  it('initializes with default multi-tenant pharmacies and active pharmacy context', () => {
    expect(initialState.pharmacies.length).toBeGreaterThanOrEqual(2);
    expect(initialState.activePharmacyId).toBeDefined();

    const activePharm = initialState.pharmacies.find((p) => p.id === initialState.activePharmacyId);
    expect(activePharm).toBeDefined();
    expect(activePharm?.name).toBe('Nandan Pharmacy');
    expect(activePharm?.drugLicenseNumber).toBe('WB-KOL-20B-184920');
    expect(activePharm?.members.some((m) => m.role === 'OWNER')).toBe(true);
  });

  it('switches active pharmacy tenant context safely', () => {
    const targetId = 'pharm-deshbandhu-siliguri';
    const nextState = switchPharmacyTenant(initialState, targetId);

    expect(nextState.activePharmacyId).toBe(targetId);
    const active = nextState.pharmacies.find((p) => p.id === nextState.activePharmacyId);
    expect(active?.name).toBe('Deshbandhu Medical Hall');
    expect(active?.city).toBe('Siliguri');
  });

  it('rejects switching to a non-existent pharmacy tenant', () => {
    expect(() => {
      switchPharmacyTenant(initialState, 'pharm-ghost-999');
    }).toThrow(/does not exist/);
  });

  it('updates pharmacy profile legal details, DL number, and operational thresholds', () => {
    const activeId = initialState.activePharmacyId;
    const nextState = updatePharmacyProfile(initialState, activeId, {
      name: 'Nandan Pharmacy & Clinic',
      legalName: 'Nandan Healthcare Enterprises Pvt. Ltd.',
      drugLicenseNumber: 'WB-KOL-20B-999888',
      gstin: '19AABCN9999P1Z9',
      addressLine1: '200 Southern Avenue',
      city: 'Kolkata',
      state: 'West Bengal',
      pincode: '700029',
      phone: '+91 98300 99999',
      email: 'admin@nandanhealthcare.in',
      expiryThresholdDays: 90,
      lowStockThresholdDefault: 25
    });

    const updated = nextState.pharmacies.find((p) => p.id === activeId);
    expect(updated).toBeDefined();
    expect(updated?.name).toBe('Nandan Pharmacy & Clinic');
    expect(updated?.drugLicenseNumber).toBe('WB-KOL-20B-999888');
    expect(updated?.gstin).toBe('19AABCN9999P1Z9');
    expect(updated?.expiryThresholdDays).toBe(90);
    expect(updated?.lowStockThresholdDefault).toBe(25);
  });

  it('validates mandatory profile fields on update', () => {
    const activeId = initialState.activePharmacyId;
    expect(() => {
      updatePharmacyProfile(initialState, activeId, {
        name: '', // Empty name rejected
        legalName: 'Test',
        drugLicenseNumber: 'WB-123',
        addressLine1: 'Test St',
        city: 'Kolkata',
        state: 'WB',
        pincode: '700001',
        phone: '9830000000',
        email: 'test@test.com',
        expiryThresholdDays: 60,
        lowStockThresholdDefault: 10
      });
    }).toThrow(/cannot be empty/);
  });

  it('creates and registers a new pharmacy tenant with an active owner', () => {
    const nextState = createPharmacyTenant(initialState, {
      name: 'Anandamoyee Pharmacy',
      legalName: 'Anandamoyee Retail Medicine LLP',
      drugLicenseNumber: 'WB-HOW-20B-555666',
      gstin: '19AABCA5555P1Z1',
      addressLine1: '54 Grand Trunk Road',
      city: 'Howrah',
      state: 'West Bengal',
      pincode: '711101',
      phone: '+91 98311 22334',
      email: 'anandamoyee@pharmacy.in',
      expiryThresholdDays: 60,
      lowStockThresholdDefault: 15,
      ownerName: 'Dipankar Sen',
      ownerPhone: '+91 98311 22334',
      ownerEmail: 'dipankar@anandamoyee.in'
    });

    expect(nextState.pharmacies.length).toBe(initialState.pharmacies.length + 1);
    expect(nextState.activePharmacyId).toBeDefined();

    const created = nextState.pharmacies.find((p) => p.id === nextState.activePharmacyId);
    expect(created).toBeDefined();
    expect(created?.name).toBe('Anandamoyee Pharmacy');
    expect(created?.city).toBe('Howrah');
    expect(created?.members).toHaveLength(1);
    expect(created?.members[0].role).toBe('OWNER');
    expect(created?.members[0].name).toBe('Dipankar Sen');
  });

  it('adds and manages authorized staff members across roles', () => {
    const activeId = initialState.activePharmacyId;
    const nextState = addPharmacyStaffMember(initialState, activeId, {
      name: 'Kaushik Roy',
      email: 'kaushik@nandanpharmacy.in',
      phone: '+91 98309 88877',
      role: 'STAFF'
    });

    const active = nextState.pharmacies.find((p) => p.id === activeId);
    const added = active?.members.find((m) => m.name === 'Kaushik Roy');
    expect(added).toBeDefined();
    expect(added?.role).toBe('STAFF');
    expect(added?.status).toBe('ACTIVE');
  });

  it('enforces last-active-owner security invariant when removing members', () => {
    const activeId = initialState.activePharmacyId;
    const pharmacy = initialState.pharmacies.find((p) => p.id === activeId)!;
    const ownerMember = pharmacy.members.find((m) => m.role === 'OWNER')!;

    // Attempting to remove the sole active owner must be strictly rejected
    expect(() => {
      removePharmacyStaffMember(initialState, activeId, ownerMember.id);
    }).toThrow(/Tenancy security violation: A pharmacy must retain at least one active OWNER/);

    // Adding a second owner allows the first owner to be safely removed
    const withSecondOwner = addPharmacyStaffMember(initialState, activeId, {
      name: 'Second Owner',
      email: 'owner2@nandan.in',
      phone: '+91 98300 00001',
      role: 'OWNER'
    });

    const afterRemoval = removePharmacyStaffMember(withSecondOwner, activeId, ownerMember.id);
    const activeAfter = afterRemoval.pharmacies.find((p) => p.id === activeId);
    expect(activeAfter?.members.some((m) => m.id === ownerMember.id)).toBe(false);
    expect(activeAfter?.members.some((m) => m.role === 'OWNER')).toBe(true);
  });

  it('persists and reloads multi-tenant pharmacy profiles from localStorage', () => {
    const activeId = initialState.activePharmacyId;
    const modifiedState = updatePharmacyProfile(initialState, activeId, {
      ...initialState.pharmacies[0],
      name: 'Nandan Super Pharmacy'
    });

    const saveOk = saveDemoInventory(modifiedState);
    expect(saveOk).toBe(true);

    const reloaded = loadDemoInventory();
    expect(reloaded.pharmacies.length).toBe(modifiedState.pharmacies.length);
    const reloadedActive = reloaded.pharmacies.find((p) => p.id === activeId);
    expect(reloadedActive?.name).toBe('Nandan Super Pharmacy');
  });
});
