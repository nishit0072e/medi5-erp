/**
 * Medi5 ERP - Local Demo Data Repository
 * 
 * Provides in-memory and localStorage persistence for the frontend prototype.
 * Invariants:
 * 1. Medicine-level quantities are strictly derived from child batches.
 * 2. Every stock change creates an immutable StockMovement where:
 *    balance_after = balance_before + quantity_change
 * 3. Never produces negative inventory.
 * 4. Gracefully recovers from missing or malformed localStorage data.
 * 5. Can be safely reset to initial synthetic seed data.
 */

import { 
  Medicine, 
  MedicineBatch, 
  StockMovement, 
  ReceiveStockInput, 
  AdjustStockInput,
  SaleRecord,
  ProcessSaleInput,
  SaleItemSummary
} from '../types/inventory';
import { PharmacyProfile, UpdatePharmacyInput, AddMemberInput, PharmacyMember } from '../types/pharmacy';
import { Patient, PatientMedication, WhatsAppReminderLog, CreatePatientInput, AddMedicationInput, PrescriptionReference } from '../types/patient';
import { ExpenseRecord, SupplierPayable } from '../types/financials';
import { Doctor, CreateDoctorInput, UpdateDoctorInput, CreateEPrescriptionInput, EPrescription, EPrescriptionMedication, PrescriptionStatus } from '../types/eprescription';
import { DoctorAppointment, DoctorScheduleSlot, CreateAppointmentInput, PatientVitals, AppointmentStatus, PaymentStatus, PaymentMode } from '../types/appointment';
import { MOCK_MEDICINES, MOCK_BATCHES, MOCK_MOVEMENTS } from './mockInventory';
import { MOCK_PHARMACIES } from './mockPharmacies';
import { MOCK_PATIENTS, MOCK_PATIENT_MEDICATIONS, MOCK_REMINDER_LOGS, MOCK_PRESCRIPTION_REFERENCES } from './mockPatients';
import { MOCK_EXPENSES, MOCK_SUPPLIER_PAYABLES } from './mockFinancials';
import { MOCK_DOCTORS, MOCK_E_PRESCRIPTIONS } from './mockEPrescriptions';
import { MOCK_APPOINTMENTS, MOCK_DOCTOR_SCHEDULES } from './mockAppointments';
import { parseExpiryDate } from '../utils/dateUtils';
import { toPaise, fromPaise } from '../utils/moneyUtils';
import { calculateCartAllocations } from '../utils/fefoAllocation';
import { calculateRefillDueDate, getRefillUrgency } from '../utils/whatsappUtils';
import { registerUserCredential, removeUserCredential, generateSecurePassword } from '../utils/authService';

export const DEMO_STORAGE_KEY = 'medi5_demo_inventory_v1';
export const DEMO_STORAGE_VERSION = 2;

export interface StoredDemoData {
  version: number;
  medicines: Medicine[];
  batches: MedicineBatch[];
  movements: StockMovement[];
  sales?: SaleRecord[];
  pharmacies?: PharmacyProfile[];
  activePharmacyId?: string;
  patients?: Patient[];
  refills?: PatientMedication[];
  reminderLogs?: WhatsAppReminderLog[];
  prescriptions?: PrescriptionReference[];
  expenses?: ExpenseRecord[];
  payables?: SupplierPayable[];
  doctors?: Doctor[];
  ePrescriptions?: EPrescription[];
  appointments?: DoctorAppointment[];
  doctorSchedules?: DoctorScheduleSlot[];
  lastUpdated: string;
}

export interface InventoryState {
  medicines: Medicine[];
  batches: MedicineBatch[];
  movements: StockMovement[];
  sales: SaleRecord[];
  pharmacies: PharmacyProfile[];
  activePharmacyId: string;
  patients: Patient[];
  refills: PatientMedication[];
  reminderLogs: WhatsAppReminderLog[];
  prescriptions: PrescriptionReference[];
  expenses: ExpenseRecord[];
  payables: SupplierPayable[];
  doctors: Doctor[];
  ePrescriptions: EPrescription[];
  appointments: DoctorAppointment[];
  doctorSchedules: DoctorScheduleSlot[];
}

export function getTenantInventory(state: InventoryState, pharmacyId: string): InventoryState {
  return {
    ...state,
    medicines: state.medicines.filter((m) => m.pharmacyId === pharmacyId),
    batches: state.batches.filter((b) => b.pharmacyId === pharmacyId),
    movements: state.movements.filter((m) => m.pharmacyId === pharmacyId),
    sales: state.sales.filter((s) => s.pharmacyId === pharmacyId),
    patients: (state.patients || []).filter((p) => p.pharmacyId === pharmacyId),
    refills: (state.refills || []).filter((r) => r.pharmacyId === pharmacyId),
    reminderLogs: (state.reminderLogs || []).filter((l) => l.pharmacyId === pharmacyId),
    prescriptions: (state.prescriptions || []).filter((p) => p.pharmacyId === pharmacyId),
    expenses: (state.expenses || []).filter((e) => e.pharmacyId === pharmacyId),
    payables: (state.payables || []).filter((p) => p.pharmacyId === pharmacyId),
    doctors: (state.doctors || []).filter((d) => d.pharmacyId === pharmacyId),
    ePrescriptions: (state.ePrescriptions || []).filter((p) => p.pharmacyId === pharmacyId),
    appointments: (state.appointments || []).filter((a) => a.pharmacyId === pharmacyId),
    doctorSchedules: (state.doctorSchedules || []).filter((s) => s.pharmacyId === pharmacyId)
  };
}

function resolvePharmacyId(state: InventoryState, requestedPharmacyId?: string): string {
  const pharmacyId = requestedPharmacyId || state.activePharmacyId || state.pharmacies[0]?.id;
  if (!pharmacyId || !state.pharmacies.some((p) => p.id === pharmacyId)) {
    throw new Error('Tenant context error: A valid pharmacy tenant is required for this operation.');
  }
  return pharmacyId;
}

/**
 * Loads inventory state from localStorage or falls back safely to default synthetic seed.
 */
export function loadDemoInventory(): InventoryState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return getInitialSeedState();
  }

  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) {
      return getInitialSeedState();
    }

    const parsed = JSON.parse(raw) as StoredDemoData;

    // Check version and structural validity
    if (
      !parsed || 
      parsed.version !== DEMO_STORAGE_VERSION || 
      !Array.isArray(parsed.medicines) || 
      !Array.isArray(parsed.batches) || 
      !Array.isArray(parsed.movements)
    ) {
      console.warn('[Medi5 Demo Repository] Malformed or outdated demo data detected. Falling back to default seed.');
      return getInitialSeedState();
    }

    const pharmacies: PharmacyProfile[] = Array.isArray(parsed.pharmacies) && parsed.pharmacies.length > 0
      ? parsed.pharmacies
      : JSON.parse(JSON.stringify(MOCK_PHARMACIES));
    const hasCorruptPharmacy = pharmacies.some(
      (p) => !p || typeof p.id !== 'string' || !p.id || !Array.isArray(p.members)
    );
    if (hasCorruptPharmacy) {
      console.warn('[Medi5 Demo Repository] Corrupted pharmacy tenant records detected in localStorage. Falling back to default seed.');
      return getInitialSeedState();
    }
    const pharmacyIdSet = new Set(pharmacies.map((p) => p.id));

    // Integrity check: medicines catalog must be explicitly tenant-owned
    const hasCorruptMedicine = parsed.medicines.some(
      (m) =>
        !m ||
        typeof m.id !== 'string' ||
        !m.id ||
        typeof m.name !== 'string' ||
        !m.name ||
        typeof m.pharmacyId !== 'string' ||
        !pharmacyIdSet.has(m.pharmacyId)
    );
    if (hasCorruptMedicine) {
      console.warn('[Medi5 Demo Repository] Corrupted medicine catalog or missing tenant ownership detected in localStorage. Falling back to default seed.');
      return getInitialSeedState();
    }

    const medicineById = new Map(parsed.medicines.map((m) => [m.id, m]));

    // Integrity check: batches must be valid, tenant-owned, and reference a medicine in the SAME tenant.
    const hasCorruptBatch = parsed.batches.some((b) => {
      if (
        !b ||
        typeof b.id !== 'string' ||
        typeof b.medicineId !== 'string' ||
        typeof b.pharmacyId !== 'string' ||
        !pharmacyIdSet.has(b.pharmacyId)
      ) return true;

      const parentMedicine = medicineById.get(b.medicineId);
      if (!parentMedicine || parentMedicine.pharmacyId !== b.pharmacyId) return true;

      return (
        typeof b.quantityRemaining !== 'number' ||
        !Number.isFinite(b.quantityRemaining) ||
        b.quantityRemaining < 0 ||
        typeof b.purchaseCost !== 'number' ||
        !Number.isFinite(b.purchaseCost) ||
        b.purchaseCost < 0 ||
        typeof b.mrp !== 'number' ||
        !Number.isFinite(b.mrp) ||
        b.mrp < 0
      );
    });
    if (hasCorruptBatch) {
      console.warn('[Medi5 Demo Repository] Corrupted batch quantities, invalid medicine references, or cross-tenant batch ownership detected in localStorage. Falling back to default seed.');
      return getInitialSeedState();
    }

    const batchById = new Map(parsed.batches.map((b) => [b.id, b]));

    // Integrity check: movements must be tenant-owned and reconcile with a batch in the SAME tenant.
    const validMovementTypes = new Set(['PURCHASE_RECEIPT', 'AUDIT_CORRECTION', 'DAMAGE_WRITE_OFF', 'EXPIRED_WRITE_OFF', 'SALE_DISPENSE']);
    const hasCorruptMovement = parsed.movements.some((m) => {
      if (
        !m ||
        typeof m.id !== 'string' ||
        typeof m.batchId !== 'string' ||
        typeof m.medicineId !== 'string' ||
        typeof m.pharmacyId !== 'string' ||
        !pharmacyIdSet.has(m.pharmacyId)
      ) return true;

      const batch = batchById.get(m.batchId);
      if (!batch || batch.pharmacyId !== m.pharmacyId || batch.medicineId !== m.medicineId) return true;

      if (!validMovementTypes.has(m.movementType)) return true;
      if (typeof m.quantityChange !== 'number' || !Number.isFinite(m.quantityChange) || m.quantityChange === 0) return true;
      if (typeof m.balanceBefore !== 'number' || !Number.isFinite(m.balanceBefore) || m.balanceBefore < 0) return true;
      if (typeof m.balanceAfter !== 'number' || !Number.isFinite(m.balanceAfter) || m.balanceAfter < 0) return true;
      if (m.balanceAfter !== m.balanceBefore + m.quantityChange) return true;
      return false;
    });
    if (hasCorruptMovement) {
      console.warn('[Medi5 Demo Repository] Corrupted stock movement ledger or cross-tenant movement detected in localStorage. Falling back to default seed.');
      return getInitialSeedState();
    }

    // Filter valid tenant-owned sales records.
    const validSales: SaleRecord[] = Array.isArray(parsed.sales)
      ? parsed.sales.filter(
          (s) =>
            s &&
            typeof s.id === 'string' &&
            typeof s.pharmacyId === 'string' &&
            pharmacyIdSet.has(s.pharmacyId) &&
            typeof s.clientSaleToken === 'string' &&
            Array.isArray(s.items) &&
            s.items.every(
              (item) =>
                item &&
                typeof item.medicineId === 'string' &&
                medicineById.get(item.medicineId)?.pharmacyId === s.pharmacyId
            ) &&
            typeof s.sellingBill === 'number' &&
            Number.isFinite(s.sellingBill) &&
            s.sellingBill >= 0 &&
            typeof s.totalBillMrp === 'number' &&
            Number.isFinite(s.totalBillMrp) &&
            typeof s.estimatedCogs === 'number' &&
            Number.isFinite(s.estimatedCogs)
        )
      : [];

    const activePharmacyId = typeof parsed.activePharmacyId === 'string' && pharmacyIdSet.has(parsed.activePharmacyId)
      ? parsed.activePharmacyId
      : pharmacies[0].id;

    // Validate or seed patient records
    const validPatients: Patient[] = Array.isArray(parsed.patients)
      ? parsed.patients.filter(
          (p) =>
            p &&
            typeof p.id === 'string' &&
            typeof p.pharmacyId === 'string' &&
            pharmacyIdSet.has(p.pharmacyId) &&
            typeof p.name === 'string' &&
            p.name.trim().length > 0 &&
            typeof p.phone === 'string'
        )
      : JSON.parse(JSON.stringify(MOCK_PATIENTS));

    const patientIdSet = new Set(validPatients.map((p) => p.id));

    // Validate or seed refills, recalculating active urgency status
    const validRefills: PatientMedication[] = Array.isArray(parsed.refills)
      ? parsed.refills
          .filter(
            (r) =>
              r &&
              typeof r.id === 'string' &&
              typeof r.pharmacyId === 'string' &&
              pharmacyIdSet.has(r.pharmacyId) &&
              typeof r.patientId === 'string' &&
              patientIdSet.has(r.patientId) &&
              typeof r.medicineName === 'string' &&
              typeof r.nextRefillDueDate === 'string'
          )
          .map((r) => {
            if (r.status === 'COMPLETED' || r.status === 'PAUSED' || r.status === 'SNOOZED' || r.status === 'CANCELLED') return r;
            const urgency = getRefillUrgency(r.nextRefillDueDate);
            return { ...r, status: urgency.status };
          })
      : JSON.parse(JSON.stringify(MOCK_PATIENT_MEDICATIONS));

    const validReminderLogs: WhatsAppReminderLog[] = Array.isArray(parsed.reminderLogs)
      ? parsed.reminderLogs.filter(
          (l) =>
            l &&
            typeof l.id === 'string' &&
            typeof l.pharmacyId === 'string' &&
            pharmacyIdSet.has(l.pharmacyId)
        )
      : JSON.parse(JSON.stringify(MOCK_REMINDER_LOGS));

    const validPrescriptions: PrescriptionReference[] = Array.isArray(parsed.prescriptions)
      ? parsed.prescriptions.filter(
          (p) =>
            p &&
            typeof p.id === 'string' &&
            typeof p.pharmacyId === 'string' &&
            pharmacyIdSet.has(p.pharmacyId)
        )
      : JSON.parse(JSON.stringify(MOCK_PRESCRIPTION_REFERENCES));

    const validExpenses: ExpenseRecord[] = Array.isArray(parsed.expenses)
      ? parsed.expenses.filter(
          (e) =>
            e &&
            typeof e.id === 'string' &&
            typeof e.pharmacyId === 'string' &&
            pharmacyIdSet.has(e.pharmacyId)
        )
      : JSON.parse(JSON.stringify(MOCK_EXPENSES));

    const validPayables: SupplierPayable[] = Array.isArray(parsed.payables)
      ? parsed.payables.filter(
          (p) =>
            p &&
            typeof p.id === 'string' &&
            typeof p.pharmacyId === 'string' &&
            pharmacyIdSet.has(p.pharmacyId)
        )
      : JSON.parse(JSON.stringify(MOCK_SUPPLIER_PAYABLES));

    const seedDoctors: Doctor[] = JSON.parse(JSON.stringify(MOCK_DOCTORS)).filter((d: Doctor) => pharmacyIdSet.has(d.pharmacyId));
    const validDoctors: Doctor[] = Array.isArray(parsed.doctors) && parsed.doctors.length > 0
      ? parsed.doctors.filter(
          (d) =>
            d &&
            typeof d.id === 'string' &&
            typeof d.pharmacyId === 'string' &&
            pharmacyIdSet.has(d.pharmacyId)
        )
      : seedDoctors;
    const doctorIdSet = new Set(validDoctors.map(d => d.id));
    for (const sDoc of seedDoctors) {
      if (!doctorIdSet.has(sDoc.id)) {
        validDoctors.push(sDoc);
      }
    }

    const seedEPresc: EPrescription[] = JSON.parse(JSON.stringify(MOCK_E_PRESCRIPTIONS)).filter((p: EPrescription) => pharmacyIdSet.has(p.pharmacyId));
    const validEPrescriptions: EPrescription[] = Array.isArray(parsed.ePrescriptions)
      ? parsed.ePrescriptions.filter(
          (p) =>
            p &&
            typeof p.id === 'string' &&
            typeof p.pharmacyId === 'string' &&
            pharmacyIdSet.has(p.pharmacyId)
        )
      : [];
    const prescRefSet = new Set(validEPrescriptions.map(p => p.referenceNumber));
    for (const sPresc of seedEPresc) {
      if (!prescRefSet.has(sPresc.referenceNumber)) {
        validEPrescriptions.push(sPresc);
      }
    }

    // Validate or seed appointments
    const seedAppointments: DoctorAppointment[] = JSON.parse(JSON.stringify(MOCK_APPOINTMENTS)).filter((a: DoctorAppointment) => pharmacyIdSet.has(a.pharmacyId));
    const validAppointments: DoctorAppointment[] = Array.isArray(parsed.appointments)
      ? parsed.appointments.filter(
          (a) =>
            a &&
            typeof a.id === 'string' &&
            typeof a.pharmacyId === 'string' &&
            pharmacyIdSet.has(a.pharmacyId) &&
            typeof a.patientName === 'string'
        )
      : seedAppointments;
    const aptIdSet = new Set(validAppointments.map(a => a.id));
    for (const sApt of seedAppointments) {
      if (!aptIdSet.has(sApt.id)) {
        validAppointments.push(sApt);
      }
    }

    // Validate or seed doctor schedules
    const seedSchedules: DoctorScheduleSlot[] = JSON.parse(JSON.stringify(MOCK_DOCTOR_SCHEDULES)).filter((s: DoctorScheduleSlot) => pharmacyIdSet.has(s.pharmacyId));
    const validSchedules: DoctorScheduleSlot[] = Array.isArray(parsed.doctorSchedules)
      ? parsed.doctorSchedules.filter(
          (s) =>
            s &&
            typeof s.id === 'string' &&
            typeof s.pharmacyId === 'string' &&
            pharmacyIdSet.has(s.pharmacyId)
        )
      : seedSchedules;

    return {
      medicines: parsed.medicines,
      batches: parsed.batches,
      movements: parsed.movements,
      sales: validSales,
      pharmacies,
      activePharmacyId,
      patients: validPatients,
      refills: validRefills,
      reminderLogs: validReminderLogs,
      prescriptions: validPrescriptions,
      expenses: validExpenses,
      payables: validPayables,
      doctors: validDoctors,
      ePrescriptions: validEPrescriptions,
      appointments: validAppointments,
      doctorSchedules: validSchedules
    };
  } catch (err) {
    console.error('[Medi5 Demo Repository] Failed to load localStorage demo data:', err);
    return getInitialSeedState();
  }
}

