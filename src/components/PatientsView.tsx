import React, { useState, useMemo } from 'react';
import { 
  Users, 
  MessageSquare, 
  Plus, 
  Search, 
  Phone, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Pill, 
  History, 
  ArrowRight,
  Check,
  RefreshCw
} from 'lucide-react';
import { 
  Patient, 
  PatientMedication, 
  WhatsAppReminderLog, 
  CreatePatientInput, 
  AddMedicationInput
} from '../types/patient';
import { PharmacyProfile } from '../types/pharmacy';
import { Medicine } from '../types/inventory';
import { getRefillUrgency } from '../utils/whatsappUtils';
import { AddPatientModal } from './AddPatientModal';
import { AddMedicationModal } from './AddMedicationModal';
import { WhatsAppReminderModal } from './WhatsAppReminderModal';

interface PatientsViewProps {
  patients: Patient[];
  refills: PatientMedication[];
  reminderLogs: WhatsAppReminderLog[];
  medicines: Medicine[];
  pharmacy: PharmacyProfile;
  staffUser: string;
  onCreatePatient: (input: CreatePatientInput) => void;
  onUpdatePatient?: (patientId: string, input: Partial<Patient>) => void;
  onDeletePatient: (patientId: string) => void;
  onAddMedication: (patientId: string, input: AddMedicationInput) => void;
  onDeleteMedication: (medicationId: string) => void;
  onRecordWhatsAppSent: (logData: {
    patientId: string;
    medicationId: string;
    patientName: string;
    patientPhone: string;
    messageText: string;
    initiatedByStaff: string;
  }) => void;
  onMarkDispensed: (medicationId: string) => void;
  onBackToInventory?: () => void;
}

