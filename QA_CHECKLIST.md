# Medi5 — QA Checklist

**Status:** Initial quality and release checklist  
**Product:** Mobile-first, multi-tenant pharmacy ERP SaaS  
**Purpose:** Define verification expectations before implementation and release.  
**Important:** A checked item means it was actually tested and evidence was reviewed; it must not be checked merely because a feature was planned or code exists.

## 1. How to Use This Checklist

- During planning, use this document to define acceptance criteria.
- During development, check only items tested in the current environment.
- Record the test date, build/commit, environment, tester, result, and any issue for release-critical checks.
- Use synthetic test data. Never put real patient or pharmacy data in test fixtures, screenshots, logs, or public issues.
- Test staging before production. Production checks must not mutate real business data unless the test is specifically approved and safely controlled.
- A failed security-critical check blocks release until fixed and retested.

## 2. Repository and Build Hygiene

- [ ] Existing changes are inspected before work begins.
- [ ] No unrelated files were overwritten or deleted.
- [ ] No secrets, credentials, private keys, or real customer data are committed.
- [ ] Environment configuration uses placeholders in tracked examples.
- [ ] Dependency changes are reviewed and intentional.
- [ ] Formatting, linting, type-checking, and build commands run successfully where configured.
- [ ] All test outcomes and known limitations are reported honestly.
- [ ] A reviewer has inspected the final diff.

## 3. Authentication and Session Handling

- [ ] A new user can complete the intended sign-up/onboarding flow.
- [ ] Valid users can sign in and sign out.
- [ ] Invalid credentials show a safe, understandable error.
- [ ] Password reset or account recovery works if included in scope.
- [ ] Expired sessions are handled without exposing protected data.
- [ ] Protected screens and data cannot be accessed without authentication.
- [ ] Logging out clears user-specific client state and sensitive cached data.
- [ ] Switching accounts does not show data from the previous account.
- [ ] Error messages do not reveal credentials, tokens, or sensitive account details.

## 4. Multi-Tenant Isolation — Release Blocking

Use at least two synthetic pharmacies (Tenant A and Tenant B), with users assigned to each. Include a user who has no membership and, if supported, a user with memberships in multiple pharmacies.

- [ ] Tenant A can read only records authorized for Tenant A.
- [ ] Tenant B can read only records authorized for Tenant B.
- [ ] Tenant A cannot read Tenant B's records by changing URL parameters, IDs, filters, or request payloads.
- [ ] Tenant A cannot insert a record into Tenant B by spoofing `pharmacy_id`.
- [ ] Tenant A cannot update another tenant's records.
- [ ] Tenant A cannot delete another tenant's records.
- [ ] Attempts to change a row's `pharmacy_id` across tenants are rejected.
- [ ] Unauthenticated requests cannot access protected tenant data.
- [ ] A user without an active membership cannot access that pharmacy's data.
- [ ] Revoked membership loses access on subsequent authorized requests.
- [ ] Role restrictions are enforced server/database side, not only by hiding UI controls.
- [ ] RLS is enabled and verified on every sensitive and tenant-owned table.
- [ ] Database grants do not accidentally provide access beyond intended RLS policies.
- [ ] Views, database functions/RPCs, storage objects, and any server endpoints preserve tenant boundaries.
- [ ] Error paths and batch queries do not leak records, identifiers, or sensitive metadata from other tenants.

**Release rule:** Any unexplained cross-tenant access is a release blocker.

## 5. Pharmacy Membership and Roles

- [ ] Pharmacy creation follows the approved onboarding flow.
- [ ] The first owner membership cannot be claimed or forged by an unrelated user.
- [ ] Users cannot promote themselves to owner/admin without authorization.
- [ ] Inviting or adding staff requires the intended permission.
- [ ] Role changes take effect as expected.
- [ ] Removing a member revokes access without deleting pharmacy-owned business records.
- [ ] Memberships across multiple pharmacies, if supported, use the selected pharmacy context safely.
- [ ] Users cannot switch context to a pharmacy where they have no active membership.

## 6. Medicine Master and Batch Inventory

- [ ] Medicine master records are separate from batch-level records.
- [ ] Required medicine fields are validated.
- [ ] Batch number, expiry date, purchase cost, MRP, and quantity are validated according to approved rules.
- [ ] Quantities cannot become negative through ordinary operations.
- [ ] Duplicate medicine/batch handling follows the approved rule.
- [ ] Low-stock thresholds work at the agreed level.
- [ ] Expiry warnings use the configured threshold and correct date logic.
- [ ] Expired batches are excluded from sellable stock.
- [ ] Quarantined batches cannot be dispensed.
- [ ] FEFO selects the earliest-expiring eligible batch when appropriate.
- [ ] Stock receipts and adjustments create auditable stock movements.
- [ ] Corrections do not silently erase the stock history.
- [ ] Batch totals, eligible stock, and displayed inventory totals agree.
- [ ] Date/time-zone boundaries do not cause incorrect expiry classification.

## 7. Sales and Stock Consistency

