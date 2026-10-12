import { isNewerVersion, parseAvailableRelease, type AvailableRelease } from "./update-rules";

const RELEASE_URL = "https://api.github.com/repos/pedras-sondere/FuneralControl/releases/latest";

export async function getAvailableRelease(localVersion: string): Promise<AvailableRelease | null> {
  try {
    const response = await fetch(RELEASE_URL, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return null;

    const release = parseAvailableRelease(await response.json());
    return release && isNewerVersion(localVersion, release.version) ? release : null;
  } catch {
    return null;
  }
}