/**
 * Saves current inventory state into localStorage.
 * Returns true if successfully written, or false if storage is unavailable / quota exceeded.
 *
 * NOTE: localStorage is purely a client-side demo persistence layer for single-browser prototype exploration.
 * It does NOT provide authentication, authorization, multi-tenant isolation, cross-device synchronization,
 * or ACID database guarantees.
 */
export function saveDemoInventory(state: InventoryState): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    const payload: StoredDemoData = {
      version: DEMO_STORAGE_VERSION,
      medicines: state.medicines,
      batches: state.batches,
      movements: state.movements,
      sales: state.sales || [],
      pharmacies: state.pharmacies || [],
      activePharmacyId: state.activePharmacyId || (MOCK_PHARMACIES[0]?.id ?? ''),
      patients: state.patients || [],
      refills: state.refills || [],
      reminderLogs: state.reminderLogs || [],
      prescriptions: state.prescriptions || [],
      expenses: state.expenses || [],
      payables: state.payables || [],
      doctors: state.doctors || [],
      ePrescriptions: state.ePrescriptions || [],
      appointments: state.appointments || [],
      doctorSchedules: state.doctorSchedules || [],
      lastUpdated: new Date().toISOString()
    };
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error('[Medi5 Demo Repository] Failed to save demo inventory:', err);
    return false;
  }
}

/**
 * Resets demo data back to the clean initial synthetic seed.
 *
 * With no pharmacyId, the whole demo dataset is purged (platform reset).
 * With a pharmacyId, only that tenant's medicines, batches, movements, and
 * sales are restored, leaving every other tenant untouched.
 */
export function resetDemoInventory(pharmacyId?: string): InventoryState {
  if (!pharmacyId) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(DEMO_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    const initial = getInitialSeedState();
    saveDemoInventory(initial);
    return initial;
  }

  const current = loadDemoInventory();
  if (!current.pharmacies.some((p) => p.id === pharmacyId)) {
    throw new Error(`Pharmacy with ID "${pharmacyId}" not found.`);
  }

  const seed = getInitialSeedState();
  const scopedReset: InventoryState = {
    ...current,
    medicines: [
      ...current.medicines.filter((m) => m.pharmacyId !== pharmacyId),
      ...seed.medicines.filter((m) => m.pharmacyId === pharmacyId)
    ],
    batches: [
      ...current.batches.filter((b) => b.pharmacyId !== pharmacyId),
      ...seed.batches.filter((b) => b.pharmacyId === pharmacyId)
    ],
    movements: [
      ...current.movements.filter((m) => m.pharmacyId !== pharmacyId),
      ...seed.movements.filter((m) => m.pharmacyId === pharmacyId)
    ],
    sales: current.sales.filter((s) => s.pharmacyId !== pharmacyId),
    patients: [
      ...current.patients.filter((p) => p.pharmacyId !== pharmacyId),
      ...seed.patients.filter((p) => p.pharmacyId === pharmacyId)
    ],
    refills: [
      ...current.refills.filter((r) => r.pharmacyId !== pharmacyId),
      ...seed.refills.filter((r) => r.pharmacyId === pharmacyId)
    ],
    reminderLogs: [
      ...current.reminderLogs.filter((l) => l.pharmacyId !== pharmacyId),
      ...seed.reminderLogs.filter((l) => l.pharmacyId === pharmacyId)
    ],
    prescriptions: [
      ...(current.prescriptions || []).filter((p) => p.pharmacyId !== pharmacyId),
      ...seed.prescriptions.filter((p) => p.pharmacyId === pharmacyId)
    ],
    doctors: [
      ...current.doctors.filter((d) => d.pharmacyId !== pharmacyId),
      ...seed.doctors.filter((d) => d.pharmacyId === pharmacyId)
    ],
    ePrescriptions: [
      ...current.ePrescriptions.filter((p) => p.pharmacyId !== pharmacyId),
      ...seed.ePrescriptions.filter((p) => p.pharmacyId === pharmacyId)
    ],
    appointments: [
      ...(current.appointments || []).filter((a) => a.pharmacyId !== pharmacyId),
      ...seed.appointments.filter((a) => a.pharmacyId === pharmacyId)
    ],
    doctorSchedules: [
      ...(current.doctorSchedules || []).filter((s) => s.pharmacyId !== pharmacyId),
      ...seed.doctorSchedules.filter((s) => s.pharmacyId === pharmacyId)
    ],
    expenses: [
      ...(current.expenses || []).filter((e) => e.pharmacyId !== pharmacyId),
      ...(seed.expenses || []).filter((e) => e.pharmacyId === pharmacyId)
    ],
    payables: [
      ...(current.payables || []).filter((p) => p.pharmacyId !== pharmacyId),
      ...(seed.payables || []).filter((p) => p.pharmacyId === pharmacyId)
    ]
  };

  saveDemoInventory(scopedReset);
  return scopedReset;
}

export function getInitialSeedState(): InventoryState {
  return {
    medicines: JSON.parse(JSON.stringify(MOCK_MEDICINES)),
    batches: JSON.parse(JSON.stringify(MOCK_BATCHES)),
    movements: JSON.parse(JSON.stringify(MOCK_MOVEMENTS)),
    sales: [],
    pharmacies: JSON.parse(JSON.stringify(MOCK_PHARMACIES)),
    activePharmacyId: MOCK_PHARMACIES[0].id,
    patients: JSON.parse(JSON.stringify(MOCK_PATIENTS)),
    refills: JSON.parse(JSON.stringify(MOCK_PATIENT_MEDICATIONS)),
    reminderLogs: JSON.parse(JSON.stringify(MOCK_REMINDER_LOGS)),
    prescriptions: JSON.parse(JSON.stringify(MOCK_PRESCRIPTION_REFERENCES)),
    expenses: JSON.parse(JSON.stringify(MOCK_EXPENSES)),
    payables: JSON.parse(JSON.stringify(MOCK_SUPPLIER_PAYABLES)),
    doctors: JSON.parse(JSON.stringify(MOCK_DOCTORS)),
    ePrescriptions: JSON.parse(JSON.stringify(MOCK_E_PRESCRIPTIONS)),
    appointments: JSON.parse(JSON.stringify(MOCK_APPOINTMENTS)),
    doctorSchedules: JSON.parse(JSON.stringify(MOCK_DOCTOR_SCHEDULES))
  };
}

/**
 * Pure operation: Receives stock for an existing or new medicine batch.
 * Validates inputs, handles duplicate detection, and appends an immutable PURCHASE_RECEIPT movement.
 */
