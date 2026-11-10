import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getInitialSeedState, 
  createAppointment, 
  updateAppointmentStatus, 
  updateAppointmentVitals,
  linkPrescriptionToAppointment,
  deleteAppointment,
  saveDoctorSchedule,
  deleteDoctorSchedule,
  getTenantInventory
} from '../data/demoRepository';
import { CreateAppointmentInput } from '../types/appointment';

describe('Phase 6: Integrated Doctor Appointment & Chamber Management System', () => {
  let state = getInitialSeedState();
  const pharmacyId = 'pharm-nandan-kolkata';
  const todayStr = new Date().toISOString().split('T')[0];

  beforeEach(() => {
    state = getInitialSeedState();
  });

  describe('A. Appointment Booking & Token Assignment', () => {
    it('creates a new appointment and assigns token #1 for a doctor on a given date', () => {
      // Clear appointments for clean test
      state.appointments = [];

      const input: CreateAppointmentInput = {
        doctorId: 'doc-1',
        patientName: 'Subir Banerjee',
        patientPhone: '9830099999',
        patientAge: 45,
        patientGender: 'MALE',
        patientAddress: 'Park Street, Kolkata',
        appointmentDate: todayStr,
        timeSlot: '10:00 AM - 10:15 AM',
        type: 'IN_CLINIC',
        priority: 'NORMAL',
        chiefComplaint: 'Mild chest pain and shortness of breath',
        consultationFee: 500,
        paymentStatus: 'PAID',
        paymentMode: 'UPI'
      };

      const { nextState, appointment } = createAppointment(state, pharmacyId, input, 'Dr. Desk Reception');

      expect(appointment.id).toBeDefined();
      expect(appointment.tokenNumber).toBe(1);
      expect(appointment.tokenCode).toContain('APT-');
      expect(appointment.patientName).toBe('Subir Banerjee');
      expect(appointment.doctorName).toBe('Dr. Nathuram Dhankar');
      expect(appointment.status).toBe('WAITING'); // because todayStr is today
      expect(appointment.consultationFee).toBe(500);
      expect(appointment.paymentStatus).toBe('PAID');
      expect(appointment.paymentMode).toBe('UPI');

      expect(nextState.appointments).toHaveLength(1);
    });

    it('assigns incrementing sequential tokens for the same doctor on the same date', () => {
      state.appointments = [];

      const input1: CreateAppointmentInput = {
        doctorId: 'doc-1',
        patientName: 'Patient One',
        patientPhone: '9830011111',
        patientAge: 30,
        patientGender: 'MALE',
        appointmentDate: todayStr,
        timeSlot: '10:00 AM - 10:15 AM',
        chiefComplaint: 'Checkup'
      };

      const input2: CreateAppointmentInput = {
        doctorId: 'doc-1',
        patientName: 'Patient Two',
        patientPhone: '9830022222',
        patientAge: 35,
        patientGender: 'FEMALE',
        appointmentDate: todayStr,
        timeSlot: '10:15 AM - 10:30 AM',
        chiefComplaint: 'Fever'
      };

      const res1 = createAppointment(state, pharmacyId, input1);
      const res2 = createAppointment(res1.nextState, pharmacyId, input2);

      expect(res1.appointment.tokenNumber).toBe(1);
      expect(res2.appointment.tokenNumber).toBe(2);
    });

    it('sets status to SCHEDULED when booking for a future date', () => {
      state.appointments = [];
      const futureDate = '2026-12-25';

      const input: CreateAppointmentInput = {
        doctorId: 'doc-1',
        patientName: 'Future Patient',
        patientPhone: '9830033333',
        patientAge: 40,
        patientGender: 'MALE',
        appointmentDate: futureDate,
        timeSlot: '11:00 AM - 11:15 AM',
        chiefComplaint: 'Annual physical'
      };

      const { appointment } = createAppointment(state, pharmacyId, input);
      expect(appointment.status).toBe('SCHEDULED');
      expect(appointment.appointmentDate).toBe('2026-12-25');
    });

    it('rejects booking when required patient details are missing', () => {
      expect(() => {
        createAppointment(state, pharmacyId, {
          doctorId: 'doc-1',
          patientName: '',
          patientPhone: '9830012345',
          patientAge: 30,
          patientGender: 'MALE',
          appointmentDate: todayStr,
          timeSlot: '10:00 AM',
          chiefComplaint: 'Headache'
        });
      }).toThrow(/Patient name is required/);

      expect(() => {
        createAppointment(state, pharmacyId, {
          doctorId: 'doc-1',
          patientName: 'Valid Name',
          patientPhone: '',
          patientAge: 30,
          patientGender: 'MALE',
          appointmentDate: todayStr,
          timeSlot: '10:00 AM',
          chiefComplaint: 'Headache'
        });
      }).toThrow(/contact number is required/);
    });

    it('rejects booking for invalid doctor ID', () => {
      expect(() => {
        createAppointment(state, pharmacyId, {
          doctorId: 'doc-non-existent',
          patientName: 'Test Patient',
          patientPhone: '9830012345',
          patientAge: 30,
          patientGender: 'MALE',
          appointmentDate: todayStr,
          timeSlot: '10:00 AM',
          chiefComplaint: 'Fever'
        });
      }).toThrow(/not found for this pharmacy/);
    });
  });

  describe('B. Appointment Lifecycle & Status Transitions', () => {
    it('transitions appointment from WAITING to IN_CONSULTATION and timestamps calledAt', () => {
      const apt = state.appointments.find((a) => a.pharmacyId === pharmacyId && a.status === 'WAITING')!;
      expect(apt).toBeDefined();

      const { appointment } = updateAppointmentStatus(state, pharmacyId, apt.id, 'IN_CONSULTATION');

      expect(appointment.status).toBe('IN_CONSULTATION');
      expect(appointment.calledAt).toBeDefined();
    });

    it('transitions appointment to COMPLETED and sets completedAt', () => {
      const apt = state.appointments.find((a) => a.pharmacyId === pharmacyId && a.status === 'IN_CONSULTATION')!;
      expect(apt).toBeDefined();

      const { appointment } = updateAppointmentStatus(state, pharmacyId, apt.id, 'COMPLETED');

      expect(appointment.status).toBe('COMPLETED');
      expect(appointment.completedAt).toBeDefined();
    });

    it('updates payment status and mode during counter settlement', () => {
      const apt = state.appointments.find((a) => a.pharmacyId === pharmacyId && a.paymentStatus === 'PENDING')!;
      expect(apt).toBeDefined();

      const { appointment } = updateAppointmentStatus(
        state, 
        pharmacyId, 
        apt.id, 
        apt.status, 
        'PAID', 
        'CASH'
      );

      expect(appointment.paymentStatus).toBe('PAID');
      expect(appointment.paymentMode).toBe('CASH');
    });

    it('links prescription to appointment and marks it completed', () => {
      const apt = state.appointments[0];
      const { appointment } = linkPrescriptionToAppointment(state, pharmacyId, apt.id, 'RX-TEST-9988');

      expect(appointment.prescriptionId).toBe('RX-TEST-9988');
      expect(appointment.status).toBe('COMPLETED');
      expect(appointment.completedAt).toBeDefined();
    });

    it('deletes an appointment safely', () => {
      const apt = state.appointments[0];
      const initialCount = state.appointments.length;

      const nextState = deleteAppointment(state, pharmacyId, apt.id);
      expect(nextState.appointments).toHaveLength(initialCount - 1);
      expect(nextState.appointments.some((a) => a.id === apt.id)).toBe(false);
    });
  });

  describe('C. Clinical Vitals Recording', () => {
    it('records and updates patient vitals accurately', () => {
      const apt = state.appointments[0];
      const vitals = {
        bp: '130/85',
        pulse: '78 bpm',
        temp: '99.1 °F',
        weightKg: 72.5,
        spo2: '98%',
        recordedBy: 'Sister Sunita'
      };

      const { appointment } = updateAppointmentVitals(state, pharmacyId, apt.id, vitals);

      expect(appointment.vitals).toBeDefined();
      expect(appointment.vitals?.bp).toBe('130/85');
      expect(appointment.vitals?.pulse).toBe('78 bpm');
      expect(appointment.vitals?.temp).toBe('99.1 °F');
      expect(appointment.vitals?.weightKg).toBe(72.5);
      expect(appointment.vitals?.spo2).toBe('98%');
      expect(appointment.vitals?.recordedBy).toBe('Sister Sunita');
      expect(appointment.vitals?.recordedAt).toBeDefined();
    });
  });

  describe('D. Doctor Weekly Schedules & Shifts', () => {
    it('creates a new doctor schedule shift', () => {
      const initialCount = (state.doctorSchedules || []).length;

      const { nextState, schedule } = saveDoctorSchedule(state, pharmacyId, {
        doctorId: 'doc-1',
        doctorName: 'Dr. Nathuram Dhankar',
        dayOfWeek: 'WEDNESDAY',
        shiftName: 'Midweek Evening Chamber',
        startTime: '06:00 PM',
        endTime: '09:00 PM',
        slotDurationMinutes: 15,
        maxTokens: 14,
        consultationFee: 550,
        isActive: true
      });

      expect(schedule.id).toBeDefined();
      expect(schedule.dayOfWeek).toBe('WEDNESDAY');
      expect(schedule.maxTokens).toBe(14);
      expect(nextState.doctorSchedules).toHaveLength(initialCount + 1);
    });

    it('deletes a doctor schedule shift', () => {
      const sched = state.doctorSchedules[0];
      expect(sched).toBeDefined();

      const nextState = deleteDoctorSchedule(state, pharmacyId, sched.id);
      expect(nextState.doctorSchedules.some((s) => s.id === sched.id)).toBe(false);
    });
  });

  describe('E. Multi-Tenant Isolation', () => {
    it('ensures appointments for pharmacy-1 are isolated from pharmacy-2', () => {
      const tenant1 = getTenantInventory(state, 'pharm-nandan-kolkata');
      const tenant2 = getTenantInventory(state, 'pharm-deshbandhu-siliguri');

      expect(tenant1.appointments.every((a) => a.pharmacyId === 'pharm-nandan-kolkata')).toBe(true);
      expect(tenant2.appointments.every((a) => a.pharmacyId === 'pharm-deshbandhu-siliguri')).toBe(true);

      // Attempting to update a pharmacy-1 appointment under pharmacy-2 tenant must fail
      const aptP1 = tenant1.appointments[0];
      if (aptP1) {
        expect(() => {
          updateAppointmentStatus(state, 'pharm-deshbandhu-siliguri', aptP1.id, 'COMPLETED');
        }).toThrow(/not found for this pharmacy/);
      }
    });
  });
});
