-- Leads at scale, AxLeads items (owner, 12 Oct 2026;
-- docs/studio-os/LEADS-SCALE-BUILT.md): a lost reason for the "Wrong
-- number" call outcome. Expand-only: one enum value. Not applied to any
-- database yet.
ALTER TYPE "LostReason" ADD VALUE IF NOT EXISTS 'WRONG_NUMBER';
