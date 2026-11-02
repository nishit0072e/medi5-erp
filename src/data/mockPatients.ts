/**
 * Synthetic Patient & Refill Seed Data (Phase 3)
 * DISCLAIMER: All names, contact numbers, and prescription details are synthetic fixtures
 * for local testing and demonstration.
 */

import { Patient, PatientMedication, WhatsAppReminderLog } from '../types/patient';

export const MOCK_PATIENTS: Patient[] = [
  // -------------------------------------------------------------------------
  // Nandan Pharmacy (pharm-nandan-kolkata)
  // -------------------------------------------------------------------------
  {
    id: 'pat-nandan-01',
    pharmacyId: 'pharm-nandan-kolkata',
    name: 'Ramesh Chandra Das',
    phone: '9830112345',
    age: 62,
    gender: 'MALE',
    address: '14/2 Rashbehari Avenue, Kolkata 700029',
    notes: 'Chronic diabetic & hypertensive patient. Prefers afternoon WhatsApp reminder.',
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '2026-10-15T10:00:00.000Z'
  },
  {
    id: 'pat-nandan-02',
    pharmacyId: 'pharm-nandan-kolkata',
    name: 'Suniti Banerjee',
    phone: '9830298765',
    age: 58,
    gender: 'FEMALE',
    address: '8B Dover Lane, Kolkata 700029',
    notes: 'Long-term BP medication. Needs doorstep delivery when husband is out.',
    createdAt: '2026-09-15T11:30:00.000Z',
    updatedAt: '2026-10-18T14:20:00.000Z'
  },
  {
    id: 'pat-nandan-03',
    pharmacyId: 'pharm-nandan-kolkata',
    name: 'Anirban Sen',
    phone: '9830345678',
    age: 44,
    gender: 'MALE',
    address: '22 Lake Terrace, Kolkata 700029',
    notes: 'Acid reflux patient. Regular 30-day Pantocid refill.',
    createdAt: '2026-10-01T09:15:00.000Z',
    updatedAt: '2026-10-20T12:00:00.000Z'
  },

  // -------------------------------------------------------------------------
  // Deshbandhu Medical Hall (pharm-deshbandhu-siliguri)
  // -------------------------------------------------------------------------
  {
    id: 'pat-desh-01',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    name: 'Pradip Roy',
    phone: '9434011223',
    age: 65,
    gender: 'MALE',
    address: 'Hill Cart Road, Siliguri 734001',
    notes: 'Cardiac regular patient. Atorvastatin 30-day cycle.',
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z'
  },
  {
    id: 'pat-desh-02',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    name: 'Maya Devi',
    phone: '9434099887',
    age: 54,
    gender: 'FEMALE',
    address: 'Sevoke Road, Siliguri 734001',
    notes: 'Calcium and multivitamin regular prescription.',
    createdAt: '2026-09-25T11:00:00.000Z',
    updatedAt: '2026-10-15T11:00:00.000Z'
  }
];

export const MOCK_PATIENT_MEDICATIONS: PatientMedication[] = [
  // -------------------------------------------------------------------------
  // Nandan Pharmacy Refills
  // -------------------------------------------------------------------------
  {
    id: 'refill-nandan-01',
    pharmacyId: 'pharm-nandan-kolkata',
    patientId: 'pat-nandan-01',
    medicineId: 'med-glycomet-500',
    medicineName: 'Glycomet 500',
    strength: '500 mg',
    dosageForm: 'Tablet',
    dailyDosage: '1 tab twice daily after meals (1-0-1)',
    quantityPerRefill: 2, // 2 strips = 20 tabs
    daysSupply: 10,
    lastDispensedDate: '2026-10-24',
    nextRefillDueDate: '2026-11-03', // e.g. Due Tomorrow / Due Today depending on date
    status: 'UPCOMING',
    reminderCount: 0
  },
  {
    id: 'refill-nandan-02',
    pharmacyId: 'pharm-nandan-kolkata',
    patientId: 'pat-nandan-01',
    medicineId: 'med-dolo-650',
    medicineName: 'Dolo 650',
    strength: '650 mg',
    dosageForm: 'Tablet',
    dailyDosage: '1 tab SOS when in pain / fever',
    quantityPerRefill: 1, // 1 strip
    daysSupply: 15,
    lastDispensedDate: '2026-10-15',
    nextRefillDueDate: '2026-10-30', // Overdue
    status: 'OVERDUE',
    lastReminderSentAt: '2026-10-31T14:30:00.000Z',
    reminderCount: 1
  },
  {
    id: 'refill-nandan-03',
    pharmacyId: 'pharm-nandan-kolkata',
    patientId: 'pat-nandan-02',
    medicineId: 'med-telma-40',
    medicineName: 'Telma 40',
    strength: '40 mg',
    dosageForm: 'Tablet',
    dailyDosage: '1 tab every morning before breakfast (1-0-0)',
    quantityPerRefill: 1, // 1 strip = 30 tabs
    daysSupply: 30,
    lastDispensedDate: '2026-10-03',
    nextRefillDueDate: '2026-11-02', // Due Today
    status: 'DUE_TODAY',
    reminderCount: 0
  },
  {
    id: 'refill-nandan-04',
    pharmacyId: 'pharm-nandan-kolkata',
    patientId: 'pat-nandan-03',
    medicineId: 'med-pantocid-40',
    medicineName: 'Pantocid 40',
    strength: '40 mg',
    dosageForm: 'Tablet',
    dailyDosage: '1 tab daily empty stomach in morning',
    quantityPerRefill: 2, // 2 strips
    daysSupply: 20,
    lastDispensedDate: '2026-10-20',
    nextRefillDueDate: '2026-11-09',
    status: 'UPCOMING',
    reminderCount: 0
  },

  // -------------------------------------------------------------------------
  // Deshbandhu Medical Refills
  // -------------------------------------------------------------------------
  {
    id: 'refill-desh-01',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    patientId: 'pat-desh-01',
    medicineId: 'med-desh-atorva-10',
    medicineName: 'Atorva 10',
    strength: '10 mg',
    dosageForm: 'Tablet',
    dailyDosage: '1 tab at night after dinner (0-0-1)',
    quantityPerRefill: 2,
    daysSupply: 30,
    lastDispensedDate: '2026-10-05',
    nextRefillDueDate: '2026-11-04',
    status: 'UPCOMING',
    reminderCount: 0
  },
  {
    id: 'refill-desh-02',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    patientId: 'pat-desh-02',
    medicineId: 'med-desh-shelcal-500',
    medicineName: 'Shelcal 500',
    strength: '500mg + 250IU',
    dosageForm: 'Tablet',
    dailyDosage: '1 tab after lunch (0-1-0)',
    quantityPerRefill: 2,
    daysSupply: 30,
    lastDispensedDate: '2026-09-28',
    nextRefillDueDate: '2026-10-28', // Overdue
    status: 'OVERDUE',
    reminderCount: 0
  }
];

export const MOCK_REMINDER_LOGS: WhatsAppReminderLog[] = [
  {
    id: 'log-01',
    pharmacyId: 'pharm-nandan-kolkata',
    patientId: 'pat-nandan-01',
    medicationId: 'refill-nandan-02',
    patientName: 'Ramesh Chandra Das',
    patientPhone: '9830112345',
    messageText: 'Namaskar Ramesh Chandra Das, this is a gentle reminder from Nandan Pharmacy for Dolo 650...',
    sentAt: '2026-10-31T14:30:00.000Z',
    initiatedByStaff: 'Priya Das'
  }
];
