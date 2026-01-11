/**
 * Posting/Viewing day phase calculation.
 *
 * Phases alternate every 24 hours at 6AM Pacific:
 * - Posting days: Jan 12, 14, 16, 18... (even days from anchor)
 * - Viewing days: Jan 13, 15, 17, 19... (odd days from anchor)
 *
 * Anchor: January 12, 2026 at 6:00 AM Pacific (first posting day)
 */

import { pacificWallTimeToUtc, getPartsInTimeZone } from "./timezone";

export type Phase = "posting" | "viewing";

const PACIFIC_TZ = "America/Los_Angeles";
const PHASE_ANCHOR_DATE = "2026-01-12"; // First posting day
const PHASE_FLIP_HOUR = 6; // 6AM Pacific

export interface PhaseInfo {
  phase: Phase;
  timeRemaining: number; // ms until next phase flip
  phaseStartedAt: Date; // When current phase started (last 6AM PT)
  phaseEndsAt: Date; // When current phase ends (next 6AM PT)
}

/**
 * Get the current phase (posting or viewing) based on the anchor date.
 * Even days from anchor = posting, odd days = viewing.
 */
export function getCurrentPhase(now: Date = new Date()): Phase {
  const anchor = pacificWallTimeToUtc({ year: 2026, month: 1, day: 12, hour: 6, minute: 0 });
  const nowPacific = getPartsInTimeZone(now, PACIFIC_TZ);

  // Find the most recent 6AM PT boundary
  const today6am = pacificWallTimeToUtc({
    year: nowPacific.year,
    month: nowPacific.month,
    day: nowPacific.day,
    hour: PHASE_FLIP_HOUR,
    minute: 0,
  });

  // If it's before 6AM today, use yesterday's 6AM
  const lastFlip = now.getTime() < today6am.getTime() 
    ? pacificWallTimeToUtc({
        year: nowPacific.year,
        month: nowPacific.month,
        day: nowPacific.day - 1,
        hour: PHASE_FLIP_HOUR,
        minute: 0,
      })
    : today6am;

  // Count days since anchor (at 6AM boundaries)
  const daysSinceAnchor = Math.floor((lastFlip.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000));
  
  // Even days = posting, odd days = viewing
  return daysSinceAnchor % 2 === 0 ? "posting" : "viewing";
}

/**
 * Get milliseconds until the next phase flip (next 6AM Pacific).
 */
export function getTimeUntilNextPhase(now: Date = new Date()): number {
  const nowPacific = getPartsInTimeZone(now, PACIFIC_TZ);
  
  // Calculate next 6AM PT
  let next6am = pacificWallTimeToUtc({
    year: nowPacific.year,
    month: nowPacific.month,
    day: nowPacific.day,
    hour: PHASE_FLIP_HOUR,
    minute: 0,
  });

  // If we've already passed 6AM today, next flip is tomorrow
  if (now.getTime() >= next6am.getTime()) {
    next6am = pacificWallTimeToUtc({
      year: nowPacific.year,
      month: nowPacific.month,
      day: nowPacific.day + 1,
      hour: PHASE_FLIP_HOUR,
      minute: 0,
    });
  }

  const msUntil = next6am.getTime() - now.getTime();
  return Math.max(0, msUntil);
}

/**
 * Get complete phase information including countdown and boundaries.
 */
export function getPhaseInfo(now: Date = new Date()): PhaseInfo {
  const phase = getCurrentPhase(now);
  const timeRemaining = getTimeUntilNextPhase(now);
  
  const nowPacific = getPartsInTimeZone(now, PACIFIC_TZ);
  
  // Find when current phase started (last 6AM PT)
  let phaseStartedAt = pacificWallTimeToUtc({
    year: nowPacific.year,
    month: nowPacific.month,
    day: nowPacific.day,
    hour: PHASE_FLIP_HOUR,
    minute: 0,
  });

  if (now.getTime() < phaseStartedAt.getTime()) {
    phaseStartedAt = pacificWallTimeToUtc({
      year: nowPacific.year,
      month: nowPacific.month,
      day: nowPacific.day - 1,
      hour: PHASE_FLIP_HOUR,
      minute: 0,
    });
  }

  // Phase ends at next 6AM PT
  const phaseEndsAt = new Date(phaseStartedAt.getTime() + 24 * 60 * 60 * 1000);

  return {
    phase,
    timeRemaining,
    phaseStartedAt,
    phaseEndsAt,
  };
}
