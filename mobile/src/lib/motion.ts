import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * The phone's "reduce motion" setting (DESIGN-SPEC.md, Motion): when it is
 * on, every animation in the app lands at once. Read once and kept current,
 * so a hundred animated parts share one listener.
 */
let reduced = false;
const listeners = new Set<(on: boolean) => void>();

void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
  reduced = on;
  listeners.forEach((l) => l(on));
});
AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
  reduced = on;
  listeners.forEach((l) => l(on));
});

/** The setting now, for code outside React. */
export function reduceMotion(): boolean {
  return reduced;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, reduceMotion, reduceMotion);
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}
