import { useProfile } from './profile';
import { useProject } from './project';

/**
 * Which plan the signed-in customer is on (owner decision, 11 Oct 2026;
 * docs/APP-API-JOURNEY.md). `null` before they sign with a studio: GEIO and
 * the expert call stay open then, because they help choose a studio.
 * After signing, Basic has no GEIO and no expert calls, and nothing on screen
 * may promise that One Interiors checks or chases the studio: that is
 * Assured's job.
 */
export interface Plan {
  plan: 'basic' | 'assured' | null;
  assured: boolean;
  /** Asked for Assured; our team is confirming the fee. */
  requested: boolean;
  expertCalls: { used: number; total: number } | null;
}

export function usePlan(): Plan {
  const { profile } = useProfile();
  const { state } = useProject();
  const fromProject = state.status === 'ready' ? (state.project.plan ?? 'basic') : null;
  const plan = profile.plan?.plan ?? fromProject;
  return {
    plan,
    assured: plan === 'assured',
    requested: profile.plan?.assuredRequested ?? false,
    expertCalls: profile.plan?.expertCalls ?? null,
  };
}
