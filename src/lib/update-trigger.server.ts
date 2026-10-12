import path from "node:path";

export function getInstalledApplicationRoot(environment: Record<string, string | undefined>) {
  const installRoot = environment["FUNERALCONTROL_INSTALL_ROOT"]?.trim();
  return installRoot || null;
}

export function buildUpdateCommand({
  installRoot,
  packageUrl,
  sha256,
}: {
  installRoot: string;
  packageUrl: string;
  sha256: string;
}) {
  return [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(installRoot, "scripts", "Update-FuneralControl.ps1"),
    "-PackageUrl",
    packageUrl,
    "-Sha256",
    sha256,
    "-InstallRoot",
    installRoot,
    "-BackupValidated",
  ];
}
