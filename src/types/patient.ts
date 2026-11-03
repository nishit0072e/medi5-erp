/**
 * Patient & Chronic Refill Management Types (Phase 3)
 * Strict multi-tenant isolation by pharmacyId.
 */

export type RefillStatus = 'UPCOMING' | 'DUE_TODAY' | 'OVERDUE' | 'COMPLETED' | 'PAUSED' | 'SNOOZED' | 'CANCELLED';

export type PatientStatus = 'ACTIVE' | 'INACTIVE';

export type CommunicationPreference = 'WHATSAPP' | 'SMS' | 'CALL' | 'NONE';

export interface Patient {
  id: string;
  pharmacyId: string;
  name: string;
  phone: string;
  email?: string;
  age?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address?: string;
  notes?: string;
  status: PatientStatus;
  communicationPreference: CommunicationPreference;
  consentGiven: boolean;
  consentDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrescriptionReference {
  id: string;
  pharmacyId: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface PatientMedication {
  id: string;
  pharmacyId: string;
  patientId: string;
  medicineId: string;
  medicineName: string;
  strength: string;
  dosageForm: string;
  dailyDosage: string; // e.g. "1 tab daily after meals"
  quantityPerRefill: number; // e.g. 30 tabs
  daysSupply: number; // e.g. 30 days
  lastDispensedDate: string; // ISO string "YYYY-MM-DD"
  nextRefillDueDate: string; // ISO string "YYYY-MM-DD"
  status: RefillStatus;
  lastReminderSentAt?: string;
  reminderCount: number;
}

export interface WhatsAppReminderLog {
  id: string;
  pharmacyId: string;
  patientId: string;
  medicationId: string;
  patientName: string;
  patientPhone: string;
  messageText: string;
  sentAt: string;
  initiatedByStaff: string;
}

export interface CreatePatientInput {
  name: string;
  phone: string;
  email?: string;
  age?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address?: string;
  notes?: string;
  communicationPreference?: CommunicationPreference;
  consentGiven?: boolean;
  initialMedication?: {
    medicineId: string;
    medicineName: string;
    strength: string;
    dosageForm: string;
    dailyDosage: string;
    quantityPerRefill: number;
    daysSupply: number;
    lastDispensedDate: string;
  };
}

export interface AddMedicationInput {
  medicineId: string;
  medicineName: string;
  strength: string;
  dosageForm: string;
  dailyDosage: string;
  quantityPerRefill: number;
  daysSupply: number;
  lastDispensedDate: string;
}

export interface UpdatePatientInput {
  name?: string;
  phone?: string;
  email?: string;
  age?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address?: string;
  notes?: string;
  status?: PatientStatus;
  communicationPreference?: CommunicationPreference;
  consentGiven?: boolean;
}

