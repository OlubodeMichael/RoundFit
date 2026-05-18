export const ACCOUNT_DELETION_REASONS = [
  'not_using',
  'missing_features',
  'too_expensive',
  'privacy',
  'bugs',
  'other_app',
  'other',
] as const;

export type AccountDeletionReason = (typeof ACCOUNT_DELETION_REASONS)[number];

export const DELETION_REASON_LABELS: Record<AccountDeletionReason, string> = {
  not_using: 'Not using it enough',
  missing_features: 'Missing features I need',
  too_expensive: 'Too expensive',
  privacy: 'Privacy or data concerns',
  bugs: 'Bugs or reliability issues',
  other_app: 'Switching to another app',
  other: 'Other',
};

export interface DeleteAccountInput {
  reason: AccountDeletionReason;
  details?: string;
}
