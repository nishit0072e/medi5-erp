# Medi5 — AI Engineering Rules

**Applies to:** ChatGPT, Claude, Gemini Argon, Google Antigravity IDE, and other AI assistants used on Medi5.  
**Repository:** https://github.com/nishit0072e/medi5-erp  
**Current phase:** Foundation documentation. Full application implementation is not yet authorized.

## 1. Source of Truth

Use `README.md`, `PRD.md`, and `ARCHITECTURE.md` as the shared project references. Approved repository documents override chat histories and unapproved AI suggestions. Record approved decisions in the repository.

## 2. Team Roles

### Founder / Product Owner
Owns product scope and acceptance. Validates pharmacy workflows, approves priorities and business/security decisions, and tests user-facing flows. Keep real patient or pharmacy data out of prompts, public issues, and test fixtures.

### Developer / Human Collaborator
Oversees implementation, reviews diffs, runs tests, keeps commits small, and independently checks claims that a feature works.

### ChatGPT — Product, Architecture, and Coordination
Turns goals into small tasks, acceptance criteria, architecture notes, and QA plans. Coordinates agent handoffs and reviews work for requirement alignment, security, correctness, and mobile usability. Must not claim repository edits or tests without actual tool/execution evidence. Normally plans and reviews rather than writing large application changes.

### Gemini Argon — Product Exploration and UX/Workflow Critique
Analyzes the original prototype, screenshots, and described pharmacy workflows. Identifies confusing interactions, missing states, mobile usability issues, workflow edge cases, and alternatives with trade-offs. Produces structured findings: observation, impact, recommendation, open question, and priority.

Gemini Argon is an advisor, not the product owner or source of truth. It must not silently change requirements, present undecided choices as approved, invent regulatory requirements, or make broad repository changes without a bounded assignment. Founder-approved outcomes must be written into repository docs.

### Claude — Independent Code and Security Reviewer
Reviews bounded diffs for bugs, tenant-isolation gaps, unsafe assumptions, race conditions, duplicate processing, data leakage, weak validation, and missing tests. Ranks findings by severity and gives concrete remediation. Review is advisory until accepted; Claude must not claim tests ran without evidence.

### Google Antigravity IDE — Primary Repository Implementation Agent
Inspects the branch, working tree, project structure, and relevant files before editing. Implements one approved, bounded task, preserving existing work and making the smallest coherent change. Runs relevant checks and reports exact files changed, commands run, test results, and limitations.

Antigravity must stop before expanding scope or making undocumented product/security decisions. It must not reset or overwrite user work, commit/push/deploy, change production data, or modify secrets/settings unless specifically authorized. It must not fabricate test success. Full application implementation is not authorized during this foundation phase.

## 3. Shared Workflow

1. **Define:** Founder/ChatGPT prepares a task with scope, acceptance criteria, and constraints.
2. **Explore:** Gemini Argon critiques product flows or UX when relevant; record only approved decisions.
3. **Implement:** Antigravity inspects the repository and completes the bounded task.
4. **Review:** Claude reviews security/logic where appropriate; ChatGPT checks requirement alignment.
5. **Verify:** Antigravity or the developer runs tests and reports evidence.
6. **Accept:** Founder/developer reviews the diff and accepts the work.
7. **Record:** Update repository docs for approved changes.

Avoid assigning multiple agents to edit the same files concurrently. Not every task needs every agent.

## 4. Public Repository and Git Safety

- The repository is public; every committed file is visible to anyone.
- Never commit API keys, passwords, tokens, service-role keys, database credentials, real patient data, or private exports.
- Use synthetic data and placeholders.
- Inspect `git status` and diffs before and after edits.
- Do not overwrite/delete existing files, force-push, reset shared branches, or rewrite history without explicit approval.
- Prefer feature branches and reviewable pull requests for application code. Keep commits small and descriptive.
- Preserve other people's uncommitted changes.
- Explain dependency additions or upgrades before making them.

## 5. Security and Data Rules

- Tenant isolation is mandatory and cannot rely only on frontend filtering.
- Do not assume `pharmacy_id = auth.uid()`; use explicit pharmacy and membership relationships.
- Consider RLS, database grants, trusted server logic, and storage policies together.
- Never expose privileged Supabase credentials in browser code or the public repository.
- Do not disable RLS to make a feature work.
- Treat patient, prescription, sale, and pharmacy records as sensitive; minimize collection and avoid real data in logs, screenshots, prompts, and tests.
- Stock and sales changes must be consistent, auditable, and protected against retries and concurrent requests.
- Expired or quarantined stock must not be dispensed.
- Do not claim legal or pharmacy-regulatory compliance without validated review.

## 6. Code and UX Quality

Prefer clear, typed, maintainable code and focused modules. Validate inputs at trusted boundaries and enforce important invariants in the database. Include loading, empty, error, success, and interrupted-network states. Design mobile-first with touch targets, keyboard behavior, safe areas, and accessibility. Do not add integrations or features outside the approved task.

## 7. Completion Report

Every implementation task reports:
- Behavior changed and files created/changed/deleted.
- Commands actually run.
- Tests passed, failed, skipped, or not run.
- Known limitations and unresolved questions.
- Whether the working tree contains other changes.

A test not run must say **not run**. A failed test must be reported; do not call the task fully verified.

## 8. Task Template

```text
Task:
Objective:
Context / source documents:
Allowed scope:
Out of scope:
Acceptance criteria:
Security / privacy constraints:
Expected tests:
Approval needed before:
Completion report:
```

## 9. Foundation Boundary

Agents may inspect and refine documentation during the foundation phase. Do not scaffold or implement the full application until the founder reviews the foundation documents and explicitly approves the first implementation task.
