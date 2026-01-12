import { useEffect, useMemo, useState } from "react";
import { getPhaseInfo, type Phase } from "@/lib/phase";

export interface UsePhaseResult {
  phase: Phase;
  timeRemaining: number; // ms until next phase flip
  phaseStartedAt: Date;
  phaseEndsAt: Date;
  isOverridden: boolean; // true if dev override is active
}

/**
 * Hook to get current posting/viewing phase with live countdown.
 * 
 * Accepts an optional phaseOverride for dev testing (from DevToolsProvider).
 * When override is set, it takes precedence over calculated phase.
 */
export function usePhase(phaseOverride: Phase | null = null): UsePhaseResult {
  // Lightweight "now tick" so countdown updates every second.
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const calculated = useMemo(() => getPhaseInfo(new Date(nowTick)), [nowTick]);

  const result = useMemo<UsePhaseResult>(() => {
    if (phaseOverride) {
      // Dev override: use override but keep calculated timeRemaining
      return {
        phase: phaseOverride,
        timeRemaining: calculated.timeRemaining,
        phaseStartedAt: calculated.phaseStartedAt,
        phaseEndsAt: calculated.phaseEndsAt,
        isOverridden: true,
      };
    }

    return {
      ...calculated,
      isOverridden: false,
    };
  }, [calculated, phaseOverride]);

  return result;
}
