/** Pacific-calendar helpers. Puzzle day rolls at midnight America/Los_Angeles. */

export const TIMEZONE = "America/Los_Angeles";
export const EPOCH = "2026-01-01";

export function pacificDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Calendar-day difference between two YYYY-MM-DD strings (not DST-sensitive). */
export function daysBetween(fromYmd, toYmd) {
  const utc = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(toYmd) - utc(fromYmd)) / 86400000);
}

export function dayIndex(date, chainLength, epoch = EPOCH) {
  const today = typeof date === "string" ? date : pacificDateString(date);
  const days = daysBetween(epoch, today);
  const n = chainLength;
  return ((days % n) + n) % n;
}

export function puzzleNumber(date, epoch = EPOCH) {
  const today = typeof date === "string" ? date : pacificDateString(date);
  return daysBetween(epoch, today) + 1;
}

export function yesterdayDateString(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
