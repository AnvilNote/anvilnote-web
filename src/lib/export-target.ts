"use client";

// Persistent export target. Two backends:
//
// - Desktop (window.anvilnote.pickExportDir present): a native folder dialog
//   via IPC to the Electron main process (see anvilnote-desktop/src/main/
//   export-dialog.ts). No blocklist — any folder, including Downloads/
//   Desktop/Documents, works.
// - Browser: the File System Access API. The user picks a folder once; we
//   keep its FileSystemDirectoryHandle in IndexedDB (handles are
//   structured-cloneable, so they survive reloads — localStorage can't store
//   them). Chromium hard-blocks Downloads/Desktop/Documents/the home dir from
//   this picker, so in-browser users must choose another folder — there's no
//   workaround from here; only the desktop shell bypasses it.
//
// Either way we create an "AnvilNote" subfolder inside the chosen folder and
// write into it. Callers fall back to a plain download when no usable target
// exists.

const DB_NAME = "anvilnote";
const STORE = "handles";
const KEY = "exportDir";
const SUBFOLDER = "AnvilNote";
const DESKTOP_DIR_KEY = "anvilnote:exportDirPath";

type DesktopBridge = Required<
  Pick<NonNullable<Window["anvilnote"]>, "pickExportDir" | "writeExportFile">
>;

function desktopBridge(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  const b = window.anvilnote;
  if (!b?.pickExportDir || !b.writeExportFile) return null;
  return b as DesktopBridge;
}

function baseName(p: string): string {
  return p.split(/[/\\]+/).filter(Boolean).pop() ?? p;
}

export function supportsFileSystemAccess(): boolean {
  if (typeof window === "undefined") return false;
  if (desktopBridge()) return true;
  return "showDirectoryPicker" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbPut(value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  const value = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return (value as FileSystemDirectoryHandle) ?? null;
}

async function idbClear(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

type PermName = "granted" | "denied" | "prompt";
type PermissiveHandle = FileSystemDirectoryHandle & {
  queryPermission?: (d: { mode: "readwrite" }) => Promise<PermName>;
  requestPermission?: (d: { mode: "readwrite" }) => Promise<PermName>;
};

async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  interactive: boolean,
): Promise<boolean> {
  const h = handle as PermissiveHandle;
  if (!h.queryPermission) return true; // older impls: assume usable
  if ((await h.queryPermission({ mode: "readwrite" })) === "granted") return true;
  if (!interactive || !h.requestPermission) return false;
  return (await h.requestPermission({ mode: "readwrite" })) === "granted";
}

/** Prompt for a folder, store it, and return its display name. */
export async function pickExportDir(): Promise<string> {
  const desktop = desktopBridge();
  if (desktop) {
    const dirPath = await desktop.pickExportDir();
    if (!dirPath) throw new DOMException("Folder picker was cancelled", "AbortError");
    localStorage.setItem(DESKTOP_DIR_KEY, dirPath);
    return baseName(dirPath);
  }

  const picker = (
    window as Window & {
      showDirectoryPicker?: (o?: {
        mode?: "readwrite";
      }) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker;
  if (!picker) throw new Error("unsupported");
  const handle = await picker({ mode: "readwrite" });
  await idbPut(handle);
  return handle.name;
}

/** The stored folder's display name, or null if none is set. */
export async function getExportDirName(): Promise<string | null> {
  if (desktopBridge()) {
    const dirPath = localStorage.getItem(DESKTOP_DIR_KEY);
    return dirPath ? baseName(dirPath) : null;
  }
  try {
    return (await idbGet())?.name ?? null;
  } catch {
    return null;
  }
}

export async function clearExportDir(): Promise<void> {
  if (desktopBridge()) {
    localStorage.removeItem(DESKTOP_DIR_KEY);
    return;
  }
  try {
    await idbClear();
  } catch {
    // ignore
  }
}

export type WriteResult = { ok: true; path: string } | { ok: false };

/**
 * Write a file (PDF, Markdown, zip backup, …) into
 * "<chosen folder>/AnvilNote/[<subfolder>/]<fileName>". `subfolder` nests the
 * file one level deeper — callers use it for the document's project name (or
 * "unfiled") so exports land pre-organized instead of all dumped flat.
 * `interactive` must be true when called from a user gesture (re-grants
 * permission across sessions). Returns ok:false when no usable target exists
 * so the caller can fall back to a download.
 */
export async function writeFileToTarget(
  blob: Blob,
  fileName: string,
  interactive: boolean,
  subfolder?: string,
): Promise<WriteResult> {
  const desktop = desktopBridge();
  if (desktop) {
    const dirPath = localStorage.getItem(DESKTOP_DIR_KEY);
    if (!dirPath) return { ok: false };
    const segments = [SUBFOLDER, ...(subfolder ? [subfolder] : []), fileName];
    try {
      const data = new Uint8Array(await blob.arrayBuffer());
      const written = await desktop.writeExportFile(dirPath, segments, data);
      return { ok: true, path: written };
    } catch {
      return { ok: false };
    }
  }

  let dir: FileSystemDirectoryHandle | null;
  try {
    dir = await idbGet();
  } catch {
    return { ok: false };
  }
  if (!dir) return { ok: false };
  if (!(await ensurePermission(dir, interactive))) return { ok: false };

  let targetDir = await dir.getDirectoryHandle(SUBFOLDER, { create: true });
  const pathParts = [dir.name, SUBFOLDER];
  if (subfolder) {
    targetDir = await targetDir.getDirectoryHandle(subfolder, { create: true });
    pathParts.push(subfolder);
  }
  const fileHandle = await targetDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  pathParts.push(fileName);
  return { ok: true, path: pathParts.join("/") };
}

export type DeliverResult =
  | { kind: "folder"; fileName: string; path: string }
  | { kind: "download"; fileName: string };

/**
 * Deliver any exported file: write it into the user's chosen export folder
 * via `writeFileToTarget` when one is set, otherwise fall back to a normal
 * browser download. Shared by PDF export and the Markdown/zip backup export.
 * `subfolder` (e.g. the document's project name) nests it one level deeper;
 * ignored for the plain-download fallback since browsers can't create
 * folders from a click-to-download anchor.
 */
export async function deliverFile(
  blob: Blob,
  fileName: string,
  subfolder?: string,
): Promise<DeliverResult> {
  // Called from a click handler, so permission prompts are allowed.
  const written = await writeFileToTarget(blob, fileName, true, subfolder);
  if (written.ok) {
    return { kind: "folder", fileName, path: written.path };
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return { kind: "download", fileName };
}
