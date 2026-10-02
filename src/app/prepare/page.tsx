import { redirect } from 'next/navigation';

/**
 * The prep pack now lives in "Your home" (build queue item 21): the room
 * boards moved to /account, and the floor-plan upload it repeated is the
 * brief's own. Old links land in the right place.
 */
export default function PreparePage() {
  redirect('/account#rooms');
}