export function processStockReceipt(
  arg1: InventoryState | ReceiveStockInput,
  arg2: InventoryState | ReceiveStockInput,
  actingUser: string = 'Nandan Owner (Demo)',
  requestedPharmacyId?: string
): {
  nextState: InventoryState;
  newMovement: StockMovement;
  affectedBatch: MedicineBatch;
  isExistingBatch: boolean;
  updatedMedicines: Medicine[];
  updatedBatches: MedicineBatch[];
  updatedMovements: StockMovement[];
} {
  const currentState = ('medicines' in arg1 ? arg1 : arg2) as InventoryState;
  const input = ('medicines' in arg1 ? arg2 : arg1) as ReceiveStockInput;
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId || input.pharmacyId);

  // 1. Validation
  if (
    typeof input.quantity !== 'number' || 
    isNaN(input.quantity) || 
    !Number.isInteger(input.quantity) || 
    input.quantity <= 0
  ) {
    throw new Error('Validation error: Quantity received must be a positive integer.');
  }
  const quantity = input.quantity;

  const purchaseCost = fromPaise(toPaise(input.purchaseCost));
  const mrp = fromPaise(toPaise(input.mrp));

  if (purchaseCost < 0 || isNaN(purchaseCost)) {
    throw new Error('Validation error: Purchase cost must be a non-negative number.');
  }
  if (mrp < 0 || isNaN(mrp)) {
    throw new Error('Validation error: MRP must be a non-negative number.');
  }
  if (mrp < purchaseCost) {
    throw new Error(`Validation error: MRP (₹${mrp.toFixed(2)}) cannot be lower than purchase cost (₹${purchaseCost.toFixed(2)}).`);
  }

  const cleanBatchNumber = input.batchNumber ? input.batchNumber.trim().toUpperCase() : '';
  if (!cleanBatchNumber) {
    throw new Error('Validation error: Batch number is required.');
  }

  const cleanExpiry = input.expiryDate ? input.expiryDate.trim() : '';
  if (!cleanExpiry) {
    throw new Error('Validation error: Expiry date is required.');
  }
  const parsedExp = parseExpiryDate(cleanExpiry);
  if (isNaN(parsedExp.getTime())) {
    throw new Error('Validation error: Expiry date format is invalid.');
  }

  // 2. Resolve or create Medicine strictly within the active tenant.
  let targetMedicine: Medicine;
  const medicines = [...currentState.medicines];
  const tenantMedicines = medicines.filter((m) => m.pharmacyId === pharmacyId);

  if (input.medicineId) {
    const existingMed = tenantMedicines.find((m) => m.id === input.medicineId);
    if (!existingMed) {
      throw new Error(`Validation error: Medicine ID "${input.medicineId}" not found in this pharmacy.`);
    }
    targetMedicine = existingMed;
  } else if (input.newMedicine) {
    const { name, genericName, strength, dosageForm, unitLabel, category, lowStockThreshold } = input.newMedicine;
    if (!name || !name.trim()) throw new Error('Validation error: New medicine name is required.');
    if (!strength || !strength.trim()) throw new Error('Validation error: New medicine strength is required.');

    // Check duplicate medicine in this tenant's master catalog only.
    const dupMed = tenantMedicines.find(
      (m) => 
        m.name.trim().toLowerCase() === name.trim().toLowerCase() && 
        m.strength.trim().toLowerCase() === strength.trim().toLowerCase() &&
        m.dosageForm === dosageForm
    );
    if (dupMed) {
      targetMedicine = dupMed;
    } else {
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 16);
      const idBase = `med-${slug}-${Date.now().toString().slice(-6)}`;
      let newMedicineId = idBase;
      let idSuffix = 1;
      while (medicines.some((m) => m.id === newMedicineId)) {
        newMedicineId = `${idBase}-${idSuffix}`;
        idSuffix += 1;
      }
      targetMedicine = {
        id: newMedicineId,
        pharmacyId,
        name: name.trim(),
        genericName: genericName ? genericName.trim() : name.trim(),
        strength: strength.trim(),
        dosageForm: dosageForm || 'Tablet',
        unitLabel: unitLabel ? unitLabel.trim() : 'Strips (10 tabs)',
        category: category ? category.trim() : 'General',
        lowStockThreshold: Math.max(0, lowStockThreshold || 10)
      };
      medicines.push(targetMedicine);
    }
  } else {
    throw new Error('Validation error: Either medicineId or newMedicine details must be supplied.');
  }

  // 3. Batch conflict detection & resolution (tenant-scoped)
  const batches = [...currentState.batches];
  const existingBatchIndex = batches.findIndex(
    (b) =>
      b.pharmacyId === pharmacyId &&
      b.medicineId === targetMedicine.id &&
      b.batchNumber.toUpperCase() === cleanBatchNumber
  );

  let affectedBatch: MedicineBatch;
  let balanceBefore = 0;
  let balanceAfter = 0;

  if (existingBatchIndex >= 0) {
    const existing = batches[existingBatchIndex];

    // Normalize expiry strings for comparison (YYYY-MM vs YYYY-MM-DD)
    const existingExpTime = parseExpiryDate(existing.expiryDate).getTime();
    const newExpTime = parsedExp.getTime();

    const costDiff = Math.abs(toPaise(existing.purchaseCost) - toPaise(purchaseCost));
    const mrpDiff = Math.abs(toPaise(existing.mrp) - toPaise(mrp));

    // Conflict Check: If batch number matches, but expiry or cost/mrp differs
    if (existingExpTime !== newExpTime || costDiff > 0 || mrpDiff > 0) {
      throw new Error(
        `Conflicting batch details for "${cleanBatchNumber}". Existing batch for ${targetMedicine.name} ` +
        `expires on ${existing.expiryDate} (₹${existing.purchaseCost}, MRP ₹${existing.mrp}). ` +
        `Receiving conflicting specifications requires a distinct batch number suffix (e.g. "${cleanBatchNumber}-B") or staff review.`
      );
    }

    // Compatible Match: Increment existing batch
    balanceBefore = existing.quantityRemaining;
    balanceAfter = balanceBefore + quantity;

    affectedBatch = {
      ...existing,
      quantityReceived: existing.quantityReceived + quantity,
      quantityRemaining: balanceAfter,
      status: 'ACTIVE'
    };
    batches[existingBatchIndex] = affectedBatch;
  } else {
    // New Batch Record
    balanceBefore = 0;
    balanceAfter = quantity;

    const expYear = parsedExp.getFullYear();
    const expMonth = (parsedExp.getMonth() + 1).toString().padStart(2, '0');
    const expDay = parsedExp.getDate().toString().padStart(2, '0');
    const normalizedExpiry = `${expYear}-${expMonth}-${expDay}`;

    affectedBatch = {
      id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      pharmacyId,
      medicineId: targetMedicine.id,
      batchNumber: cleanBatchNumber,
      expiryDate: normalizedExpiry,
      purchaseCost,
      mrp,
      quantityReceived: quantity,
      quantityRemaining: quantity,
      supplierName: input.supplierName ? input.supplierName.trim() : 'Direct Purchase',
      status: 'ACTIVE',
      receivedDate: new Date().toISOString().split('T')[0]
    };
    batches.unshift(affectedBatch);
  }

  // 4. Record Immutable Stock Movement
  const newMovement: StockMovement = {
    id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    pharmacyId,
    batchId: affectedBatch.id,
    medicineId: targetMedicine.id,
    medicineName: `${targetMedicine.name} (${targetMedicine.strength})`,
    batchNumber: affectedBatch.batchNumber,
    movementType: 'PURCHASE_RECEIPT',
    quantityChange: quantity,
    balanceBefore,
    balanceAfter,
    reason: input.notes ? input.notes.trim() : `Stock received from ${affectedBatch.supplierName}`,
    timestamp: new Date().toISOString(),
    performedBy: actingUser
  };

  const nextState: InventoryState = {
    medicines,
    batches,
    movements: [newMovement, ...currentState.movements],
    sales: currentState.sales || [],
    pharmacies: currentState.pharmacies || [],
    activePharmacyId: currentState.activePharmacyId || '',
    patients: currentState.patients || [],
    refills: currentState.refills || [],
    reminderLogs: currentState.reminderLogs || [],
    prescriptions: currentState.prescriptions || [],
    expenses: currentState.expenses || [],
    payables: currentState.payables || [],
    doctors: currentState.doctors || [],
    ePrescriptions: currentState.ePrescriptions || [],
    appointments: currentState.appointments || [],
    doctorSchedules: currentState.doctorSchedules || []
  };

  return {
    nextState,
    newMovement,
    affectedBatch,
    isExistingBatch: existingBatchIndex >= 0,
    updatedMedicines: nextState.medicines,
    updatedBatches: nextState.batches,
    updatedMovements: nextState.movements
  };
}

/**
 * Pure operation: Adjusts stock for audit correction, damage, or expired write-off.
 * Enforces non-negative balance and appends an immutable movement record.
 */
export function processStockAdjustment(
  arg1: InventoryState | AdjustStockInput,
  arg2: InventoryState | AdjustStockInput,
  actingUser: string = 'Nandan Owner (Demo)',
  requestedPharmacyId?: string
): {
  nextState: InventoryState;
  newMovement: StockMovement;
  affectedBatch: MedicineBatch;
  updatedBatches: MedicineBatch[];
  updatedMovements: StockMovement[];
} {
  const currentState = ('batches' in arg1 && 'medicines' in arg1 ? arg1 : arg2) as InventoryState;
  const input = ('batches' in arg1 && 'medicines' in arg1 ? arg2 : arg1) as AdjustStockInput;
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId || input.pharmacyId);

  const batches = [...currentState.batches];
  const batchIndex = batches.findIndex(
    (b) => b.id === input.batchId && b.pharmacyId === pharmacyId
  );
  if (batchIndex < 0) {
    throw new Error(`Validation error: Batch ID "${input.batchId}" not found in this pharmacy.`);
  }

  const batch = batches[batchIndex];
  const medicine = currentState.medicines.find((m) => m.id === batch.medicineId);
  const medName = medicine ? `${medicine.name} (${medicine.strength})` : `Batch ${batch.batchNumber}`;

  if (
    typeof input.quantityChange !== 'number' || 
    isNaN(input.quantityChange) || 
    !Number.isInteger(input.quantityChange) || 
    input.quantityChange === 0
  ) {
    throw new Error('Validation error: Quantity change must be a non-zero integer.');
  }
  const qtyChange = input.quantityChange;

  const balanceBefore = batch.quantityRemaining;
  const balanceAfter = balanceBefore + qtyChange;

  if (balanceAfter < 0) {
    throw new Error(
      `Inventory invariant violation: Adjustment would result in negative stock balance (${balanceBefore} + ${qtyChange} = ${balanceAfter}).`
    );
  }

  // Update batch state
  const updatedBatch: MedicineBatch = {
    ...batch,
    quantityRemaining: balanceAfter,
    status: balanceAfter === 0 ? 'DEPLETED' : batch.status
  };
  batches[batchIndex] = updatedBatch;

  // Append movement
  const newMovement: StockMovement = {
    id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    pharmacyId,
    batchId: batch.id,
    medicineId: batch.medicineId,
    medicineName: medName,
    batchNumber: batch.batchNumber,
    movementType: input.movementType,
    quantityChange: qtyChange,
    balanceBefore,
    balanceAfter,
    reason: input.reason ? input.reason.trim() : `${input.movementType.replace('_', ' ')} adjustment`,
    timestamp: new Date().toISOString(),
    performedBy: actingUser
  };

  const nextState: InventoryState = {
    medicines: currentState.medicines,
    batches,
    movements: [newMovement, ...currentState.movements],
    sales: currentState.sales || [],
    pharmacies: currentState.pharmacies || [],
    activePharmacyId: currentState.activePharmacyId || '',
    patients: currentState.patients || [],
    refills: currentState.refills || [],
    reminderLogs: currentState.reminderLogs || [],
    prescriptions: currentState.prescriptions || [],
    expenses: currentState.expenses || [],
    payables: currentState.payables || [],
    doctors: currentState.doctors || [],
    ePrescriptions: currentState.ePrescriptions || [],
    appointments: currentState.appointments || [],
    doctorSchedules: currentState.doctorSchedules || []
  };

  return {
    nextState,
    newMovement,
    affectedBatch: updatedBatch,
    updatedBatches: nextState.batches,
    updatedMovements: nextState.movements
  };
}

export interface ProcessSaleResult {
  nextState: InventoryState;
  sale: SaleRecord;
  movements: StockMovement[];
  isIdempotentReplay?: boolean;
}

/**
 * Pure operation: Processes a walk-in counter sale atomically under FEFO allocation.
 *
 * Invariants:
 * 1. Checks idempotency token: if exact retry, returns existing sale without stock mutation;
 *    if token exists with different payload, rejects immediately.
 * 2. Pure FEFO allocation excludes expired, quarantined, and depleted batches.
 * 3. Enforces integer paise math for Total Bill (MRP), Selling Bill, Discount, COGS, and Gross Profit.
 * 4. Below-cost checkout (Selling Bill < COGS) requires explicit confirmedBelowCost.
 * 5. Atomic state update: Decrements allocated batch quantities, transitions depleted batches,
 *    and appends immutable SALE_DISPENSE movements.
 * 6. Never mutates input state; returns completely isolated nextState.
 */
