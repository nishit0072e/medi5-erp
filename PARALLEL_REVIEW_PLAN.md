# Medi5 — Parallel Foundation Review Plan

**Status:** Ready for parallel review  
**Repository:** https://github.com/nishit0072e/medi5-erp  
**Phase:** Foundation review only; no application implementation yet

## Objective

Run four independent, non-overlapping reviews in parallel. The goal is to find gaps and contradictions in the foundation before coding. These are review assignments, not authorization to modify application code.

## Shared rules for every reviewer

- Read the current `README.md`, `PRD.md`, `ARCHITECTURE.md`, `AI_RULES.md`, and `QA_CHECKLIST.md` before making recommendations.
- Treat repository files as the source of truth. Do not assume unrecorded discussions are approved decisions.
- The repository is public: do not request or include secrets, credentials, real patient data, or real pharmacy records.
- Do not edit files, commit, push, deploy, scaffold the app, or change settings during this review.
- Distinguish documented facts, assumptions, recommendations, and questions.
- Do not claim to have inspected files or run tests unless you actually did.
- Work independently. Do not wait for another agent's report.
- Return findings in the requested format. The founder retains final decision authority.

## Assignment A — Gemini Argon: Product and UX Workflow Audit

**Mission:** Critique the product definition and mobile pharmacy workflows, especially the intended experience for independent pharmacies using Android smartphones.

**Prompt to give Gemini Argon:**

> You are the Product and UX Workflow Reviewer for Medi5, a mobile-first, multi-tenant pharmacy ERP SaaS initially targeting independent retail pharmacies in West Bengal, India.
>
> Review the repository foundation documents: README.md, PRD.md, ARCHITECTURE.md, AI_RULES.md, and QA_CHECKLIST.md. If the original prototype screenshots or design are available to you, inspect them; otherwise clearly say you could not access them and do not invent details.
>
> Focus only on product scope, pharmacy workflow, mobile usability, screen states, user journeys, and missing edge cases. Review Inventory, Patients/refill reminders, Sales, Analytics, Smart Reorder, and Settings. Consider everyday constraints such as small phone screens, intermittent networks, accidental taps, corrections, and busy pharmacy workflows.
>
> Do not implement or edit files. Do not make legal-compliance claims. Do not silently change requirements.
>
> Return:
> 1. Executive summary (maximum 10 bullets).
> 2. Findings ranked Critical / High / Medium / Low. For each: document/section, issue, user/business impact, recommendation, and whether founder approval is needed.
> 3. Missing user journeys and error/empty/loading states.
> 4. Five highest-value questions for the founder, avoiding questions already answered in the documents.
> 5. Proposed acceptance criteria for the first user-facing workflow.
> 6. Explicitly list assumptions and anything you could not inspect.
>
> Keep findings specific and actionable. Your output is a review report, not an implementation plan for the whole app.

## Assignment B — Claude: Independent Architecture and Security Audit

**Mission:** Challenge the proposed technical architecture and identify security, data-integrity, and operational risks before implementation.

**Prompt to give Claude:**

> You are the independent Architecture and Security Reviewer for Medi5, a mobile-first, multi-tenant pharmacy ERP SaaS. Review README.md, PRD.md, ARCHITECTURE.md, AI_RULES.md, and QA_CHECKLIST.md.
>
> Focus on Supabase Auth, PostgreSQL RLS, pharmacy membership and onboarding, tenant isolation, grants, database functions/RPCs, sensitive patient data, sale transactions, idempotency, concurrent stock deduction, batch expiry, auditability, PWA caching, secrets, migrations, backups, and testing. Challenge the design rather than merely summarizing it.
>
> This is a documentation-only review. Do not edit files or write application code. Do not claim a security guarantee without explaining the assumptions required for it. Do not claim legal compliance.
>
> Return:
> 1. Overall risk assessment and the five most important risks.
> 2. Findings ranked Critical / High / Medium / Low, each with the relevant document/section, attack/failure scenario, impact, recommended mitigation, and a concrete test.
> 3. Any architecture contradictions or unsafe ambiguity.
> 4. Minimum security gates that must pass before tenant data can be stored.
> 5. Unresolved design decisions that require founder approval.
> 6. Questions that require external validation or qualified local advice.
>
> Separate definite flaws from risks that depend on implementation details. Be rigorous, specific, and concise.

## Assignment C — Google Antigravity IDE: Read-Only Repository and Tooling Audit

**Mission:** Inspect the actual repository state and report implementation readiness without modifying anything.

**Prompt to give Antigravity:**

> You are the primary implementation engineer for Medi5, but this assignment is READ-ONLY. Inspect the current repository and working tree before doing anything else.
>
> Read README.md, PRD.md, ARCHITECTURE.md, AI_RULES.md, QA_CHECKLIST.md, and inspect the directory structure, branch, Git status, and recent history as available. Identify what exists versus what is only proposed. Do not assume the documentation means infrastructure or application code already exists.
>
> Do not create, edit, delete, format, install, commit, push, deploy, reset, or change settings. Do not expose secrets in your report; if you notice possible secrets, report only the file/path and safe next steps, not the secret value.
>
> Return:
> 1. Repository snapshot: branch, working-tree status, files/directories, and existing application/tooling.
> 2. Foundation document consistency issues.
> 3. Tooling or environment prerequisites not yet met, with evidence.
> 4. A recommended smallest first implementation task, but do not execute it.
> 5. Acceptance criteria and exact tests/commands that would apply to that task.
> 6. Risks, unknowns, and anything you could not inspect.
>
> Report only commands actually run and observed results. Keep the working tree unchanged.

## Assignment D — ChatGPT: Cross-Document Coordination and Decision Register

**Mission:** Coordinate the foundation review, check the documents for contradictions, and synthesize the other agents' findings after their reports arrive.

**Prompt for the ChatGPT coordination conversation:**

> You are the architecture and coordination partner for Medi5. Review README.md, PRD.md, ARCHITECTURE.md, AI_RULES.md, QA_CHECKLIST.md. Do not implement application code or change repository files unless I explicitly ask.
>
> First, independently identify contradictions, missing decisions, and unclear acceptance criteria across the documents. Then wait for me to provide the reports from Gemini Argon, Claude, and Antigravity. Compare their findings, group duplicates, identify disagreements, distinguish confirmed facts from assumptions, and recommend a small prioritized decision list for the founder.
>
> Do not automatically accept an agent's recommendation. For every material recommendation, state the reason, trade-off, impact if deferred, and whether founder approval is required. Keep a decision register with: ID, question, options, recommendation, rationale, decision owner, status, and affected documents.
>
> Do not start implementation until the founder approves the foundation and explicitly authorizes the first task.

## Parallel execution order

Launch assignments A, B, and C independently at roughly the same time. Assignment D can begin with a cross-document review now and then synthesize the other reports as they arrive.

These reviews intentionally do not edit the repository, avoiding conflicting parallel writes. Once reports are available, consolidate approved changes in one controlled documentation update.

## Report collection template

Ask each agent to end its report with:
- **Top three findings**
- **Founder decisions needed**
- **Evidence / document sections reviewed**
- **What was not inspected**
- **Confirmation that no files were changed**

## Exit criteria for this review phase

- [ ] Gemini Argon product/UX report received.
- [ ] Claude architecture/security report received.
- [ ] Antigravity read-only repository audit received.
- [ ] ChatGPT has reconciled findings and prepared a prioritized decision register.
- [ ] Founder has reviewed and approved the relevant decisions.
- [ ] Only then is the first bounded implementation task authorized.
