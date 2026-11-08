// Date/time helpers used by both the website and the Excel/CSV export.
// Change this if your students are in a different time zone.
export const TIMEZONE = "Asia/Kolkata";

export function formatDateTime(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

// 754 -> "12m 34s"
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
