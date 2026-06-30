// Builds the export file name: "<title>-<yyyymmddHHMMSS>.pdf".
// The title is sanitized so it's safe as a filename on every OS.

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function timestamp(date = new Date()): string {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function sanitizeTitle(title: string): string {
  const cleaned = title
    .trim()
    // Strip characters that are illegal in file names across macOS/Windows.
    .replace(/[/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Untitled";
}

export function buildExportFileName(title: string, date = new Date()): string {
  return `${sanitizeTitle(title)}-${timestamp(date)}.pdf`;
}
