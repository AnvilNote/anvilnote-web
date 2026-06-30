"use client";

// Persistent export target using the File System Access API. The user picks a
// folder once; we keep its FileSystemDirectoryHandle in IndexedDB (handles are
// structured-cloneable, so they survive reloads — localStorage can't store
// them). On export we create an "AnvilNote" subfolder inside the chosen folder
// and write the PDF there.
//
// Availability: Chromium only. Chrome blocks Downloads/Desktop/Documents from
// the picker, so the user must choose another folder. Callers fall back to a
// plain download when no usable target exists.

const DB_NAME = "anvilnote";
const STORE = "handles";
const KEY = "exportDir";
const SUBFOLDER = "AnvilNote";

export function supportsFileSystemAccess(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
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

/** Prompt for a folder, store its handle, and return its display name. */
export async function pickExportDir(): Promise<string> {
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
  try {
    return (await idbGet())?.name ?? null;
  } catch {
    return null;
  }
}

export async function clearExportDir(): Promise<void> {
  try {
    await idbClear();
  } catch {
    // ignore
  }
}

export type WriteResult = { ok: true; path: string } | { ok: false };

/**
 * Write the PDF into "<chosen folder>/AnvilNote/<fileName>".
 * `interactive` must be true when called from a user gesture (re-grants
 * permission across sessions). Returns ok:false when no usable target exists so
 * the caller can fall back to a download.
 */
export async function writePdfToTarget(
  blob: Blob,
  fileName: string,
  interactive: boolean,
): Promise<WriteResult> {
  let dir: FileSystemDirectoryHandle | null;
  try {
    dir = await idbGet();
  } catch {
    return { ok: false };
  }
  if (!dir) return { ok: false };
  if (!(await ensurePermission(dir, interactive))) return { ok: false };

  const subDir = await dir.getDirectoryHandle(SUBFOLDER, { create: true });
  const fileHandle = await subDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  return { ok: true, path: `${dir.name}/${SUBFOLDER}/${fileName}` };
}
