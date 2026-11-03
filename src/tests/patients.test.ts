import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getInitialSeedState, 
  loadDemoInventory, 
  saveDemoInventory, 
  getTenantInventory,
  createPatient, 
  updatePatient, 
  deletePatient, 
  addPatientMedication, 
  deletePatientMedication, 
  recordWhatsAppReminderSent, 
  markRefillDispensed,
  snoozeRefill,
  cancelRefill,
  completeRefill,
  reactivateRefill,
  createPrescription,
  updatePrescription,
  deletePrescription,
  linkSaleToPatient
} from '../data/demoRepository';
import { 
  formatWhatsAppPhoneNumber, 
  isValidIndianMobile, 
  calculateRefillDueDate, 
  getRefillUrgency, 
  generateRefillReminderMessage, 
  buildWhatsAppLink 
} from '../utils/whatsappUtils';
import { CreatePatientInput } from '../types/patient';

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

describe('Phase 3: Patients & WhatsApp Refill Reminders Module', () => {
  beforeEach(() => {
    mockStorageInstance.clear();
  });

  describe('WhatsApp & Date Utilities', () => {
    it('normalizes Indian phone numbers to WhatsApp international format', () => {
      expect(formatWhatsAppPhoneNumber('9830112345')).toBe('919830112345');
      expect(formatWhatsAppPhoneNumber('+91 98301-12345')).toBe('919830112345');
      expect(formatWhatsAppPhoneNumber('09830112345')).toBe('919830112345');
    });

    it('validates 10-digit Indian mobile numbers starting with 6-9', () => {
      expect(isValidIndianMobile('9830112345')).toBe(true);
      expect(isValidIndianMobile('8765432109')).toBe(true);
      expect(isValidIndianMobile('7000000000')).toBe(true);
      expect(isValidIndianMobile('6123456789')).toBe(true);
      // Invalid numbers
      expect(isValidIndianMobile('1234567890')).toBe(false); // starts with 1
      expect(isValidIndianMobile('98301')).toBe(false); // too short
      expect(isValidIndianMobile('983011234567')).toBe(false); // too long
    });

    it('calculates next refill due date from last dispensed date and days supply', () => {
      expect(calculateRefillDueDate('2026-10-01', 30)).toBe('2026-10-31');
      expect(calculateRefillDueDate('2026-10-15', 10)).toBe('2026-10-25');
      expect(calculateRefillDueDate('2026-10-31', 1)).toBe('2026-11-01');
    });

    it('evaluates refill urgency status relative to reference date', () => {
      const today = '2026-11-02';
      // Due today
      const dueToday = getRefillUrgency('2026-11-02', today);
      expect(dueToday.status).toBe('DUE_TODAY');
      expect(dueToday.diffDays).toBe(0);

      // Overdue
      const overdue = getRefillUrgency('2026-10-30', today);
      expect(overdue.status).toBe('OVERDUE');
      expect(overdue.diffDays).toBe(-3);
      expect(overdue.label).toBe('3 days overdue');

      // Upcoming in 5 days
      const upcoming = getRefillUrgency('2026-11-07', today);
      expect(upcoming.status).toBe('UPCOMING');
      expect(upcoming.diffDays).toBe(5);
      expect(upcoming.label).toBe('Due in 5 days');
    });

    it('constructs correct WhatsApp click-to-chat URL with encoded text', () => {
      const url = buildWhatsAppLink('9830112345', 'Namaskar Ramesh Chandra Das');
      expect(url).toContain('https://wa.me/919830112345?text=');
      expect(url).toContain(encodeURIComponent('Namaskar Ramesh Chandra Das'));
    });

    it('generates personalized refill reminder message with pharmacy branding', () => {
      const message = generateRefillReminderMessage({
        patientName: 'Ramesh Chandra Das',
        pharmacyName: 'Nandan Pharmacy',
        pharmacyPhone: '+91 98300 00000',
        medicineName: 'Glycomet 500',
        strength: '500 mg',
        nextRefillDueDate: '2026-11-03'
      });
      expect(message).toContain('Namaskar Ramesh Chandra Das');
      expect(message).toContain('Nandan Pharmacy');
      expect(message).toContain('Glycomet 500 (500 mg)');
      expect(message).toContain('+91 98300 00000');
    });
  });

  describe('Strict Tenant Isolation for Patients & Refills', () => {
    it('isolates patients strictly by pharmacyId', () => {
      const state = getInitialSeedState();
      const nandanInventory = getTenantInventory(state, 'pharm-nandan-kolkata');
      const deshInventory = getTenantInventory(state, 'pharm-deshbandhu-siliguri');

      expect(nandanInventory.patients.length).toBeGreaterThan(0);
      expect(deshInventory.patients.length).toBeGreaterThan(0);

      // Zero cross-tenant leakage
      nandanInventory.patients.forEach((p) => {
        expect(p.pharmacyId).toBe('pharm-nandan-kolkata');
      });
      deshInventory.patients.forEach((p) => {
        expect(p.pharmacyId).toBe('pharm-deshbandhu-siliguri');
      });

      // No Nandan patient ID exists in Deshbandhu
      const nandanPatientIds = new Set(nandanInventory.patients.map((p) => p.id));
      deshInventory.patients.forEach((p) => {
        expect(nandanPatientIds.has(p.id)).toBe(false);
      });
    });

    it('isolates refills and medication schedules strictly by pharmacyId', () => {
      const state = getInitialSeedState();
      const nandanInventory = getTenantInventory(state, 'pharm-nandan-kolkata');
      const deshInventory = getTenantInventory(state, 'pharm-deshbandhu-siliguri');

      nandanInventory.refills.forEach((r) => {
        expect(r.pharmacyId).toBe('pharm-nandan-kolkata');
      });
      deshInventory.refills.forEach((r) => {
        expect(r.pharmacyId).toBe('pharm-deshbandhu-siliguri');
      });
    });

    it('isolates WhatsApp reminder audit logs strictly by pharmacyId', () => {
      const state = getInitialSeedState();
      const nandanInventory = getTenantInventory(state, 'pharm-nandan-kolkata');
      const deshInventory = getTenantInventory(state, 'pharm-deshbandhu-siliguri');

      nandanInventory.reminderLogs.forEach((l) => {
        expect(l.pharmacyId).toBe('pharm-nandan-kolkata');
      });
      deshInventory.reminderLogs.forEach((l) => {
        expect(l.pharmacyId).toBe('pharm-deshbandhu-siliguri');
      });
    });
  });

  describe('Patient CRUD and Medication Scheduling Operations', () => {
    it('creates a new patient with optional initial medication', () => {
      const state = getInitialSeedState();
      const input: CreatePatientInput = {
        name: 'Soumitra Chatterjee',
        phone: '9830599999',
        age: 70,
        gender: 'MALE',
        address: 'Ballygunge Circular Road, Kolkata',
        notes: 'Cardiac regular prescription',
        initialMedication: {
          medicineId: 'med-telma-40',
          medicineName: 'Telma 40',
          strength: '40 mg',
          dosageForm: 'Tablet',
          dailyDosage: '1 tab every morning',
          quantityPerRefill: 1,
          daysSupply: 30,
          lastDispensedDate: '2026-10-10'
        }
      };

      const result = createPatient(state, 'pharm-nandan-kolkata', input);
      expect(result.patient.id).toBeDefined();
      expect(result.patient.name).toBe('Soumitra Chatterjee');
      expect(result.patient.pharmacyId).toBe('pharm-nandan-kolkata');

      // Verify initial medication was created with calculated due date
      expect(result.initialMedication).toBeDefined();
      expect(result.initialMedication?.patientId).toBe(result.patient.id);
      expect(result.initialMedication?.nextRefillDueDate).toBe('2026-11-09');
      expect(result.nextState.patients.some((p) => p.id === result.patient.id)).toBe(true);
      expect(result.nextState.refills.some((r) => r.patientId === result.patient.id)).toBe(true);
    });

    it('rejects duplicate patient mobile number within the same pharmacy', () => {
      const state = getInitialSeedState();
      const input: CreatePatientInput = {
        name: 'Duplicate Test',
        phone: '9830112345' // Same as Ramesh Chandra Das
      };

      expect(() => {
        createPatient(state, 'pharm-nandan-kolkata', input);
      }).toThrow('already registered at this pharmacy');
    });

    it('allows same mobile number to be registered across different pharmacies', () => {
      const state = getInitialSeedState();
      const input: CreatePatientInput = {
        name: 'Cross-Tenant Customer',
        phone: '9830112345' // Exists in Nandan
      };

      // Registering in Deshbandhu Medical should succeed
      const result = createPatient(state, 'pharm-deshbandhu-siliguri', input);
      expect(result.patient.pharmacyId).toBe('pharm-deshbandhu-siliguri');
    });

    it('adds chronic medication to existing patient', () => {
      const state = getInitialSeedState();
      const result = addPatientMedication(state, 'pharm-nandan-kolkata', 'pat-nandan-01', {
        medicineId: 'med-augmentin-625',
        medicineName: 'Augmentin 625 Duo',
        strength: '500mg + 125mg',
        dosageForm: 'Tablet',
        dailyDosage: '1 tab twice daily',
        quantityPerRefill: 1,
        daysSupply: 7,
        lastDispensedDate: '2026-10-28'
      });

      expect(result.medication.patientId).toBe('pat-nandan-01');
      expect(result.medication.nextRefillDueDate).toBe('2026-11-04');
      expect(result.nextState.refills.some((r) => r.id === result.medication.id)).toBe(true);

      // Test deletePatientMedication
      const afterDelete = deletePatientMedication(result.nextState, 'pharm-nandan-kolkata', result.medication.id);
      expect(afterDelete.refills.some((r) => r.id === result.medication.id)).toBe(false);
    });

    it('updates patient details successfully', () => {
      const state = getInitialSeedState();
      const updated = updatePatient(state, 'pharm-nandan-kolkata', 'pat-nandan-01', {
        notes: 'Updated allergy notes'
      });
      expect(updated.patient.notes).toBe('Updated allergy notes');
      expect(updated.nextState.patients.find((p) => p.id === 'pat-nandan-01')?.notes).toBe('Updated allergy notes');
    });

    it('records user-initiated WhatsApp reminder dispatch in audit log', () => {
      const state = getInitialSeedState();
      const result = recordWhatsAppReminderSent(state, 'pharm-nandan-kolkata', {
        patientId: 'pat-nandan-01',
        medicationId: 'refill-nandan-01',
        patientName: 'Ramesh Chandra Das',
        patientPhone: '9830112345',
        messageText: 'Sample reminder text',
        initiatedByStaff: 'Priya Das'
      });

      expect(result.log.id).toBeDefined();
      expect(result.log.sentAt).toBeDefined();
      expect(result.nextState.reminderLogs.some((l) => l.id === result.log.id)).toBe(true);

      // Verify medication lastReminderSentAt was updated and reminderCount incremented
      const updatedMed = result.nextState.refills.find((r) => r.id === 'refill-nandan-01');
      expect(updatedMed?.lastReminderSentAt).toBe(result.log.sentAt);
      expect(updatedMed?.reminderCount).toBe(1);
    });

    it('marks refill as dispensed, resetting reminder cycle forward', () => {
      const state = getInitialSeedState();
      const result = markRefillDispensed(
        state, 
        'pharm-nandan-kolkata', 
        'refill-nandan-02', 
        '2026-11-02'
      );

      expect(result.medication.lastDispensedDate).toBe('2026-11-02');
      // Days supply was 15 -> next due date is 2026-11-17
      expect(result.medication.nextRefillDueDate).toBe('2026-11-17');
      expect(result.medication.reminderCount).toBe(0);
    });

    it('deletes patient and removes all their medication schedules', () => {
      const state = getInitialSeedState();
      const nextState = deletePatient(state, 'pharm-nandan-kolkata', 'pat-nandan-01');

      expect(nextState.patients.some((p) => p.id === 'pat-nandan-01')).toBe(false);
      expect(nextState.refills.some((r) => r.patientId === 'pat-nandan-01')).toBe(false);
    });
  });

  describe('Refill Lifecycle Operations', () => {
    it('snoozes a refill by 7 days and sets status to SNOOZED', () => {
      const state = getInitialSeedState();
      const result = snoozeRefill(state, 'pharm-nandan-kolkata', 'refill-nandan-01', 7);

      expect(result.medication.status).toBe('SNOOZED');
      expect(result.medication.nextRefillDueDate).toBe('2026-11-10');
      expect(result.nextState.refills.find((r) => r.id === 'refill-nandan-01')?.status).toBe('SNOOZED');
    });

    it('cancels a refill, setting status to CANCELLED', () => {
      const state = getInitialSeedState();
      const result = cancelRefill(state, 'pharm-nandan-kolkata', 'refill-nandan-02');

      expect(result.medication.status).toBe('CANCELLED');
      expect(result.nextState.refills.find((r) => r.id === 'refill-nandan-02')?.status).toBe('CANCELLED');
    });

    it('completes a refill, setting status to COMPLETED', () => {
      const state = getInitialSeedState();
      const result = completeRefill(state, 'pharm-nandan-kolkata', 'refill-nandan-03');

      expect(result.medication.status).toBe('COMPLETED');
      expect(result.nextState.refills.find((r) => r.id === 'refill-nandan-03')?.status).toBe('COMPLETED');
    });

    it('reactivates a terminal refill (CANCELLED/COMPLETED/SNOOZED) recalculating urgency', () => {
      const state = getInitialSeedState();

      // First cancel
      const cancelled = cancelRefill(state, 'pharm-nandan-kolkata', 'refill-nandan-01');
      expect(cancelled.medication.status).toBe('CANCELLED');

      // Then reactivate
      const reactivated = reactivateRefill(cancelled.nextState, 'pharm-nandan-kolkata', 'refill-nandan-01');
      expect(reactivated.medication.status).not.toBe('CANCELLED');
      expect(reactivated.medication.status).not.toBe('COMPLETED');
      expect(reactivated.medication.nextRefillDueDate).toBe('2026-11-03'); // unchanged - snooze moves date
    });
  });

  describe('Prescription CRUD Operations', () => {
    it('creates a prescription for an existing patient', () => {
      const state = getInitialSeedState();
      const result = createPrescription(state, 'pharm-nandan-kolkata', {
        patientId: 'pat-nandan-01',
        referenceNumber: 'RX-TEST-001',
        issueDate: '2026-11-01',
        prescriberName: 'Dr. Test Prescriber',
        prescriberRegistration: 'WBMC-12345',
        hospitalClinic: 'Test Hospital',
        expiryDate: '2026-11-15',
        notes: 'Test prescription'
      });

      expect(result.prescription.referenceNumber).toBe('RX-TEST-001');
      expect(result.prescription.patientId).toBe('pat-nandan-01');
      expect(result.prescription.pharmacyId).toBe('pharm-nandan-kolkata');
      expect(result.nextState.prescriptions.some((p) => p.id === result.prescription.id)).toBe(true);
    });

    it('rejects creating a prescription with duplicate reference number in same pharmacy', () => {
      const state = getInitialSeedState();
      const input = {
        patientId: 'pat-nandan-01',
        referenceNumber: 'RX-DUPLICATE-001',
        issueDate: '2026-11-01'
      };
      const afterFirst = createPrescription(state, 'pharm-nandan-kolkata', input);
      expect(() => {
        createPrescription(afterFirst.nextState, 'pharm-nandan-kolkata', input);
      }).toThrow(`A prescription with reference number "${input.referenceNumber}" already exists.`);
    });

    it('updates a prescription', () => {
      const state = getInitialSeedState();
      const created = createPrescription(state, 'pharm-nandan-kolkata', {
        patientId: 'pat-nandan-01',
        referenceNumber: 'RX-UPDATE-001',
        issueDate: '2026-11-01'
      });

      const updated = updatePrescription(created.nextState, 'pharm-nandan-kolkata', created.prescription.id, {
        notes: 'Updated notes',
        prescriberName: 'Dr. Updated'
      });

      expect(updated.prescription.notes).toBe('Updated notes');
      expect(updated.prescription.prescriberName).toBe('Dr. Updated');
      expect(updated.prescription.updatedAt).toBeDefined();
    });

    it('deletes a prescription', () => {
      const state = getInitialSeedState();
      const created = createPrescription(state, 'pharm-nandan-kolkata', {
        patientId: 'pat-nandan-01',
        referenceNumber: 'RX-DELETE-001',
        issueDate: '2026-11-01'
      });

      const afterDelete = deletePrescription(created.nextState, 'pharm-nandan-kolkata', created.prescription.id);
      expect(afterDelete.prescriptions.some((p) => p.id === created.prescription.id)).toBe(false);
    });
  });

  describe('Sale-Patient Linkage', () => {
    it('links an existing unassigned sale to a patient', () => {
      const state = getInitialSeedState();
      const fakeSale = {
        id: 'sale-test-001',
        pharmacyId: 'pharm-nandan-kolkata',
        timestamp: '2026-11-02T10:00:00.000Z',
        items: [],
        sellingBill: 100,
        totalBillMrp: 120,
        discount: 20,
        estimatedCogs: 50,
        estimatedGrossProfit: 50,
        tenderType: 'CASH',
        staffUser: 'Test Staff',
        batchAllocations: []
      } as any;

      const stateWithSale = { ...state, sales: [...state.sales, fakeSale] };
      const result = linkSaleToPatient(stateWithSale, 'pharm-nandan-kolkata', fakeSale.id, 'pat-nandan-01');

      const linkedSale = result.sales.find((s) => s.id === fakeSale.id);
      expect(linkedSale?.patientId).toBe('pat-nandan-01');
    });

    it('rejects linking a sale already assigned to another patient', () => {
      const state = getInitialSeedState();
      const fakeSale = {
        id: 'sale-test-002',
        pharmacyId: 'pharm-nandan-kolkata',
        timestamp: '2026-11-02T10:00:00.000Z',
        items: [],
        sellingBill: 100,
        totalBillMrp: 120,
        discount: 20,
        estimatedCogs: 50,
        estimatedGrossProfit: 50,
        tenderType: 'CASH',
        staffUser: 'Test Staff',
        batchAllocations: [],
        patientId: 'pat-nandan-02'
      } as any;

      const stateWithSale = { ...state, sales: [...state.sales, fakeSale] };
      expect(() => {
        linkSaleToPatient(stateWithSale, 'pharm-nandan-kolkata', fakeSale.id, 'pat-nandan-01');
      }).toThrow('already linked to another patient');
    });

    it('rejects linking a non-existent sale', () => {
      const state = getInitialSeedState();
      expect(() => {
        linkSaleToPatient(state, 'pharm-nandan-kolkata', 'non-existent-sale', 'pat-nandan-01');
      }).toThrow('Sale record not found for this pharmacy tenant');
    });
  });

  describe('Storage Persistence & Migration', () => {
    it('persists and loads patient records and refill schedules from localStorage', () => {
      const state = getInitialSeedState();
      const saveOk = saveDemoInventory(state);
      expect(saveOk).toBe(true);

      const loaded = loadDemoInventory();
      expect(loaded.patients.length).toBe(state.patients.length);
      expect(loaded.refills.length).toBe(state.refills.length);
      expect(loaded.reminderLogs.length).toBe(state.reminderLogs.length);
    });
  });
});
