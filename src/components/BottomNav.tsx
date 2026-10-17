import React from 'react';
import { Package, Users, BarChart3, Settings } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'inventory' | 'patients' | 'analytics' | 'settings';
  onTabChange: (tab: 'inventory' | 'patients' | 'analytics' | 'settings') => void;
  inventoryCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  inventoryCount = 6
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
        className={`nav-item disabled`}
        type="button"
        title="Patients module will be built in Phase 3"
        aria-disabled="true"
        onClick={() => alert('Patients & WhatsApp Refills module is part of Phase 3.')}
      >
        <Users size={20} />
        <span>Patients</span>
      </button>

      <button
        className={`nav-item disabled`}
        type="button"
        title="Analytics module will be built in Phase 4"
        aria-disabled="true"
        onClick={() => alert('Financial Health & Leakage Analytics is part of Phase 4.')}
      >
        <BarChart3 size={20} />
        <span>Analytics</span>
      </button>

      <button
        className={`nav-item disabled`}
        type="button"
        title="Pharmacy Settings will be built in Phase 2"
        aria-disabled="true"
        onClick={() => alert('Multi-tenant Pharmacy Profile Settings is part of Phase 2.')}
      >
        <Settings size={20} />
        <span>Settings</span>
      </button>
    </nav>
  );
};