export function processSaleCheckout(
  currentState: InventoryState,
  input: ProcessSaleInput,
  referenceDate: Date = new Date(),
  actingUser: string = 'Nandan Owner (Demo)',
  requestedPharmacyId?: string
): ProcessSaleResult {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId || input.pharmacyId);

  // 1. Idempotency Token Validation (scoped to the active tenant)
  const token = input.clientSaleToken ? input.clientSaleToken.trim() : '';
  if (!token) {
    throw new Error('Validation error: Checkout idempotency token is required.');
  }

  const existingSales = currentState.sales || [];
  const tenantSales = existingSales.filter((s) => s.pharmacyId === pharmacyId);
  const existingSale = tenantSales.find((s) => s.clientSaleToken === token);
  if (existingSale) {
    // Check if the sale parameters match the existing sale (using aggregate quantity per medicine)
    const inputCart = input.cart || [];
    const getCartMap = (items: { medicineId: string; quantity: number }[]) => {
      const map = new Map<string, number>();
      for (const item of items) {
        map.set(item.medicineId, (map.get(item.medicineId) || 0) + item.quantity);
      }
      return map;
    };

    const inputMap = getCartMap(inputCart);
    const existingMap = getCartMap(existingSale.items);

    const sameItems = inputMap.size === existingMap.size &&
      Array.from(inputMap.entries()).every(([medId, qty]) => existingMap.get(medId) === qty);
    const sameSellingBill = toPaise(input.sellingBill) === toPaise(existingSale.sellingBill);
    const sameTender = (input.tenderType || 'CASH') === existingSale.tenderType;
    const sameConfirmedBelowCost = Boolean(input.confirmedBelowCost) === Boolean(existingSale.confirmedBelowCost);

    if (sameItems && sameSellingBill && sameTender && sameConfirmedBelowCost) {
      // Idempotent retry: do not deduct stock again or create duplicate movement
      return {
        nextState: currentState,
        sale: existingSale,
        movements: [],
        isIdempotentReplay: true
      };
    } else {
      // Different payload with same token: reject immediately
      throw new Error(
        `Idempotency violation: A sale has already been processed with token "${token}" but with different contents or selling bill (or tender/confirmation).`
      );
    }
  }

  // 2. Cart Content Validation
  if (!input.cart || !Array.isArray(input.cart) || input.cart.length === 0) {
    throw new Error('Validation error: Cart cannot be empty for checkout.');
  }

  for (const item of input.cart) {
    if (
      typeof item.quantity !== 'number' ||
      !Number.isFinite(item.quantity) ||
      isNaN(item.quantity) ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      throw new Error('Validation error: Requested quantities must be positive whole packaging units.');
    }

    const med = currentState.medicines.find(
      (m) => m.id === item.medicineId && m.pharmacyId === pharmacyId
    );
    if (!med) {
      throw new Error(`Validation error: Medicine ID "${item.medicineId}" does not exist in this pharmacy's catalog.`);
    }
  }

  const tenantMedicines = currentState.medicines.filter((m) => m.pharmacyId === pharmacyId);
  const tenantBatches = currentState.batches.filter((b) => b.pharmacyId === pharmacyId);

  // 3. Selling Bill Validation
  if (
    typeof input.sellingBill !== 'number' ||
    !Number.isFinite(input.sellingBill) ||
    isNaN(input.sellingBill) ||
    input.sellingBill < 0
  ) {
    throw new Error('Validation error: Selling Bill must be a valid, non-negative monetary amount.');
  }

  // Validate that Selling Bill does not contain invalid fractional paise (more than 2 decimal places)
  const sellingBillPaise = toPaise(input.sellingBill);
  if (Math.abs(fromPaise(sellingBillPaise) - input.sellingBill) > 0.0001) {
    throw new Error('Validation error: Selling Bill cannot contain fractional paise (more than 2 decimal places).');
  }

  // 4. Pure FEFO Allocation Evaluation
  const {
    lineAllocations,
    totalBillMrp,
    estimatedCogs,
    isFullyFulfillable,
    unfulfilledLines
  } = calculateCartAllocations(input.cart, tenantMedicines, tenantBatches, referenceDate);

  if (!isFullyFulfillable) {
    const missingDesc = unfulfilledLines
      .map((l) => `"${l.medicineName}" (missing ${l.missingQty} units)`)
      .join(', ');
    throw new Error(
      `Validation error: Insufficient eligible stock to fulfill checkout: ${missingDesc}.`
    );
  }

  const totalBillMrpPaise = toPaise(totalBillMrp);
  const totalCogsPaise = toPaise(estimatedCogs);

  // 5. Below-Cost Safety Interlock
  if (sellingBillPaise < totalCogsPaise && !input.confirmedBelowCost) {
    throw new Error(
      `Validation error: Selling Bill (₹${fromPaise(sellingBillPaise).toFixed(2)}) is below estimated COGS (₹${fromPaise(totalCogsPaise).toFixed(2)}). Deliberate confirmation is required before proceeding.`
    );
  }

  // 6. Compute Financials
  const discountPaise = totalBillMrpPaise - sellingBillPaise;
  const grossProfitPaise = sellingBillPaise - totalCogsPaise;

  // 7. Generate Stable Unique Sale ID
  const year = referenceDate.getFullYear();
  const sequenceNum = (tenantSales.length + 1).toString().padStart(4, '0');
  const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const saleId = `INV-${year}-${sequenceNum}-${randSuffix}`;

  // 8. Construct Sale Item Summaries & Apply Batch Deductions
  const updatedBatches = [...currentState.batches];
  const newMovements: StockMovement[] = [];
  const saleItems: SaleItemSummary[] = [];

  for (const line of lineAllocations) {
    saleItems.push({
      medicineId: line.medicine.id,
      medicineName: line.medicine.name,
      genericName: line.medicine.genericName,
      strength: line.medicine.strength,
      dosageForm: line.medicine.dosageForm,
      unitLabel: line.medicine.unitLabel,
      quantity: line.requestedQuantity,
      lineTotalMrp: line.lineTotalMrp,
      lineTotalCogs: line.lineTotalCogs,
      allocations: line.allocations
    });

    for (const alloc of line.allocations) {
      const bIndex = updatedBatches.findIndex((b) => b.id === alloc.batchId);
      if (bIndex < 0) {
        throw new Error(`Inventory invariant error: Batch "${alloc.batchNumber}" unexpectedly missing.`);
      }

      const currentBatch = updatedBatches[bIndex];
      const balanceBefore = currentBatch.quantityRemaining;
      const balanceAfter = balanceBefore - alloc.quantity;

      if (balanceAfter < 0) {
        throw new Error(
          `Inventory invariant violation: Batch "${currentBatch.batchNumber}" cannot have negative stock (${balanceBefore} - ${alloc.quantity} = ${balanceAfter}).`
        );
      }

      const updatedBatch: MedicineBatch = {
        ...currentBatch,
        quantityRemaining: balanceAfter,
        status: balanceAfter === 0 ? 'DEPLETED' : currentBatch.status
      };
      updatedBatches[bIndex] = updatedBatch;

      const movement: StockMovement = {
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        pharmacyId,
        batchId: currentBatch.id,
        medicineId: currentBatch.medicineId,
        medicineName: `${line.medicine.name} (${line.medicine.strength})`,
        batchNumber: currentBatch.batchNumber,
        movementType: 'SALE_DISPENSE',
        quantityChange: -alloc.quantity,
        balanceBefore,
        balanceAfter,
        reason: `Counter Sale ${saleId}`,
        referenceId: saleId,
        timestamp: referenceDate.toISOString(),
        performedBy: input.staffUser || actingUser
      };
      newMovements.push(movement);
    }
  }

  // 9. Create Completed Sale Record
  const newSale: SaleRecord = {
    id: saleId,
    pharmacyId,
    clientSaleToken: token,
    timestamp: referenceDate.toISOString(),
    patientId: input.patientId,
    items: saleItems,
    totalBillMrp,
    sellingBill: fromPaise(sellingBillPaise),
    discount: fromPaise(discountPaise),
    estimatedCogs,
    estimatedGrossProfit: fromPaise(grossProfitPaise),
    tenderType: input.tenderType || 'CASH',
    staffUser: input.staffUser || actingUser,
    confirmedBelowCost: !!input.confirmedBelowCost
  };

  const nextState: InventoryState = {
    medicines: currentState.medicines,
    batches: updatedBatches,
    movements: [...newMovements, ...currentState.movements],
    sales: [newSale, ...existingSales],
    pharmacies: currentState.pharmacies || [],
    activePharmacyId: currentState.activePharmacyId || '',
    patients: currentState.patients || [],
    refills: currentState.refills || [],
    reminderLogs: currentState.reminderLogs || [],
    prescriptions: currentState.prescriptions || [],
    expenses: currentState.expenses || [],
    payables: currentState.payables || [],
    doctors: currentState.doctors || [],
    ePrescriptions: currentState.ePrescriptions || [],
    appointments: currentState.appointments || [],
    doctorSchedules: currentState.doctorSchedules || []
  };

  return {
    nextState,
    sale: newSale,
    movements: newMovements
  };
}

/**
 * Updates an existing pharmacy profile's legal details, address, and operational thresholds.
 */
export function updatePharmacyProfile(
  currentState: InventoryState,
  pharmacyId: string,
  input: UpdatePharmacyInput
): InventoryState {
  const pharmacies = [...currentState.pharmacies];
  const index = pharmacies.findIndex((p) => p.id === pharmacyId);
  if (index < 0) {
    throw new Error(`Pharmacy with ID "${pharmacyId}" not found.`);
  }

  if (!input.name || !input.name.trim()) {
    throw new Error('Pharmacy name cannot be empty.');
  }
  if (!input.drugLicenseNumber || !input.drugLicenseNumber.trim()) {
    throw new Error('Drug License Number (Form 20/21) is required.');
  }
  if (!input.city || !input.city.trim()) {
    throw new Error('City is required.');
  }
  if (!input.phone || !input.phone.trim()) {
    throw new Error('Contact phone number is required.');
  }

  const existing = pharmacies[index];
  const updated: PharmacyProfile = {
    ...existing,
    name: input.name.trim(),
    legalName: input.legalName ? input.legalName.trim() : input.name.trim(),
    drugLicenseNumber: input.drugLicenseNumber.trim().toUpperCase(),
    gstin: input.gstin ? input.gstin.trim().toUpperCase() : undefined,
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2 ? input.addressLine2.trim() : undefined,
    city: input.city.trim(),
    state: input.state ? input.state.trim() : 'West Bengal',
    pincode: input.pincode.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    expiryThresholdDays: Math.max(1, input.expiryThresholdDays || 60),
    lowStockThresholdDefault: Math.max(1, input.lowStockThresholdDefault || 15),
    updatedAt: new Date().toISOString()
  };

  pharmacies[index] = updated;

  return {
    ...currentState,
    pharmacies
  };
}

/**
 * Switches the active pharmacy tenant context in the application.
 */
export function switchPharmacyTenant(
  currentState: InventoryState,
  targetPharmacyId: string
): InventoryState {
  const target = currentState.pharmacies.find((p) => p.id === targetPharmacyId);
  if (!target) {
    throw new Error(`Target pharmacy tenant "${targetPharmacyId}" does not exist.`);
  }

  return {
    ...currentState,
    activePharmacyId: targetPharmacyId
  };
}

/**
 * Creates and registers a new pharmacy tenant in the system.
 */
export function createPharmacyTenant(
  currentState: InventoryState,
  input: UpdatePharmacyInput & { ownerName: string; ownerPhone: string; ownerEmail: string; ownerPassword?: string }
): InventoryState {
  if (!input.name || !input.name.trim()) {
    throw new Error('Pharmacy name is required.');
  }

  const slug = input.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 16);
  const newId = `pharm-${slug}-${Date.now().toString().slice(-4)}`;
  const ownerEmail = (input.ownerEmail && input.ownerEmail.trim()) || input.email.trim();
  const ownerPassword = (input.ownerPassword && input.ownerPassword.trim()) || generateSecurePassword();

  const newPharmacy: PharmacyProfile = {
    id: newId,
    name: input.name.trim(),
    legalName: input.legalName ? input.legalName.trim() : input.name.trim(),
    drugLicenseNumber: input.drugLicenseNumber.trim().toUpperCase(),
    gstin: input.gstin ? input.gstin.trim().toUpperCase() : undefined,
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2 ? input.addressLine2.trim() : undefined,
    city: input.city.trim(),
    state: input.state ? input.state.trim() : 'West Bengal',
    pincode: input.pincode.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    currency: 'INR',
    expiryThresholdDays: Math.max(1, input.expiryThresholdDays || 60),
    lowStockThresholdDefault: Math.max(1, input.lowStockThresholdDefault || 15),
    status: 'ACTIVE',
    updatedAt: new Date().toISOString(),
    members: [
      {
        id: `user-owner-${Date.now().toString().slice(-4)}`,
        name: input.ownerName.trim() || 'Store Owner',
        email: ownerEmail,
        phone: input.ownerPhone.trim() || input.phone.trim(),
        role: 'OWNER',
        status: 'ACTIVE',
        joinedDate: new Date().toISOString().split('T')[0],
        initialPassword: ownerPassword
      }
    ]
  };

  // Register owner login credentials into auth system
  registerUserCredential({
    email: ownerEmail,
    password: ownerPassword,
    name: `${newPharmacy.members[0].name} (Owner)`,
    role: 'OWNER',
    pharmacyId: newPharmacy.id,
    pharmacyName: newPharmacy.name
  });

  const pharmacies = [...currentState.pharmacies, newPharmacy];

  return {
    ...currentState,
    pharmacies,
    activePharmacyId: newPharmacy.id
  };
}