- [ ] A valid sale records the correct items, quantities, prices, and totals.
- [ ] Stock deduction and sale persistence succeed or fail together.
- [ ] Insufficient stock rejects the sale without partial unintended changes.
- [ ] Expired and quarantined batches cannot be selected for dispensing.
- [ ] Repeating the same request does not create a duplicate sale or deduct stock twice.
- [ ] Concurrent sale attempts cannot oversell the same stock.
- [ ] Batch selection and deductions are correct for sales spanning multiple batches.
- [ ] Monetary calculations use the approved precision and rounding rules.
- [ ] Sale history and stock movement history reconcile.
- [ ] Cancelled sales, refunds, and returns follow approved state transitions and audit rules when implemented.
- [ ] Failures during a transaction leave no partial sale or orphaned stock movement.
- [ ] The user receives a clear outcome when the network drops during a sale, without encouraging unsafe retries.

## 8. Patients and Refill Reminders

- [ ] Patient records contain only fields approved as necessary.
- [ ] Patient records are isolated by pharmacy and authorized roles.
- [ ] Patient search does not reveal unauthorized records.
- [ ] Validation prevents malformed or accidental contact details.
- [ ] Reminder dates and statuses follow the approved workflow.
- [ ] WhatsApp links are user-initiated and open the intended recipient/message.
- [ ] The user can review the prefilled message before sending.
- [ ] The app does not claim that a message was sent merely because a link opened.
- [ ] Patient information is not placed in public URLs, analytics events, or unsafe logs.
- [ ] Retention, correction, and deletion behaviors follow the approved policy and applicable requirements.

## 9. Analytics, Expenses, and Reorder Suggestions

- [ ] Sales totals reconcile with recorded sale data.
- [ ] Cost of goods sold follows the approved costing method.
- [ ] Expenses are included only once and in the correct period.
- [ ] Profit figures state the assumptions and exclusions that apply.
- [ ] Expired-stock waste is calculated consistently with stock movements and costing rules.
- [ ] Recorded facts are visually distinguished from forecasts and estimates.
- [ ] Stock-out and missed-refill estimates display assumptions and uncertainty.
- [ ] Reorder suggestions account for eligible stock and outstanding orders when supported.
- [ ] Suggested quantities follow approved rules and cannot create invalid orders.
- [ ] A supplier message or order is not initiated without explicit user action.
- [ ] Empty datasets and date-range boundaries produce sensible results.

## 10. Mobile UX and Accessibility

- [ ] Main workflows work on representative narrow Android viewport sizes.
- [ ] Inventory, Patients, Analytics, and Settings navigation is usable.
- [ ] Touch targets are comfortably operable.
- [ ] Forms remain usable when the on-screen keyboard is open.
- [ ] Bottom sheets and dialogs fit the viewport and can be dismissed appropriately.
- [ ] Safe-area insets do not hide important controls.
- [ ] Text remains readable and content does not overflow horizontally.
- [ ] Loading, empty, success, validation, and error states are present.
- [ ] Focus order, labels, contrast, and keyboard interaction are checked.
- [ ] Slow network and recoverable request failures are handled.
- [ ] Browser refresh and navigation do not expose another user's data.
- [ ] The app is tested on at least one real or representative Android device before release.

## 11. PWA, Offline, and Caching

- [ ] The PWA manifest and installation behavior work on supported browsers.
- [ ] Service-worker updates do not leave the app in an unusable mixed version.
- [ ] Offline behavior matches the documented product promise.
- [ ] No offline queue can replay a sale or stock mutation without approved idempotency and reconciliation.
- [ ] Authenticated API responses and sensitive tenant data are not placed in unsafe shared caches.
- [ ] Logout/account switching clears sensitive cached state.
- [ ] Reconnection and interrupted requests are handled safely.
- [ ] Unsupported browsers degrade gracefully.

## 12. Privacy and Operational Security

- [ ] No secrets are present in the frontend bundle or public repository.
- [ ] Public error messages avoid exposing internal stack traces or database details.
- [ ] Logs avoid unnecessary patient information, tokens, and credentials.
- [ ] Input validation and database constraints cover critical invariants.
- [ ] Rate limiting or abuse protection is considered for exposed endpoints where applicable.
- [ ] Dependencies and known security advisories are reviewed before release.
- [ ] Backup and restore procedures are documented and tested.
- [ ] Access to production systems is limited to authorized people.
- [ ] Applicable Indian privacy, pharmacy, drug-sale, and recordkeeping obligations have been reviewed with qualified local advice before commercial launch.

## 13. Deployment and Release

- [ ] Development, staging, and production are isolated as intended.
- [ ] Environment variables are configured without committing secrets.
- [ ] Database migrations are reviewed and tested against staging.
- [ ] Production migration and rollback/forward-fix procedures are documented.
- [ ] A release candidate is tested on staging.
- [ ] Critical tests pass against the release candidate.
- [ ] Known limitations and deferred features are documented.
- [ ] A responsible person approves the release.
- [ ] Post-deployment smoke tests are completed without exposing real customer data.
- [ ] Monitoring and an incident response contact/process are defined.

## 14. Evidence Record

For release-critical checks, record a short evidence entry:

| Field | Value |
|---|---|
| Build / commit | |
| Environment | Development / Staging / Production |
| Date and tester | |
| Checklist section / test case | |
| Result | Pass / Fail / Blocked / Not run |
| Evidence or issue reference | |
| Follow-up owner | |

## 15. Foundation-Phase Acceptance

Before starting the first application implementation task:

- [ ] `README.md`, `PRD.md`, `ARCHITECTURE.md`, `AI_RULES.md`, and this checklist have been reviewed.
- [ ] Initial architecture decisions and unresolved questions are identified.
- [ ] The first implementation task has explicit scope and acceptance criteria.
- [ ] No one treats this checklist as proof that tests have already been performed.
