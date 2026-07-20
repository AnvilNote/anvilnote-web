// Desktop-only update check: compares the running app version against the
// latest GitHub release tag for the desktop shell repo. Web (non-Electron)
// builds never call this — callers gate on window.anvilnote being present.

const OWNER_REPO = "AnvilNote/anvilnote-desktop";
const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${OWNER_REPO}/releases/latest`;
export const LATEST_RELEASE_PAGE_URL = `https://github.com/${OWNER_REPO}/releases/latest`;

function parseVersion(version: string): number[] {
  return version
    .replace(/^v/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

/** Returns > 0 if `a` is newer than `b`, < 0 if older, 0 if equal. */
export function compareVersions(a: string, b: string): number {
  const partsA = parseVersion(a);
  const partsB = parseVersion(b);
  const length = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < length; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function fetchLatestReleaseVersion(): Promise<string | null> {
  try {
    const res = await fetch(LATEST_RELEASE_API_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data: { tag_name?: string } = await res.json();
    return data.tag_name?.replace(/^v/, "") ?? null;
  } catch {
    return null;
  }
}

export type ReleaseAsset = { name: string; downloadUrl: string };
export type LatestRelease = { version: string; assets: ReleaseAsset[] };

/** Used by the landing page's download button to pick a platform-specific asset. */
export async function fetchLatestRelease(): Promise<LatestRelease | null> {
  try {
    const res = await fetch(LATEST_RELEASE_API_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data: { tag_name?: string; assets?: { name: string; browser_download_url: string }[] } =
      await res.json();
    if (!data.tag_name) return null;
    return {
      version: data.tag_name.replace(/^v/, ""),
      assets: (data.assets ?? []).map((asset) => ({
        name: asset.name,
        downloadUrl: asset.browser_download_url,
      })),
    };
  } catch {
    return null;
  }
}
