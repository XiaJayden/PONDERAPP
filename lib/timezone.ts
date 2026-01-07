/**
 * Timezone helpers (Pacific time) for daily prompt timing.
 *
 * Why:
 * - The web MVP used a fixed `-08:00` offset, which breaks during DST.
 * - Here we compute true America/Los_Angeles behavior using Intl timeZone formatting.
 *
 * Design constraints:
 * - Keep this dependency-free (no moment/luxon/date-fns-tz).
 * - Be explicit + debug-friendly (project rule: add logs/comments).
 */

const PACIFIC_TZ = "America/Los_Angeles";

interface DateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseIsoDateOnly(isoDate: string) {
  // isoDate: YYYY-MM-DD
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`[timezone] Invalid ISO date: ${isoDate}`);
  const [, y, m, d] = match;
  return { year: Number(y), month: Number(m), day: Number(d) };
}

function getPartsInTimeZone(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type === "literal") continue;
    map[p.type] = p.value;
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function toMinutes(parts: DateParts) {
  // Used only for computing delta; day boundaries are handled by UTC ms adjustment.
  return (((parts.hour * 60 + parts.minute) * 60 + parts.second) * 1000);
}

/**
 * Convert a "Pacific local wall time" into a real UTC Date.
 *
 * Uses a small iterative correction:
 * - Start with a naive UTC guess
 * - See what Pacific time that guess corresponds to
 * - Shift by the delta to land on the desired wall time (DST-aware)
 */
export function pacificWallTimeToUtc(input: Omit<DateParts, "second"> & { second?: number }) {
  const desired: DateParts = {
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute,
    second: input.second ?? 0,
  };

  // Initial naive guess: treat desired wall time as if it were UTC.
  let utcMs = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, desired.second);

  // One correction pass is typically enough; we do two to be safe around DST boundaries.
  for (let i = 0; i < 2; i += 1) {
    const guess = new Date(utcMs);
    const actualLocal = getPartsInTimeZone(guess, PACIFIC_TZ);

    // Compute time-of-day delta in ms (the day delta is handled by the Date.UTC base).
    const desiredTod = toMinutes(desired);
    const actualTod = toMinutes(actualLocal);
    const deltaMs = desiredTod - actualTod;

    // Also correct for date mismatch (rare, but happens because time-of-day shift can cross midnight).
    const desiredDateKey = `${desired.year}-${pad2(desired.month)}-${pad2(desired.day)}`;
    const actualDateKey = `${actualLocal.year}-${pad2(actualLocal.month)}-${pad2(actualLocal.day)}`;

    if (desiredDateKey !== actualDateKey) {
      // If the date differs, shift by whole days too.
      const desiredUtcMidnight = Date.UTC(desired.year, desired.month - 1, desired.day, 0, 0, 0);
      const actualUtcMidnight = Date.UTC(actualLocal.year, actualLocal.month - 1, actualLocal.day, 0, 0, 0);
      const dayDelta = desiredUtcMidnight - actualUtcMidnight;
      utcMs += dayDelta;
    }

    utcMs += deltaMs;
  }

  return new Date(utcMs);
}

export function getPacificTimeForPromptDate(promptDate: string, hour: number, minute: number) {
  const { year, month, day } = parseIsoDateOnly(promptDate);
  return pacificWallTimeToUtc({ year, month, day, hour, minute, second: 0 });
}

export function getTodayPacificIsoDate(now: Date = new Date()) {
  const parts = getPartsInTimeZone(now, PACIFIC_TZ);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}




