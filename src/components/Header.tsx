import React from 'react';
import { Pill, AlertCircle } from 'lucide-react';

interface HeaderProps {
  pharmacyName?: string;
  location?: string;
}

export const Header: React.FC<HeaderProps> = ({
  pharmacyName = 'Nandan Pharmacy',
  location = 'Kolkata, WB'
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

          <div className="pharmacy-badge" title="Active Tenant Context">
            <span className="status-dot"></span>
            <span>{pharmacyName} ({location})</span>
          </div>
        </div>
      </header>

      <div className="demo-banner">
        <div className="demo-banner-content">
          <AlertCircle size={14} />
          <span>Demo Prototype — Using isolated synthetic data. No Supabase connection required.</span>
        </div>
      </div>
    </>
  );
};
