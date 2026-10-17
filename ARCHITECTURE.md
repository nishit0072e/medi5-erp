# Medi5 — Architecture

**Status:** Proposed architecture for review  
**Scope:** Foundation design only; not authorization to implement the entire product  
**Product:** Mobile-first, multi-tenant pharmacy ERP SaaS

## 1. Architecture Goals

Medi5 should be secure by default, mobile-first, maintainable by a small team, and suitable for incremental delivery. Pharmacy data must remain isolated across tenants, and inventory and sales operations must preserve consistency even when requests are retried or multiple staff members act concurrently.

This document records the current proposal. Choices marked **Proposed** are not final until reviewed and approved.

## 2. Proposed System Overview

The initial architecture is a web application delivered as an installable Progressive Web App (PWA).

- **Client:** React application, built with Vite and TypeScript.
- **UI:** Tailwind CSS and Lucide icons, following the approved Medi5 design tokens.
- **Identity:** Supabase Auth.
- **Database:** Supabase-hosted PostgreSQL.
- **Authorization:** PostgreSQL Row Level Security (RLS), supported by carefully scoped database functions where required.
- **Hosting:** A static frontend host such as Vercel; final provider and environment setup remain to be confirmed.
- **Testing:** Vitest and React Testing Library for unit/component tests, plus Playwright for browser workflows.
- **Source control:** GitHub. This repository is public, so it must contain no secrets, credentials, or real patient/pharmacy data.

The browser must never be trusted to enforce tenant boundaries. Hiding another pharmacy's records in the UI is not authorization.

## 3. High-Level Request Flow

1. A user opens the PWA and signs in through Supabase Auth.
2. The client requests data through Supabase's authenticated APIs.
3. PostgreSQL policies evaluate the authenticated identity and pharmacy membership for each protected operation.
4. Database constraints and transactional operations preserve data integrity.
5. The client displays only the response it is authorized to receive and handles loading, empty, offline, and error states explicitly.

Privileged server credentials must never be embedded in the frontend. If a future integration requires a privileged secret, it must run in a trusted server-side environment and validate authorization independently.

## 4. Tenant and Membership Model

**Proposed core entities:**

- `profiles`: application-level user profile keyed to the authenticated user ID.
- `pharmacies`: one record per pharmacy tenant.
- `pharmacy_memberships`: explicit relationship between a user and a pharmacy, including role and membership status.
- Tenant-owned business tables: each row belongs to a pharmacy through a `pharmacy_id` foreign key.

Do not assume that a pharmacy ID equals a user's authentication ID. One user may be associated with more than one pharmacy, and one pharmacy may have multiple authorized users.

Roles and permissions need an explicit decision before implementation. At minimum, the design should distinguish an owner/administrator from staff permissions and should support revoking a membership.

### Tenant authorization requirements

- Enable RLS on every table containing tenant-owned or sensitive data.
- Read, insert, update, and delete policies must be considered separately.
- A user may access a tenant's records only through a valid, active membership and the required role.
- Inserts must not allow a client to assign records to an arbitrary pharmacy.
- Updates must prevent moving a record across tenants by changing `pharmacy_id`.
- Database functions, views, storage objects, and future server endpoints must not bypass the same access model.
- Test both allowed same-tenant operations and denied cross-tenant operations.
- Use restrictive grants and least privilege in addition to RLS; do not treat RLS as a replacement for all database permissions.

Membership bootstrapping (who creates a pharmacy and its first owner membership) must be designed carefully so a user cannot promote themselves into another tenant. This is an unresolved design decision and should be reviewed before migrations are written.

## 5. Proposed Domain Model

The following is a conceptual model, not a final schema or migration.

### Organization and access

- `profiles`
- `pharmacies`
- `pharmacy_memberships`

### Inventory

- `medicines`: medicine/product identity and descriptive fields.
- `medicine_batches`: pharmacy-specific batch, expiry, cost, MRP, and quantity information.
- `stock_movements`: auditable ledger of receipts, sales, adjustments, returns, and expiry/quarantine actions.
- `suppliers`: pharmacy-specific supplier contact and ordering information.
- Potential future `purchase_orders` and `purchase_order_items`.

Medicine identity and batch identity must remain separate. Batch expiry and cost must not be represented only as fields on the medicine master record.

### Sales

- `sales`: sale header, status, timestamps, totals, and idempotency information.
- `sale_items`: items and quantities sold, including the selected batch and a snapshot of relevant price/cost values.

A sale that consumes stock must update the sale, its items, stock movements, and batch quantities in a single database transaction. The exact database function/RPC contract is to be specified before implementing the POS.

### Patients and reminders

- `patients`: minimum necessary patient information, scoped to a pharmacy.
- `prescriptions` or `patient_medications`: only if required by validated workflows and applicable rules.
- `refill_reminders`: reminder schedule and status, with minimum necessary details.

Patient data is sensitive. Avoid storing unnecessary medical history, and decide retention, deletion, access logging, and consent/notice behavior before launch.

### Analytics and expenses

- `expenses`: pharmacy-specific recorded operating expenses.
- Analytics should initially derive from validated sales, stock, and expense records. Cached aggregates or reporting tables can be added only if performance requires them.

Do not treat estimates such as missed sales or future stock-outs as recorded financial facts. Label assumptions and estimates clearly in the UI.

## 6. Inventory and Sales Invariants

These are mandatory business invariants; exact implementation details remain to be designed.

