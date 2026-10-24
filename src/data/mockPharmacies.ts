import { PharmacyProfile } from '../types/pharmacy';

export const MOCK_PHARMACIES: PharmacyProfile[] = [
  {
    id: 'pharm-nandan-kolkata',
    name: 'Nandan Pharmacy',
    legalName: 'Nandan Chemist & Druggist Pvt. Ltd.',
    drugLicenseNumber: 'WB-KOL-20B-184920',
    gstin: '19AABCN8572P1Z5',
    addressLine1: '142 Rashbehari Avenue',
    addressLine2: 'Near Triangular Park',
    city: 'Kolkata',
    state: 'West Bengal',
    pincode: '700029',
    phone: '+91 98300 12345',
    email: 'care@nandanpharmacy.in',
    currency: 'INR',
    expiryThresholdDays: 60,
    lowStockThresholdDefault: 15,
    status: 'ACTIVE',
    updatedAt: new Date().toISOString(),
    members: [
      {
        id: 'user-nandan-01',
        name: 'Nandan Sen',
        email: 'nandan.owner@nandanpharmacy.in',
        phone: '+91 98300 12345',
        role: 'OWNER',
        status: 'ACTIVE',
        joinedDate: '2024-01-15'
      },
      {
        id: 'user-ratan-02',
        name: 'Ratan Biswas',
        email: 'ratan.mgr@nandanpharmacy.in',
        phone: '+91 98301 54321',
        role: 'MANAGER',
        status: 'ACTIVE',
        joinedDate: '2024-03-01'
      },
      {
        id: 'user-priya-03',
        name: 'Priya Das',
        email: 'priya.dispenser@nandanpharmacy.in',
        phone: '+91 98302 98765',
        role: 'STAFF',
        status: 'ACTIVE',
        joinedDate: '2024-06-10'
      }
    ]
  },
  {
    id: 'pharm-deshbandhu-siliguri',
    name: 'Deshbandhu Medical Hall',
    legalName: 'Deshbandhu Medicare Retail LLP',
    drugLicenseNumber: 'WB-DAR-21A-093214',
    gstin: '19AABCD4123Q1Z2',
    addressLine1: '45 Hill Cart Road',
    addressLine2: 'Opposite City Head Post Office',
    city: 'Siliguri',
    state: 'West Bengal',
    pincode: '734001',
    phone: '+91 94340 98765',
    email: 'contact@deshbandhumedical.in',
    currency: 'INR',
    expiryThresholdDays: 45,
    lowStockThresholdDefault: 20,
    status: 'ACTIVE',
    updatedAt: new Date().toISOString(),
    members: [
      {
        id: 'user-subhash-01',
        name: 'Subhash Mukherjee',
        email: 'subhash@deshbandhumedical.in',
        phone: '+91 94340 98765',
        role: 'OWNER',
        status: 'ACTIVE',
        joinedDate: '2023-11-20'
      },
      {
        id: 'user-aniket-02',
        name: 'Aniket Roy',
        email: 'aniket@deshbandhumedical.in',
        phone: '+91 94341 12340',
        role: 'STAFF',
        status: 'ACTIVE',
        joinedDate: '2024-02-14'
      }
    ]
  }
];

export interface MockCredential {
  email: string;
  password: string;
  name: string;
  role: 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'STAFF';
  pharmacyId?: string;
  pharmacyName?: string;
}

export const SUPER_ADMIN_CREDENTIAL: MockCredential = {
  email: 'admin@medi5.in',
  password: 'admin',
  name: 'Platform Super Admin',
  role: 'SUPER_ADMIN'
};

export const MOCK_CREDENTIALS: MockCredential[] = [
  SUPER_ADMIN_CREDENTIAL,
  {
    email: 'nandan.owner@nandanpharmacy.in',
    password: 'password123',
    name: 'Nandan Sen (Owner)',
    role: 'OWNER',
    pharmacyId: 'pharm-nandan-kolkata',
    pharmacyName: 'Nandan Pharmacy'
  },
  {
    email: 'priya.dispenser@nandanpharmacy.in',
    password: 'password123',
    name: 'Priya Das (Staff)',
    role: 'STAFF',
    pharmacyId: 'pharm-nandan-kolkata',
    pharmacyName: 'Nandan Pharmacy'
  },
  {
    email: 'subhash@deshbandhumedical.in',
    password: 'password123',
    name: 'Subhash Mukherjee (Owner)',
    role: 'OWNER',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    pharmacyName: 'Deshbandhu Medical Hall'
  },
  {
    email: 'aniket@deshbandhumedical.in',
    password: 'password123',
    name: 'Aniket Roy (Staff)',
    role: 'STAFF',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    pharmacyName: 'Deshbandhu Medical Hall'
  }
];

