import React, { useState } from 'react';
import { 
  Pill, 
  Lock, 
  Mail, 
  ShieldCheck, 
  Store, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Crown
} from 'lucide-react';
import { authenticateUser } from '../utils/authService';
import { AuthSession } from '../types/pharmacy';

interface LoginScreenProps {
  onLoginSuccess: (session: AuthSession) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const session = authenticateUser(loginId, password);
      onLoginSuccess(session);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (email: string, pw: string) => {
    setLoginId(email);
    setPassword(pw);
    setErrorMessage(null);
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-card-container">
        {/* Brand Header */}
        <div className="login-brand-header">
          <div className="login-logo-badge">
            <Pill size={28} strokeWidth={2.5} />
          </div>
          <h1>Medi5 ERP</h1>
          <p className="login-subtext">Smart Multi-Tenant Pharmacy Operating Platform</p>
        </div>

        {/* Security Badge */}
        <div className="login-security-banner">
          <ShieldCheck size={16} className="text-primary-green" />
          <span>Strict Tenant Isolation & Role-Based Access Control</span>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="login-error-alert" role="alert">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Login ID / Registered Email *</label>
            <div className="input-with-icon">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                className="form-input pl-icon"
                value={loginId}
                onChange={(e) => {
                  setLoginId(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="name@pharmacy.in or admin@medi5.in"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password *</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input pl-icon pr-icon"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="Enter password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-login-submit"
            disabled={isLoading}
          >
            <span>{isLoading ? 'Authenticating...' : 'Sign In to Medi5'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Quick Demo Credentials Panel */}
        <div className="quick-creds-section">
          <div className="quick-creds-title">
            <span>Demo Testing Accounts (Click to Fill)</span>
          </div>

          <div className="quick-creds-grid">
            <button
              type="button"
              className="quick-cred-card superadmin-cred"
              onClick={() => handleQuickFill('admin@medi5.in', 'admin')}
            >
              <div className="cred-role-header">
                <Crown size={14} className="text-amber-500" />
                <span className="font-bold">Super Admin (Platform Owner)</span>
              </div>
              <div className="cred-details">
                <code>admin@medi5.in</code> • <code>admin</code>
              </div>
              <span className="cred-purpose">Platform live monitoring, GMV, store diagnostics & usage fees</span>
            </button>

            <button
              type="button"
              className="quick-cred-card tenant-cred"
              onClick={() => handleQuickFill('nandan.owner@nandanpharmacy.in', 'password123')}
            >
              <div className="cred-role-header">
                <Store size={14} className="text-primary-green" />
                <span className="font-bold">Nandan Pharmacy (Owner)</span>
              </div>
              <div className="cred-details">
                <code>nandan.owner@nandanpharmacy.in</code> • <code>password123</code>
              </div>
              <span className="cred-purpose">Kolkata store — Isolated inventory, POS, & staff</span>
            </button>

            <button
              type="button"
              className="quick-cred-card tenant-cred"
              onClick={() => handleQuickFill('subhash@deshbandhumedical.in', 'password123')}
            >
              <div className="cred-role-header">
                <Store size={14} className="text-primary-green" />
                <span className="font-bold">Deshbandhu Medical (Owner)</span>
              </div>
              <div className="cred-details">
                <code>subhash@deshbandhumedical.in</code> • <code>password123</code>
              </div>
              <span className="cred-purpose">Siliguri store — Completely isolated tenant</span>
            </button>
          </div>

          <p className="login-isolation-note">
            🛡️ <strong>Zero Cross-Tenant Visibility:</strong> Each pharmacy tenant only sees their own registered medicines, batches, sales, and staff. Other pharmacies remain completely hidden.
          </p>
        </div>
      </div>
    </div>
  );
};
