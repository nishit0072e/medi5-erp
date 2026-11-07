/**
 * E-Prescription & OPD Corner Domain Models for Medi5 ERP
 * 
 * Doctor's Corner: E-prescription creation by doctors
 * OPD Corner: Pharmacist access, dispensing, sharing
 * Patient auto-registration with lifetime/temporary medication logic
 */

export type DoctorSpecialization = 
  | 'GENERAL_PHYSICIAN' 
  | 'CARDIOLOGIST' 
  | 'DERMATOLOGIST' 
  | 'ORTHOPEDIC' 
  | 'PEDIATRICIAN' 
  | 'GYNECOLOGIST' 
  | 'NEUROLOGIST' 
  | 'PSYCHIATRIST' 
  | 'ENT' 
  | 'OPHTHALMOLOGIST' 
  | 'DENTIST' 
  | 'OTHER';

export type PrescriptionStatus = 'ACTIVE' | 'DISPENSED' | 'PARTIALLY_DISPENSED' | 'CANCELLED' | 'EXPIRED';

export type MedicationDurationType = 'LIFETIME' | 'SHORT_TERM' | 'AS_NEEDED';

export type FollowUpFrequency = 'NONE' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'CUSTOM';

export interface Doctor {
  id: string;
  pharmacyId: string;
  name: string;
  mobile: string;
  email: string;
  designation: string; // e.g. "Senior Consultant", "Medical Officer"
  degree: string; // e.g. "MBBS, MD (Medicine)"
  specialization: DoctorSpecialization;
  registrationNumber: string; // Medical council registration
  hospitalClinic?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDoctorInput {
  name: string;
  mobile: string;
  email: string;
  designation: string;
  degree: string;
  specialization: DoctorSpecialization;
  registrationNumber: string;
  hospitalClinic?: string;
}

export interface UpdateDoctorInput {
  name?: string;
  mobile?: string;
  email?: string;
  designation?: string;
  degree?: string;
  specialization?: DoctorSpecialization;
  registrationNumber?: string;
  hospitalClinic?: string;
  isActive?: boolean;
}

export interface EPrescriptionMedication {
  id: string;
  medicineId?: string; // Optional link to inventory medicine
  medicineName: string;
  genericName?: string;
  genericComposition?: string; // Active salt composition (NMC generic naming)
  strength: string;
  dosageForm: string;
  dosage: string; // e.g. "1 tab", "5 ml", "1 cap"
  frequency: string; // e.g. "OD", "BD", "TDS", "SOS", "1-0-1"
  duration: string; // e.g. "7 days", "30 days", "Lifetime"
  durationType: MedicationDurationType;
  quantity: number; // Total quantity prescribed
  instructions: string; // e.g. "After meals", "Before bed", "Empty stomach"
  isLifetime: boolean; // true if lifetime continuing medication
  isScheduleH1?: boolean; // Schedule H1 regulatory warning
}

export interface EPrescriptionTest {
  id: string;
  testName: string;
  instructions?: string;
  isUrgent: boolean;
}

export interface EPrescriptionFollowUp {
  id: string;
  followUpDate: string; // ISO date
  frequency: FollowUpFrequency;
  customDays?: number; // For CUSTOM frequency
  notes?: string;
  isCompleted: boolean;
}

export interface EPrescription {
  id: string;
  pharmacyId: string;
  referenceNumber: string; // Format: PHARMACY_CODE-EP-YYYYMMDD-XXXX
  generatedAt: string; // ISO timestamp
  generatedBy: string; // Doctor name
  
  // Doctor Details (auto-fetched)
  doctorId: string;
  doctorName: string;
  doctorMobile: string;
  doctorDesignation: string;
  doctorDegree: string;
  doctorSpecialization: DoctorSpecialization;
  doctorRegistrationNumber: string;
  doctorEmail: string;
  doctorHospitalClinic?: string;
  
  // Patient Details
  patientId?: string; // If patient already registered
  patientName: string;
  patientAge: number;
  patientGender: 'MALE' | 'FEMALE' | 'OTHER';
  patientPhone: string;
  patientEmail?: string;
  patientAddress?: string;
  patientWeight?: number; // in kg
  patientHeight?: number; // in cm
  patientKnownAllergies?: string;
  abhaId?: string; // Ayushman Bharat Health Account ID (14 digits)

