import React from 'react';
import { Package, Users, BarChart3, Settings, AlertTriangle } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'inventory' | 'patients' | 'analytics' | 'settings';
  onTabChange: (tab: 'inventory' | 'patients' | 'analytics' | 'settings') => void;
  inventoryCount?: number;
  refillAlertCount?: number;
  leakageScore?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  inventoryCount = 6,
  refillAlertCount = 0,
  leakageScore = 0
}) => {
  return (
    <nav className="bottom-nav" aria-label="Main Navigation">
      <button
        className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
        onClick={() => onTabChange('inventory')}
        type="button"
        aria-label="Inventory Tab"
      >
        <Package size={20} />
        <span>Inventory</span>
        {inventoryCount > 0 && <span className="nav-badge-pill">{inventoryCount}</span>}
      </button>

      <button
        className={`nav-item ${activeTab === 'patients' ? 'active' : ''}`}
        type="button"
        onClick={() => onTabChange('patients')}
        aria-label="Patients & WhatsApp Refills Tab"
      >
        <Users size={20} />
        <span>Patients</span>
        {refillAlertCount > 0 && <span className="nav-badge-pill nav-badge-amber">{refillAlertCount}</span>}
      </button>

      <button
        className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
        type="button"
        onClick={() => onTabChange('analytics')}
        aria-label="Financial Health & Leakage Analytics Tab"
      >
        <BarChart3 size={20} />
        <span>Analytics</span>
        {leakageScore > 50 && (
          <span className="nav-badge-pill nav-badge-amber">
            <AlertTriangle size={10} /> {leakageScore}
          </span>
        )}
      </button>

      <button
        className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
        type="button"
        onClick={() => onTabChange('settings')}
        aria-label="Pharmacy Settings Tab"
      >
        <Settings size={20} />
        <span>Settings</span>
      </button>
    </nav>
  );
};
