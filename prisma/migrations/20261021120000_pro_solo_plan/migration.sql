-- Pro Solo (owner, 21 Oct 2026): Pro for a one-person company, one login.
-- A new value of the plan enum; nothing else changes. The code refuses to put
-- a studio with more than one person on it.
ALTER TYPE "StudioSoftwarePlan" ADD VALUE IF NOT EXISTS 'SOLO' BEFORE 'PRO';
