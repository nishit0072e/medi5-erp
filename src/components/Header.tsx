import React from 'react';
import { Pill, AlertCircle, Plus, RotateCcw, ListFilter, History, ShoppingCart } from 'lucide-react';

interface HeaderProps {
  pharmacyName?: string;
  location?: string;
  activeView: 'inventory' | 'pos' | 'ledger';
  onViewChange: (view: 'inventory' | 'pos' | 'ledger') => void;
  onOpenReceive: () => void;
  onResetDemo: () => void;
  ledgerCount: number;
  salesCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  pharmacyName = 'Nandan Pharmacy',
  location = 'Kolkata, WB',
  activeView,
  onViewChange,
  onOpenReceive,
  onResetDemo,
  ledgerCount,
  salesCount = 0
}) => {
  return (
    <>
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
            <div className="pharmacy-badge" title="Active Tenant Context">
              <span className="status-dot"></span>
              <span>{pharmacyName} ({location})</span>
            </div>

            <button
              type="button"
              className="btn-receive-top"
              onClick={onOpenReceive}
              aria-label="Receive Stock"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Receive Stock</span>
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="header-view-tabs" role="tablist" aria-label="Primary View Switcher">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'inventory'}
            className={`view-tab-btn ${activeView === 'inventory' ? 'active' : ''}`}
            onClick={() => onViewChange('inventory')}
          >
            <ListFilter size={15} />
            <span>Medicine Inventory</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'pos'}
            className={`view-tab-btn ${activeView === 'pos' ? 'active' : ''}`}
            onClick={() => onViewChange('pos')}
          >
            <ShoppingCart size={15} />
            <span>Counter POS</span>
            {salesCount > 0 && <span className="tab-count-badge pos-tab-badge">{salesCount}</span>}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'ledger'}
            className={`view-tab-btn ${activeView === 'ledger' ? 'active' : ''}`}
            onClick={() => onViewChange('ledger')}
          >
            <History size={15} />
            <span>Stock Ledger</span>
            <span className="tab-count-badge">{ledgerCount}</span>
          </button>
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
