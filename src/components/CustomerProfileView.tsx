import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Pencil,
  CheckCircle2,
  Clock,
  AlertCircle,
  Pill,
  FileText,
  ShoppingBag,
  History,
  MessageSquare,
  RefreshCw,
  Trash2,
  Plus,
  Ban,
  Play,
  CheckCheck,
  Calendar,
  ShieldCheck,
  Link2
} from 'lucide-react';
import {
  Patient,
  PatientMedication,
  PrescriptionReference,
  WhatsAppReminderLog
} from '../types/patient';
import { SaleRecord } from '../types/inventory';
import { PharmacyProfile } from '../types/pharmacy';
import { getRefillUrgency } from '../utils/whatsappUtils';
import { formatINR } from '../utils/dateUtils';
import { SaleReceiptModal } from './SaleReceiptModal';

type ProfileTab = 'overview' | 'purchases' | 'prescriptions' | 'refills' | 'activity';

interface CustomerProfileViewProps {
  patient: Patient;
  refills: PatientMedication[];
  prescriptions: PrescriptionReference[];
  reminderLogs: WhatsAppReminderLog[];
  sales: SaleRecord[];
  pharmacy?: PharmacyProfile;
  onBack: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onAddMedication: () => void;
  onDeleteMedication: (medicationId: string) => void;
  onMarkDispensed: (medicationId: string) => void;
  onSnoozeRefill: (medicationId: string) => void;
  onCancelRefill: (medicationId: string) => void;
  onCompleteRefill: (medicationId: string) => void;
  onReactivateRefill: (medicationId: string) => void;
  onSendWhatsApp: (medication: PatientMedication) => void;
  onAddPrescription: () => void;
  onDeletePrescription: (prescriptionId: string) => void;
  onLinkPurchase: (saleId: string) => void;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

const statusLabel = (status: PatientMedication['status']) => {
  switch (status) {
    case 'DUE_TODAY':
      return 'Due Today';
    case 'OVERDUE':
      return 'Overdue';
    case 'UPCOMING':
      return 'Upcoming';
    case 'COMPLETED':
      return 'Completed';
    case 'PAUSED':
      return 'Paused';
    case 'SNOOZED':
      return 'Snoozed';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
};

const isTerminal = (status: PatientMedication['status']) =>
  status === 'COMPLETED' || status === 'CANCELLED';

export const CustomerProfileView: React.FC<CustomerProfileViewProps> = ({
  patient,
  refills,
  prescriptions,
  reminderLogs,
  sales,
  pharmacy,
  onBack,
  onEdit,
  onToggleStatus,
  onAddMedication,
  onDeleteMedication,
  onMarkDispensed,
  onSnoozeRefill,
  onCancelRefill,
  onCompleteRefill,
  onReactivateRefill,
  onSendWhatsApp,
  onAddPrescription,
  onDeletePrescription,
  onLinkPurchase
}) => {
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [linkSaleId, setLinkSaleId] = useState('');
  const [receiptSale, setReceiptSale] = useState<SaleRecord | null>(null);

  const patientRefills = useMemo(
    () => refills.filter((r) => r.patientId === patient.id),
    [refills, patient.id]
  );

  const patientPrescriptions = useMemo(
    () =>
      prescriptions
        .filter((p) => p.patientId === patient.id)
        .sort((a, b) => b.issueDate.localeCompare(a.issueDate)),
    [prescriptions, patient.id]
  );

  const patientLogs = useMemo(
    () =>
      reminderLogs
        .filter((l) => l.patientId === patient.id)
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt)),
    [reminderLogs, patient.id]
  );

  const patientSales = useMemo(
    () =>
      sales
        .filter((s) => s.patientId === patient.id)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [sales, patient.id]
  );

  const linkableSales = useMemo(
    () =>
      sales
        .filter((s) => !s.patientId)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [sales]
  );

  const totalSpend = useMemo(
    () => patientSales.reduce((sum, sale) => sum + sale.sellingBill, 0),
    [patientSales]
  );

  const activeRefills = patientRefills.filter((r) => !isTerminal(r.status));
  const overdueCount = patientRefills.filter(
    (r) => getRefillUrgency(r.nextRefillDueDate).status === 'OVERDUE'
  ).length;

