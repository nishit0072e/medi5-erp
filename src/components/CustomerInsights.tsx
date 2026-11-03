import React, { useMemo } from 'react';
import { Users, UserCheck, UserMinus, Sparkles, MessageCircle, TrendingUp } from 'lucide-react';
import { Patient, WhatsAppReminderLog } from '../types/patient';
import { SaleRecord } from '../types/inventory';
import { formatINR } from '../utils/dateUtils';

interface CustomerInsightsProps {
  patients: Patient[];
  sales: SaleRecord[];
  reminderLogs: WhatsAppReminderLog[];
}

export const CustomerInsights: React.FC<CustomerInsightsProps> = ({
  patients,
  sales,
  reminderLogs
}) => {
  const insights = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    const active = patients.filter((p) => p.status === 'ACTIVE').length;
    const inactive = patients.length - active;
    const newThisMonth = patients.filter((p) => p.createdAt >= monthStart).length;

    const linkedSales = sales.filter((s) => s.patientId);
    const spendByPatient = new Map<string, number>();
    linkedSales.forEach((sale) => {
      if (!sale.patientId) return;
      spendByPatient.set(sale.patientId, (spendByPatient.get(sale.patientId) || 0) + sale.sellingBill);
    });

    const buyers = spendByPatient.size;
    const totalLinkedSpend = Array.from(spendByPatient.values()).reduce((sum, v) => sum + v, 0);
    const averageSpend = buyers > 0 ? totalLinkedSpend / buyers : 0;

    let topCustomer: { name: string; spend: number } | null = null;
    const topEntry = Array.from(spendByPatient.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topEntry) {
      const patient = patients.find((p) => p.id === topEntry[0]);
      if (patient) {
        topCustomer = { name: patient.name, spend: topEntry[1] };
      }
    }

    const remindersThisMonth = reminderLogs.filter((l) => l.sentAt >= monthStart).length;
    const reachedPatientIds = new Set(
      reminderLogs.filter((l) => l.sentAt >= monthStart).map((l) => l.patientId)
    );
    const reachRate = active > 0 ? Math.min(100, Math.round((reachedPatientIds.size / active) * 100)) : 0;

    return {
      active,
      inactive,
      newThisMonth,
      buyers,
      averageSpend,
      topCustomer,
      remindersThisMonth,
      reachRate
    };
  }, [patients, sales, reminderLogs]);

  return (
    <div className="customer-insights-panel">
      <div className="customer-insights-head">
        <h4>
          <Sparkles size={15} /> Customer Insights
        </h4>
        <span className="text-xs text-muted">Live from linked sales and reminder logs</span>
      </div>

      <div className="customer-insights-grid">
        <div className="insight-tile">
          <div className="insight-icon insight-icon-green">
            <UserCheck size={16} />
          </div>
          <div>
            <div className="insight-value">{insights.active}</div>
            <div className="insight-label">Active customers</div>
          </div>
        </div>

        <div className="insight-tile">
          <div className="insight-icon insight-icon-slate">
            <UserMinus size={16} />
          </div>
          <div>
            <div className="insight-value">{insights.inactive}</div>
            <div className="insight-label">Inactive profiles</div>
          </div>
        </div>

        <div className="insight-tile">
          <div className="insight-icon insight-icon-amber">
            <Users size={16} />
          </div>
          <div>
            <div className="insight-value">{insights.newThisMonth}</div>
            <div className="insight-label">Added this month</div>
          </div>
        </div>

        <div className="insight-tile">
          <div className="insight-icon insight-icon-blue">
            <MessageCircle size={16} />
          </div>
          <div>
            <div className="insight-value">{insights.remindersThisMonth}</div>
            <div className="insight-label">
              Reminders this month • {insights.reachRate}% reach
            </div>
          </div>
        </div>

        <div className="insight-tile">
          <div className="insight-icon insight-icon-teal">
            <TrendingUp size={16} />
          </div>
          <div>
            <div className="insight-value">{formatINR(insights.averageSpend)}</div>
            <div className="insight-label">
              {insights.buyers > 0
                ? `Avg spend • ${insights.buyers} linked buyer${insights.buyers === 1 ? '' : 's'}`
                : 'No linked purchases yet'}
            </div>
          </div>
        </div>

        <div className="insight-tile">
          <div className="insight-icon insight-icon-purple">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="insight-value insight-value-sm">
              {insights.topCustomer ? insights.topCustomer.name : 'No purchases yet'}
            </div>
            <div className="insight-label">
              Top customer
              {insights.topCustomer ? ` • ${formatINR(insights.topCustomer.spend)}` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
