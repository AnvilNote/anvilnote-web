import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Returns false during server render and the first client paint, then true.
 * Useful for guarding theme-dependent UI against hydration mismatches without
 * calling setState inside an effect.
 */
export function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
