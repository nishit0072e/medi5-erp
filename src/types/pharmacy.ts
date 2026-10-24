/**
 * Multi-Tenant Pharmacy & User Profile Domain Models for Medi5 ERP
 * 
 * Invariants:
 * 1. Each pharmacy tenant maintains legal entity details (Drug License Form 20/21, GSTIN, registered address).
 * 2. Authorized memberships govern access (OWNER, MANAGER, STAFF).
 * 3. Every pharmacy tenant must retain at least one active OWNER.
 * 4. Dispensing receipts and inventory audit trail reference active pharmacy tenant metadata.
 */

export type MembershipRole = 'OWNER' | 'MANAGER' | 'STAFF';
export type MembershipStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REVOKED';

export interface PharmacyMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: MembershipRole;
  status: MembershipStatus;
  joinedDate: string;
}

export interface PharmacyProfile {
  id: string;
  name: string;
  legalName: string;
  drugLicenseNumber: string;
  gstin?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  currency: string;
  expiryThresholdDays: number;
  lowStockThresholdDefault: number;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  members: PharmacyMember[];
  updatedAt: string;
}

export interface UpdatePharmacyInput {
  name: string;
  legalName: string;
  drugLicenseNumber: string;
  gstin?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  expiryThresholdDays: number;
  lowStockThresholdDefault: number;
}

export interface AddMemberInput {
  name: string;
  email: string;
  phone: string;
  role: MembershipRole;
}