  // Regulatory Validity & Refill Controls
  validityDays?: number; // e.g. 30 days
  validUntil?: string; // ISO date format
  maxRefillsAllowed?: number; // Maximum refills permitted (0 for acute, 1-3 for chronic)
  refillsDispensed?: number;
  verificationCode?: string; // Tamper-evident verification token (e.g. RX-9942)
  isScheduleH1Prescribed?: boolean; // Audit flag if any Schedule H1 drug is included
  
  // Clinical Details
  chiefComplaint: string;
  diagnosis: string;
  checkupsDone: string; // e.g. "BP: 120/80, HR: 72, Temp: 98.6°F"
  clinicalNotes?: string;
  
  // Medications
  medications: EPrescriptionMedication[];
  
  // Tests
  tests: EPrescriptionTest[];
  
  // Follow-up
  followUps: EPrescriptionFollowUp[];
  nextFollowUpDate?: string;
  
  // Status & Dispensing
  status: PrescriptionStatus;
  dispensedAt?: string;
  dispensedBy?: string; // Pharmacist name
  dispensedMedications: Array<{
    medicationId: string;
    quantityDispensed: number;
    batchNumbers: string[];
    dispensedAt: string;
    dispensedBy?: string;
  }>;
  
  // Sharing
  sharedVia: Array<'WHATSAPP' | 'EMAIL' | 'PRINT' | 'SMS'>;
  sharedAt?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface CreateEPrescriptionInput {
  doctorId: string;
  
  // Patient Details
  patientId?: string;
  patientName: string;
  patientAge: number;
  patientGender: 'MALE' | 'FEMALE' | 'OTHER';
  patientPhone: string;
  patientEmail?: string;
  patientAddress?: string;
  patientWeight?: number;
  patientHeight?: number;
  patientKnownAllergies?: string;
  abhaId?: string;
  validityDays?: number;
  maxRefillsAllowed?: number;
  
  // Clinical Details
  chiefComplaint: string;
  diagnosis: string;
  checkupsDone: string;
  clinicalNotes?: string;
  
  // Medications
  medications: Omit<EPrescriptionMedication, 'id'>[];
  
  // Tests
  tests: Omit<EPrescriptionTest, 'id'>[];
  
  // Follow-up
  followUps: Omit<EPrescriptionFollowUp, 'id'>[];
}

export interface OPDCornerFilters {
  status?: PrescriptionStatus;
  doctorId?: string;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

export interface PatientRegistrationFromPrescription {
  // Auto-registration logic
  shouldRegister: boolean;
  registrationType: 'PERMANENT' | 'TEMPORARY';
  lifetimeMedications: string[]; // Medication names marked as lifetime
  temporaryMedications: string[]; // Medication names with duration
  followUpDurationDays: number; // For temporary patients
}

// PDF Document Types for Business Documents
export type BusinessDocumentType = 'SOA' | 'PROFIT_LOSS' | 'INCOME_EXPENDITURE';

export interface BusinessDocumentConfig {
  type: BusinessDocumentType;
  pharmacyId: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  generatedBy: string;
}

export interface SOAData {
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyPhone: string;
  pharmacyEmail: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  transactions: Array<{
    date: string;
    type: 'SALE' | 'PURCHASE' | 'PAYMENT' | 'RECEIPT' | 'EXPENSE' | 'ADJUSTMENT';
    reference: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  closingBalance: number;
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  totalPaymentsReceived: number;
  totalPaymentsMade: number;
}

export interface ProfitLossData {
  pharmacyName: string;
  periodStart: string;
  periodEnd: string;
  revenue: {
    sales: number;
    otherIncome: number;
    totalRevenue: number;
  };
  costOfGoodsSold: {
    openingStock: number;
    purchases: number;
    closingStock: number;
    totalCOGS: number;
  };
  grossProfit: number;
  expenses: Array<{
    category: string;
    amount: number;
  }>;
  totalExpenses: number;
  netProfit: number;
}

export interface IncomeExpenditureData {
  pharmacyName: string;
  periodStart: string;
  periodEnd: string;
  income: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  expenditure: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  totalIncome: number;
  totalExpenditure: number;
  surplusDeficit: number;
}