  const activityEvents = useMemo(() => {
    const events: { id: string; date: string; label: string; detail: string; kind: string }[] = [];

    events.push({
      id: `patient-${patient.id}`,
      date: patient.createdAt,
      label: 'Patient registered',
      detail: `Added to ${patient.name}'s customer profile`,
      kind: 'patient'
    });

    patientPrescriptions.forEach((rx) => {
      events.push({
        id: `rx-${rx.id}`,
        date: rx.createdAt,
        label: 'Prescription reference recorded',
        detail: `${rx.referenceNumber}${rx.prescriberName ? ` • ${rx.prescriberName}` : ''}`,
        kind: 'prescription'
      });
    });

    patientLogs.forEach((log) => {
      events.push({
        id: `log-${log.id}`,
        date: log.sentAt,
        label: 'WhatsApp reminder sent',
        detail: `${log.messageText.slice(0, 70)}${log.messageText.length > 70 ? '…' : ''}`,
        kind: 'whatsapp'
      });
    });

    patientSales.forEach((sale) => {
      events.push({
        id: `sale-${sale.id}`,
        date: sale.timestamp,
        label: 'Purchase recorded',
        detail: `${sale.id} • ${formatINR(sale.sellingBill)} • ${sale.items.length} item(s)`,
        kind: 'purchase'
      });
    });

    patientRefills.forEach((refill) => {
      events.push({
        id: `refill-${refill.id}`,
        date: `${refill.lastDispensedDate}T09:00:00.000Z`,
        label: 'Refill dispensed',
        detail: `${refill.medicineName} (${refill.strength}) • next due ${refill.nextRefillDueDate}`,
        kind: 'refill'
      });
    });

    return events.sort((a, b) => b.date.localeCompare(a.date));
  }, [patient, patientPrescriptions, patientLogs, patientSales, patientRefills]);

