export type AvailableRelease = {
  version: string;
  notes: string;
  packageUrl: string;
  sha256: string;
};

type GitHubRelease = {
  tag_name?: unknown;
  prerelease?: unknown;
  body?: unknown;
  assets?: unknown;
};

function versionParts(version: string) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) return null;
  return version.split(".").map(Number);
}

export function isNewerVersion(local: string, remote: string) {
  const localParts = versionParts(local);
  const remoteParts = versionParts(remote);
  if (!localParts || !remoteParts) return false;

  return remoteParts.some((part, index) =>
    localParts.slice(0, index).every((localPart, parent) => localPart === remoteParts[parent])
      ? part > localParts[index]
      : false,
  );
}

export function parseAvailableRelease(release: GitHubRelease): AvailableRelease | null {
  if (release.prerelease || typeof release.tag_name !== "string") return null;
  const version = release.tag_name.replace(/^v/, "");
  if (!versionParts(version) || typeof release.body !== "string" || !Array.isArray(release.assets))
    return null;

  const packageAsset = release.assets.find(
    (asset): asset is { name: string; browser_download_url: string } =>
      typeof asset === "object" &&
      asset !== null &&
      "name" in asset &&
      "browser_download_url" in asset &&
      typeof asset.name === "string" &&
      typeof asset.browser_download_url === "string" &&
      asset.name === "FuneralControl-update.zip" &&
      asset.browser_download_url.startsWith("https://github.com/pedras-sondere/FuneralControl/"),
  );
  const hash = release.body.match(/SHA256:\s*([a-fA-F0-9]{64})/)?.[1]?.toLowerCase();
  if (!packageAsset || !hash) return null;

  return {
    version,
    notes: release.body,
    packageUrl: packageAsset.browser_download_url,
    sha256: hash,
  };
}
