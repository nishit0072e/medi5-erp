import React, { useState } from 'react';
import { Clock, Plus, X, Trash2, CheckCircle2 } from 'lucide-react';
import { Doctor } from '../types/eprescription';
import { DoctorScheduleSlot, DayOfWeek } from '../types/appointment';

interface DoctorScheduleModalProps {
  isOpen: boolean;
  doctors: Doctor[];
  schedules: DoctorScheduleSlot[];
  onClose: () => void;
  onSaveSchedule: (schedule: Omit<DoctorScheduleSlot, 'id' | 'pharmacyId'> & { id?: string }) => void;
  onDeleteSchedule: (scheduleId: string) => void;
}

const DAYS_OF_WEEK: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export const DoctorScheduleModal: React.FC<DoctorScheduleModalProps> = ({
  isOpen,
  doctors,
  schedules,
  onClose,
  onSaveSchedule,
  onDeleteSchedule
}) => {
  if (!isOpen) return null;

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(doctors[0]?.id || '');
  const [isAddingNew, setIsAddingNew] = useState(false);

  // New slot form state
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>('MONDAY');
  const [shiftName, setShiftName] = useState('Morning OPD');
  const [startTime, setStartTime] = useState('10:00 AM');
  const [endTime, setEndTime] = useState('01:00 PM');
  const [slotDuration, setSlotDuration] = useState(15);
  const [maxTokens, setMaxTokens] = useState(12);
  const [fee, setFee] = useState(500);

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];
  const doctorSchedules = schedules.filter((s) => s.doctorId === selectedDoctorId);

  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor) return;

    onSaveSchedule({
      doctorId: selectedDoctor.id,
      doctorName: selectedDoctor.name,
      dayOfWeek,
      shiftName: shiftName.trim() || 'General OPD',
      startTime,
      endTime,
      slotDurationMinutes: slotDuration,
      maxTokens,
      consultationFee: fee,
      isActive: true
    });

    setIsAddingNew(false);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title">
      <div className="modal-container modal-patient-modal" style={{ maxWidth: '640px' }}>
        <div className="modal-dialog-form">
          {/* Header */}
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="icon-badge">
                <Clock size={18} />
              </div>
              <div>
                <h3 id="schedule-modal-title" className="modal-title">Doctor Chamber & OPD Schedules</h3>
                <p className="modal-subtitle">Configure consulting days, timings, and token quotas</p>
              </div>
            </div>
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="modal-body modal-dialog-scrollable">
            {/* Doctor Picker */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Select Doctor to View / Manage</label>
              <select
                className="form-select font-bold"
                value={selectedDoctorId}
                onChange={(e) => {
                  setSelectedDoctorId(e.target.value);
                  setIsAddingNew(false);
                }}
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} • {d.specialization} ({d.degree})
                  </option>
                ))}
              </select>
            </div>

            {/* Existing Schedules for Doctor */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Active Shifts for {selectedDoctor?.name} ({doctorSchedules.length})
              </h4>
              {!isAddingNew && (
                <button
                  type="button"
                  className="btn-primary-action"
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  onClick={() => setIsAddingNew(true)}
                >
                  <Plus size={14} />
                  <span>Add Shift</span>
                </button>
              )}
            </div>

            {doctorSchedules.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {doctorSchedules.map((slot) => (
                  <div
                    key={slot.id}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="queue-pill active" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                          {slot.dayOfWeek}
                        </span>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{slot.shiftName}</strong>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                        🕒 {slot.startTime} - {slot.endTime} • Max: {slot.maxTokens} tokens • Fee: ₹{slot.consultationFee}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteSchedule(slot.id)}
                      title="Remove Shift"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '6px' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px', background: '#F8FAFC', borderRadius: 'var(--radius-sm)', marginBottom: '14px' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No consulting schedules configured for this doctor yet.</p>
              </div>
            )}

            {/* Add New Shift Inline Form */}
            {isAddingNew && (
              <form onSubmit={handleAddSlot} style={{ background: '#FAFDFB', border: '1.5px dashed var(--primary-green)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span className="font-bold text-xs" style={{ textTransform: 'uppercase', color: 'var(--primary-green-dark)' }}>
                    Add New Consulting Shift
                  </span>
                  <button type="button" onClick={() => setIsAddingNew(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={15} />
                  </button>
                </div>

                <div className="settings-grid-2">
                  <div className="form-group">
                    <label className="form-label">Day of Week</label>
                    <select className="form-select font-bold" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}>
                      {DAYS_OF_WEEK.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Shift Label</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Morning OPD / Evening Chamber"
                      value={shiftName}
                      onChange={(e) => setShiftName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="settings-grid-2" style={{ marginTop: '8px' }}>
                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input type="text" className="form-input font-mono" placeholder="10:00 AM" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Time</label>
                    <input type="text" className="form-input font-mono" placeholder="01:00 PM" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                  </div>
                </div>

                <div className="settings-grid-2" style={{ marginTop: '8px' }}>
                  <div className="form-group">
                    <label className="form-label">Slot Duration (Minutes)</label>
                    <input type="number" min="5" max="60" step="5" className="form-input font-mono" value={slotDuration} onChange={(e) => setSlotDuration(parseInt(e.target.value, 10) || 15)} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Max Token Quota</label>
                    <input type="number" min="1" max="100" className="form-input font-mono font-bold" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 10)} />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '8px' }}>
                  <label className="form-label">Consultation Fee (₹)</label>
                  <input type="number" min="0" step="50" className="form-input font-mono font-bold" value={fee} onChange={(e) => setFee(parseInt(e.target.value, 10) || 500)} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setIsAddingNew(false)} style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary-action" style={{ padding: '6px 14px', fontSize: '0.78rem' }}>
                    <CheckCircle2 size={14} />
                    <span>Save Shift</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer modal-dialog-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
