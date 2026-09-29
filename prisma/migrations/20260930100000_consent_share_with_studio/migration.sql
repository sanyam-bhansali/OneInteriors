-- Consent to share a customer's name and number with the studios they pick
-- (plan §3.3). Enum value only; no RLS change.

ALTER TYPE "ConsentPurpose" ADD VALUE IF NOT EXISTS 'SHARE_WITH_STUDIO';
