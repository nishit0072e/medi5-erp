import { DoctorSpecialization } from './eprescription';

export type AppointmentStatus = 
  | 'SCHEDULED' 
  | 'WAITING' 
  | 'IN_CONSULTATION' 
  | 'COMPLETED' 
  | 'CANCELLED' 
  | 'NO_SHOW';

export type AppointmentType = 'IN_CLINIC' | 'TELE_CONSULT' | 'HOME_VISIT';

export type AppointmentPriority = 'NORMAL' | 'URGENT' | 'SENIOR_CITIZEN' | 'PREGNANCY';

export type PaymentStatus = 'PENDING' | 'PAID' | 'WAIVED';

export type PaymentMode = 'CASH' | 'UPI' | 'CARD';

export interface PatientVitals {
  bp?: string;          // e.g. "120/80"
  pulse?: string;       // e.g. "72 bpm"
  temp?: string;        // e.g. "98.6 °F"
  weightKg?: number;    // e.g. 68.5
  spo2?: string;        // e.g. "98%"
  recordedAt?: string;  // ISO string
  recordedBy?: string;  // Staff/Doctor name
}

export interface DoctorAppointment {
  id: string;
  pharmacyId: string;
  tokenNumber: number;          // Daily running token per doctor (1, 2, 3...)
  tokenCode: string;            // Format: APT-YYYYMMDD-DOC-XXX
  
  // Doctor Details
  doctorId: string;
  doctorName: string;
  doctorSpecialization: DoctorSpecialization;
  doctorDegree: string;
  
  // Patient Details
  patientId?: string;           // Optional link to existing patient
  patientName: string;
  patientPhone: string;
  patientAge: number;
  patientGender: 'MALE' | 'FEMALE' | 'OTHER';
  patientEmail?: string;
  patientAddress?: string;
  
  // Appointment Logistics
  appointmentDate: string;      // YYYY-MM-DD
  timeSlot: string;             // e.g. "10:00 AM - 10:15 AM"
  type: AppointmentType;
  priority: AppointmentPriority;
  status: AppointmentStatus;
  
  // Clinical Information
  chiefComplaint: string;
  vitals?: PatientVitals;
  prescriptionId?: string;      // Linked e-prescription when issued
  
  // Commercials & Fee
  consultationFee: number;      // In INR (₹)
  paymentStatus: PaymentStatus;
  paymentMode?: PaymentMode;
  
  // Notes & Audit
  notes?: string;
  bookedBy: string;             // Staff / User name
  bookedAt: string;             // ISO timestamp
  calledAt?: string;            // When moved to IN_CONSULTATION
  completedAt?: string;         // When consultation ended
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentInput {
  doctorId: string;
  patientId?: string;
  patientName: string;
  patientPhone: string;
  patientAge: number;
  patientGender: 'MALE' | 'FEMALE' | 'OTHER';
  patientEmail?: string;
  patientAddress?: string;
  appointmentDate: string;      // YYYY-MM-DD
  timeSlot: string;
  type?: AppointmentType;
  priority?: AppointmentPriority;
  chiefComplaint: string;
  vitals?: PatientVitals;
  consultationFee?: number;
  paymentStatus?: PaymentStatus;
  paymentMode?: PaymentMode;
  notes?: string;
}

export interface UpdateAppointmentInput {
  appointmentDate?: string;
  timeSlot?: string;
  type?: AppointmentType;
  priority?: AppointmentPriority;
  status?: AppointmentStatus;
  chiefComplaint?: string;
  vitals?: PatientVitals;
  consultationFee?: number;
  paymentStatus?: PaymentStatus;
  paymentMode?: PaymentMode;
  prescriptionId?: string;
  notes?: string;
}

export type DayOfWeek = 
  | 'MONDAY' 
  | 'TUESDAY' 
  | 'WEDNESDAY' 
  | 'THURSDAY' 
  | 'FRIDAY' 
  | 'SATURDAY' 
  | 'SUNDAY';

export interface DoctorScheduleSlot {
  id: string;
  pharmacyId: string;
  doctorId: string;
  doctorName: string;
  dayOfWeek: DayOfWeek;
  shiftName: string;            // e.g. "Morning OPD", "Evening Chamber"
  startTime: string;            // "10:00 AM"
  endTime: string;              // "01:00 PM"
  slotDurationMinutes: number;  // 15
  maxTokens: number;            // 15
  consultationFee: number;      // 500
  isActive: boolean;
}

export interface AppointmentKPIs {
  totalBooked: number;
  waiting: number;
  inConsultation: number;
  completed: number;
  cancelled: number;
  totalFeesCollected: number;
}