/**
 * Adds an authorized staff member or manager to a pharmacy tenant.
 */
export function addPharmacyStaffMember(
  currentState: InventoryState,
  pharmacyId: string,
  input: AddMemberInput
): InventoryState {
  const pharmacies = [...currentState.pharmacies];
  const pIndex = pharmacies.findIndex((p) => p.id === pharmacyId);
  if (pIndex < 0) throw new Error('Pharmacy tenant not found.');

  if (!input.name || !input.name.trim()) throw new Error('Staff member name is required.');
  if (!input.phone || !input.phone.trim()) throw new Error('Staff phone number is required.');

  const pharmacy = pharmacies[pIndex];
  const staffEmail = input.email && input.email.trim()
    ? input.email.trim()
    : `${input.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@${pharmacy.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.in`;
  const staffPassword = (input.password && input.password.trim()) || generateSecurePassword();

  const newMember: PharmacyMember = {
    id: `user-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 5)}`,
    name: input.name.trim(),
    email: staffEmail,
    phone: input.phone.trim(),
    role: input.role || 'STAFF',
    status: 'ACTIVE',
    joinedDate: new Date().toISOString().split('T')[0],
    initialPassword: staffPassword
  };

  // Register staff credentials into auth system
  registerUserCredential({
    email: staffEmail,
    password: staffPassword,
    name: `${newMember.name} (${newMember.role})`,
    role: newMember.role,
    pharmacyId: pharmacy.id,
    pharmacyName: pharmacy.name
  });

  pharmacies[pIndex] = {
    ...pharmacy,
    members: [...pharmacy.members, newMember],
    updatedAt: new Date().toISOString()
  };

  return {
    ...currentState,
    pharmacies
  };
}

/**
 * Removes a staff member while strictly enforcing the last-active-owner invariant.
 */
export function removePharmacyStaffMember(
  currentState: InventoryState,
  pharmacyId: string,
  memberId: string
): InventoryState {
  const pharmacies = [...currentState.pharmacies];
  const pIndex = pharmacies.findIndex((p) => p.id === pharmacyId);
  if (pIndex < 0) throw new Error('Pharmacy tenant not found.');

  const pharmacy = pharmacies[pIndex];
  const targetMember = pharmacy.members.find((m) => m.id === memberId);
  if (!targetMember) throw new Error('Member not found.');

  if (targetMember.role === 'OWNER') {
    const remainingActiveOwners = pharmacy.members.filter(
      (m) => m.role === 'OWNER' && m.status === 'ACTIVE' && m.id !== memberId
    );
    if (remainingActiveOwners.length === 0) {
      throw new Error('Tenancy security violation: A pharmacy must retain at least one active OWNER.');
    }
  }

  // Remove credentials from auth system
  if (targetMember.email) {
    removeUserCredential(targetMember.email);
  }

  pharmacies[pIndex] = {
    ...pharmacy,
    members: pharmacy.members.filter((m) => m.id !== memberId),
    updatedAt: new Date().toISOString()
  };

  return {
    ...currentState,
    pharmacies
  };
}

// ============================================================================
// Phase 3: Patient & WhatsApp Refill Reminders Operations
// ============================================================================

/**
 * Registers a new patient with optional initial chronic medication.
 * Strictly scoped to the specified pharmacyId.
 */
export function createPatient(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  input: CreatePatientInput
): {
  nextState: InventoryState;
  patient: Patient;
  initialMedication?: PatientMedication;
} {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);

  if (!input.name || !input.name.trim()) {
    throw new Error('Patient name is required.');
  }

  const cleanPhone = input.phone.replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    throw new Error('A valid 10-digit mobile number is required for WhatsApp refill reminders.');
  }

  // Prevent duplicate patient phone numbers within the SAME pharmacy tenant
  const existingPatient = (currentState.patients || []).find(
    (p) => p.pharmacyId === pharmacyId && p.phone.replace(/\D/g, '') === cleanPhone
  );
  if (existingPatient) {
    throw new Error(`A patient with mobile number "${input.phone}" is already registered at this pharmacy.`);
  }

  const now = new Date().toISOString();
  const patientId = `pat-${pharmacyId.slice(-6)}-${Date.now().toString().slice(-6)}`;

  const newPatient: Patient = {
    id: patientId,
    pharmacyId,
    name: input.name.trim(),
    phone: cleanPhone,
    email: input.email?.trim() || undefined,
    age: input.age,
    gender: input.gender,
    address: input.address?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    status: 'ACTIVE',
    communicationPreference: input.communicationPreference || 'WHATSAPP',
    consentGiven: input.consentGiven || false,
    consentDate: input.consentGiven ? new Date().toISOString() : undefined,
    createdAt: now,
    updatedAt: now
  };

  let newMedication: PatientMedication | undefined;
  const updatedRefills = [...(currentState.refills || [])];

  if (input.initialMedication) {
    const med = input.initialMedication;
    const dueDate = calculateRefillDueDate(med.lastDispensedDate, med.daysSupply);
    const urgency = getRefillUrgency(dueDate);

    newMedication = {
      id: `refill-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`,
      pharmacyId,
      patientId: newPatient.id,
      medicineId: med.medicineId,
      medicineName: med.medicineName,
      strength: med.strength,
      dosageForm: med.dosageForm,
      dailyDosage: med.dailyDosage,
      quantityPerRefill: med.quantityPerRefill,
      daysSupply: med.daysSupply,
      lastDispensedDate: med.lastDispensedDate,
      nextRefillDueDate: dueDate,
      status: urgency.status,
      reminderCount: 0
    };

    updatedRefills.push(newMedication);
  }

  const nextState: InventoryState = {
    ...currentState,
    patients: [...(currentState.patients || []), newPatient],
    refills: updatedRefills
  };

  return {
    nextState,
    patient: newPatient,
    initialMedication: newMedication
  };
}

/**
 * Updates basic demographic details of a patient.
 */
export function updatePatient(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  patientId: string,
  input: Partial<Patient>
): { nextState: InventoryState; patient: Patient } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const patientIndex = (currentState.patients || []).findIndex(
    (p) => p.id === patientId && p.pharmacyId === pharmacyId
  );
  if (patientIndex < 0) {
    throw new Error('Patient record not found for this pharmacy tenant.');
  }

  const existing = currentState.patients[patientIndex];
  const updated: Patient = {
    ...existing,
    ...input,
    id: existing.id,
    pharmacyId: existing.pharmacyId,
    updatedAt: new Date().toISOString()
  };

  const updatedPatients = [...currentState.patients];
  updatedPatients[patientIndex] = updated;

  return {
    nextState: {
      ...currentState,
      patients: updatedPatients
    },
    patient: updated
  };
}

/**
 * Deletes a patient record and cleans up associated medication schedules.
 */
export function deletePatient(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  patientId: string
): InventoryState {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);

  return {
    ...currentState,
    patients: (currentState.patients || []).filter(
      (p) => !(p.id === patientId && p.pharmacyId === pharmacyId)
    ),
    refills: (currentState.refills || []).filter(
      (r) => !(r.patientId === patientId && r.pharmacyId === pharmacyId)
    )
  };
}

/**
 * Adds a new chronic medication / refill schedule to an existing patient.
 */
export function addPatientMedication(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  patientId: string,
  input: AddMedicationInput
): { nextState: InventoryState; medication: PatientMedication } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const patient = (currentState.patients || []).find(
    (p) => p.id === patientId && p.pharmacyId === pharmacyId
  );
  if (!patient) {
    throw new Error('Patient record not found in this pharmacy tenant.');
  }

  if (!input.medicineName || !input.medicineName.trim()) {
    throw new Error('Medicine name is required.');
  }

  const dueDate = calculateRefillDueDate(input.lastDispensedDate, input.daysSupply);
  const urgency = getRefillUrgency(dueDate);

  const newMedication: PatientMedication = {
    id: `refill-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`,
    pharmacyId,
    patientId,
    medicineId: input.medicineId,
    medicineName: input.medicineName.trim(),
    strength: input.strength || '',
    dosageForm: input.dosageForm || 'Tablet',
    dailyDosage: input.dailyDosage || '1 tab daily',
    quantityPerRefill: Math.max(1, input.quantityPerRefill || 1),
    daysSupply: Math.max(1, input.daysSupply || 30),
    lastDispensedDate: input.lastDispensedDate,
    nextRefillDueDate: dueDate,
    status: urgency.status,
    reminderCount: 0
  };

  return {
    nextState: {
      ...currentState,
      refills: [...(currentState.refills || []), newMedication]
    },
    medication: newMedication
  };
}

/**
 * Removes a chronic medication / refill reminder.
 */
export function deletePatientMedication(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  medicationId: string
): InventoryState {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);

  return {
    ...currentState,
    refills: (currentState.refills || []).filter(
      (r) => !(r.id === medicationId && r.pharmacyId === pharmacyId)
    )
  };
}

/**
 * Records a user-initiated WhatsApp reminder in the audit log and updates reminder counters.
 */
export function recordWhatsAppReminderSent(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  logData: Omit<WhatsAppReminderLog, 'id' | 'pharmacyId' | 'sentAt'>
): { nextState: InventoryState; log: WhatsAppReminderLog } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const now = new Date().toISOString();

  const newLog: WhatsAppReminderLog = {
    id: `log-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`,
    pharmacyId,
    sentAt: now,
    ...logData
  };

  const updatedRefills = (currentState.refills || []).map((r) => {
    if (r.id === logData.medicationId && r.pharmacyId === pharmacyId) {
      return {
        ...r,
        lastReminderSentAt: now,
        reminderCount: (r.reminderCount || 0) + 1
      };
    }
    return r;
  });

  return {
    nextState: {
      ...currentState,
      refills: updatedRefills,
      reminderLogs: [newLog, ...(currentState.reminderLogs || [])]
    },
    log: newLog
  };
}

/**
 * Marks a chronic refill as dispensed (e.g. customer bought refill),
 * resetting the reminder cycle forward by daysSupply.
 */
export function markRefillDispensed(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  medicationId: string,
  dispensedDate?: string
): { nextState: InventoryState; medication: PatientMedication } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const targetIndex = (currentState.refills || []).findIndex(
    (r) => r.id === medicationId && r.pharmacyId === pharmacyId
  );
  if (targetIndex < 0) {
    throw new Error('Refill schedule record not found.');
  }

  const existing = currentState.refills[targetIndex];
  const newLastDispensed = dispensedDate || new Date().toISOString().split('T')[0];
  const newDueDate = calculateRefillDueDate(newLastDispensed, existing.daysSupply);
  const urgency = getRefillUrgency(newDueDate);

  const updated: PatientMedication = {
    ...existing,
    lastDispensedDate: newLastDispensed,
    nextRefillDueDate: newDueDate,
    status: urgency.status,
    reminderCount: 0
  };

  const updatedRefills = [...currentState.refills];
  updatedRefills[targetIndex] = updated;

  return {
    nextState: {
      ...currentState,
      refills: updatedRefills
    },
    medication: updated
  };
}

/**
 * Snoozes a refill reminder by pushing the next due date forward.
 */
export function snoozeRefill(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  medicationId: string,
  days = 7
): { nextState: InventoryState; medication: PatientMedication } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const targetIndex = (currentState.refills || []).findIndex(
    (r) => r.id === medicationId && r.pharmacyId === pharmacyId
  );
  if (targetIndex < 0) {
    throw new Error('Refill schedule record not found.');
  }

  const existing = currentState.refills[targetIndex];
  const [y, m, d] = existing.nextRefillDueDate.split('-').map(Number);
  const snoozedDate = new Date(Date.UTC(y, m - 1, d));
  snoozedDate.setUTCDate(snoozedDate.getUTCDate() + Math.max(1, days));

  const updated: PatientMedication = {
    ...existing,
    nextRefillDueDate: snoozedDate.toISOString().split('T')[0],
    status: 'SNOOZED'
  };

  const updatedRefills = [...currentState.refills];
  updatedRefills[targetIndex] = updated;

  return {
    nextState: {
      ...currentState,
      refills: updatedRefills
    },
    medication: updated
  };
}

