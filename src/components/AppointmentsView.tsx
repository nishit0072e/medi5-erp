import React, { useState, useMemo } from 'react';
import { 
  Calendar, Clock, Phone, Search, Plus, 
  Stethoscope, CheckCircle2, X, 
  IndianRupee, MessageSquare, ArrowRight,
  UserCheck, FileText, Trash2
} from 'lucide-react';
import { 
  DoctorAppointment, 
  AppointmentStatus, 
  CreateAppointmentInput, 
  PatientVitals, 
  DoctorScheduleSlot,
  PaymentStatus,
  PaymentMode 
} from '../types/appointment';
import { Doctor } from '../types/eprescription';
import { Patient } from '../types/patient';
import { PharmacyProfile } from '../types/pharmacy';
import { BookAppointmentModal } from './BookAppointmentModal';
import { RecordVitalsModal } from './RecordVitalsModal';
import { DoctorScheduleModal } from './DoctorScheduleModal';
import { formatINR } from '../utils/moneyUtils';

interface AppointmentsViewProps {
  pharmacy: PharmacyProfile;
  doctors: Doctor[];
  patients: Patient[];
  appointments: DoctorAppointment[];
  schedules: DoctorScheduleSlot[];
  staffUser?: string;
  userRole?: string;
  onCreateAppointment: (input: CreateAppointmentInput) => void;
  onUpdateStatus: (appointmentId: string, status: AppointmentStatus, paymentStatus?: PaymentStatus, paymentMode?: PaymentMode) => void;
  onUpdateVitals: (appointmentId: string, vitals: PatientVitals) => void;
  onDeleteAppointment: (appointmentId: string) => void;
  onSaveSchedule: (schedule: Omit<DoctorScheduleSlot, 'id' | 'pharmacyId'> & { id?: string }) => void;
  onDeleteSchedule: (scheduleId: string) => void;
  onStartConsultationBridge?: (appointment: DoctorAppointment) => void;
  onBackToInventory?: () => void;
}