  return (
    <div className="customer-profile-container">
      {/* Header */}
      <div className="customer-profile-header">
        <button type="button" className="btn-back-link" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Directory</span>
        </button>

        <div className="customer-profile-identity">
          <div className="patient-avatar patient-avatar-lg">{patient.name.charAt(0)}</div>
          <div className="customer-profile-title-block">
            <div className="customer-profile-name-row">
              <h2>{patient.name}</h2>
              <span className={`patient-status-pill status-${patient.status.toLowerCase()}`}>
                {patient.status}
              </span>
            </div>
            <div className="customer-profile-contact text-xs text-muted font-mono">
              <span>
                <Phone size={12} /> +91 {patient.phone}
              </span>
              {patient.email && (
                <span>
                  <Mail size={12} /> {patient.email}
                </span>
              )}
              {patient.address && (
                <span>
                  <MapPin size={12} /> {patient.address}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="customer-profile-actions">
          <button type="button" className="btn-secondary btn-sm" onClick={onEdit}>
            <Pencil size={14} />
            <span>Edit Profile</span>
          </button>
          <button
            type="button"
            className={`btn-secondary btn-sm ${patient.status === 'ACTIVE' ? 'btn-danger-outline' : ''}`}
            onClick={onToggleStatus}
          >
            {patient.status === 'ACTIVE' ? <Ban size={14} /> : <Play size={14} />}
            <span>{patient.status === 'ACTIVE' ? 'Mark Inactive' : 'Reactivate'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="settings-subtabs customer-profile-tabs" role="tablist">
        {(
          [
            { id: 'overview', label: 'Overview', icon: User },
            { id: 'purchases', label: `Purchases (${patientSales.length})`, icon: ShoppingBag },
            { id: 'prescriptions', label: `Prescriptions (${patientPrescriptions.length})`, icon: FileText },
            { id: 'refills', label: `Refills (${patientRefills.length})`, icon: Pill },
            { id: 'activity', label: 'Activity', icon: History }
          ] as { id: ProfileTab; label: string; icon: React.ElementType }[]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`settings-tab-btn ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="patient-tab-content">
          <div className="customer-profile-stat-grid">
            <div className="customer-stat-card">
              <span className="customer-stat-label">Total Purchases</span>
              <span className="customer-stat-value">{patientSales.length}</span>
            </div>
            <div className="customer-stat-card">
              <span className="customer-stat-label">Lifetime Spend</span>
              <span className="customer-stat-value">{formatINR(totalSpend)}</span>
            </div>
            <div className="customer-stat-card">
              <span className="customer-stat-label">Active Refills</span>
              <span className="customer-stat-value">{activeRefills.length}</span>
            </div>
            <div className="customer-stat-card">
              <span className="customer-stat-label">Overdue Refills</span>
              <span className={`customer-stat-value ${overdueCount > 0 ? 'text-red-500' : ''}`}>
                {overdueCount}
              </span>
            </div>
            <div className="customer-stat-card">
              <span className="customer-stat-label">Reminders Sent</span>
              <span className="customer-stat-value">{patientLogs.length}</span>
            </div>
            <div className="customer-stat-card">
              <span className="customer-stat-label">Member Since</span>
              <span className="customer-stat-value customer-stat-value-sm">{formatDate(patient.createdAt)}</span>
            </div>
          </div>

          <div className="customer-profile-grid-2">
            <div className="customer-info-card">
              <h4 className="customer-info-title">
                <User size={15} /> Demographics
              </h4>
              <dl className="customer-info-list">
                <div>
                  <dt>Age</dt>
                  <dd>{patient.age ? `${patient.age} years` : 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Gender</dt>
                  <dd>{patient.gender || 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{patient.address || 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{patient.email || 'Not recorded'}</dd>
                </div>
              </dl>
            </div>

            <div className="customer-info-card">
              <h4 className="customer-info-title">
                <ShieldCheck size={15} /> Communication & Consent
              </h4>
              <dl className="customer-info-list">
                <div>
                  <dt>Preferred Channel</dt>
                  <dd>{patient.communicationPreference}</dd>
                </div>
                <div>
                  <dt>Consent Status</dt>
                  <dd>
                    {patient.consentGiven ? (
                      <span className="consent-badge consent-granted">
                        <CheckCircle2 size={12} /> Granted
                      </span>
                    ) : (
                      <span className="consent-badge consent-missing">
                        <AlertCircle size={12} /> Not recorded
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Consent Date</dt>
                  <dd>{patient.consentDate ? formatDate(patient.consentDate) : '—'}</dd>
                </div>
                <div>
                  <dt>Notes</dt>
                  <dd>{patient.notes || 'No notes recorded'}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="customer-info-card">
            <h4 className="customer-info-title">
              <Calendar size={15} /> Next Refill Schedule
            </h4>
            {activeRefills.length > 0 ? (
              <div className="customer-next-refill-list">
                {activeRefills
                  .slice()
                  .sort((a, b) => a.nextRefillDueDate.localeCompare(b.nextRefillDueDate))
                  .slice(0, 3)
                  .map((refill) => {
                    const urgency = getRefillUrgency(refill.nextRefillDueDate);
                    return (
                      <div key={refill.id} className="customer-next-refill-row">
                        <div>
                          <strong className="text-xs">
                            {refill.medicineName} ({refill.strength})
                          </strong>
                          <div className="text-xs text-muted">{refill.dailyDosage}</div>
                        </div>
                        <div className="text-xs font-mono text-right">
                          <div>{refill.nextRefillDueDate}</div>
                          <span className={`refill-urgency-pill urgency-${urgency.status.toLowerCase()}`}>
                            {urgency.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-xs text-muted">No active refill schedules.</p>
            )}
          </div>
        </div>
      )}

      {/* PURCHASES */}
      {activeTab === 'purchases' && (
        <div className="patient-tab-content">
          {linkableSales.length > 0 && (
            <div className="customer-tab-toolbar">
              <p className="text-xs text-muted">
                Link recent unassigned invoices to this customer to build their purchase history.
              </p>
              <div className="link-purchase-controls">
                <select
                  className="form-select directory-sort-select"
                  value={linkSaleId}
                  onChange={(e) => setLinkSaleId(e.target.value)}
                >
                  <option value="">Select an unlinked sale…</option>
                  {linkableSales.slice(0, 15).map((sale) => (
                    <option key={sale.id} value={sale.id}>
                      {sale.id} • {formatDate(sale.timestamp)} • {formatINR(sale.sellingBill)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-primary-action btn-sm"
                  disabled={!linkSaleId}
                  onClick={() => {
                    if (linkSaleId) {
                      onLinkPurchase(linkSaleId);
                      setLinkSaleId('');
                    }
                  }}
                >
                  <Link2 size={13} />
                  <span>Link Sale</span>
                </button>
              </div>
            </div>
          )}

          {patientSales.length > 0 ? (
            <div className="staff-table-wrap">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>MRP</th>
                    <th>Paid</th>
                    <th>Tender</th>
                    <th>Staff</th>
                    <th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {patientSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="font-mono text-xs font-bold">{sale.id}</td>
                      <td className="text-xs">{formatDateTime(sale.timestamp)}</td>
                      <td className="text-xs">
                        {sale.items.map((item) => item.medicineName).join(', ')}
                      </td>
                      <td className="font-mono text-xs">{formatINR(sale.totalBillMrp)}</td>
                      <td className="font-mono text-xs font-bold">{formatINR(sale.sellingBill)}</td>
                      <td>
                        <span className="tender-badge">{sale.tenderType}</span>
                      </td>
                      <td className="text-xs">{sale.staffUser}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setReceiptSale(sale)}
                          title="View printable sale receipt"
                        >
                          <FileText size={13} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-patient-state">
              <ShoppingBag size={36} className="text-muted" />
              <h4>No Linked Purchases</h4>
              <p className="text-muted text-xs">
                Sales linked to this patient at the POS counter will appear here with invoice and tender details.
              </p>
            </div>
          )}
        </div>
      )}

      {/* PRESCRIPTIONS */}
      {activeTab === 'prescriptions' && (
        <div className="patient-tab-content">
          <div className="customer-tab-toolbar">
            <p className="text-xs text-muted">
              Prescriber references stored for this customer. Always verify the original prescription before dispensing.
            </p>
            <button type="button" className="btn-primary-action btn-sm" onClick={onAddPrescription}>
              <Plus size={14} />
              <span>Add Prescription</span>
            </button>
          </div>

          {patientPrescriptions.length > 0 ? (
            <div className="prescription-card-grid">
              {patientPrescriptions.map((rx) => {
                const expired = rx.expiryDate ? rx.expiryDate < new Date().toISOString().split('T')[0] : false;
                return (
                  <div key={rx.id} className="prescription-card">
                    <div className="prescription-card-head">
                      <div>
                        <div className="prescription-ref font-mono font-bold">{rx.referenceNumber}</div>
                        <div className="text-xs text-muted">Issued {formatDate(rx.issueDate)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {rx.expiryDate && (
                          <span className={`rx-expiry-badge ${expired ? 'expired' : ''}`}>
                            {expired ? 'Expired' : `Valid to ${rx.expiryDate}`}
                          </span>
                        )}
                        <button
                          type="button"
                          className="btn-chip-delete"
                          onClick={() => {
                            if (window.confirm(`Delete prescription reference ${rx.referenceNumber}?`)) {
                              onDeletePrescription(rx.id);
                            }
                          }}
                          title="Delete prescription reference"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <dl className="prescription-meta">
                      <div>
                        <dt>Prescriber</dt>
                        <dd>{rx.prescriberName || 'Not recorded'}</dd>
                      </div>
                      <div>
                        <dt>Registration</dt>
                        <dd className="font-mono">{rx.prescriberRegistration || '—'}</dd>
                      </div>
                      <div>
                        <dt>Clinic / Hospital</dt>
                        <dd>{rx.hospitalClinic || '—'}</dd>
                      </div>
                      <div>
                        <dt>Contact</dt>
                        <dd className="font-mono">{rx.prescriberContact || '—'}</dd>
                      </div>
                    </dl>

                    {rx.notes && <p className="prescription-notes text-xs text-muted">{rx.notes}</p>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-patient-state">
              <FileText size={36} className="text-muted" />
              <h4>No Prescription References</h4>
              <p className="text-muted text-xs">
                Add a prescriber reference to keep issue dates, registration numbers and clinic details on file.
              </p>
            </div>
          )}
        </div>
      )}

      {/* REFILLS */}
      {activeTab === 'refills' && (
        <div className="patient-tab-content">
          <div className="customer-tab-toolbar">
            <p className="text-xs text-muted">
              Snooze, complete or cancel refill schedules. All reminders remain user-initiated.
            </p>
            <button type="button" className="btn-primary-action btn-sm" onClick={onAddMedication}>
              <Plus size={14} />
              <span>Add Medication</span>
            </button>
          </div>

          {patientRefills.length > 0 ? (
            <div className="customer-refill-list">
              {patientRefills.map((refill) => {
                const urgency = getRefillUrgency(refill.nextRefillDueDate);
                const terminal = isTerminal(refill.status);
                const snoozed = refill.status === 'SNOOZED';

                return (
                  <div key={refill.id} className={`customer-refill-row ${terminal ? 'refill-terminal' : ''}`}>
                    <div className="customer-refill-main">
                      <div className="med-name-bold">
                        <Pill size={14} className="text-primary-green" />
                        <span>{refill.medicineName} ({refill.strength})</span>
                        <span className="med-dosage-tag">{refill.dosageForm}</span>
                      </div>
                      <div className="text-xs text-muted">{refill.dailyDosage}</div>
                      <div className="refill-cycle-meta text-xs font-mono text-muted">
                        <span>Pack: {refill.quantityPerRefill} units</span>
                        <span>• Supply: {refill.daysSupply} days</span>
                        <span>• Dispensed: {refill.lastDispensedDate}</span>
                        <span>• Due: <strong>{refill.nextRefillDueDate}</strong></span>
                      </div>
                    </div>

                    <div className="customer-refill-side">
                      <span className={`refill-urgency-pill urgency-${refill.status.toLowerCase()}`}>
                        {refill.status === 'SNOOZED' || terminal ? (
                          <Clock size={12} />
                        ) : refill.status === 'OVERDUE' ? (
                          <AlertCircle size={12} />
                        ) : null}
                        {statusLabel(refill.status)}
                        {!terminal && !snoozed && ` • ${urgency.label}`}
                      </span>

                      <div className="customer-refill-actions">
                        {!terminal && (
                          <>
                            <button
                              type="button"
                              className="btn-chip-wa"
                              onClick={() => onSendWhatsApp(refill)}
                              title="Send WhatsApp reminder"
                            >
                              <MessageSquare size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn-chip-action"
                              onClick={() => onMarkDispensed(refill.id)}
                              title="Mark dispensed and advance refill cycle"
                            >
                              <RefreshCw size={13} />
                            </button>
                            {snoozed ? (
                              <button
                                type="button"
                                className="btn-chip-action"
                                onClick={() => onReactivateRefill(refill.id)}
                                title="Reactivate reminder"
                              >
                                <Play size={13} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn-chip-action"
                                onClick={() => onSnoozeRefill(refill.id)}
                                title="Snooze for 7 days"
                              >
                                <Clock size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-chip-action"
                              onClick={() => onCompleteRefill(refill.id)}
                              title="Mark therapy completed"
                            >
                              <CheckCheck size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn-chip-action btn-chip-danger"
                              onClick={() => onCancelRefill(refill.id)}
                              title="Cancel refill schedule"
                            >
                              <Ban size={13} />
                            </button>
                          </>
                        )}
                        {terminal && (
                          <button
                            type="button"
                            className="btn-chip-action"
                            onClick={() => onReactivateRefill(refill.id)}
                            title="Reactivate refill schedule"
                          >
                            <Play size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-chip-delete"
                          onClick={() => {
                            if (window.confirm(`Remove ${refill.medicineName} from ${patient.name}'s chronic list?`)) {
                              onDeleteMedication(refill.id);
                            }
                          }}
                          title="Delete refill schedule"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-patient-state">
              <Pill size={36} className="text-muted" />
              <h4>No Refill Reminders</h4>
              <p className="text-muted text-xs">
                Add a chronic medication to schedule refill windows and WhatsApp reminders.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ACTIVITY */}
      {activeTab === 'activity' && (
        <div className="patient-tab-content">
          {activityEvents.length > 0 ? (
            <div className="customer-activity-timeline">
              {activityEvents.map((event) => (
                <div key={event.id} className={`activity-item activity-${event.kind}`}>
                  <div className="activity-dot" />
                  <div className="activity-body">
                    <div className="activity-label">{event.label}</div>
                    <div className="activity-detail text-xs text-muted">{event.detail}</div>
                    <div className="activity-time text-xs font-mono text-muted">
                      {formatDateTime(event.date)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-patient-state">
              <History size={36} className="text-muted" />
              <h4>No Activity Yet</h4>
              <p className="text-muted text-xs">
                Purchases, reminders, prescriptions and refill changes will appear here.
              </p>
            </div>
          )}
        </div>
      )}

      <SaleReceiptModal
        sale={receiptSale}
        pharmacy={pharmacy}
        isOpen={receiptSale !== null}
        onClose={() => setReceiptSale(null)}
      />
    </div>
  );
};
