import { gated } from '../PilotGate';

/** Full software only (studio/pilot.ts): closed for a studio that is not a pilot. */
export default gated('design');