/**
 * Marks a refill schedule as cancelled (patient stopped therapy / transferred).
 */
export function cancelRefill(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  medicationId: string
): { nextState: InventoryState; medication: PatientMedication } {
  return setRefillTerminalStatus(currentState, requestedPharmacyId, medicationId, 'CANCELLED');
}

/**
 * Marks a refill schedule as completed (full therapy course finished).
 */
export function completeRefill(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  medicationId: string
): { nextState: InventoryState; medication: PatientMedication } {
  return setRefillTerminalStatus(currentState, requestedPharmacyId, medicationId, 'COMPLETED');
}

/**
 * Reactivates a snoozed/cancelled/completed refill, recalculating urgency from its due date.
 */
export function reactivateRefill(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  medicationId: string
): { nextState: InventoryState; medication: PatientMedication } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const targetIndex = (currentState.refills || []).findIndex(
    (r) => r.id === medicationId && r.pharmacyId === pharmacyId
  );
  if (targetIndex < 0) {
    throw new Error('Refill schedule record not found.');
  }

  const existing = currentState.refills[targetIndex];
  const urgency = getRefillUrgency(existing.nextRefillDueDate);
  const updated: PatientMedication = {
    ...existing,
    status: urgency.status
  };

  const updatedRefills = [...currentState.refills];
  updatedRefills[targetIndex] = updated;

  return {
    nextState: {
      ...currentState,
      refills: updatedRefills
    },
    medication: updated
  };
}

function setRefillTerminalStatus(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  medicationId: string,
  status: 'COMPLETED' | 'CANCELLED'
): { nextState: InventoryState; medication: PatientMedication } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const targetIndex = (currentState.refills || []).findIndex(
    (r) => r.id === medicationId && r.pharmacyId === pharmacyId
  );
  if (targetIndex < 0) {
    throw new Error('Refill schedule record not found.');
  }

  const updated: PatientMedication = {
    ...currentState.refills[targetIndex],
    status
  };

  const updatedRefills = [...currentState.refills];
  updatedRefills[targetIndex] = updated;

  return {
    nextState: {
      ...currentState,
      refills: updatedRefills
    },
    medication: updated
  };
}

export interface CreateExpenseInput {
  pharmacyId?: string;
  category: ExpenseRecord['category'];
  title: string;
  amount: number;
  date: string;
  paymentMethod: ExpenseRecord['paymentMethod'];
  referenceNumber?: string;
  vendorName?: string;
  notes?: string;
}

export function recordExpense(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  input: CreateExpenseInput
): { nextState: InventoryState; expense: ExpenseRecord } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId || input.pharmacyId);

  if (!input.title || !input.title.trim()) {
    throw new Error('Expense title or description is required.');
  }
  if (typeof input.amount !== 'number' || isNaN(input.amount) || input.amount <= 0) {
    throw new Error('Expense amount must be a positive finite number.');
  }
  if (!input.date) {
    throw new Error('Expense date is required.');
  }

  const newExpense: ExpenseRecord = {
    id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    pharmacyId,
    category: input.category,
    title: input.title.trim(),
    amount: Math.round(input.amount * 100) / 100,
    date: input.date,
    paymentMethod: input.paymentMethod || 'CASH',
    referenceNumber: input.referenceNumber?.trim(),
    vendorName: input.vendorName?.trim(),
    notes: input.notes?.trim(),
    createdAt: new Date().toISOString()
  };

  const updatedExpenses = [newExpense, ...(currentState.expenses || [])];
  const nextState: InventoryState = {
    ...currentState,
    expenses: updatedExpenses
  };

  saveDemoInventory(nextState);
  return { nextState, expense: newExpense };
}

export function updateExpense(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  expenseId: string,
  updates: Partial<CreateExpenseInput>
): { nextState: InventoryState; expense: ExpenseRecord } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const targetIndex = (currentState.expenses || []).findIndex(
    (e) => e.id === expenseId && e.pharmacyId === pharmacyId
  );
  if (targetIndex < 0) {
    throw new Error('Expense record not found.');
  }

  const existing = currentState.expenses[targetIndex];
  if (updates.amount !== undefined && (typeof updates.amount !== 'number' || isNaN(updates.amount) || updates.amount <= 0)) {
    throw new Error('Expense amount must be a positive finite number.');
  }

  const updated: ExpenseRecord = {
    ...existing,
    category: updates.category || existing.category,
    title: updates.title !== undefined ? updates.title.trim() : existing.title,
    amount: updates.amount !== undefined ? Math.round(updates.amount * 100) / 100 : existing.amount,
    date: updates.date || existing.date,
    paymentMethod: updates.paymentMethod || existing.paymentMethod,
    referenceNumber: updates.referenceNumber !== undefined ? updates.referenceNumber.trim() : existing.referenceNumber,
    vendorName: updates.vendorName !== undefined ? updates.vendorName.trim() : existing.vendorName,
    notes: updates.notes !== undefined ? updates.notes.trim() : existing.notes
  };

  const updatedExpenses = [...currentState.expenses];
  updatedExpenses[targetIndex] = updated;

  const nextState: InventoryState = {
    ...currentState,
    expenses: updatedExpenses
  };

  saveDemoInventory(nextState);
  return { nextState, expense: updated };
}

export function deleteExpense(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  expenseId: string
): InventoryState {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const updatedExpenses = (currentState.expenses || []).filter(
    (e) => !(e.id === expenseId && e.pharmacyId === pharmacyId)
  );

  const nextState: InventoryState = {
    ...currentState,
    expenses: updatedExpenses
  };

  saveDemoInventory(nextState);
  return nextState;
}

export function recordSupplierPayment(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  payableId: string,
  payment: {
    amount: number;
    paymentDate: string;
    method: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
    reference?: string;
    recordedBy: string;
  }
): { nextState: InventoryState; payable: SupplierPayable } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const targetIndex = (currentState.payables || []).findIndex(
    (p) => p.id === payableId && p.pharmacyId === pharmacyId
  );
  if (targetIndex < 0) {
    throw new Error('Supplier invoice payable not found.');
  }

  const existing = currentState.payables[targetIndex];
  const remainingDue = Math.max(0, existing.totalAmount - existing.paidAmount);

  if (typeof payment.amount !== 'number' || isNaN(payment.amount) || payment.amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }
  if (payment.amount > remainingDue + 0.01) {
    throw new Error(`Payment amount (₹${payment.amount}) cannot exceed remaining due (₹${remainingDue}).`);
  }

  const newPaidAmount = Math.round((existing.paidAmount + payment.amount) * 100) / 100;
  const isFullyPaid = newPaidAmount >= existing.totalAmount - 0.01;

  const newHistoryEntry = {
    id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    amount: payment.amount,
    paymentDate: payment.paymentDate,
    method: payment.method,
    reference: payment.reference?.trim(),
    recordedBy: payment.recordedBy
  };

  const updatedPayable: SupplierPayable = {
    ...existing,
    paidAmount: newPaidAmount,
    status: isFullyPaid ? 'PAID' : 'PARTIAL',
    paymentHistory: [newHistoryEntry, ...existing.paymentHistory]
  };

  const updatedPayables = [...currentState.payables];
  updatedPayables[targetIndex] = updatedPayable;

  const nextState: InventoryState = {
    ...currentState,
    payables: updatedPayables
  };

  saveDemoInventory(nextState);
  return { nextState, payable: updatedPayable };
}

// ============================================================================
// Prescription Reference Operations
// ============================================================================

export interface CreatePrescriptionInput {
  pharmacyId?: string;
  patientId: string;
  referenceNumber: string;
  issueDate: string;
  prescriberName?: string;
  prescriberRegistration?: string;
  prescriberContact?: string;
  hospitalClinic?: string;
  expiryDate?: string;
  notes?: string;
  attachmentUrl?: string;
}

export function createPrescription(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  input: CreatePrescriptionInput
): { nextState: InventoryState; prescription: PrescriptionReference } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId || input.pharmacyId);

  if (!input.referenceNumber || !input.referenceNumber.trim()) {
    throw new Error('Prescription reference number is required.');
  }
  if (!input.issueDate) {
    throw new Error('Prescription issue date is required.');
  }
  if (!input.patientId) {
    throw new Error('Patient ID is required.');
  }

  // Verify patient exists in this pharmacy
  const patient = (currentState.patients || []).find(
    (p) => p.id === input.patientId && p.pharmacyId === pharmacyId
  );
  if (!patient) {
    throw new Error('Patient not found in this pharmacy.');
  }

  // Check for duplicate reference number
  const existingRef = (currentState.prescriptions || []).find(
    (p) => p.pharmacyId === pharmacyId && p.referenceNumber.trim().toUpperCase() === input.referenceNumber.trim().toUpperCase()
  );
  if (existingRef) {
    throw new Error(`A prescription with reference number "${input.referenceNumber}" already exists.`);
  }

  const now = new Date().toISOString();
  const newPrescription: PrescriptionReference = {
    id: `presc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    pharmacyId,
    patientId: input.patientId,
    referenceNumber: input.referenceNumber.trim().toUpperCase(),
    issueDate: input.issueDate,
    prescriberName: input.prescriberName?.trim() || undefined,
    prescriberRegistration: input.prescriberRegistration?.trim() || undefined,
    prescriberContact: input.prescriberContact?.trim() || undefined,
    hospitalClinic: input.hospitalClinic?.trim() || undefined,
    expiryDate: input.expiryDate || undefined,
    notes: input.notes?.trim() || undefined,
    attachmentUrl: input.attachmentUrl?.trim() || undefined,
    createdAt: now,
    updatedAt: now
  };

  const updatedPrescriptions = [newPrescription, ...(currentState.prescriptions || [])];
  const nextState: InventoryState = {
    ...currentState,
    prescriptions: updatedPrescriptions
  };

  saveDemoInventory(nextState);
  return { nextState, prescription: newPrescription };
}

export function updatePrescription(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  prescriptionId: string,
  updates: Partial<CreatePrescriptionInput>
): { nextState: InventoryState; prescription: PrescriptionReference } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const targetIndex = (currentState.prescriptions || []).findIndex(
    (p) => p.id === prescriptionId && p.pharmacyId === pharmacyId
  );
  if (targetIndex < 0) {
    throw new Error('Prescription record not found.');
  }

  const existing = currentState.prescriptions[targetIndex];
  const updated: PrescriptionReference = {
    ...existing,
    referenceNumber: updates.referenceNumber?.trim().toUpperCase() || existing.referenceNumber,
    issueDate: updates.issueDate || existing.issueDate,
    prescriberName: updates.prescriberName?.trim() || existing.prescriberName,
    prescriberRegistration: updates.prescriberRegistration?.trim() || existing.prescriberRegistration,
    prescriberContact: updates.prescriberContact?.trim() || existing.prescriberContact,
    hospitalClinic: updates.hospitalClinic?.trim() || existing.hospitalClinic,
    expiryDate: updates.expiryDate || existing.expiryDate,
    notes: updates.notes?.trim() || existing.notes,
    attachmentUrl: updates.attachmentUrl?.trim() || existing.attachmentUrl,
    updatedAt: new Date().toISOString()
  };

  const updatedPrescriptions = [...currentState.prescriptions];
  updatedPrescriptions[targetIndex] = updated;

  const nextState: InventoryState = {
    ...currentState,
    prescriptions: updatedPrescriptions
  };

  saveDemoInventory(nextState);
  return { nextState, prescription: updated };
}

export function deletePrescription(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  prescriptionId: string
): InventoryState {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const updatedPrescriptions = (currentState.prescriptions || []).filter(
    (p) => !(p.id === prescriptionId && p.pharmacyId === pharmacyId)
  );

  const nextState: InventoryState = {
    ...currentState,
    prescriptions: updatedPrescriptions
  };

  saveDemoInventory(nextState);
  return nextState;
}


/**
 * Links an existing sale/invoice to a patient for purchase-history tracking.
 */
export function linkSaleToPatient(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  saleId: string,
  patientId: string
): InventoryState {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);

  const patient = (currentState.patients || []).find(
    (p) => p.id === patientId && p.pharmacyId === pharmacyId
  );
  if (!patient) {
    throw new Error('Patient record not found for this pharmacy tenant.');
  }

  const saleIndex = (currentState.sales || []).findIndex(
    (s) => s.id === saleId && s.pharmacyId === pharmacyId
  );
  if (saleIndex < 0) {
    throw new Error('Sale record not found for this pharmacy tenant.');
  }

  const existingSale = currentState.sales[saleIndex];
  if (existingSale.patientId && existingSale.patientId !== patientId) {
    throw new Error('This sale is already linked to another patient.');
  }

  const updatedSales = [...currentState.sales];
  updatedSales[saleIndex] = { ...existingSale, patientId };

  const nextState: InventoryState = {
    ...currentState,
    sales: updatedSales
  };

  saveDemoInventory(nextState);
  return nextState;
}


/**
 * ========================================================
 * E-Prescription & OPD Corner Functions
 * ========================================================
 */
function generatePrescriptionRef(pharmacyCode: string): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${pharmacyCode}-EP-${dateStr}-${random}`;
}

