/**
 * Phase 0 Security TDD Test Specification for Firestore Rules
 * Verifies all "Dirty Dozen" adversarial payloads return PERMISSION_DENIED.
 *
 * Run against Firebase Firestore Emulator with @firebase/rules-unit-testing:
 *   firebase emulators:exec --only firestore "npx tsx firestore.rules.test.ts"
 */

export interface AdversarialPayloadCase {
  id: string;
  name: string;
  operation: 'create' | 'get' | 'list' | 'update' | 'delete';
  path: string;
  auth: {
    uid: string;
    email?: string;
    email_verified?: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

const VALID_BASE_REPORT = {
  char: '舞',
  issueType: 'stroke_color',
  currentCode: 'nqfs',
  suggestedCode: 'nqfs',
  currentRoots: '𠂉 卌 一 ',
  suggestedRoots: '𠂉 卌 一 ',
  suggestedStrokeIndices: '0,0,1,1,1,1,1,2,-1,-1,-1,3,3,3',
  description: '舞字下方的夕未標記略墨且顏色分組不足四根。',
  status: 'open',
  reporterUid: 'user_a',
  reporterName: '道友甲',
  source: 'home',
  createdAt: '__SERVER_TIMESTAMP__',
  updatedAt: '__SERVER_TIMESTAMP__',
};

export const DIRTY_DOZEN_CASES: AdversarialPayloadCase[] = [
  {
    id: 'D01',
    name: 'Unauthenticated Create',
    operation: 'create',
    path: 'correctionReports/rep_001',
    auth: null,
    payload: { ...VALID_BASE_REPORT },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'D02',
    name: 'Unverified Email Admin Spoof',
    operation: 'list',
    path: 'correctionReports',
    auth: { uid: 'spoof_uid', email: 'harryli@gmail.com', email_verified: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'D03',
    name: 'Shadow Field Injection on Create',
    operation: 'create',
    path: 'correctionReports/rep_003',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { ...VALID_BASE_REPORT, isVerified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'D04',
    name: 'Identity Spoofing on Create',
    operation: 'create',
    path: 'correctionReports/rep_004',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { ...VALID_BASE_REPORT, reporterUid: 'user_b' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'D05',
    name: 'State Shortcutting on Create',
    operation: 'create',
    path: 'correctionReports/rep_005',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { ...VALID_BASE_REPORT, status: 'resolved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'D06',
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: 'correctionReports/rep_006',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { ...VALID_BASE_REPORT, createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'D07',
    name: 'Path Variable ID Poisoning',
    operation: 'create',
    path: `correctionReports/${'x'.repeat(140)}`,
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { ...VALID_BASE_REPORT },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'D08',
    name: 'Oversized String Resource Exhaustion (DoW)',
    operation: 'create',
    path: 'correctionReports/rep_008',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { ...VALID_BASE_REPORT, description: '錯'.repeat(1200) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'D09',
    name: 'Cross-User Read / Blanket List Scraping',
    operation: 'get',
    path: 'correctionReports/rep_owned_by_user_b',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'D10',
    name: 'Privilege Escalation via Status Update',
    operation: 'update',
    path: 'correctionReports/rep_owned_by_user_a_open',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { status: 'resolved', updatedAt: '__SERVER_TIMESTAMP__' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'D11',
    name: 'Terminal State Tampering After Resolved',
    operation: 'update',
    path: 'correctionReports/rep_owned_by_user_a_resolved',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { description: '篡改已結案紀錄', updatedAt: '__SERVER_TIMESTAMP__' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'D12',
    name: 'Value Poisoning & Immortal Field Mutation',
    operation: 'update',
    path: 'correctionReports/rep_owned_by_user_a_open',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { description: true, createdAt: '__SERVER_TIMESTAMP__', updatedAt: '__SERVER_TIMESTAMP__' },
    expected: 'PERMISSION_DENIED',
  },
];
