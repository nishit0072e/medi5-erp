# Medi5 — Product Requirements Document

**Project:** Medi5 — Smart Pharmacy Assistant & Mobile ERP  
**Status:** Foundation and requirements definition  
**Initial target market:** Independent retail pharmacies in West Bengal, India

## 1. Product Vision

Medi5 is a mobile-first, multi-tenant pharmacy management platform designed to help independent pharmacies manage inventory, medicine batches, sales, patient refill reminders, supplier reorders, and business analytics from a smartphone.

The objective is to build a reliable, secure, affordable, production-ready SaaS product.

## 2. Target Users

- Pharmacy owners managing daily operations.
- Authorized pharmacy staff handling inventory and sales.
- Future authorized users with role-appropriate permissions.

The initial experience must prioritize Android smartphones and users who may not have a desktop computer.

## 3. Core Product Modules

### 3.1 Inventory
- Medicine master records and categories.
- Batch-level inventory, expiry dates, purchase costs, and MRP.
- Stock quantities and configurable alert thresholds.
- Low-stock and expiry alerts.
- Expired-stock handling.
- Stock movement history.
- Quick sale and dispensing workflows.
- Suggested reorder quantities.

### 3.2 Patients and Refill Reminders
- Patient records containing only necessary information.
- Medicine and refill details.
- Configurable refill reminders.
- Optional WhatsApp reminder links.
- Strict access controls for patient data.

### 3.3 Sales
- Smartphone-friendly sale entry.
- Stock validation and batch deduction.
- Transaction history.
- Recorded revenue and cost information.
- Protection against duplicate transactions and overselling.
- Support for auditable corrections and future refund workflows.

### 3.4 Analytics
- Daily and weekly sales summaries.
- Revenue and cost of goods sold.
- Operating expenses and profit estimates.
- Expired-stock waste.
- Estimated stock-out losses.
- Estimated missed refill opportunities.

Recorded financial values and estimates must be clearly distinguished.

### 3.5 Smart Reorder
- Low-stock recommendations.
- Sales-velocity-based stock targets.
- Consideration of eligible stock and outstanding orders.
- Supplier contact and prefilled WhatsApp messages.
- Explicit user approval before initiating an order workflow.

### 3.6 Pharmacy Settings
- Pharmacy profile.
- Owner and authorized user information.
- Supplier contact details.
- Configurable expiry-alert thresholds.
- Account and session management.

## 4. Multi-Tenant Requirements

Multiple independent pharmacies must use the same application while remaining isolated from one another.

Requirements:
- Each pharmacy has a distinct tenant record.
- Users authenticate through individual accounts.
- Authorized users are linked to pharmacies through explicit membership relationships.
- Tenant-owned records are associated with the appropriate pharmacy.
- Database authorization enforces tenant isolation.
- Unauthorized cross-tenant reads and mutations are rejected.
- Patient, inventory, sales, and financial data receive the same protection.

Frontend filtering alone is not sufficient.

## 5. Mobile and PWA Requirements

- Mobile-first responsive interface.
- Installable Progressive Web App.
- Touch-friendly controls and forms.
- Appropriate safe-area handling.
- Clear loading, empty, success, and error states.
- Usability on lower-end Android devices and slower connections.
- Explicitly designed offline behavior where supported.
- Reliable recovery from interrupted network requests.

## 6. Initial Design Direction

- Primary green: `#13634B`
- Sage background: `#DFECE6`
- White cards: `#FFFFFF`
- Mint category background: `#D0E6DF`
- Four main navigation tabs: Inventory, Patients, Analytics, Settings.
- Rounded cards, compact status badges, and mobile-friendly bottom sheets.

The original prototype screenshots provide the initial visual reference.

## 7. Security and Privacy

- Secure authentication and session handling.
- Database-enforced authorization.
- Strict tenant isolation.
- Input validation and database constraints.
- Protection of secrets and credentials.
- Minimal collection of patient information.
- Auditable stock and financial operations.
- Appropriate backup and recovery procedures.

Applicable Indian privacy, pharmacy, drug-sale, and recordkeeping requirements must be assessed before commercial release.

## 8. Quality Requirements

- Automated tests for important business rules.
- Cross-tenant authorization tests.
- Validation of expiry and batch-selection logic.
- Testing of sales and stock consistency.
- Mobile viewport and usability testing.
- Error handling and recovery testing.
- Documented staging and production release procedures.

## 9. Initial Scope Boundaries

The immediate phase is requirements and architecture documentation.

Do not treat this document as authorization to implement the complete application.

Native mobile applications, paid WhatsApp API integrations, advanced AI forecasting, and other additional capabilities require separate evaluation and approval.

## 10. Acceptance Criteria for the Foundation Phase

- Product scope and core modules are documented.
- Multi-tenant security is identified as a mandatory requirement.
- Initial mobile UX requirements are recorded.
- Business rules requiring further decisions are identified.
- Architecture and implementation have not been prematurely locked beyond approved decisions.