function getPharmacyCode(state: InventoryState, pharmacyId: string): string {
  const pharmacy = state.pharmacies.find(p => p.id === pharmacyId);
  if (!pharmacy) return 'MED';
  // Generate code from pharmacy name: first 3 letters uppercase
  return pharmacy.name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'MED';
}

export function createDoctor(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  input: CreateDoctorInput
): { nextState: InventoryState; doctor: Doctor } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const now = new Date().toISOString();
  
  const newDoctor: Doctor = {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    pharmacyId,
    name: input.name.trim(),
    mobile: input.mobile.trim(),
    email: input.email.trim(),
    designation: input.designation.trim(),
    degree: input.degree.trim(),
    specialization: input.specialization,
    registrationNumber: input.registrationNumber.trim(),
    hospitalClinic: input.hospitalClinic?.trim(),
    isActive: true,
    createdAt: now,
    updatedAt: now
  };

  const updatedDoctors = [newDoctor, ...(currentState.doctors || [])];
  const nextState: InventoryState = {
    ...currentState,
    doctors: updatedDoctors
  };

  saveDemoInventory(nextState);
  return { nextState, doctor: newDoctor };
}

export function updateDoctor(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  doctorId: string,
  updates: Partial<UpdateDoctorInput>
): { nextState: InventoryState; doctor: Doctor } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const doctorIndex = (currentState.doctors || []).findIndex(
    (d) => d.id === doctorId && d.pharmacyId === pharmacyId
  );
  if (doctorIndex < 0) {
    throw new Error('Doctor record not found for this pharmacy tenant.');
  }

  const existing = currentState.doctors[doctorIndex];
  const updated: Doctor = {
    ...existing,
    name: updates.name?.trim() || existing.name,
    mobile: updates.mobile?.trim() || existing.mobile,
    email: updates.email?.trim() || existing.email,
    designation: updates.designation?.trim() || existing.designation,
    degree: updates.degree?.trim() || existing.degree,
    specialization: updates.specialization || existing.specialization,
    registrationNumber: updates.registrationNumber?.trim() || existing.registrationNumber,
    hospitalClinic: updates.hospitalClinic?.trim() || existing.hospitalClinic,
    isActive: updates.isActive !== undefined ? updates.isActive : existing.isActive,
    updatedAt: new Date().toISOString()
  };

  const updatedDoctors = [...(currentState.doctors || [])];
  updatedDoctors[doctorIndex] = updated;

  const nextState: InventoryState = {
    ...currentState,
    doctors: updatedDoctors
  };

  saveDemoInventory(nextState);
  return { nextState, doctor: updated };
}

export function deleteDoctor(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  doctorId: string
): InventoryState {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const updatedDoctors = (currentState.doctors || []).filter(
    (d) => !(d.id === doctorId && d.pharmacyId === pharmacyId)
  );

  const nextState: InventoryState = {
    ...currentState,
    doctors: updatedDoctors
  };

  saveDemoInventory(nextState);
  return nextState;
}

export function createEPrescription(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  input: CreateEPrescriptionInput
): { nextState: InventoryState; prescription: EPrescription } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const pharmacyCode = getPharmacyCode(currentState, pharmacyId);
  const now = new Date().toISOString();
  
  // Fetch doctor details
  let doctor = (currentState.doctors || []).find(d => d.id === input.doctorId && d.pharmacyId === pharmacyId);
  if (!doctor) {
    doctor = (currentState.doctors || []).find(d => d.id === input.doctorId);
  }
  if (!doctor && (currentState.doctors || []).length > 0) {
    doctor = currentState.doctors[0];
  }
  if (!doctor) {
    doctor = {
      id: input.doctorId || 'doc-default',
      pharmacyId,
      name: 'Dr. Medical Practitioner',
      mobile: '+91 98765 43210',
      email: 'doctor@clinic.com',
      designation: 'Attending Physician',
      degree: 'MBBS, MD',
      specialization: 'GENERAL_PHYSICIAN',
      registrationNumber: 'MCI-84920',
      hospitalClinic: 'Medi5 Clinic',
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
  }

  const referenceNumber = generatePrescriptionRef(pharmacyCode);
  
  const SCHEDULE_H1_KEYWORDS = ['alprazolam', 'tramadol', 'diazepam', 'zolpidem', 'cefixime', 'cefpodoxime', 'levofloxacin', 'moxifloxacin', 'meropenem', 'clobazam', 'lorazepam'];

  const medications: EPrescriptionMedication[] = input.medications.map((m, idx) => {
    const isH1 = m.isScheduleH1 || SCHEDULE_H1_KEYWORDS.some(k => m.medicineName.toLowerCase().includes(k) || (m.genericName && m.genericName.toLowerCase().includes(k)));
    return {
      id: `med-${Date.now()}-${idx}`,
      medicineId: m.medicineId,
      medicineName: m.medicineName.trim(),
      genericName: m.genericName?.trim(),
      genericComposition: m.genericComposition?.trim() || m.genericName?.trim() || m.medicineName.trim(),
      strength: m.strength.trim(),
      dosageForm: m.dosageForm,
      dosage: m.dosage.trim(),
      frequency: m.frequency,
      duration: m.duration.trim(),
      durationType: m.durationType,
      quantity: m.quantity,
      instructions: m.instructions?.trim() || '',
      isLifetime: m.durationType === 'LIFETIME',
      isScheduleH1: isH1
    };
  });

  const hasScheduleH1 = medications.some(m => m.isScheduleH1);
  const validityDays = input.validityDays || 30;
  const validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const maxRefillsAllowed = input.maxRefillsAllowed !== undefined 
    ? input.maxRefillsAllowed 
    : (medications.some(m => m.isLifetime) ? 3 : 0);
  const verificationCode = `VRX-${Math.floor(100000 + Math.random() * 900000)}`;

  const tests = input.tests.map((t, idx) => ({
    id: `test-${Date.now()}-${idx}`,
    testName: t.testName.trim(),
    instructions: t.instructions?.trim(),
    isUrgent: t.isUrgent || false
  }));

  const followUps = input.followUps.map((f, idx) => ({
    id: `fu-${Date.now()}-${idx}`,
    followUpDate: f.followUpDate,
    frequency: f.frequency,
    customDays: f.customDays,
    notes: f.notes?.trim(),
    isCompleted: false
  }));

  const nextFollowUpDate = followUps
    .filter(f => f.followUpDate)
    .map(f => new Date(f.followUpDate).getTime())
    .sort((a, b) => a - b)[0];

  const newPrescription: EPrescription = {
    id: `epresc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    pharmacyId,
    referenceNumber,
    generatedAt: now,
    generatedBy: doctor.name,
    
    doctorId: doctor.id,
    doctorName: doctor.name,
    doctorMobile: doctor.mobile,
    doctorDesignation: doctor.designation,
    doctorDegree: doctor.degree,
    doctorSpecialization: doctor.specialization,
    doctorRegistrationNumber: doctor.registrationNumber,
    doctorEmail: doctor.email,
    doctorHospitalClinic: doctor.hospitalClinic,
    
    patientId: input.patientId,
    patientName: input.patientName.trim(),
    patientAge: input.patientAge,
    patientGender: input.patientGender,
    patientPhone: input.patientPhone.trim(),
    patientEmail: input.patientEmail?.trim(),
    patientAddress: input.patientAddress?.trim(),
    patientWeight: input.patientWeight,
    patientHeight: input.patientHeight,
    patientKnownAllergies: input.patientKnownAllergies?.trim(),
    abhaId: input.abhaId?.trim(),

    validityDays,
    validUntil,
    maxRefillsAllowed,
    refillsDispensed: 0,
    verificationCode,
    isScheduleH1Prescribed: hasScheduleH1,
    
    chiefComplaint: input.chiefComplaint.trim(),
    diagnosis: input.diagnosis.trim(),
    checkupsDone: input.checkupsDone.trim(),
    clinicalNotes: input.clinicalNotes?.trim(),
    
    medications,
    tests,
    followUps,
    nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate).toISOString() : undefined,
    
    status: 'ACTIVE',
    dispensedMedications: [],
    sharedVia: [],
    
    createdAt: now,
    updatedAt: now
  };

  const updatedPrescriptions = [newPrescription, ...(currentState.ePrescriptions || [])];
  const nextState: InventoryState = {
    ...currentState,
    ePrescriptions: updatedPrescriptions
  };

  saveDemoInventory(nextState);
  return { nextState, prescription: newPrescription };
}

export function updateEPrescriptionStatus(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  prescriptionId: string,
  status: PrescriptionStatus,
  dispensedMeds?: Array<{ medicationId: string; quantityDispensed: number; batchNumbers: string[] }>,
  dispensedBy?: string
): { nextState: InventoryState; prescription: EPrescription } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const prescIndex = (currentState.ePrescriptions || []).findIndex(
    (p) => p.id === prescriptionId && p.pharmacyId === pharmacyId
  );
  if (prescIndex < 0) {
    throw new Error('E-Prescription not found for this pharmacy tenant.');
  }

  const existing = currentState.ePrescriptions[prescIndex];
  const updated: EPrescription = {
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
    dispensedAt: status === 'DISPENSED' || status === 'PARTIALLY_DISPENSED' ? new Date().toISOString() : existing.dispensedAt,
    dispensedBy: dispensedBy || existing.dispensedBy,
    dispensedMedications: dispensedMeds 
      ? [...existing.dispensedMedications, ...dispensedMeds.map(dm => ({
          ...dm,
          dispensedAt: new Date().toISOString()
        }))]
      : existing.dispensedMedications
  };

  const updatedPrescriptions = [...(currentState.ePrescriptions || [])];
  updatedPrescriptions[prescIndex] = updated;

  const nextState: InventoryState = {
    ...currentState,
    ePrescriptions: updatedPrescriptions
  };

  saveDemoInventory(nextState);
  return { nextState, prescription: updated };
}

export function shareEPrescription(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  prescriptionId: string,
  method: 'WHATSAPP' | 'EMAIL' | 'PRINT' | 'SMS'
): { nextState: InventoryState; prescription: EPrescription } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const prescIndex = (currentState.ePrescriptions || []).findIndex(
    (p) => p.id === prescriptionId && p.pharmacyId === pharmacyId
  );
  if (prescIndex < 0) {
    throw new Error('E-Prescription not found for this pharmacy tenant.');
  }

  const existing = currentState.ePrescriptions[prescIndex];
  const updated: EPrescription = {
    ...existing,
    sharedVia: [...new Set([...existing.sharedVia, method])],
    sharedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const updatedPrescriptions = [...(currentState.ePrescriptions || [])];
  updatedPrescriptions[prescIndex] = updated;

  const nextState: InventoryState = {
    ...currentState,
    ePrescriptions: updatedPrescriptions
  };

  saveDemoInventory(nextState);
  return { nextState, prescription: updated };
}

export function registerPatientFromPrescription(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  prescriptionId: string
): { nextState: InventoryState; patient: any; createdPatientIds: string[] } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const prescription = (currentState.ePrescriptions || []).find(
    (p) => p.id === prescriptionId && p.pharmacyId === pharmacyId
  );
  if (!prescription) {
    throw new Error('E-Prescription not found for this pharmacy tenant.');
  }

  // Check if patient already exists by phone
  let patient = (currentState.patients || []).find(
    (p) => p.phone === prescription.patientPhone && p.pharmacyId === pharmacyId
  );

  const createdPatientIds: string[] = [];
  
  if (!patient) {
    // Create new patient
    const now = new Date().toISOString();
    patient = {
      id: `pat-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      pharmacyId,
      name: prescription.patientName,
      phone: prescription.patientPhone,
      email: prescription.patientEmail,
      age: prescription.patientAge,
      gender: prescription.patientGender,
      address: prescription.patientAddress,
      notes: `Auto-registered from e-prescription ${prescription.referenceNumber}. Allergies: ${prescription.patientKnownAllergies || 'None'}`,
      status: 'ACTIVE' as any,
      communicationPreference: 'WHATSAPP',
      consentGiven: true,
      consentDate: new Date().toISOString(),
      createdAt: now,
      updatedAt: now
    };

    const updatedPatients = [patient, ...(currentState.patients || [])];
    currentState.patients = updatedPatients;
    createdPatientIds.push(patient.id);
  }

  // Register lifetime medications
  const lifetimeMeds = prescription.medications.filter(m => m.isLifetime);
  for (const med of lifetimeMeds) {
    // Check if medication already exists for this patient
    const existingMed = (currentState.refills || []).find(
      r => r.patientId === patient!.id && r.medicineName === med.medicineName && r.pharmacyId === pharmacyId
    );
    if (!existingMed) {
      const newMed = {
        id: `refill-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        pharmacyId,
        patientId: patient!.id,
        medicineId: med.medicineId || '',
        medicineName: med.medicineName,
        strength: med.strength,
        dosageForm: med.dosageForm,
        dailyDosage: `${med.dosage} ${med.frequency}`,
        quantityPerRefill: med.quantity,
        daysSupply: med.durationType === 'LIFETIME' ? 90 : 30, // 90 days for lifetime
        lastDispensedDate: new Date().toISOString().split('T')[0],
        nextRefillDueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'UPCOMING' as any,
        reminderCount: 0
      };
      currentState.refills = [newMed, ...(currentState.refills || [])];
    }
  }

  // For temporary medications, create with expiry based on follow-up
  const tempMeds = prescription.medications.filter(m => !m.isLifetime);
  for (const med of tempMeds) {
    const existingMed = (currentState.refills || []).find(
      r => r.patientId === patient!.id && r.medicineName === med.medicineName && r.pharmacyId === pharmacyId
    );
    if (!existingMed) {
      // Calculate days supply from duration string (e.g., "7 days", "30 days")
      let daysSupply = 30;
      const durationMatch = med.duration.match(/(\d+)\s*(day|week|month)/i);
      if (durationMatch) {
        const num = parseInt(durationMatch[1]);
        const unit = durationMatch[2].toLowerCase();
        if (unit.startsWith('day')) daysSupply = num;
        else if (unit.startsWith('week')) daysSupply = num * 7;
        else if (unit.startsWith('month')) daysSupply = num * 30;
      }
      
      const newMed = {
        id: `refill-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        pharmacyId,
        patientId: patient!.id,
        medicineId: med.medicineId || '',
        medicineName: med.medicineName,
        strength: med.strength,
        dosageForm: med.dosageForm,
        dailyDosage: `${med.dosage} ${med.frequency}`,
        quantityPerRefill: med.quantity,
        daysSupply,
        lastDispensedDate: new Date().toISOString().split('T')[0],
        nextRefillDueDate: new Date(Date.now() + daysSupply * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'UPCOMING' as any,
        reminderCount: 0
      };
      currentState.refills = [newMed, ...(currentState.refills || [])];
    }
  }

  const nextState: InventoryState = { ...currentState };
  saveDemoInventory(nextState);
  return { nextState, patient: patient!, createdPatientIds };
}