- Quantities cannot become negative through ordinary sale operations.
- Expired or quarantined batches are not eligible for dispensing.
- Batch selection should use FEFO (first-expiry, first-out) among eligible batches where appropriate.
- Expiry dates and batch quantities must be validated.
- Stock changes must be traceable through an append-oriented movement history; corrections should be auditable rather than silently rewriting history.
- Retrying a sale request must not create a duplicate sale or deduct stock twice. Use a server-validated idempotency key or equivalent mechanism.
- Concurrent sales must be protected by database transactions and appropriate row locking/atomic updates.
- Monetary calculations must use a consistent precision strategy and must not rely on imprecise floating-point arithmetic for authoritative totals.
- Refunds, returns, cancelled sales, and stock adjustments need explicit state transitions and audit rules before implementation.

## 7. Client Application Structure

**Proposed:** Keep the frontend organized by feature rather than putting the entire application in a few large components.

Possible feature areas:

- `app/`: application bootstrap, routing, global providers.
- `components/`: shared UI primitives and layout.
- `features/inventory/`
- `features/patients/`
- `features/sales/`
- `features/analytics/`
- `features/settings/`
- `lib/`: Supabase client, validation helpers, formatting utilities.
- `types/`: shared application types.
- `tests/`: shared test setup and test utilities.

This is a proposed organization, not a required exact folder layout. Confirm it when the initial project scaffold is planned.

## 8. Mobile and PWA Behavior

- Design for Android phone widths first, then scale up to tablet and desktop.
- Keep the four primary areas: Inventory, Patients, Analytics, Settings.
- Provide touch-friendly controls, readable text, keyboard-aware forms, and safe-area spacing.
- Include loading, empty, success, validation, and recoverable-error states.
- Installability does not imply reliable offline operation. Define exactly which screens, if any, may work offline.
- Do not queue sales or stock mutations offline unless conflict resolution, idempotency, and user-visible reconciliation are explicitly designed and tested.
- Avoid persisting sensitive patient data in browser storage or service-worker caches by default.
- Service-worker caching rules must not cache authenticated API responses or sensitive tenant data in a way that could expose them after logout or account switching.

## 9. External Integrations

WhatsApp reminders and supplier messages should begin as user-initiated prefilled links where appropriate. The app must not silently send messages. Confirm the recipient and message before opening the external application.

Paid messaging APIs, automated outbound messages, barcode integrations, accounting integrations, and advanced forecasting are out of the initial foundation scope and require separate review.

## 10. Environments and Secrets

Maintain separate development, staging, and production environments, with separate Supabase projects or equivalently isolated resources.

- Commit an `.env.example` containing placeholder names only.
- Keep actual environment files and credentials out of Git.
- Frontend-exposed Supabase project URL and publishable/anon key are configuration, not a substitute for security; RLS and database grants must still protect all data.
- Never expose a Supabase service-role key, database password, signing secret, or other privileged credential to the browser or public repository.
- Use test-only or synthetic data in development and automated tests.
- Define backup, restore, migration, and rollback procedures before production use.

## 11. Quality and Security Verification

Required test categories before production:

- Authentication and session lifecycle.
- Cross-tenant read and write denial, including attempts to spoof `pharmacy_id`.
- Membership creation, role changes, and revocation.
- Expired/quarantined batch exclusion and FEFO selection.
- Sale atomicity, duplicate retries, concurrency, and insufficient-stock behavior.
- Monetary totals and rounding.
- Input validation and database constraints.
- Mobile layouts, navigation, forms, and recoverable network failures.
- Logout and tenant/account switching without leaking cached data.
- Backup restoration and production migration rehearsal.

Tests must use isolated synthetic fixtures and must not contain real patient data.

## 12. Delivery Stages

1. **Foundation:** approve PRD, architecture, working agreements, and unresolved decisions.
2. **Scaffold:** create the minimal frontend, lint/type-check/test setup, and environment template.
3. **Identity and tenancy:** implement authentication, pharmacy membership, schema migrations, RLS, and isolation tests before business data is added.
4. **Inventory:** medicine master, batches, movements, expiry and low-stock logic.
5. **Sales:** transactional dispensing and idempotency protections.
6. **Patients and reminders:** minimal patient records and user-initiated reminder links.
7. **Analytics and reorder:** validated calculations with clear distinctions between facts and estimates.
8. **PWA and release readiness:** offline boundaries, accessibility, backups, security review, staging and production deployment.

Each stage requires review and acceptance before the next begins. Do not generate the complete application in one large code-writing step.

## 13. Decisions Still Open

The team should resolve these in small, explicit decisions before implementation:

1. TypeScript versus JavaScript (TypeScript is proposed).
2. Exact user roles and permission matrix.
3. Pharmacy onboarding and first-owner membership flow.
4. Required medicine fields, batch fields, units, and quantity conventions.
5. Tax/invoice requirements and whether invoice generation is in the first release.
6. Sale cancellation, returns, refunds, and stock adjustment rules.
7. Patient data minimization, retention, deletion, and notice/consent requirements.
8. Offline capabilities and whether any workflows are permitted offline.
9. Deployment providers, environments, backup schedule, and recovery objectives.
10. Applicable Indian pharmacy, drug-sale, privacy, and recordkeeping requirements, validated with qualified local advice before commercial launch.

## 14. Approval Boundary

This document describes a proposed architecture for review. It does not claim that any infrastructure, database, security policy, or application code has already been created. No implementation should begin until the foundation documents and the next small implementation step have been reviewed and agreed.
