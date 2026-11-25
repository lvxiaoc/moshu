# Security Specification — 墨鍵道場 數據糾錯報告 (Firestore)

## 1. Data Invariants
1. **Default-Deny Baseline**: Every path outside `/correctionReports/{reportId}` is denied for both read and write.
2. **Verified Identity**: All reads and writes require a signed-in Firebase Auth user with `request.auth.token.email_verified == true`.
3. **Zero PII Storage**: `CorrectionReport` documents strictly omit `email`, `phone`, and `address`; only `reporterUid` and `reporterName` (max 80 chars) are stored.
4. **Ownership & Least Privilege**:
   - Non-admin users can only `get` or `list` their own reports (`resource.data.reporterUid == request.auth.uid`).
   - Only the bootstrapped verified admin (`harryli@gmail.com` with `email_verified == true`) can `get`, `list`, update `status`, or `delete` reports from any user.
5. **Creation Invariants**:
   - Document ID `{reportId}` matches `^[a-zA-Z0-9_\-]+$` and length `<= 128`.
   - `reporterUid == request.auth.uid` (no identity spoofing).
   - `status == 'open'` (no self-resolving on creation).
   - `createdAt == request.time` and `updatedAt == request.time` (strict server timestamp enforcement).
   - Exact key allowlist (`hasAll` + `hasOnly` of the 14 blueprint fields — zero shadow fields).
   - Every string field has strict `.size()` bounds and enum/regex checks.
6. **Action-Based Updates & Terminal State Locking**:
   - Every `update` invokes `isValidCorrectionReport(incoming())` first.
   - `reporterUid` and `createdAt` are immortal/immutable across all updates.
   - `updatedAt == request.time` on every update.
   - **Action 1 (Reporter Edit)**: Reporter can only modify `['issueType', 'suggestedCode', 'suggestedRoots', 'suggestedStrokeIndices', 'description', 'updatedAt']` while `existing().status == 'open'`, and `status` must remain `'open'`. Once `reviewed` or `resolved`, reporters cannot edit or delete.
   - **Action 2 (Admin Review)**: Verified admin can modify `['status', 'updatedAt']` (including overriding terminal `'resolved'` states if needed).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **D01 — Unauthenticated Create**: `auth = null` creating a valid report → `PERMISSION_DENIED`.
2. **D02 — Unverified Email Admin Spoof**: `auth = { uid: 'evil', token: { email: 'harryli@gmail.com', email_verified: false } }` attempting `list` or `update` → `PERMISSION_DENIED`.
3. **D03 — Shadow Field Injection on Create**: Valid report + extra `"isAdmin": true` or `"isVerified": true` field → `PERMISSION_DENIED`.
4. **D04 — Identity Spoofing on Create**: `auth.uid = 'user_a'` creating a report with `reporterUid: 'user_b'` → `PERMISSION_DENIED`.
5. **D05 — State Shortcutting on Create**: Regular user creating a report with `status: 'resolved'` instead of `'open'` → `PERMISSION_DENIED`.
6. **D06 — Client Timestamp Forgery**: Creating a report with a backdated timestamp instead of `request.time` → `PERMISSION_DENIED`.
7. **D07 — Path Variable ID Poisoning**: Creating a doc at `/correctionReports/bad id with spaces and $$$` or >128 chars → `PERMISSION_DENIED`.
8. **D08 — Oversized String Resource Exhaustion (DoW)**: `description` with 2,000 characters (> 500 max) → `PERMISSION_DENIED`.
9. **D09 — Cross-User Read / Blanket List Scraping**: `user_a` attempting `get` on `user_b`'s report or unfiltered `list` on `/correctionReports` → `PERMISSION_DENIED`.
10. **D10 — Privilege Escalation via Update**: `user_a` updating `status` from `'open'` to `'resolved'` on their own report → `PERMISSION_DENIED`.
11. **D11 — Terminal State Tampering**: `user_a` editing `description` on their own report after admin marked it `'resolved'` → `PERMISSION_DENIED`.
12. **D12 — Value Poisoning / Immortal Field Mutation**: Updating whitelisted `description` to a Boolean `true`, or mutating `createdAt` / `reporterUid` → `PERMISSION_DENIED`.
