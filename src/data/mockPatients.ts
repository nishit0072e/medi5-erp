/**
 * Synthetic Patient & Refill Seed Data (Phase 3)
 * DISCLAIMER: All names, contact numbers, and prescription details are synthetic fixtures
 * for local testing and demonstration.
 */

import { Patient, PatientMedication, WhatsAppReminderLog, PrescriptionReference } from '../types/patient';

export const MOCK_PATIENTS: Patient[] = [
  // -------------------------------------------------------------------------
  // Nandan Pharmacy (pharm-nandan-kolkata)
  // -------------------------------------------------------------------------
  {
    id: 'pat-nandan-01',
    pharmacyId: 'pharm-nandan-kolkata',
    name: 'Ramesh Chandra Das',
    phone: '9830112345',
    email: 'ramesh.das@email.com',
    age: 62,
    gender: 'MALE',
    address: '14/2 Rashbehari Avenue, Kolkata 700029',
    notes: 'Chronic diabetic & hypertensive patient. Prefers afternoon WhatsApp reminder.',
    status: 'ACTIVE',
    communicationPreference: 'WHATSAPP',
    consentGiven: true,
    consentDate: '2026-09-10T10:00:00.000Z',
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '2026-10-15T10:00:00.000Z'
  },
  {
    id: 'pat-nandan-02',
    pharmacyId: 'pharm-nandan-kolkata',
    name: 'Suniti Banerjee',
    phone: '9830298765',
    email: 'suniti.banerjee@email.com',
    age: 58,
    gender: 'FEMALE',
    address: '8B Dover Lane, Kolkata 700029',
    notes: 'Long-term BP medication. Needs doorstep delivery when husband is out.',
    status: 'ACTIVE',
    communicationPreference: 'WHATSAPP',
    consentGiven: true,
    consentDate: '2026-09-15T11:30:00.000Z',
    createdAt: '2026-09-15T11:30:00.000Z',
    updatedAt: '2026-10-18T14:20:00.000Z'
  },
  {
    id: 'pat-nandan-03',
    pharmacyId: 'pharm-nandan-kolkata',
    name: 'Anirban Sen',
    phone: '9830345678',
    email: 'anirban.sen@email.com',
    age: 44,
    gender: 'MALE',
    address: '22 Lake Terrace, Kolkata 700029',
    notes: 'Acid reflux patient. Regular 30-day Pantocid refill.',
    status: 'ACTIVE',
    communicationPreference: 'SMS',
    consentGiven: true,
    consentDate: '2026-10-01T09:15:00.000Z',
    createdAt: '2026-10-01T09:15:00.000Z',
    updatedAt: '2026-10-20T12:00:00.000Z'
  },
  {
    id: 'pat-nandan-04',
    pharmacyId: 'pharm-nandan-kolkata',
    name: 'Priya Mukherjee',
    phone: '9830456789',
    email: 'priya.mukherjee@email.com',
    age: 35,
    gender: 'FEMALE',
    address: '45 Gariahat Road, Kolkata 700019',
    notes: 'Thyroid medication. Prefers call reminders.',
    status: 'INACTIVE',
    communicationPreference: 'CALL',
    consentGiven: false,
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z'
  },

  // -------------------------------------------------------------------------
  // Deshbandhu Medical Hall (pharm-deshbandhu-siliguri)
  // -------------------------------------------------------------------------
  {
    id: 'pat-desh-01',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    name: 'Pradip Roy',
    phone: '9434011223',
    email: 'pradip.roy@email.com',
    age: 65,
    gender: 'MALE',
    address: 'Hill Cart Road, Siliguri 734001',
    notes: 'Cardiac regular patient. Atorvastatin 30-day cycle.',
    status: 'ACTIVE',
    communicationPreference: 'WHATSAPP',
    consentGiven: true,
    consentDate: '2026-09-20T10:00:00.000Z',
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z'
  },
  {
    id: 'pat-desh-02',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    name: 'Maya Devi',
    phone: '9434099887',
    email: 'maya.devi@email.com',
    age: 54,
    gender: 'FEMALE',
    address: 'Sevoke Road, Siliguri 734001',
    notes: 'Calcium and multivitamin regular prescription.',
    status: 'ACTIVE',
    communicationPreference: 'SMS',
    consentGiven: true,
    consentDate: '2026-09-25T11:00:00.000Z',
    createdAt: '2026-09-25T11:00:00.000Z',
    updatedAt: '2026-10-15T11:00:00.000Z'
  },
  {
    id: 'pat-desh-03',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    name: 'Subhash Chandra',
    phone: '9434055667',
    email: 'subhash.chandra@email.com',
    age: 70,
    gender: 'MALE',
    address: 'Bagdogra, Siliguri 734014',
    notes: 'Parkinson\'s medication. Family member collects.',
    status: 'ACTIVE',
    communicationPreference: 'NONE',
    consentGiven: false,
    createdAt: '2026-08-15T10:00:00.000Z',
    updatedAt: '2026-10-05T10:00:00.000Z'
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
    nextRefillDueDate: '2026-11-03',
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
    nextRefillDueDate: '2026-10-30',
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
    nextRefillDueDate: '2026-11-02',
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
  {
    id: 'refill-nandan-05',
    pharmacyId: 'pharm-nandan-kolkata',
    patientId: 'pat-nandan-02',
    medicineId: 'med-atorvastatin-10',
    medicineName: 'Atorva 10',
    strength: '10 mg',
    dosageForm: 'Tablet',
    dailyDosage: '1 tab at night after dinner (0-0-1)',
    quantityPerRefill: 1,
    daysSupply: 30,
    lastDispensedDate: '2026-10-05',
    nextRefillDueDate: '2026-11-04',
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
    nextRefillDueDate: '2026-10-28',
    status: 'OVERDUE',
    reminderCount: 0
  },
  {
    id: 'refill-desh-03',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    patientId: 'pat-desh-03',
    medicineId: 'med-desh-syndopa-110',
    medicineName: 'Syndopa 110',
    strength: '100mg + 10mg',
    dosageForm: 'Tablet',
    dailyDosage: '1 tab three times daily (1-1-1)',
    quantityPerRefill: 2,
    daysSupply: 20,
    lastDispensedDate: '2026-10-10',
    nextRefillDueDate: '2026-10-30',
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
  },
  {
    id: 'log-02',
    pharmacyId: 'pharm-nandan-kolkata',
    patientId: 'pat-nandan-02',
    medicationId: 'refill-nandan-03',
    patientName: 'Suniti Banerjee',
    patientPhone: '9830298765',
    messageText: 'Namaskar Suniti Banerjee, this is a gentle reminder from Nandan Pharmacy for Telma 40...',
    sentAt: '2026-11-01T10:15:00.000Z',
    initiatedByStaff: 'Priya Das'
  },
  {
    id: 'log-03',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    patientId: 'pat-desh-01',
    medicationId: 'refill-desh-01',
    patientName: 'Pradip Roy',
    patientPhone: '9434011223',
    messageText: 'Namaskar Pradip Roy, this is a gentle reminder from Deshbandhu Medical Hall for Atorva 10...',
    sentAt: '2026-10-30T16:45:00.000Z',
    initiatedByStaff: 'Deshbandhu Staff'
  }
];

export const MOCK_PRESCRIPTION_REFERENCES: PrescriptionReference[] = [
  // Nandan Pharmacy
  {
    id: 'presc-nandan-01',
    pharmacyId: 'pharm-nandan-kolkata',
    patientId: 'pat-nandan-01',
    referenceNumber: 'RX-2026-NDN-001',
    issueDate: '2026-08-15',
    prescriberName: 'Dr. Amitava Ghosh',
    prescriberRegistration: 'WBMC-45231',
    prescriberContact: '+91 98300 11223',
    hospitalClinic: 'Apollo Gleneagles Hospital, Kolkata',
    expiryDate: '2027-08-15',
    notes: 'Diabetes & Hypertension management. Review every 3 months.',
    createdAt: '2026-08-15T10:00:00.000Z',
    updatedAt: '2026-08-15T10:00:00.000Z'
  },
  {
    id: 'presc-nandan-02',
    pharmacyId: 'pharm-nandan-kolkata',
    patientId: 'pat-nandan-02',
    referenceNumber: 'RX-2026-NDN-002',
    issueDate: '2026-07-20',
    prescriberName: 'Dr. Sujata Mitra',
    prescriberRegistration: 'WBMC-38912',
    prescriberContact: '+91 98300 44556',
    hospitalClinic: 'Fortis Hospital, Kolkata',
    expiryDate: '2027-07-20',
    notes: 'Hypertension - Monitor BP weekly. Adjust dose if systolic > 150.',
    createdAt: '2026-07-20T11:00:00.000Z',
    updatedAt: '2026-07-20T11:00:00.000Z'
  },
  {
    id: 'presc-nandan-03',
    pharmacyId: 'pharm-nandan-kolkata',
    patientId: 'pat-nandan-03',
    referenceNumber: 'RX-2026-NDN-003',
    issueDate: '2026-09-01',
    prescriberName: 'Dr. Rajesh Sharma',
    prescriberRegistration: 'WBMC-55789',
    prescriberContact: '+91 98300 77889',
    hospitalClinic: 'AMRI Hospital, Kolkata',
    expiryDate: '2027-09-01',
    notes: 'GERD - Pantoprazole 40mg daily. Review if symptoms persist > 2 weeks.',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  // Deshbandhu
  {
    id: 'presc-desh-01',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    patientId: 'pat-desh-01',
    referenceNumber: 'RX-2026-DSH-001',
    issueDate: '2026-06-10',
    prescriberName: 'Dr. Pranab Das',
    prescriberRegistration: 'WBMC-22134',
    prescriberContact: '+91 94340 11223',
    hospitalClinic: 'North Bengal Medical College, Siliguri',
    expiryDate: '2027-06-10',
    notes: 'Post-MI cardiac care. Atorvastatin 10mg nightly. Echo scheduled annually.',
    createdAt: '2026-06-10T10:00:00.000Z',
    updatedAt: '2026-06-10T10:00:00.000Z'
  },
  {
    id: 'presc-desh-02',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    patientId: 'pat-desh-02',
    referenceNumber: 'RX-2026-DSH-002',
    issueDate: '2026-05-15',
    prescriberName: 'Dr. Anjali Sen',
    prescriberRegistration: 'WBMC-33456',
    prescriberContact: '+91 94340 44556',
    hospitalClinic: 'Siliguri District Hospital',
    expiryDate: '2027-05-15',
    notes: 'Osteoporosis prophylaxis. Calcium + Vitamin D daily.',
    createdAt: '2026-05-15T11:00:00.000Z',
    updatedAt: '2026-05-15T11:00:00.000Z'
  },
  {
    id: 'presc-desh-03',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    patientId: 'pat-desh-03',
    referenceNumber: 'RX-2026-DSH-003',
    issueDate: '2026-09-01',
    prescriberName: 'Dr. Sourav Banerjee',
    prescriberRegistration: 'WBMC-66789',
    prescriberContact: '+91 94340 77889',
    hospitalClinic: 'North Bengal Neuro Centre, Siliguri',
    expiryDate: '2027-09-01',
    notes: 'Parkinson\'s disease. Syndopa 110mg TID. Monitor for dyskinesia.',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  }
];

