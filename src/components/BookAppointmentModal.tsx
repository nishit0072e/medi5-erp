import React, { useState } from 'react';
import { Calendar, User, X, AlertCircle, Stethoscope, IndianRupee, ShieldCheck } from 'lucide-react';
import { Doctor } from '../types/eprescription';
import { Patient } from '../types/patient';
import { CreateAppointmentInput, AppointmentPriority, AppointmentType, PaymentStatus, PaymentMode, DoctorScheduleSlot } from '../types/appointment';

interface BookAppointmentModalProps {
  isOpen: boolean;
  doctors: Doctor[];
  patients: Patient[];
  schedules: DoctorScheduleSlot[];
  onClose: () => void;
  onSubmit: (input: CreateAppointmentInput) => void;
}

export const BookAppointmentModal: React.FC<BookAppointmentModalProps> = ({
  isOpen,
  doctors,
  patients,
  schedules,
  onClose,
  onSubmit
}) => {
  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  // Selected Doctor
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(doctors[0]?.id || '');
  
  // Patient details state
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPhone] = useState('');
  const [patientAge, setPatientAge] = useState<number | ''>(35);
  const [patientGender, setPatientGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [patientAddress, setPatientAddress] = useState('');

  // Appointment details
  const [appointmentDate, setAppointmentDate] = useState(todayStr);
  const [timeSlot, setTimeSlot] = useState('10:00 AM - 10:15 AM');
  const [appointmentType, setAppointmentType] = useState<AppointmentType>('IN_CLINIC');
  const [priority, setPriority] = useState<AppointmentPriority>('NORMAL');
  const [chiefComplaint, setChiefComplaint] = useState('');
  
  // Commercials
  const [consultationFee, setConsultationFee] = useState<number>(500);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('PAID');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [notes, setNotes] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // When patient is selected from dropdown, autofill
  const handlePatientSelect = (pId: string) => {
    setSelectedPatientId(pId);
    if (!pId) return;
    const found = patients.find((p) => p.id === pId);
    if (found) {
      setPatientName(found.name);
      setPhone(found.phone);
      if (found.age) setPatientAge(found.age);
      if (found.gender) setPatientGender(found.gender);
      if (found.address) setPatientAddress(found.address);
    }
  };

  // When doctor changes, update fee from schedule if available
  const handleDoctorChange = (dId: string) => {
    setSelectedDoctorId(dId);
    const doctorSched = schedules.find((s) => s.doctorId === dId);
    if (doctorSched) {
      setConsultationFee(doctorSched.consultationFee);
      setTimeSlot(`${doctorSched.startTime} - ${doctorSched.startTime.replace(':00', ':15')}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedDoctorId) {
      setErrorMessage('Please select a doctor.');
      return;
    }

    if (!patientName.trim()) {
      setErrorMessage('Patient full name is required.');
      return;
    }

    if (!patientPhone.trim() || patientPhone.trim().length < 10) {
      setErrorMessage('Please provide a valid 10-digit mobile number.');
      return;
    }

    if (!appointmentDate) {
      setErrorMessage('Please pick an appointment date.');
      return;
    }

    try {
      onSubmit({
        doctorId: selectedDoctorId,
        patientId: selectedPatientId || undefined,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        patientAge: Number(patientAge) || 30,
        patientGender,
        patientAddress: patientAddress.trim() || undefined,
        appointmentDate,
        timeSlot,
        type: appointmentType,
        priority,
        chiefComplaint: chiefComplaint.trim() || 'General OPD Consultation',
        consultationFee,
        paymentStatus,
        paymentMode: paymentStatus === 'PAID' ? paymentMode : undefined,
        notes: notes.trim() || undefined
      });
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to book appointment');
    }
  };

  const defaultSlots = [
    '10:00 AM - 10:15 AM',
    '10:15 AM - 10:30 AM',
    '10:30 AM - 10:45 AM',
    '10:45 AM - 11:00 AM',
    '11:00 AM - 11:15 AM',
    '11:15 AM - 11:30 AM',
    '11:30 AM - 11:45 AM',
    '11:45 AM - 12:00 PM',
    '05:00 PM - 05:15 PM',
    '05:15 PM - 05:30 PM',
    '05:30 PM - 05:45 PM',
    '05:45 PM - 06:00 PM',
    '06:00 PM - 06:15 PM',
    '06:15 PM - 06:30 PM',
    '06:30 PM - 06:45 PM',
    '06:45 PM - 07:00 PM'
  ];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="book-apt-title">
      <div className="modal-container modal-patient-modal">
        <form onSubmit={handleSubmit} className="modal-dialog-form">
          {/* Pinned Header */}
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="icon-badge">
                <Calendar size={18} />
              </div>
              <div>
                <h3 id="book-apt-title" className="modal-title">Book Doctor Appointment</h3>
                <p className="modal-subtitle">Generate patient token & chamber consultation slot</p>
              </div>
            </div>
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
              <X size={18} />
            </button>
          </div>

          {errorMessage && (
            <div className="settings-alert alert-error" role="alert" style={{ margin: '14px 18px 0 18px' }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Scrollable Body */}
          <div className="modal-body modal-dialog-scrollable">
            {/* Section 1: Doctor & Timing */}
            <div style={{ background: '#FAFDFB', padding: '12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Stethoscope size={15} className="text-primary-green" />
                <span className="font-bold text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Consulting Doctor & Slot</span>
              </div>

              <div className="settings-grid-2">
                <div className="form-group">
                  <label className="form-label">Consulting Doctor *</label>
                  <select
                    className="form-select font-bold"
                    value={selectedDoctorId}
                    onChange={(e) => handleDoctorChange(e.target.value)}
                    required
                  >
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} • {doc.specialization} ({doc.degree})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Appointment Date *</label>
                  <input
                    type="date"
                    className="form-input font-mono font-bold"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="settings-grid-2" style={{ marginTop: '8px' }}>
                <div className="form-group">
                  <label className="form-label">Consultation Time Slot *</label>
                  <select
                    className="form-select font-mono"
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                  >
                    {defaultSlots.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Consultation Type</label>
                  <select
                    className="form-select"
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value as AppointmentType)}
                  >
                    <option value="IN_CLINIC">🏥 In-Clinic OPD Visit</option>
                    <option value="TELE_CONSULT">📞 Tele-Consultation (Audio/Video)</option>
                    <option value="HOME_VISIT">🏡 Home Health Visit</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Patient Demographics */}
            <div style={{ background: '#FFFFFF', padding: '12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={15} className="text-primary-green" />
                  <span className="font-bold text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Patient Details</span>
                </div>
                {patients.length > 0 && (
                  <select
                    className="form-select"
                    style={{ fontSize: '0.75rem', padding: '3px 8px', maxWidth: '200px' }}
                    value={selectedPatientId}
                    onChange={(e) => handlePatientSelect(e.target.value)}
                  >
                    <option value="">Quick select registered patient...</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="settings-grid-2">
                <div className="form-group">
                  <label className="form-label">Patient Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Ramesh Chandra Das"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">WhatsApp Mobile Number *</label>
                  <div className="input-with-icon">
                    <span className="input-icon font-mono font-bold text-xs" style={{ left: '10px' }}>+91</span>
                    <input
                      type="tel"
                      className="form-input pl-icon font-mono font-bold"
                      placeholder="9830012345"
                      value={patientPhone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={10}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="settings-grid-2" style={{ marginTop: '8px' }}>
                <div className="form-group">
                  <label className="form-label">Age (Years) *</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    className="form-input font-mono"
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value ? parseInt(e.target.value, 10) : '')}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    className="form-select"
                    value={patientGender}
                    onChange={(e) => setPatientGender(e.target.value as 'MALE' | 'FEMALE' | 'OTHER')}
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '8px' }}>
                <label className="form-label">Address / Neighborhood</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 14/2 Rashbehari Avenue, Kolkata"
                  value={patientAddress}
                  onChange={(e) => setPatientAddress(e.target.value)}
                />
              </div>
            </div>

            {/* Section 3: Clinical Priority & Chief Complaint */}
            <div className="settings-grid-2">
              <div className="form-group">
                <label className="form-label">Consultation Priority</label>
                <select
                  className="form-select font-bold"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as AppointmentPriority)}
                >
                  <option value="NORMAL">Standard / Normal OPD</option>
                  <option value="URGENT">🚨 Urgent / Acute Distress</option>
                  <option value="SENIOR_CITIZEN">👴 Senior Citizen Priority</option>
                  <option value="PREGNANCY">🤰 Antenatal / Maternity</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Chief Complaint / Symptoms *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Persistent fever, cough for 4 days"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Section 4: Fees & Payment Collection */}
            <div style={{ background: '#F8FAFC', padding: '12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <IndianRupee size={15} className="text-primary-green" />
                <span className="font-bold text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Consultation Fee & Payment</span>
              </div>

              <div className="settings-grid-2">
                <div className="form-group">
                  <label className="form-label">Fee Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    className="form-input font-mono font-bold"
                    value={consultationFee}
                    onChange={(e) => setConsultationFee(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  <select
                    className="form-select font-bold"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                  >
                    <option value="PAID">✅ Paid at Counter</option>
                    <option value="PENDING">⏳ Payment Pending</option>
                    <option value="WAIVED">🎁 Complimentary / Waived</option>
                  </select>
                </div>
              </div>

              {paymentStatus === 'PAID' && (
                <div className="form-group" style={{ marginTop: '8px' }}>
                  <label className="form-label">Payment Tender</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['CASH', 'UPI', 'CARD'] as PaymentMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`btn-days-preset ${paymentMode === mode ? 'active' : ''}`}
                        onClick={() => setPaymentMode(mode)}
                      >
                        {mode === 'CASH' ? '💵 Cash' : mode === 'UPI' ? '📱 UPI / QR' : '💳 Card'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Administrative Notes</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Previous prescription attached, referred by Dr. Sengupta"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Pinned Footer Actions */}
          <div className="modal-footer modal-dialog-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary-action">
              <ShieldCheck size={16} />
              <span>Confirm & Generate Token</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
