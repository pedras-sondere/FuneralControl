import path from "node:path";

export function getInstalledApplicationRoot(environment: Record<string, string | undefined>) {
  const installRoot = environment["FUNERALCONTROL_INSTALL_ROOT"]?.trim();
  return installRoot || null;
}

export function getInstalledDataRoot(environment: Record<string, string | undefined>) {
  const dataRoot = environment["FUNERALCONTROL_DATA_ROOT"]?.trim();
  return dataRoot || null;
}

export function buildUpdateCommand({
  installRoot,
  dataRoot,
  version,
  size,
  packageUrl,
  sha256,
}: {
  installRoot: string;
  dataRoot: string;
  version: string;
  size: number;
  packageUrl: string;
  sha256: string;
}) {
  return [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(installRoot, "bootstrap", "Update-FuneralControlV2.ps1"),
    "-PackageUrl",
    packageUrl,
    "-Sha256",
    sha256,
    "-ExpectedVersion",
    version,
    "-ExpectedSize",
    String(size),
    "-InstallRoot",
    installRoot,
    "-DataRoot",
    dataRoot,
    "-BackupValidated",
  ];
}

function quotePowerShell(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildElevatedUpdateCommand(options: Parameters<typeof buildUpdateCommand>[0]) {
  const childArguments = buildUpdateCommand(options);
  const scriptPath = childArguments[4];
  const invocation = `& ${quotePowerShell(scriptPath)} ${childArguments
    .slice(5)
    .map(quotePowerShell)
    .join(" ")}`;
  const encodedCommand = Buffer.from(invocation, "utf16le").toString("base64");
  const elevate =
    `Start-Process -FilePath 'powershell.exe' ` +
    `-ArgumentList '-NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCommand}' ` +
    `-Verb RunAs -WindowStyle Hidden -Wait`;
  return ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", elevate];
}
