export type AvailableRelease = {
  version: string;
  notes: string;
  packageUrl: string;
  sha256: string;
  size: number;
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

  const expectedAssetName = `FuneralControl-runtime-${version}.zip`;
  const expectedAssetUrl = `https://github.com/pedras-sondere/FuneralControl/releases/download/v${version}/${expectedAssetName}`;
  const packageAsset = release.assets.find(
    (asset): asset is { name: string; browser_download_url: string; size: number } =>
      typeof asset === "object" &&
      asset !== null &&
      "name" in asset &&
      "browser_download_url" in asset &&
      "size" in asset &&
      typeof asset.name === "string" &&
      typeof asset.browser_download_url === "string" &&
      typeof asset.size === "number" &&
      Number.isSafeInteger(asset.size) &&
      asset.size > 0 &&
      asset.name === expectedAssetName &&
      asset.browser_download_url === expectedAssetUrl,
  );
  const hash = release.body.match(/SHA256:\s*([a-fA-F0-9]{64})/)?.[1]?.toLowerCase();
  if (!packageAsset || !hash) return null;

  return {
    version,
    notes: release.body,
    packageUrl: packageAsset.browser_download_url,
    sha256: hash,
    size: packageAsset.size,
  };
}
