import React, { useState, useEffect } from 'react';
import { 
  Pill, 
  AlertCircle, 
  Plus, 
  RotateCcw, 
  ListFilter, 
  History, 
  ShoppingCart, 
  Building2,
  Crown,
  LogOut,
  ArrowRight,
  Users,
  BarChart2,
  Stethoscope,
  FileText,
  Calendar,
  Wifi,
  WifiOff,
  ShieldCheck
} from 'lucide-react';
import { AuthUser } from '../types/pharmacy';

interface HeaderProps {
  pharmacyName?: string;
  location?: string;
  activeView: 'inventory' | 'pos' | 'ledger' | 'patients' | 'analytics' | 'settings' | 'doctor-corner' | 'opd-corner' | 'appointments';
  onViewChange: (view: 'inventory' | 'pos' | 'ledger' | 'patients' | 'analytics' | 'settings' | 'doctor-corner' | 'opd-corner' | 'appointments') => void;
  onOpenReceive: () => void;
  onResetDemo: () => void;
  ledgerCount: number;
  salesCount?: number;
  patientsCount?: number;
  refillsDueCount?: number;
  appointmentsCount?: number;
  currentUser?: AuthUser;
  onLogout?: () => void;
  isSuperAdminInspecting?: boolean;
  onReturnToSuperAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  pharmacyName = 'Nandan Pharmacy',
  location = 'Kolkata, WB',
  activeView,
  onViewChange,
  onOpenReceive,
  onResetDemo,
  ledgerCount,
  salesCount = 0,
  patientsCount = 0,
  refillsDueCount = 0,
  appointmentsCount = 0,
  currentUser,
  onLogout,
  isSuperAdminInspecting = false,
  onReturnToSuperAdmin
}) => {
  const userRole = currentUser?.role || 'OWNER';
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const canAccessTab = (tab: HeaderProps['activeView']) => {
    if (userRole === 'SUPER_ADMIN' || userRole === 'OWNER') return true;
    if (userRole === 'DOCTOR') {
      return tab === 'doctor-corner' || tab === 'appointments' || tab === 'patients' || tab === 'opd-corner';
    }
    if (userRole === 'STAFF') {
      return tab === 'pos' || tab === 'appointments' || tab === 'opd-corner' || tab === 'inventory' || tab === 'patients';
    }
    if (userRole === 'MANAGER') {
      return tab === 'inventory' || tab === 'pos' || tab === 'appointments' || tab === 'opd-corner' || tab === 'ledger' || tab === 'patients' || tab === 'settings';
    }
    return true;
  };

  return (
    <>
      {/* Super Admin Inspection Mode Banner */}
      {isSuperAdminInspecting && (
        <div className="superadmin-inspect-banner">
          <div className="inspect-banner-content">
            <div className="inspect-banner-text">
              <Crown size={16} className="text-amber-500" />
              <span>
                <strong>Super Admin Real-Time Audit:</strong> Viewing <strong>{pharmacyName}</strong> ({location}). Changes directly reflect in platform stats.
              </span>
            </div>
            {onReturnToSuperAdmin && (
              <button 
                type="button" 
                className="btn-return-admin"
                onClick={onReturnToSuperAdmin}
              >
                <span>Return to Platform Command Center</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      <header className="app-header">
        <div className="header-top">
          <div className="brand-wrapper">
            <div className="brand-logo-badge" aria-label="Medi5 Logo">
              <Pill size={20} strokeWidth={2.5} />
            </div>
            <div className="brand-text">
              <h1>Medi5</h1>
              <p>Smart Pharmacy Assistant</p>
            </div>
          </div>

          <div className="header-actions-group">
            {/* Real-Time Connectivity & PWA Offline Shield */}
            <div
              title={isOnline ? 'Local FEFO & Cart Engine Synchronized' : 'Offline mode active. Sales continue to be recorded locally.'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 9px',
                borderRadius: '12px',
                background: isOnline ? '#ecfdf5' : '#fffbeb',
                border: isOnline ? '1px solid #a7f3d0' : '1px solid #fde68a',
                color: isOnline ? '#047857' : '#b45309'
              }}
            >
              {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {/* Drug License Compliance Watchdog */}
            <button
              type="button"
              className="clickable-badge"
              onClick={() => onViewChange('settings')}
              title="Statutory Drug License Form 20B/21B Valid till 2027"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 9px',
                borderRadius: '12px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
                cursor: 'pointer'
              }}
            >
              <ShieldCheck size={13} />
              <span>DL 20B/21B</span>
            </button>

            <button 
              type="button"
              className="pharmacy-badge clickable-badge" 
              title="Active Store Profile"
              onClick={() => onViewChange('settings')}
              aria-label="Active Pharmacy Profile Settings"
            >
              <span className="status-dot"></span>
              <span>{pharmacyName} ({location})</span>
            </button>

            {currentUser && (
              <div className="user-profile-badge">
                <div className="user-info-text">
                  <span className="user-display-name">{currentUser.name}</span>
                  <span className={`user-role-tag role-${currentUser.role.toLowerCase()}`}>
                    {currentUser.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : currentUser.role}
                  </span>
                </div>
                {onLogout && (
                  <button
                    type="button"
                    className="btn-signout-header"
                    onClick={onLogout}
                    title="Sign Out"
                    aria-label="Sign Out"
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            )}

            {currentUser?.role !== 'DOCTOR' && (
              <button
                type="button"
                className="btn-receive-top"
                onClick={onOpenReceive}
                aria-label="Receive Stock"
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>Receive Stock</span>
              </button>
            )}
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="header-view-tabs" role="tablist" aria-label="Primary View Switcher">
          {canAccessTab('inventory') && (
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'inventory'}
              className={`view-tab-btn ${activeView === 'inventory' ? 'active' : ''}`}
              onClick={() => onViewChange('inventory')}
            >
              <ListFilter size={15} />
              <span title="Medicine Inventory">Inventory</span>
            </button>
          )}

          {canAccessTab('pos') && (
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'pos'}
              className={`view-tab-btn ${activeView === 'pos' ? 'active' : ''}`}
              onClick={() => onViewChange('pos')}
            >
              <ShoppingCart size={15} />
              <span title="Counter POS">POS</span>
              {salesCount > 0 && <span className="tab-count-badge pos-tab-badge">{salesCount}</span>}
            </button>
          )}

          {canAccessTab('ledger') && (
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'ledger'}
              className={`view-tab-btn ${activeView === 'ledger' ? 'active' : ''}`}
              onClick={() => onViewChange('ledger')}
            >
              <History size={15} />
              <span title="Stock Ledger">Ledger</span>
              <span className="tab-count-badge">{ledgerCount}</span>
            </button>
          )}

          {canAccessTab('patients') && (
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'patients'}
              className={`view-tab-btn ${activeView === 'patients' ? 'active' : ''}`}
              onClick={() => onViewChange('patients')}
            >
              <Users size={15} />
              <span title="Patients & WhatsApp Refills">Patients</span>
              {refillsDueCount > 0 ? (
                <span className="tab-count-badge pos-tab-badge">{refillsDueCount}</span>
              ) : patientsCount > 0 ? (
                <span className="tab-count-badge">{patientsCount}</span>
              ) : null}
            </button>
          )}

          {canAccessTab('analytics') && (
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'analytics'}
              className={`view-tab-btn ${activeView === 'analytics' ? 'active' : ''}`}
              onClick={() => onViewChange('analytics')}
            >
              <BarChart2 size={15} />
              <span title="Financial Health & Leakage Analytics">Analytics</span>
            </button>
          )}

          {canAccessTab('appointments') && (
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'appointments'}
              className={`view-tab-btn ${activeView === 'appointments' ? 'active' : ''}`}
              onClick={() => onViewChange('appointments')}
            >
              <Calendar size={15} />
              <span title="Doctor Appointments & Chamber Queue">Appointments</span>
              {typeof appointmentsCount === 'number' && appointmentsCount > 0 && (
                <span className="badge-alert-count">{appointmentsCount}</span>
              )}
            </button>
          )}

          {canAccessTab('doctor-corner') && (
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'doctor-corner'}
              className={`view-tab-btn ${activeView === 'doctor-corner' ? 'active' : ''}`}
              onClick={() => onViewChange('doctor-corner')}
            >
              <Stethoscope size={15} />
              <span title="Doctor's Corner - E-Prescription">{userRole === 'DOCTOR' ? 'Dr. Desk' : 'Dr. Corner'}</span>
            </button>
          )}

          {canAccessTab('opd-corner') && (
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'opd-corner'}
              className={`view-tab-btn ${activeView === 'opd-corner' ? 'active' : ''}`}
              onClick={() => onViewChange('opd-corner')}
            >
              <FileText size={15} />
              <span title="OPD Corner - E-Prescriptions">OPD Corner</span>
            </button>
          )}

          {canAccessTab('settings') && (
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'settings'}
              className={`view-tab-btn ${activeView === 'settings' ? 'active' : ''}`}
              onClick={() => onViewChange('settings')}
            >
              <Building2 size={15} />
              <span title="Pharmacy Profile">Profile</span>
            </button>
          )}
        </div>
      </header>

      {/* Demo Persistent Storage Banner */}
      <div className="demo-banner">
        <div className="demo-banner-content">
          <div className="demo-banner-info">
            <AlertCircle size={14} />
            <span>
              <strong>Local Demo Mode:</strong> Counter sales and inventory persisted in browser localStorage (v1). Not production/shared database storage.
            </span>
          </div>

          <button
            type="button"
            className="btn-reset-demo"
            onClick={onResetDemo}
            title="Reset to initial seed dataset"
            aria-label="Reset local demo dataset"
          >
            <RotateCcw size={12} />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>
    </>
  );
};