export const AppointmentsView: React.FC<AppointmentsViewProps> = ({
  pharmacy,
  doctors,
  patients,
  appointments,
  schedules,
  staffUser = 'Staff Reception',
  userRole: _userRole = 'STAFF',
  onCreateAppointment,
  onUpdateStatus,
  onUpdateVitals,
  onDeleteAppointment,
  onSaveSchedule,
  onDeleteSchedule,
  onStartConsultationBridge,
  onBackToInventory
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Filters state
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AppointmentStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Modals state
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [vitalsTarget, setVitalsTarget] = useState<DoctorAppointment | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      // 1. Date filter
      if (selectedDate && apt.appointmentDate !== selectedDate) {
        return false;
      }

      // 2. Doctor filter
      if (selectedDoctorId !== 'ALL' && apt.doctorId !== selectedDoctorId) {
        return false;
      }

      // 3. Status filter
      if (statusFilter !== 'ALL' && apt.status !== statusFilter) {
        return false;
      }

      // 4. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = apt.patientName.toLowerCase().includes(q);
        const matchesPhone = apt.patientPhone.includes(q);
        const matchesToken = apt.tokenCode.toLowerCase().includes(q) || String(apt.tokenNumber) === q;
        const matchesComplaint = apt.chiefComplaint.toLowerCase().includes(q);
        const matchesDoc = apt.doctorName.toLowerCase().includes(q);
        return matchesName || matchesPhone || matchesToken || matchesComplaint || matchesDoc;
      }

      return true;
    });
  }, [appointments, selectedDate, selectedDoctorId, statusFilter, searchQuery]);

  // Aggregate KPIs for the selected date
  const kpis = useMemo(() => {
    const forDate = appointments.filter((a) => !selectedDate || a.appointmentDate === selectedDate);
    const totalBooked = forDate.length;
    const waiting = forDate.filter((a) => a.status === 'WAITING').length;
    const inConsultation = forDate.filter((a) => a.status === 'IN_CONSULTATION').length;
    const completed = forDate.filter((a) => a.status === 'COMPLETED').length;
    const cancelled = forDate.filter((a) => a.status === 'CANCELLED' || a.status === 'NO_SHOW').length;
    const totalFeesCollected = forDate
      .filter((a) => a.paymentStatus === 'PAID')
      .reduce((sum, a) => sum + (a.consultationFee || 0), 0);

    return { totalBooked, waiting, inConsultation, completed, cancelled, totalFeesCollected };
  }, [appointments, selectedDate]);

  // WhatsApp Token Slip dispatch
  const handleSendWhatsAppSlip = (apt: DoctorAppointment) => {
    const clinicName = pharmacy.name || 'Medi5 Clinic & Pharmacy';
    const clinicAddr = pharmacy.addressLine1 || 'Kolkata, West Bengal';
    const clinicPhone = pharmacy.phone || '+91 98300 00000';

    const text = 
`*APPOINTMENT CONFIRMATION & TOKEN SLIP*
🏥 *${clinicName}*
📍 Address: ${clinicAddr}
📞 Helpline: ${clinicPhone}

━━━━━━━━━━━━━━━━━━━━
🎟️ *Token Number: #${apt.tokenNumber}*
🔖 Booking Ref: ${apt.tokenCode}
👨‍⚕️ Doctor: ${apt.doctorName} (${apt.doctorDegree})
📋 Specialization: ${apt.doctorSpecialization}
📅 Date: ${apt.appointmentDate}
🕒 Slot: ${apt.timeSlot}
👤 Patient: ${apt.patientName} (${apt.patientAge}y/${apt.patientGender})
🩺 Complaint: ${apt.chiefComplaint}
💰 Consultation Fee: ₹${apt.consultationFee} (${apt.paymentStatus === 'PAID' ? 'PAID at Counter' : 'PENDING'})
━━━━━━━━━━━━━━━━━━━━

⚠️ *Patient Instructions:*
1. Please report to the chamber reception 10 minutes prior to your slot.
2. Present this digital token pass at the consultation desk.
3. For cancellations or emergency queries, please call ${clinicPhone}.

_Powered by Medi5 Clinic & Pharmacy ERP_`;

    const cleanPhone = apt.patientPhone.replace(/[^0-9]/g, '');
    const targetMobile = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const waUrl = `https://api.whatsapp.com/send?phone=${targetMobile}&text=${encodeURIComponent(text)}`;
    
    window.open(waUrl, '_blank');
    showToast(`WhatsApp digital token pass launched for ${apt.patientName}.`);
  };

  return (
    <div className="patients-container appointments-container">
      {/* Header Bar */}
      <div className="settings-header">
        <div className="settings-header-title">
          <div className="icon-badge">
            <Calendar size={22} />
          </div>
          <div>
            <h2>Doctor Chamber & OPD Appointments</h2>
            <p className="settings-subtitle">
              Live token queue management, vitals recording, and 1-click clinical bridge to E-Prescription creator.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-primary-action"
            onClick={() => setIsBookModalOpen(true)}
          >
            <Plus size={16} />
            <span>Book Appointment</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => setIsScheduleModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Clock size={15} />
            <span>Chamber Schedules</span>
          </button>

          {onBackToInventory && (
            <button
              type="button"
              className="btn-back-counter"
              onClick={onBackToInventory}
            >
              <ArrowRight size={14} />
              <span>Back</span>
            </button>
          )}
        </div>
      </div>

      {/* Local Feedback Toast */}
      {feedbackToast && (
        <div className="settings-alert alert-success" style={{ margin: '12px 0' }}>
          <CheckCircle2 size={16} />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* KPI Cards Strip */}
      <div className="patient-kpi-grid">
        <div 
          className={`patient-kpi-card ${statusFilter === 'ALL' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter('ALL')}
        >
          <div className="kpi-card-header">
            <span className="kpi-label">TOTAL BOOKED</span>
            <Calendar size={16} className="text-primary-green" />
          </div>
          <div className="kpi-value">{kpis.totalBooked}</div>
          <span className="kpi-sub">Appointments for {selectedDate === todayStr ? 'Today' : selectedDate}</span>
        </div>

        <div 
          className={`patient-kpi-card ${statusFilter === 'WAITING' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter('WAITING')}
        >
          <div className="kpi-card-header">
            <span className="kpi-label">IN WAITING LOBBY</span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <div className="kpi-value text-amber-500">{kpis.waiting}</div>
          <span className="kpi-sub">Patients waiting for turn</span>
        </div>

        <div 
          className={`patient-kpi-card ${statusFilter === 'IN_CONSULTATION' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter('IN_CONSULTATION')}
        >
          <div className="kpi-card-header">
            <span className="kpi-label">INSIDE CHAMBER</span>
            <Stethoscope size={16} className="text-emerald-500" />
          </div>
          <div className="kpi-value text-emerald-500">{kpis.inConsultation}</div>
          <span className="kpi-sub">Currently with consulting doctor</span>
        </div>

        <div 
          className={`patient-kpi-card ${statusFilter === 'COMPLETED' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter('COMPLETED')}
        >
          <div className="kpi-card-header">
            <span className="kpi-label">CONSULTATIONS COMPLETED</span>
            <UserCheck size={16} className="text-blue-500" />
          </div>
          <div className="kpi-value text-blue-500">{kpis.completed}</div>
          <span className="kpi-sub">{kpis.cancelled} cancelled / no-show</span>
        </div>

        <div className="patient-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">FEES COLLECTED</span>
            <IndianRupee size={16} className="text-emerald-500" />
          </div>
          <div className="kpi-value text-emerald-600 font-mono">
            {formatINR(kpis.totalFeesCollected)}
          </div>
          <span className="kpi-sub">Counter consultation collections</span>
        </div>
      </div>

      {/* Queue Controls & Filter Bar */}
      <div className="queue-controls-bar" style={{ marginTop: '16px' }}>
        {/* Date Selector & Doctor Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', background: '#FFFFFF', padding: '3px', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              className={`queue-pill ${selectedDate === todayStr ? 'active' : ''}`}
              onClick={() => setSelectedDate(todayStr)}
              style={{ border: 'none' }}
            >
              Today
            </button>
            <button
              type="button"
              className={`queue-pill ${selectedDate === new Date(Date.now() + 86400000).toISOString().split('T')[0] ? 'active' : ''}`}
              onClick={() => {
                const tmrw = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                setSelectedDate(tmrw);
              }}
              style={{ border: 'none' }}
            >
              Tomorrow
            </button>
          </div>

          <input
            type="date"
            className="form-input font-mono font-bold"
            style={{ padding: '5px 10px', fontSize: '0.8rem', width: 'auto' }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />

          <select
            className="form-select font-bold"
            style={{ padding: '6px 10px', fontSize: '0.82rem', maxWidth: '240px' }}
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
          >
            <option value="ALL">All Consulting Doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
            ))}
          </select>
        </div>

        {/* Search Box */}
        <div className="queue-search-box">
          <Search size={14} className="queue-search-icon" />
          <input
            type="text"
            placeholder="Search patient, token, phone or complaint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="queue-search-input"
          />
        </div>
      </div>

      {/* Status Pills */}
      <div className="queue-filter-pills" style={{ margin: '10px 0 16px 0' }}>
        <button
          type="button"
          className={`queue-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setStatusFilter('ALL')}
        >
          All Status ({appointments.filter(a => !selectedDate || a.appointmentDate === selectedDate).length})
        </button>
        <button
          type="button"
          className={`queue-pill pill-amber ${statusFilter === 'WAITING' ? 'active' : ''}`}
          onClick={() => setStatusFilter('WAITING')}
        >
          Waiting ({kpis.waiting})
        </button>
        <button
          type="button"
          className={`queue-pill pill-green ${statusFilter === 'IN_CONSULTATION' ? 'active' : ''}`}
          onClick={() => setStatusFilter('IN_CONSULTATION')}
        >
          In Chamber ({kpis.inConsultation})
        </button>
        <button
          type="button"
          className={`queue-pill ${statusFilter === 'COMPLETED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('COMPLETED')}
        >
          Completed ({kpis.completed})
        </button>
        <button
          type="button"
          className={`queue-pill ${statusFilter === 'SCHEDULED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('SCHEDULED')}
        >
          Upcoming Scheduled
        </button>
      </div>

      {/* Live Appointment Queue Cards Grid */}
      {filteredAppointments.length > 0 ? (
        <div className="refill-cards-grid appointment-queue-grid">
          {filteredAppointments.map((apt) => {
            const isWaiting = apt.status === 'WAITING';
            const isInChamber = apt.status === 'IN_CONSULTATION';
            const isCompleted = apt.status === 'COMPLETED';
            const isUrgent = apt.priority === 'URGENT';
            const isSenior = apt.priority === 'SENIOR_CITIZEN';

            return (
              <div 
                key={apt.id} 
                className={`refill-card appointment-card ${
                  isInChamber 
                    ? 'card-in-chamber' 
                    : isWaiting 
                    ? 'card-waiting' 
                    : isUrgent 
                    ? 'card-overdue' 
                    : ''
                }`}
              >
                {/* Card Top: Token Number & Priority Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="token-badge-large">
                      #{apt.tokenNumber}
                    </div>
                    <div>
                      <div className="font-mono text-xs font-bold text-muted">{apt.tokenCode}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Slot: {apt.timeSlot}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {isUrgent && (
                      <span className="urgency-badge urgency-urgent">
                        🚨 Urgent
                      </span>
                    )}
                    {isSenior && (
                      <span className="urgency-badge urgency-senior">
                        👴 Senior Citizen
                      </span>
                    )}
                    <span className={`refill-urgency-pill urgency-${apt.status.toLowerCase()}`}>
                      {isInChamber && <span className="pulse-indicator" />}
                      <span>{apt.status.replace('_', ' ')}</span>
                    </span>
                  </div>
                </div>

                {/* Patient Information */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                  <div className="patient-name-title font-bold" style={{ fontSize: '0.98rem' }}>
                    {apt.patientName}
                  </div>
                  <div className="patient-phone-sub font-mono text-xs" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <Phone size={12} className="text-primary-green" />
                    <span>+91 {apt.patientPhone}</span>
                    <span>• {apt.patientAge}y / {apt.patientGender}</span>
                  </div>
                  {apt.patientAddress && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      📍 {apt.patientAddress}
                    </div>
                  )}
                </div>

                {/* Doctor & Complaint */}
                <div style={{ background: '#FAFDFB', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-green-dark)' }}>
                    <Stethoscope size={14} />
                    <span>{apt.doctorName}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>({apt.doctorDegree})</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', marginTop: '4px' }}>
                    <strong>Chief Complaint:</strong> {apt.chiefComplaint}
                  </div>
                </div>

                {/* Clinical Vitals Strip */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', padding: '6px 10px', borderRadius: '4px' }}>
                  {apt.vitals && (apt.vitals.bp || apt.vitals.pulse || apt.vitals.temp || apt.vitals.spo2 || apt.vitals.weightKg) ? (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                      {apt.vitals.bp && <span><strong>BP:</strong> {apt.vitals.bp}</span>}
                      {apt.vitals.pulse && <span><strong>Pulse:</strong> {apt.vitals.pulse}</span>}
                      {apt.vitals.temp && <span><strong>Temp:</strong> {apt.vitals.temp}</span>}
                      {apt.vitals.spo2 && <span><strong>SpO2:</strong> {apt.vitals.spo2}</span>}
                      {apt.vitals.weightKg && <span><strong>Wt:</strong> {apt.vitals.weightKg}kg</span>}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No clinical vitals recorded yet
                    </span>
                  )}

                  {!isCompleted && (
                    <button
                      type="button"
                      onClick={() => setVitalsTarget(apt)}
                      style={{ background: 'none', border: 'none', color: 'var(--primary-green)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, textDecoration: 'underline' }}
                    >
                      {apt.vitals?.bp ? 'Update Vitals' : '+ Add Vitals'}
                    </button>
                  )}
                </div>

                {/* Fee & Payment Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', paddingTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="text-muted">Fee:</span>
                    <strong className="font-mono">₹{apt.consultationFee}</strong>
                    <span className={`badge-payment ${apt.paymentStatus.toLowerCase()}`}>
                      {apt.paymentStatus === 'PAID' ? `PAID (${apt.paymentMode || 'CASH'})` : 'PENDING'}
                    </span>
                  </div>

                  {apt.paymentStatus === 'PENDING' && (
                    <button
                      type="button"
                      className="btn-pay-quick"
                      onClick={() => {
                        onUpdateStatus(apt.id, apt.status, 'PAID', 'CASH');
                        showToast(`Fee payment of ₹${apt.consultationFee} recorded in cash.`);
                      }}
                    >
                      Collect Cash
                    </button>
                  )}
                </div>

                {/* Action Buttons Toolbar */}
                <div className="appointment-actions-toolbar" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {/* WhatsApp Slip */}
                  <button
                    type="button"
                    className="btn-action-wa"
                    style={{ flex: 1, padding: '7px 10px', fontSize: '0.75rem' }}
                    onClick={() => handleSendWhatsAppSlip(apt)}
                    title="Send digital appointment token slip via WhatsApp"
                  >
                    <MessageSquare size={13} />
                    <span>WhatsApp Pass</span>
                  </button>

                  {/* Operational transitions */}
                  {isWaiting && (
                    <button
                      type="button"
                      className="btn-action-call"
                      onClick={() => {
                        onUpdateStatus(apt.id, 'IN_CONSULTATION');
                        showToast(`Patient ${apt.patientName} called into consulting chamber.`);
                      }}
                      title="Call patient into doctor chamber"
                    >
                      <Stethoscope size={14} />
                      <span>Call Next</span>
                    </button>
                  )}

                  {isInChamber && (
                    <>
                      {onStartConsultationBridge && (
                        <button
                          type="button"
                          className="btn-primary-action"
                          style={{ flex: 1.2, padding: '7px 10px', fontSize: '0.75rem' }}
                          onClick={() => onStartConsultationBridge(apt)}
                          title="Bridge directly into Doctor Corner with pre-filled details"
                        >
                          <FileText size={14} />
                          <span>Start e-Rx</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn-action-dispensed"
                        onClick={() => {
                          onUpdateStatus(apt.id, 'COMPLETED');
                          showToast(`Consultation for ${apt.patientName} marked completed.`);
                        }}
                        title="Mark consultation completed"
                      >
                        <CheckCircle2 size={14} />
                        <span>Done</span>
                      </button>
                    </>
                  )}

                  {isCompleted && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#16A34A', fontWeight: 700 }}>
                      <CheckCircle2 size={14} />
                      <span>Consultation Finished</span>
                      {apt.prescriptionId && <span className="font-mono text-xs text-muted">({apt.prescriptionId})</span>}
                    </div>
                  )}

                  {!isCompleted && apt.status !== 'CANCELLED' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Cancel appointment for ${apt.patientName}?`)) {
                          onUpdateStatus(apt.id, 'CANCELLED');
                          showToast(`Appointment for ${apt.patientName} cancelled.`);
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '6px' }}
                      title="Cancel Appointment"
                    >
                      <X size={14} />
                    </button>
                  )}

                  {apt.status === 'CANCELLED' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Permanently remove record for ${apt.patientName}?`)) {
                          onDeleteAppointment(apt.id);
                          showToast(`Appointment record removed.`);
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '6px' }}
                      title="Remove Cancelled Record"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state-card" style={{ padding: '36px 20px', textAlign: 'center', background: '#FFFFFF', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)', marginTop: '16px' }}>
          <Calendar size={36} className="text-muted" style={{ margin: '0 auto 10px auto' }} />
          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>No Appointments Found</h4>
          <p className="text-muted text-xs" style={{ maxWidth: '400px', margin: '4px auto 14px auto' }}>
            {searchQuery || selectedDoctorId !== 'ALL' || statusFilter !== 'ALL'
              ? 'No appointments match your current search and filter settings for this date.'
              : `No appointments are booked for ${selectedDate}. Click below to schedule a patient consultation token.`}
          </p>
          <button
            type="button"
            className="btn-primary-action"
            onClick={() => setIsBookModalOpen(true)}
            style={{ margin: '0 auto' }}
          >
            <Plus size={15} />
            <span>Book New Appointment</span>
          </button>
        </div>
      )}

      {/* Book Appointment Modal */}
      <BookAppointmentModal
        isOpen={isBookModalOpen}
        doctors={doctors}
        patients={patients}
        schedules={schedules}
        onClose={() => setIsBookModalOpen(false)}
        onSubmit={(input) => {
          onCreateAppointment(input);
          showToast(`Appointment booked successfully! Token assigned.`);
        }}
      />

      {/* Record Vitals Modal */}
      <RecordVitalsModal
        isOpen={Boolean(vitalsTarget)}
        appointment={vitalsTarget}
        staffName={staffUser}
        onClose={() => setVitalsTarget(null)}
        onSubmit={(aptId, vitals) => {
          onUpdateVitals(aptId, vitals);
          showToast(`Vitals recorded for ${vitalsTarget?.patientName}.`);
          setVitalsTarget(null);
        }}
      />

      {/* Doctor Schedule Modal */}
      <DoctorScheduleModal
        isOpen={isScheduleModalOpen}
        doctors={doctors}
        schedules={schedules}
        onClose={() => setIsScheduleModalOpen(false)}
        onSaveSchedule={(sched) => {
          onSaveSchedule(sched);
          showToast(`Doctor consulting schedule saved.`);
        }}
        onDeleteSchedule={(schedId) => {
          onDeleteSchedule(schedId);
          showToast(`Schedule shift deleted.`);
        }}
      />
    </div>
  );
};