export function cleanupTemporaryPatients(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined
): InventoryState {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  // Find patients who only have temporary medications and whose follow-up period has expired
  const patientsToCheck = (currentState.patients || []).filter(p => p.pharmacyId === pharmacyId);
  
  for (const patient of patientsToCheck) {
    const patientMeds = (currentState.refills || []).filter(r => r.patientId === patient.id && r.pharmacyId === pharmacyId);
    const hasLifetimeMeds = patientMeds.some(_med => {
      // Check if medication was originally from a lifetime prescription
      const prescription = (currentState.ePrescriptions || []).find(p => 
        p.pharmacyId === pharmacyId && 
        p.medications.some(m => m.medicineName === _med.medicineName && m.isLifetime)
      );
      return !!prescription;
    });
    
    if (!hasLifetimeMeds && patientMeds.length > 0) {
      // Check if all medications have expired their follow-up period
      const latestFollowUp = patientMeds.reduce((latest, med) => {
        const medDate = new Date(med.nextRefillDueDate).getTime();
        return medDate > latest ? medDate : latest;
      }, 0);
      
      // If latest follow-up was more than 30 days ago, clean up
      if (Date.now() - latestFollowUp > 30 * 24 * 60 * 60 * 1000) {
        // Remove patient and their medications
        currentState.patients = currentState.patients!.filter(p => p.id !== patient.id);
        currentState.refills = currentState.refills!.filter(r => r.patientId !== patient.id);
      }
    }
  }

  const nextState: InventoryState = { ...currentState };
  saveDemoInventory(nextState);
  return nextState;
}

// ============================================================================
// PHASE 6: INTEGRATED DOCTOR APPOINTMENT & CHAMBER MANAGEMENT REPOSITORY
// ============================================================================

/**
 * Creates a new doctor appointment with auto-assigned daily running token number.
 */
export function createAppointment(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  input: CreateAppointmentInput,
  bookedBy: string = 'Staff Reception'
): { nextState: InventoryState; appointment: DoctorAppointment } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);

  if (!input.patientName || !input.patientName.trim()) {
    throw new Error('Appointment booking failed: Patient name is required.');
  }

  if (!input.patientPhone || !input.patientPhone.trim()) {
    throw new Error('Appointment booking failed: Patient contact number is required.');
  }

  if (!input.doctorId) {
    throw new Error('Appointment booking failed: Doctor must be selected.');
  }

  const doctor = (currentState.doctors || []).find((d) => d.id === input.doctorId && d.pharmacyId === pharmacyId);
  if (!doctor) {
    throw new Error(`Doctor with ID "${input.doctorId}" not found for this pharmacy.`);
  }

  const apptDate = input.appointmentDate || new Date().toISOString().split('T')[0];

  // Calculate next running daily token for this doctor on this date
  const doctorDateAppointments = (currentState.appointments || []).filter(
    (a) => a.pharmacyId === pharmacyId && a.doctorId === doctor.id && a.appointmentDate === apptDate
  );
  const tokenNumber = doctorDateAppointments.length + 1;
  const docCode = doctor.id.replace(/[^0-9]/g, '') || '1';
  const dateCompact = apptDate.replace(/-/g, '');
  const tokenCode = `APT-${dateCompact}-D${docCode}-${String(tokenNumber).padStart(3, '0')}`;

  const todayStr = new Date().toISOString().split('T')[0];
  const initialStatus: AppointmentStatus = apptDate === todayStr ? 'WAITING' : 'SCHEDULED';

  const newAppointment: DoctorAppointment = {
    id: `apt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    pharmacyId,
    tokenNumber,
    tokenCode,
    doctorId: doctor.id,
    doctorName: doctor.name,
    doctorSpecialization: doctor.specialization,
    doctorDegree: doctor.degree,
    patientId: input.patientId,
    patientName: input.patientName.trim(),
    patientPhone: input.patientPhone.trim(),
    patientAge: Number(input.patientAge) || 30,
    patientGender: input.patientGender || 'MALE',
    patientEmail: input.patientEmail?.trim() || undefined,
    patientAddress: input.patientAddress?.trim() || undefined,
    appointmentDate: apptDate,
    timeSlot: input.timeSlot || '10:00 AM - 10:15 AM',
    type: input.type || 'IN_CLINIC',
    priority: input.priority || 'NORMAL',
    status: initialStatus,
    chiefComplaint: input.chiefComplaint?.trim() || 'General Health Checkup & Consultation',
    vitals: input.vitals,
    consultationFee: typeof input.consultationFee === 'number' ? input.consultationFee : 500,
    paymentStatus: input.paymentStatus || 'PENDING',
    paymentMode: input.paymentMode,
    notes: input.notes?.trim() || undefined,
    bookedBy,
    bookedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const nextState: InventoryState = {
    ...currentState,
    appointments: [newAppointment, ...(currentState.appointments || [])]
  };

  saveDemoInventory(nextState);
  return { nextState, appointment: newAppointment };
}

/**
 * Updates an appointment's operational status and lifecycle timestamps.
 */
export function updateAppointmentStatus(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  appointmentId: string,
  newStatus: AppointmentStatus,
  paymentStatus?: PaymentStatus,
  paymentMode?: PaymentMode
): { nextState: InventoryState; appointment: DoctorAppointment } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const aptIndex = (currentState.appointments || []).findIndex(
    (a) => a.id === appointmentId && a.pharmacyId === pharmacyId
  );

  if (aptIndex === -1) {
    throw new Error(`Appointment with ID "${appointmentId}" not found for this pharmacy.`);
  }

  const existing = currentState.appointments[aptIndex];
  const now = new Date().toISOString();

  const updated: DoctorAppointment = {
    ...existing,
    status: newStatus,
    paymentStatus: paymentStatus || existing.paymentStatus,
    paymentMode: paymentMode || existing.paymentMode,
    calledAt: newStatus === 'IN_CONSULTATION' && !existing.calledAt ? now : existing.calledAt,
    completedAt: newStatus === 'COMPLETED' ? now : existing.completedAt,
    updatedAt: now
  };

  const updatedAppointments = [...currentState.appointments];
  updatedAppointments[aptIndex] = updated;

  const nextState: InventoryState = {
    ...currentState,
    appointments: updatedAppointments
  };

  saveDemoInventory(nextState);
  return { nextState, appointment: updated };
}

/**
 * Records or updates clinical vitals for an appointment.
 */
export function updateAppointmentVitals(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  appointmentId: string,
  vitals: PatientVitals
): { nextState: InventoryState; appointment: DoctorAppointment } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const aptIndex = (currentState.appointments || []).findIndex(
    (a) => a.id === appointmentId && a.pharmacyId === pharmacyId
  );

  if (aptIndex === -1) {
    throw new Error(`Appointment with ID "${appointmentId}" not found for this pharmacy.`);
  }

  const existing = currentState.appointments[aptIndex];
  const updated: DoctorAppointment = {
    ...existing,
    vitals: {
      ...existing.vitals,
      ...vitals,
      recordedAt: new Date().toISOString()
    },
    updatedAt: new Date().toISOString()
  };

  const updatedAppointments = [...currentState.appointments];
  updatedAppointments[aptIndex] = updated;

  const nextState: InventoryState = {
    ...currentState,
    appointments: updatedAppointments
  };

  saveDemoInventory(nextState);
  return { nextState, appointment: updated };
}

/**
 * Links a newly generated E-Prescription to an appointment and marks it completed.
 */
export function linkPrescriptionToAppointment(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  appointmentId: string,
  prescriptionId: string
): { nextState: InventoryState; appointment: DoctorAppointment } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const aptIndex = (currentState.appointments || []).findIndex(
    (a) => a.id === appointmentId && a.pharmacyId === pharmacyId
  );

  if (aptIndex === -1) {
    throw new Error(`Appointment with ID "${appointmentId}" not found for this pharmacy.`);
  }

  const existing = currentState.appointments[aptIndex];
  const updated: DoctorAppointment = {
    ...existing,
    prescriptionId,
    status: 'COMPLETED',
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const updatedAppointments = [...currentState.appointments];
  updatedAppointments[aptIndex] = updated;

  const nextState: InventoryState = {
    ...currentState,
    appointments: updatedAppointments
  };

  saveDemoInventory(nextState);
  return { nextState, appointment: updated };
}

/**
 * Deletes an appointment safely within tenant boundaries.
 */
export function deleteAppointment(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  appointmentId: string
): InventoryState {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const exists = (currentState.appointments || []).some(
    (a) => a.id === appointmentId && a.pharmacyId === pharmacyId
  );

  if (!exists) {
    throw new Error(`Appointment with ID "${appointmentId}" not found for this pharmacy.`);
  }

  const nextState: InventoryState = {
    ...currentState,
    appointments: currentState.appointments.filter((a) => a.id !== appointmentId || a.pharmacyId !== pharmacyId)
  };

  saveDemoInventory(nextState);
  return nextState;
}

/**
 * Saves or updates a doctor's weekly consultation schedule.
 */
export function saveDoctorSchedule(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  schedule: Omit<DoctorScheduleSlot, 'id' | 'pharmacyId'> & { id?: string }
): { nextState: InventoryState; schedule: DoctorScheduleSlot } {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const existingSchedules = currentState.doctorSchedules || [];

  let savedSlot: DoctorScheduleSlot;
  let updatedSchedules: DoctorScheduleSlot[];

  if (schedule.id) {
    const idx = existingSchedules.findIndex((s) => s.id === schedule.id && s.pharmacyId === pharmacyId);
    if (idx === -1) {
      throw new Error(`Schedule with ID "${schedule.id}" not found.`);
    }
    savedSlot = {
      ...existingSchedules[idx],
      ...schedule,
      id: schedule.id,
      pharmacyId
    };
    updatedSchedules = [...existingSchedules];
    updatedSchedules[idx] = savedSlot;
  } else {
    savedSlot = {
      ...schedule,
      id: `sched-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      pharmacyId
    };
    updatedSchedules = [...existingSchedules, savedSlot];
  }

  const nextState: InventoryState = {
    ...currentState,
    doctorSchedules: updatedSchedules
  };

  saveDemoInventory(nextState);
  return { nextState, schedule: savedSlot };
}

/**
 * Deletes a doctor schedule slot.
 */
export function deleteDoctorSchedule(
  currentState: InventoryState,
  requestedPharmacyId: string | undefined,
  scheduleId: string
): InventoryState {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId);
  const nextState: InventoryState = {
    ...currentState,
    doctorSchedules: (currentState.doctorSchedules || []).filter(
      (s) => s.id !== scheduleId || s.pharmacyId !== pharmacyId
    )
  };

  saveDemoInventory(nextState);
  return nextState;
}
