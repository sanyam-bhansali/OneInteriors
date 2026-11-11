'use client';

import { useEffect, useState } from 'react';
import { societyNamesAction } from './name-actions';

export const SOCIETY_LIST_ID = 'oi-society-names';

/**
 * Suggestions for a lead's Society box (owner, 11 Nov 2026): the studio's
 * societies, so a lead is typed with the name the Societies tab links by.
 * Off the Max plan the list is empty and the box works as before.
 */
export function SocietyNames() {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    societyNamesAction()
      .then((n) => live && setNames(n))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return (
    <datalist id={SOCIETY_LIST_ID}>
      {names.map((n) => (
        <option key={n} value={n} />
      ))}
    </datalist>
  );
}