export const PatientsView: React.FC<PatientsViewProps> = ({
  patients,
  refills,
  reminderLogs,
  medicines,
  pharmacy,
  staffUser,
  onCreatePatient,
  onUpdatePatient: _onUpdatePatient,
  onDeletePatient,
  onAddMedication,
  onDeleteMedication,
  onRecordWhatsAppSent,
  onMarkDispensed,
  onBackToInventory
}) => {
  // Navigation Tabs: 'refills' | 'directory' | 'logs'
  const [activeTab, setActiveTab] = useState<'refills' | 'directory' | 'logs'>('refills');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | 'DUE_TODAY' | 'OVERDUE' | 'UPCOMING_7'>('ALL');

  // Modals state
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [addMedTargetPatient, setAddMedTargetPatient] = useState<Patient | null>(null);
  const [waReminderTarget, setWaReminderTarget] = useState<{
    patient: Patient;
    medication: PatientMedication;
  } | null>(null);

  // Quick toast feedback
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setLocalFeedback(msg);
    setTimeout(() => setLocalFeedback(null), 3500);
  };

  // Patients map for instant lookup by ID
  const patientById = useMemo(() => {
    return new Map(patients.map((p) => [p.id, p]));
  }, [patients]);

  // Enriched Refills list with live urgency calculations
  const enrichedRefills = useMemo(() => {
    return refills.map((refill) => {
      const patient = patientById.get(refill.patientId);
      const urgency = getRefillUrgency(refill.nextRefillDueDate);
      return {
        refill,
        patient,
        urgency
      };
    });
  }, [refills, patientById]);

  // Aggregate KPI summary
  const stats = useMemo(() => {
    const dueToday = enrichedRefills.filter((r) => r.urgency.status === 'DUE_TODAY').length;
    const overdue = enrichedRefills.filter((r) => r.urgency.status === 'OVERDUE').length;
    const upcoming7 = enrichedRefills.filter(
      (r) => r.urgency.status === 'UPCOMING' && r.urgency.diffDays <= 7
    ).length;

    return {
      totalPatients: patients.length,
      dueToday,
      overdue,
      upcoming7,
      totalRefills: refills.length,
      totalRemindersSent: reminderLogs.length
    };
  }, [patients.length, enrichedRefills, refills.length, reminderLogs.length]);

  // Filtered refills queue
  const filteredRefills = useMemo(() => {
    return enrichedRefills.filter(({ refill, patient, urgency }) => {
      // 1. Urgency filter
      if (urgencyFilter === 'DUE_TODAY' && urgency.status !== 'DUE_TODAY') return false;
      if (urgencyFilter === 'OVERDUE' && urgency.status !== 'OVERDUE') return false;
      if (urgencyFilter === 'UPCOMING_7' && (urgency.diffDays < 0 || urgency.diffDays > 7)) return false;

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesPatient = patient?.name.toLowerCase().includes(q) || patient?.phone.includes(q);
        const matchesMed = refill.medicineName.toLowerCase().includes(q) || refill.strength.toLowerCase().includes(q);
        return Boolean(matchesPatient || matchesMed);
      }

      return true;
    });
  }, [enrichedRefills, urgencyFilter, searchQuery]);

  // Filtered patients directory
  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return patients;
    const q = searchQuery.toLowerCase().trim();
    return patients.filter((p) => p.name.toLowerCase().includes(q) || p.phone.includes(q) || p.address?.toLowerCase().includes(q));
  }, [patients, searchQuery]);

  return (
    <div className="patients-container">
      {/* Header Bar */}
      <div className="settings-header">
        <div className="settings-header-title">
          <div className="icon-badge">
            <Users size={22} />
          </div>
          <div>
            <h2>Patients & WhatsApp Refill Reminders</h2>
            <p className="settings-subtitle">
              Track chronic patient prescriptions, schedule refill windows, and send polite user-initiated WhatsApp memos.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn-primary-action"
            onClick={() => setIsAddPatientOpen(true)}
          >
            <Plus size={16} />
            <span>Register Patient</span>
          </button>

          {onBackToInventory && (
            <button
              type="button"
              className="btn-back-counter"
              onClick={onBackToInventory}
            >
              <span>Back to Inventory</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Local Feedback Toast */}
      {localFeedback && (
        <div className="settings-alert alert-success" style={{ margin: '12px 0' }}>
          <CheckCircle2 size={16} />
          <span>{localFeedback}</span>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="patient-kpi-grid">
        <div 
          className={`patient-kpi-card ${urgencyFilter === 'DUE_TODAY' ? 'active-filter' : ''}`}
          onClick={() => { setActiveTab('refills'); setUrgencyFilter('DUE_TODAY'); }}
        >
          <div className="kpi-card-header">
            <span className="kpi-label">REFILLS DUE TODAY</span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <div className="kpi-value text-amber-500">{stats.dueToday}</div>
          <span className="kpi-sub">Prescriptions ending today</span>
        </div>

        <div 
          className={`patient-kpi-card ${urgencyFilter === 'OVERDUE' ? 'active-filter' : ''}`}
          onClick={() => { setActiveTab('refills'); setUrgencyFilter('OVERDUE'); }}
        >
          <div className="kpi-card-header">
            <span className="kpi-label">OVERDUE REFILLS</span>
            <AlertCircle size={16} className="text-red-500" />
          </div>
          <div className="kpi-value text-red-500">{stats.overdue}</div>
          <span className="kpi-sub">Action required to retain patient</span>
        </div>

        <div 
          className={`patient-kpi-card ${urgencyFilter === 'UPCOMING_7' ? 'active-filter' : ''}`}
          onClick={() => { setActiveTab('refills'); setUrgencyFilter('UPCOMING_7'); }}
        >
          <div className="kpi-card-header">
            <span className="kpi-label">UPCOMING (NEXT 7 DAYS)</span>
            <Calendar size={16} className="text-emerald-500" />
          </div>
          <div className="kpi-value text-emerald-500">{stats.upcoming7}</div>
          <span className="kpi-sub">Upcoming refill pipeline</span>
        </div>

        <div 
          className="patient-kpi-card"
          onClick={() => { setActiveTab('directory'); setUrgencyFilter('ALL'); }}
        >
          <div className="kpi-card-header">
            <span className="kpi-label">TOTAL REGISTERED PATIENTS</span>
            <Users size={16} className="text-primary-green" />
          </div>
          <div className="kpi-value">{stats.totalPatients}</div>
          <span className="kpi-sub">Active chronic customer base</span>
        </div>
      </div>

      {/* View Sub-Tabs */}
      <div className="settings-subtabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'refills'}
          className={`settings-tab-btn ${activeTab === 'refills' ? 'active' : ''}`}
          onClick={() => setActiveTab('refills')}
        >
          <Clock size={15} />
          <span>Refill Reminders Queue</span>
          {stats.dueToday + stats.overdue > 0 && (
            <span className="badge-alert-count">{stats.dueToday + stats.overdue}</span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'directory'}
          className={`settings-tab-btn ${activeTab === 'directory' ? 'active' : ''}`}
          onClick={() => setActiveTab('directory')}
        >
          <Users size={15} />
          <span>Patient Directory ({patients.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'logs'}
          className={`settings-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <History size={15} />
          <span>WhatsApp Audit Log ({reminderLogs.length})</span>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: REFILL REMINDERS QUEUE
          ===================================================================== */}
      {activeTab === 'refills' && (
        <div className="patient-tab-content">
          {/* Filter Bar */}
          <div className="queue-controls-bar">
            <div className="queue-filter-pills">
              <button
                type="button"
                className={`queue-pill ${urgencyFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setUrgencyFilter('ALL')}
              >
                All Refills ({enrichedRefills.length})
              </button>
              <button
                type="button"
                className={`queue-pill pill-amber ${urgencyFilter === 'DUE_TODAY' ? 'active' : ''}`}
                onClick={() => setUrgencyFilter('DUE_TODAY')}
              >
                Due Today ({stats.dueToday})
              </button>
              <button
                type="button"
                className={`queue-pill pill-red ${urgencyFilter === 'OVERDUE' ? 'active' : ''}`}
                onClick={() => setUrgencyFilter('OVERDUE')}
              >
                Overdue ({stats.overdue})
              </button>
              <button
                type="button"
                className={`queue-pill pill-green ${urgencyFilter === 'UPCOMING_7' ? 'active' : ''}`}
                onClick={() => setUrgencyFilter('UPCOMING_7')}
              >
                Next 7 Days ({stats.upcoming7})
              </button>
            </div>

            <div className="queue-search-box">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search patient, phone, or medicine..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="queue-search-input"
              />
            </div>
          </div>

          {/* Refill Cards List */}
          {filteredRefills.length > 0 ? (
            <div className="refill-cards-grid">
              {filteredRefills.map(({ refill, patient, urgency }) => {
                if (!patient) return null;
                const isOverdue = urgency.status === 'OVERDUE';
                const isDueToday = urgency.status === 'DUE_TODAY';

                return (
                  <div 
                    key={refill.id} 
                    className={`refill-card ${isOverdue ? 'card-overdue' : isDueToday ? 'card-due-today' : ''}`}
                  >
                    <div className="refill-card-head">
                      <div>
                        <div className="patient-name-title font-bold">{patient.name}</div>
                        <div className="patient-phone-sub font-mono">
                          <Phone size={11} style={{ display: 'inline', marginRight: '4px' }} />
                          +91 {patient.phone}
                          {patient.address && <span> • {patient.address}</span>}
                        </div>
                      </div>

                      <div className={`refill-urgency-pill urgency-${urgency.status.toLowerCase()}`}>
                        {urgency.status === 'OVERDUE' && <AlertCircle size={12} />}
                        {urgency.status === 'DUE_TODAY' && <Clock size={12} />}
                        <span>{urgency.label}</span>
                      </div>
                    </div>

                    <div className="refill-med-details">
                      <div className="med-name-bold">
                        <Pill size={14} className="text-primary-green" />
                        <span>{refill.medicineName} ({refill.strength})</span>
                        <span className="med-dosage-tag">{refill.dosageForm}</span>
                      </div>
                      <div className="dosage-instructions-text text-muted text-xs">
                        <strong>Dosage:</strong> {refill.dailyDosage}
                      </div>
                      <div className="refill-cycle-meta text-xs font-mono text-muted">
                        <span>Pack: {refill.quantityPerRefill} units</span>
                        <span>• Supply: {refill.daysSupply} days</span>
                        <span>• Dispensed: {refill.lastDispensedDate}</span>
                        <span>• Due: <strong>{refill.nextRefillDueDate}</strong></span>
                      </div>
                    </div>

                    {refill.lastReminderSentAt && (
                      <div className="reminder-sent-tag">
                        <Check size={12} />
                        <span>Reminder sent ({refill.reminderCount}x)</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="refill-card-actions">
                      <button
                        type="button"
                        className="btn-action-wa"
                        onClick={() => setWaReminderTarget({ patient, medication: refill })}
                        title="Send personalized WhatsApp refill reminder"
                      >
                        <MessageSquare size={14} />
                        <span>WhatsApp Reminder</span>
                      </button>

                      <button
                        type="button"
                        className="btn-action-dispensed"
                        onClick={() => {
                          onMarkDispensed(refill.id);
                          showFeedback(`Marked ${refill.medicineName} dispensed for ${patient.name}. Refill date advanced!`);
                        }}
                        title="Mark this refill as dispensed today, advancing the next refill cycle"
                      >
                        <RefreshCw size={13} />
                        <span>Mark Dispensed</span>
                      </button>

                      <a
                        href={`tel:${patient.phone}`}
                        className="btn-action-call"
                        title="Call patient"
                      >
                        <Phone size={13} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-patient-state">
              <Clock size={36} className="text-muted" />
              <h4>No Refill Reminders Found</h4>
              <p className="text-muted text-xs">
                {searchQuery || urgencyFilter !== 'ALL'
                  ? 'No refill reminders match your current search and filter settings.'
                  : 'Patients with chronic medications will automatically show up here as their refill dates approach.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: PATIENT DIRECTORY
          ===================================================================== */}
      {activeTab === 'directory' && (
        <div className="patient-tab-content">
          <div className="queue-controls-bar">
            <div className="queue-search-box" style={{ width: '100%', maxWidth: '360px' }}>
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search patient directory by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="queue-search-input"
              />
            </div>

            <button
              type="button"
              className="btn-primary-action btn-sm"
              onClick={() => setIsAddPatientOpen(true)}
            >
              <Plus size={14} />
              <span>+ Add Patient</span>
            </button>
          </div>

          <div className="patient-directory-list">
            {filteredPatients.map((patient) => {
              const patientRefills = refills.filter((r) => r.patientId === patient.id);

              return (
                <div key={patient.id} className="patient-profile-card">
                  <div className="patient-profile-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="patient-avatar">{patient.name.charAt(0)}</div>
                      <div>
                        <div className="patient-card-name font-bold">{patient.name}</div>
                        <div className="patient-card-sub text-xs text-muted font-mono">
                          Ph: +91 {patient.phone}
                          {patient.age && <span> • Age: {patient.age}y</span>}
                          {patient.gender && <span> • {patient.gender}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="patient-header-actions">
                      <button
                        type="button"
                        className="btn-add-med-pill"
                        onClick={() => setAddMedTargetPatient(patient)}
                      >
                        <Plus size={13} />
                        <span>Add Medication</span>
                      </button>

                      <button
                        type="button"
                        className="btn-delete-member"
                        onClick={() => {
                          if (window.confirm(`Delete patient record for "${patient.name}" and all their scheduled reminders?`)) {
                            onDeletePatient(patient.id);
                            showFeedback(`Deleted patient ${patient.name}.`);
                          }
                        }}
                        title="Delete patient"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {patient.address && (
                    <div className="patient-meta-line text-xs text-muted">
                      📍 {patient.address}
                    </div>
                  )}

                  {patient.notes && (
                    <div className="patient-meta-line text-xs text-muted">
                      📝 {patient.notes}
                    </div>
                  )}

                  {/* Medications for this patient */}
                  <div className="patient-meds-section">
                    <div className="patient-meds-header text-xs font-bold text-muted uppercase">
                      Active Chronic Prescriptions ({patientRefills.length})
                    </div>

                    {patientRefills.length > 0 ? (
                      <div className="patient-meds-grid">
                        {patientRefills.map((med) => {
                          const urgency = getRefillUrgency(med.nextRefillDueDate);

                          return (
                            <div key={med.id} className="patient-med-chip">
                              <div className="med-chip-info">
                                <span className="font-bold text-xs">{med.medicineName} ({med.strength})</span>
                                <span className="text-muted text-xs font-mono">{med.dailyDosage}</span>
                                <div className="text-muted text-xs font-mono">
                                  Due: <strong className="text-primary-green-dark">{med.nextRefillDueDate}</strong> ({urgency.label})
                                </div>
                              </div>

                              <div className="med-chip-actions">
                                <button
                                  type="button"
                                  className="btn-chip-wa"
                                  onClick={() => setWaReminderTarget({ patient, medication: med })}
                                  title="Send WhatsApp Reminder"
                                >
                                  <MessageSquare size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-chip-delete"
                                  onClick={() => {
                                    if (window.confirm(`Remove ${med.medicineName} from ${patient.name}'s chronic list?`)) {
                                      onDeleteMedication(med.id);
                                      showFeedback(`Removed ${med.medicineName}.`);
                                    }
                                  }}
                                  title="Remove medication"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-muted py-1 font-mono">
                        No chronic medications assigned yet. Click "+ Add Medication" above to schedule refills.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: WHATSAPP AUDIT LOG
          ===================================================================== */}
      {activeTab === 'logs' && (
        <div className="patient-tab-content">
          <div className="table-card-header" style={{ padding: '0 0 12px 0', border: 'none' }}>
            <div>
              <h3>WhatsApp Refill Reminder Audit Trail</h3>
              <p className="text-xs text-muted">
                Immutable log of user-initiated refill reminders sent to patients from {pharmacy.name}.
              </p>
            </div>
          </div>

          {reminderLogs.length > 0 ? (
            <div className="staff-table-wrap">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Patient</th>
                    <th>WhatsApp Phone</th>
                    <th>Initiated By</th>
                    <th>Message Snippet</th>
                  </tr>
                </thead>
                <tbody>
                  {reminderLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="font-mono text-xs text-muted">
                        {new Date(log.sentAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="font-bold text-xs">{log.patientName}</td>
                      <td className="font-mono text-xs text-primary-green-dark">
                        +91 {log.patientPhone}
                      </td>
                      <td className="text-xs">{log.initiatedByStaff}</td>
                      <td className="text-xs text-muted font-mono" style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.messageText}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-patient-state">
              <History size={36} className="text-muted" />
              <h4>No WhatsApp Reminders Sent Yet</h4>
              <p className="text-muted text-xs">
                When staff initiate WhatsApp refill reminders, the dispatch events will appear here with timestamps and staff identities.
              </p>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD PATIENT */}
      {isAddPatientOpen && (
        <AddPatientModal
          isOpen={isAddPatientOpen}
          medicines={medicines}
          onClose={() => setIsAddPatientOpen(false)}
          onSubmit={(input) => {
            onCreatePatient(input);
            showFeedback(`Registered patient "${input.name}" successfully!`);
          }}
        />
      )}

      {/* MODAL: ADD MEDICATION */}
      {addMedTargetPatient && (
        <AddMedicationModal
          isOpen={Boolean(addMedTargetPatient)}
          patient={addMedTargetPatient}
          medicines={medicines}
          onClose={() => setAddMedTargetPatient(null)}
          onSubmit={(input) => {
            onAddMedication(addMedTargetPatient.id, input);
            showFeedback(`Added ${input.medicineName} to ${addMedTargetPatient.name}'s schedule.`);
            setAddMedTargetPatient(null);
          }}
        />
      )}

      {/* MODAL: WHATSAPP REMINDER CONFIRMATION */}
      {waReminderTarget && (
        <WhatsAppReminderModal
          isOpen={Boolean(waReminderTarget)}
          patient={waReminderTarget.patient}
          medication={waReminderTarget.medication}
          pharmacy={pharmacy}
          staffUser={staffUser}
          onClose={() => setWaReminderTarget(null)}
          onSent={(logData) => {
            onRecordWhatsAppSent(logData);
            showFeedback(`WhatsApp reminder recorded for ${waReminderTarget.patient.name}.`);
            setWaReminderTarget(null);
          }}
        />
      )}
    </div>
  );
};
