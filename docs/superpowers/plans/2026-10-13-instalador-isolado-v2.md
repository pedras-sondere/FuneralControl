# Instalador Windows isolado v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Entregar um instalador Windows v2 que execute o FuneralControl com runtimes privados de Node.js e PostgreSQL, sem alterar componentes globais do computador.

**Architecture:** O release cria um ZIP de runtime com aplicação construída e dependências de produção. Um bootstrap Inno Setup baixa apenas artefatos hasheados, instala-os em caminhos privados, inicializa um cluster PostgreSQL em porta própria e grava estado não secreto retomável. O launcher usa somente esses caminhos conhecidos, inicia e encerra seus próprios processos, e o atualizador troca somente versões de app após verificar manifesto assinado e saúde local.

**Tech Stack:** Windows 10/11 x64, PowerShell 5.1+, Inno Setup, Node.js portátil, PostgreSQL portátil, Node crypto/Ed25519, React 19, TanStack Start, PostgreSQL, Vitest.

**Spec:** docs/superpowers/specs/2026-10-13-instalador-isolado-v2-design.md

## Global Constraints

- O produto é local, opera em localhost e atende uma única conta Windows autorizada.
- A instalação inicial exige internet e elevação administrativa; a execução diária não depende de serviço PostgreSQL global, Docker, winget, PATH, Node.js ou PostgreSQL existentes.
- O runtime usa C:\Program Files\FuneralControl e os dados v2 usam C:\ProgramData\FuneralControl\v2; resíduos v1 são somente diagnosticados, nunca adotados ou removidos automaticamente.
- PostgreSQL privado usa 127.0.0.1:54329, UTF-8, SCRAM e só fica ativo enquanto o FuneralControl está em execução.
- O computador cliente nunca executa npm install, npm ci, instalador MSI do Node nem instalador EDB do PostgreSQL.
- Segredos não entram em argumentos de processo, logs, manifesto de estado, .env em texto simples ou mensagens de diagnóstico. A configuração de runtime usa DPAPI da conta autorizada.
- A conta inicial é admin/admin e deve trocar a senha no primeiro acesso antes de executar operações protegidas.
- Atualização normal é manual, assinada e limitada a app\versions; não atualiza runtimes, dados, documentos, uploads, backups ou esquema de banco automaticamente.
- A desinstalação remove programa/runtimes, mas preserva ProgramData por padrão.
- O lançamento só pode ser considerado final após a matriz manual em Windows limpo descrita na especificação.

## Review Focus

- PostgreSQL na porta 5432, Node no PATH ou serviço postgresql externo: o bootstrap e o launcher devem ignorá-los integralmente; cobrir nas tarefas 3, 4 e 6.
- Download interrompido, hash/tamanho inválido ou arquivo ZIP com caminho fora do staging: nenhuma extração, atalho ou estado pronto pode ser produzido; cobrir nas tarefas 3 e 6.
- Porta privada 54329 ocupada ou diretório de banco não vazio sem manifesto v2: interromper com diagnóstico, sem encerrar processo nem apagar dados; cobrir na tarefa 4.
- Senha sentinela e tentativa por outro SID Windows: não vazar segredo em arquivo/log/erro e não iniciar com configuração alheia; cobrir nas tarefas 3 e 5.
- Release sem assinatura válida, com caminho proibido, versão/schema incompatível ou saúde pós-update falha: manter a versão ativa anterior e os dados intactos; cobrir na tarefa 7.

---

### Task 1: Contratos de versão, esquema, saúde e primeiro acesso

**Files:**
- Modify: package.json
- Modify: src/lib/app-version.ts
- Create: src/lib/schema-version.ts
- Modify: src/lib/runtime-config.server.ts
- Modify: src/lib/db.server.ts
- Modify: src/lib/auth.server.ts
- Modify: src/lib/api.functions.ts
- Modify: src/routes/login.tsx
- Create: src/routes/change-password.tsx
- Create: src/routes/api/health.ts
- Create: src/test/initial-password-policy.test.ts
- Create: src/test/runtime-health.test.ts
- Modify: src/test/runtime-config.test.ts

**Interfaces:**
- Produces APP_VERSION from FUNERALCONTROL_APP_VERSION, with a development fallback matching package.json.
- Produces CURRENT_SCHEMA_VERSION and assertSchemaCompatibility(); DDL initialization only occurs with FUNERALCONTROL_ALLOW_SCHEMA_MIGRATION=true.
- Produces readInitialAdminConfig(env): { email: string; password: string }, used only when no user exists.
- Produces GET /api/health returning { ok: true, version, schemaVersion } only after SELECT 1 succeeds.
- Produces changeOwnPassword({ currentPassword, newPassword }) and SessionUser.mustChangePassword; protected functions reject operations until the initial password changes.

- [ ] **Step 1: Write failing tests** for version/schema compatibility, initial admin password policy, protected mutation rejection, and health with injected version.

    expect(readInitialAdminConfig({ INITIAL_ADMIN_EMAIL: "admin", INITIAL_ADMIN_PASSWORD: "admin" }))
      .toEqual({ email: "admin", password: "admin" });
    expect(assertSchemaCompatibility({ installed: 1, required: 2 })).toMatchObject({ ok: false });

- [ ] **Step 2: Run focused tests to verify they fail.**

    Run: npm test -- src/test/initial-password-policy.test.ts src/test/runtime-health.test.ts src/test/runtime-config.test.ts
    Expected: FAIL because schema metadata, health route, password-change flag, and server function do not exist.

- [ ] **Step 3: Implement version and schema contracts.**

Add version to package.json; make app-version.ts consume launch environment with a development fallback; move schema DDL into ordered migrations with a schema_migrations record. Normal starts validate but do not alter an incompatible schema. Initial installation and platform maintenance set FUNERALCONTROL_ALLOW_SCHEMA_MIGRATION=true.

- [ ] **Step 4: Implement first-login policy and health route.**

Seed the first user with must_change_password=true, retain only encrypted INITIAL_ADMIN configuration, return the flag from login/session lookup, route it to /change-password, and enforce it in server-side authorization. The password-change function clears the flag only after verifying the current password. The health handler uses q("SELECT 1") and returns version/schema without credential data.

- [ ] **Step 5: Run focused tests to verify they pass.**

    Run: npm test -- src/test/initial-password-policy.test.ts src/test/runtime-health.test.ts src/test/runtime-config.test.ts
    Expected: PASS.

- [ ] **Step 6: Commit.**

    git add package.json package-lock.json src/lib src/routes src/test
    git commit -m "feat: preparar contratos de runtime local"

### Task 2: Empacotador de runtime de produção

**Files:**
- Create: scripts/Build-FuneralControlRuntime.ps1
- Create: scripts/New-FuneralControlInstallerManifest.ps1
- Create: scripts/Build-ReleaseManifest.mjs
- Create: scripts/Verify-ReleaseManifest.mjs
- Create: installer/release-public-key.pem
- Modify: package.json
- Create: src/test/runtime-bundle.test.ts
- Create: src/test/release-manifest.test.ts
- Modify: .gitignore

**Interfaces:**
- Produces Build-FuneralControlRuntime.ps1 -Version <semver> -OutputDirectory <path> [-AsJson], emitting FuneralControl-runtime-<version>.zip and JSON { archivePath, sha256, version, schemaVersion }.
- Produces New-FuneralControlInstallerManifest.ps1 -RuntimeMetadata <json> -OutputPath <psd1>, injecting the exact runtime URL, size, SHA-256 and version into the bootstrap manifest before Inno compilation.
- Produces a ZIP whose root contains only package.json, package-lock.json, dist/, node_modules/, runtime-manifest.json, and optional SBOM.json.
- Produces Build-ReleaseManifest.mjs --runtime <zip> --private-key <pem> --output <dir> and Verify-ReleaseManifest.mjs --manifest <json> --signature <sig> --public-key <pem>.

- [ ] **Step 1: Write failing tests** for runtime allowlist, excluded development/configuration paths, manifest version matching package.json, and Ed25519 rejection of altered metadata.

    expect(runtimeEntries).toEqual(expect.arrayContaining(["package.json", "dist/server/server.js"]));
    expect(runtimeEntries).not.toEqual(expect.arrayContaining([".env", "src/", "docker-compose.yml"]));
    expect(verifyReleaseManifest(tamperedManifest, signature, publicKey)).toBe(false);

- [ ] **Step 2: Run focused tests to verify they fail.**

    Run: npm test -- src/test/runtime-bundle.test.ts src/test/release-manifest.test.ts
    Expected: FAIL because the builder and signing verifier do not exist.

- [ ] **Step 3: Implement the controlled runtime build.**

Run npm ci and npm run build only in the controlled release workspace; create a fresh staging directory; run npm ci --omit=dev there; copy built dist, package metadata, production dependencies, generated version/schema manifest, and SBOM. Validate the staging tree before compression. Generate the bootstrap manifest only from the emitted runtime metadata. Do not include .env, source, tests, Docker, caches, Git metadata, or v1 scripts.

- [ ] **Step 4: Implement signed release metadata.**

Use Node crypto Ed25519 to sign canonical manifest bytes. Commit only the public key; keep private key paths ignored and document that production signing material is external. Make verification fail closed on unknown fields, invalid signature, invalid hash, invalid semver, or unexpected asset name.

- [ ] **Step 5: Run build and focused tests.**

    Run: npm test -- src/test/runtime-bundle.test.ts src/test/release-manifest.test.ts
    Run: powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Build-FuneralControlRuntime.ps1 -Version <package-version> -OutputDirectory <temporary-output> -AsJson
    Expected: Tests PASS; JSON reports a ZIP with SHA-256 and a manifest matching the single source of version.

- [ ] **Step 6: Commit.**

    git add package.json package-lock.json scripts installer/release-public-key.pem src/test .gitignore
    git commit -m "build: empacotar runtime de produção"

### Task 3: Primitivas seguras de bootstrap e estado v2

**Files:**
- Create: scripts/FuneralControlInstaller.Common.psm1
- Modify: scripts/installer-manifest.psd1
- Modify: scripts/Test-FuneralControlPrerequisites.ps1
- Create: src/test/installer-v2-common.test.ts
- Modify: src/test/installer-manifest.test.ts
- Modify: src/test/installer-bootstrap.test.ts
- Modify: vitest.config.ts

**Interfaces:**
- Produces Get-FuneralControlPaths -InstallRoot <path> -DataRoot <path>, returning known app/runtime/state/config/log/staging paths and port 54329.
- Produces Read-FuneralControlState, Set-FuneralControlPhase, and Test-FuneralControlState over a non-secret installation.json with phase enum prechecked|downloaded|verified|extracted|clusterInitialized|databaseConfigured|appValidated|shortcutCreated.
- Produces Invoke-FuneralControlVerifiedDownload -Component <object> -Destination <path> and Expand-FuneralControlSafeArchive -Archive <path> -Destination <path>.
- Produces Protect-FuneralControlRuntimeConfig / Unprotect-FuneralControlRuntimeConfig, bound to authorized SID through DPAPI, and sanitized log helpers.

- [ ] **Step 1: Write failing tests** for manifest URL/hash/size validation, state progression, a rejected ../ archive entry, changed SHA-256, a sentinel secret absent from state/log output, and v1 root reported but not adopted.

    expect(advanceState("verified", "downloaded")).toMatchObject({ ok: false });
    expect(testArchiveEntry("../outside.txt")).toMatchObject({ ok: false });
    expect(output).not.toContain("SENTINEL_DO_NOT_LEAK");

- [ ] **Step 2: Run focused tests to verify they fail.**

    Run: npm test -- src/test/installer-v2-common.test.ts src/test/installer-manifest.test.ts src/test/installer-bootstrap.test.ts
    Expected: FAIL because v2 state, safe extraction, DPAPI configuration, and manifest contracts do not exist.

- [ ] **Step 3: Stabilize the PowerShell test runner before adding v2 script tests.**

First reproduce the existing failure with the normal full suite and confirm that the same PowerShell tests pass with one Vitest worker. Configure the repository to serialize Windows PowerShell child-process tests, because parallel invocations currently terminate with Windows access violation 3221225477. Remove the obsolete test that simultaneously required and prohibited winget; replace it with the v2 prohibition contract.

- [ ] **Step 4: Implement shared PowerShell module and v2 manifest.**

Use pinned Node portable ZIP, PostgreSQL binary ZIP, and release runtime ZIP with HTTPS URL, version, exact byte size, SHA-256, and allowed source host. Store only metadata, active application version, authorized SID, paths and phases in state. Use exclusive temporary files, remove them in finally, quote native invocations safely, capture exit code/stdout/stderr without exposing environment secrets, and set ACLs to authorized user/SYSTEM/Administrators as required.

- [ ] **Step 5: Replace prerequisite checks.**

Check Windows x64, elevation, available disk on destination/staging drives, each required HTTPS endpoint, and conflicts only on private paths/port. Do not query PATH, Get-Service postgresql, winget, external PostgreSQL directories, or global Node.

- [ ] **Step 6: Run focused tests to verify they pass.**

    Run: npm test -- src/test/installer-v2-common.test.ts src/test/installer-manifest.test.ts src/test/installer-bootstrap.test.ts
    Expected: PASS; tests verify no v1 discovery or plaintext secret contract remains.

- [ ] **Step 7: Commit.**

    git add scripts/FuneralControlInstaller.Common.psm1 scripts/installer-manifest.psd1 scripts/Test-FuneralControlPrerequisites.ps1 src/test
    git commit -m "feat: adicionar base isolada do instalador v2"

### Task 4: Cluster PostgreSQL privado e configuração cifrada

**Files:**
- Modify: scripts/Configure-FuneralControlDatabase.ps1
- Create: scripts/Test-FuneralControlDatabase.ps1
- Modify: src/test/db-bootstrap.test.ts
- Create: src/test/private-postgres-runtime.test.ts

**Interfaces:**
- Produces Configure-FuneralControlDatabase.ps1 -InstallRoot <path> -DataRoot <path> -RuntimePostgresRoot <path> -AuthorizedSid <sid> -Port 54329 [-DryRun] [-AsJson].
- Produces a v2 cluster at <DataRoot>\postgres-data, database funeralcontrol, role funeralcontrol_app, encrypted runtime config, and health result identifying only version/port/database name.
- Produces Test-FuneralControlDatabase.ps1 -RuntimePostgresRoot <path> -DataRoot <path> -Port 54329, testing only private pg_isready/psql binaries.

- [ ] **Step 1: Write failing tests** for private binary paths, port 54329, SCRAM/loopback configuration, refusal of nonempty unmanaged data directory, no superpassword/PGPASSWORD secret logging, and no references to PATH, global PostgreSQL directories, or Get-Service.

    expect(script).toContain("RuntimePostgresRoot");
    expect(script).toContain("54329");
    expect(script).not.toMatch(/Get-Command psql|Program Files\\PostgreSQL|--superpassword/);

- [ ] **Step 2: Run focused tests to verify they fail.**

    Run: npm test -- src/test/db-bootstrap.test.ts src/test/private-postgres-runtime.test.ts
    Expected: FAIL because the current bootstrap searches for global PostgreSQL and uses port 5432.

- [ ] **Step 3: Implement private cluster initialization.**

Extract PostgreSQL only into known runtime root. Create initdb password and SQL files with ACLs restricted to active user, use them once, delete them in finally, configure loopback/SCRAM/port 54329, start only that data directory with its pg_ctl, create application role/database, and persist only DPAPI-protected application configuration. Do not retain a superuser password or plaintext .env file.

- [ ] **Step 4: Implement real health and idempotence checks.**

If v2 state and data directory agree, verify the private cluster before reusing it. If data exists without valid v2 state, fail safely with a diagnostic. Never stop a PID or service that does not belong to recorded v2 data directory.

- [ ] **Step 5: Run focused tests to verify they pass.**

    Run: npm test -- src/test/db-bootstrap.test.ts src/test/private-postgres-runtime.test.ts
    Expected: PASS.

- [ ] **Step 6: Commit.**

    git add scripts/Configure-FuneralControlDatabase.ps1 scripts/Test-FuneralControlDatabase.ps1 src/test
    git commit -m "feat: isolar cluster PostgreSQL local"

### Task 5: Launcher privado, uploads separados e encerramento seguro

**Files:**
- Modify: scripts/Start-FuneralControl.ps1
- Create: scripts/Stop-FuneralControl.ps1
- Create: src/lib/managed-shutdown.server.ts
- Modify: FuneralControl.cmd
- Modify: src/lib/api.functions.ts
- Modify: src/components/app-layout.tsx
- Modify: src/test/local-launcher.test.ts
- Modify: src/test/session-timeout.test.tsx
- Create: src/test/managed-shutdown.test.ts

**Interfaces:**
- Produces Start-FuneralControl.ps1 -InstallRoot <path> [-OpenBrowser] [-DryRun] [-AsJson], validating SID/state, starting private PostgreSQL, launching portable node.exe with srvx.mjs, waiting for /api/health, and recording only its own PIDs.
- Produces Stop-FuneralControl.ps1 -InstallRoot <path> -Reason <logout|timeout|update|failure>, waiting for/ending only recorded private processes and using pg_ctl stop for the recorded data directory.
- Produces scheduleManagedShutdown(reason) in the server flow; it is active only when FUNERALCONTROL_MANAGED_RUNTIME=true and is scheduled only after backup processing completes and the logout handler can return its response.

- [ ] **Step 1: Write failing tests** for direct portable Node invocation, UPLOAD_DIR under ProgramData\FuneralControl\v2\uploads, health polling by expected version, refusal on another SID or occupied 54329, and logout/inactivity requesting managed shutdown only after backup handling.

    expect(launcher).toContain("runtime\\node\\node.exe");
    expect(launcher).toContain("UPLOAD_DIR");
    expect(logoutResult.backup).toBeDefined();
    expect(requestManagedShutdown).toHaveBeenCalledWith("logout");

- [ ] **Step 2: Run focused tests to verify they fail.**

    Run: npm test -- src/test/local-launcher.test.ts src/test/session-timeout.test.tsx src/test/managed-shutdown.test.ts
    Expected: FAIL because the launcher uses npm, finds global services, and logout keeps the server alive.

- [ ] **Step 3: Implement managed runtime launcher.**

Read/decrypt configuration only in authorized user process; set DATABASE_URL, DATABASE_SSL=false, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD, UPLOAD_DIR, FUNERALCONTROL_APP_VERSION, FUNERALCONTROL_SCHEMA_VERSION, and FUNERALCONTROL_MANAGED_RUNTIME only for child Node process. Invoke portable node.exe and packaged node_modules\srvx\bin\srvx.mjs directly, not npm. Wait for versioned health before opening localhost.

- [ ] **Step 4: Implement controlled shutdown.**

After successful logout/timeout backup, schedule the managed runtime shutdown so the handler returns first; launcher then stops its Node child and its own PostgreSQL data directory. Keep browser development mode and non-managed local development from exiting unexpectedly. Create desktop shortcut only through successful installer flow, never on a failed launcher invocation.

- [ ] **Step 5: Run focused tests to verify they pass.**

    Run: npm test -- src/test/local-launcher.test.ts src/test/session-timeout.test.tsx src/test/managed-shutdown.test.ts
    Expected: PASS.

- [ ] **Step 6: Commit.**

    git add scripts/Start-FuneralControl.ps1 scripts/Stop-FuneralControl.ps1 FuneralControl.cmd src/lib/api.functions.ts src/components/app-layout.tsx src/test
    git commit -m "feat: iniciar e encerrar runtime local privado"

### Task 6: Orquestrador Inno Setup v2, atalho e desinstalação segura

**Files:**
- Modify: installer/FuneralControl.iss
- Modify: scripts/Install-FuneralControl.ps1
- Modify: src/test/installer-package.test.ts
- Modify: src/test/installer-bootstrap.test.ts
- Create: docs/instalacao-local-v2.md

**Interfaces:**
- Produces Install-FuneralControl.ps1 -InstallRoot <path> -DataRoot <path> [-Repair] [-DryRun] [-AsJson] using v2 manifest/state/launcher contracts.
- Produces a user-desktop FuneralControl.lnk only after Test-FuneralControlDatabase and /api/health succeed.
- Produces an uninstaller that removes files under Program Files\FuneralControl but does not delete the v2 ProgramData root.

- [ ] **Step 1: Write failing tests** for exact bootstrap-only Inno payload, no dist/source/package lock/development tree in installer payload, explicit privilege requirement, no shortcut before success, no Common Desktop shortcut, and safe preservation of ProgramData on uninstall.

    expect(definition).not.toContain('Source: "..\\dist\\*"');
    expect(definition).not.toContain("CommonDesktopDirectory");
    expect(definition).toContain("Uninstallable=yes");
    expect(bootstrapResult.createsShortcut).toBe(false);

- [ ] **Step 2: Run focused tests to verify they fail.**

    Run: npm test -- src/test/installer-package.test.ts src/test/installer-bootstrap.test.ts
    Expected: FAIL because current Inno package embeds source/runtime files and invokes v1 installation behavior.

- [ ] **Step 3: Implement resumable bootstrap.**

Replace global discovery/MSI/EDB/npm logic with phases: preflight, verified download, extraction, private cluster, database configuration, app health, user-desktop shortcut. On failure, leave sanitized log/state and show its exact v2 path. Detect legacy v1 artifacts for reporting only. Do not create a shortcut or mark ready until both health checks pass.

- [ ] **Step 4: Implement Inno package boundaries.**

Include only bootstrap scripts, common module, manifest, public key, launcher, and versioned Inno metadata. Keep application runtime as verified download. Use a normal uninstaller and document data/backups remain intentionally; never add an uninstall delete rule for ProgramData.

- [ ] **Step 5: Run package tests and compile installer.**

    Run: npm test -- src/test/installer-package.test.ts src/test/installer-bootstrap.test.ts
    Run: ISCC.exe installer\FuneralControl.iss
    Expected: Tests PASS; compilation produces v2 bootstrapper without application source/development tree.

- [ ] **Step 6: Commit.**

    git add installer/FuneralControl.iss scripts/Install-FuneralControl.ps1 src/test docs/instalacao-local-v2.md
    git commit -m "feat: reconstruir instalador Windows isolado"

### Task 7: Atualização manual autenticada e reversível

**Files:**
- Modify: src/lib/github-releases.server.ts
- Modify: src/lib/update-rules.ts
- Modify: src/lib/update-trigger.server.ts
- Modify: src/lib/api.functions.ts
- Modify: src/components/update-notice.tsx
- Modify: scripts/Update-FuneralControl.ps1
- Modify: src/test/update-rules.test.ts
- Modify: src/test/update-trigger.test.ts
- Modify: src/test/update-launcher.test.ts
- Create: src/test/update-v2-security.test.ts
- Create: docs/assinatura-de-releases.md

**Interfaces:**
- Consumes GitHub Release assets FuneralControl-release-manifest.json and .sig, plus FuneralControl-runtime-<version>.zip.
- Produces AvailableRelease { version, schemaVersion, packageUrl, sha256, size, manifestUrl, signatureUrl } only after public-key verification and compatibility checks.
- Produces Update-FuneralControl.ps1 -InstallRoot <path> -ManifestUrl <url> -SignatureUrl <url> -ExpectedVersion <semver> -BackupManifest <path>, changing only app\versions and active-version state.

- [ ] **Step 1: Write failing tests** for invalid signature, untrusted release URL, mismatched manifest/ZIP hash, disallowed ZIP entry, schema mismatch, stale app PID, failed health, and rollback retaining previous active version/data root.

    expect(parseAvailableRelease({ manifest, signatureValid: false })).toBeNull();
    expect(updatePlan.allowedTargets).toEqual(["app/versions", "state/active-app.json"]);
    expect(updatePlan.rollbackVersion).toBe("2.0.0");

- [ ] **Step 2: Run focused tests to verify they fail.**

    Run: npm test -- src/test/update-rules.test.ts src/test/update-trigger.test.ts src/test/update-launcher.test.ts src/test/update-v2-security.test.ts
    Expected: FAIL because v1 updater trusts a body hash, copies over install root, and lacks version/schema health confirmation.

- [ ] **Step 3: Implement release discovery and authenticated trigger.**

Read only expected GitHub Release assets, verify detached manifest with portable Node verifier, require real validated local-backup manifest rather than boolean, and request UAC for stable updater when needed. Do not pass write authority or secrets from browser input.

- [ ] **Step 4: Implement side-by-side update and rollback.**

Wait for recorded application PID to exit, download/validate/extract package into staging, reject all paths except runtime allowlist, install candidate version beside active version, start it through launcher, and atomically change active-version state only after health returns expected version/schema. On every failure, preserve original version and all ProgramData data.

- [ ] **Step 5: Document release signing operations.**

Document public-key placement, external generation/storage of Ed25519 private key, signature generation, Release asset names, and the fact that key must never be committed or attached to support logs.

- [ ] **Step 6: Run focused tests to verify they pass.**

    Run: npm test -- src/test/update-rules.test.ts src/test/update-trigger.test.ts src/test/update-launcher.test.ts src/test/update-v2-security.test.ts
    Expected: PASS.

- [ ] **Step 7: Commit.**

    git add src/lib src/components scripts/Update-FuneralControl.ps1 src/test docs/assinatura-de-releases.md
    git commit -m "feat: proteger atualização manual por release"

### Task 8: Verificação integral, documentação operacional e aceite de release

**Files:**
- Modify: README.md
- Modify: docs/plano-sistema.md
- Create: docs/aceite-instalador-v2.md
- Modify: src/test/installer-package.test.ts
- Modify: src/test/runtime-bundle.test.ts

**Interfaces:**
- Produces release checklist with artifact names, SHA-256, signing status, test evidence, clean-VM scenarios, and explicit result per scenario.
- Produces installation/recovery documentation in pt-BR pointing to sanitized v2 logs and warning users not to manually delete legacy PostgreSQL/configuration files.

- [ ] **Step 1: Write failing package/release checks** rejecting a release folder containing .env, postgres-bootstrap.secret, development directories, a private key, or a payload outside published asset allowlist.

    expect(releaseFiles).not.toContain("postgres-bootstrap.secret");
    expect(releaseFiles).not.toContain(".env");
    expect(releaseFiles).not.toContain("src/");

- [ ] **Step 2: Run focused checks to verify they fail before release sanitation is implemented.**

    Run: npm test -- src/test/installer-package.test.ts src/test/runtime-bundle.test.ts
    Expected: FAIL until release staging allowlist and documentation are complete.

- [ ] **Step 3: Implement documentation and release sanitation.**

Document prerequisites, expected download size, normal user flow, repair diagnostics, release-key ownership, backup preservation, and VM test record. Ensure generated installers/runtime assets stay out of Git while checksum/manifest evidence is retained with the release.

- [ ] **Step 4: Run automated verification.**

    Run: npm run lint
    Run: npm test
    Run: npm run build
    Run: git diff --check
    Expected: lint has no errors, focused/full tests pass, application builds, and Git reports no whitespace errors.

- [ ] **Step 5: Execute and record manual Windows acceptance matrix.**

Run the nine scenarios in the approved specification on clean Windows/VMs: clean install; existing Node/PostgreSQL on 5432; no internet/hash/disk failures; interrupted phase recovery; reboot/start/logout/timeout; signed manual update and rollback; unauthorized account; uninstall/reinstall data retention; log/secret inspection.

Expected: Each row in docs/aceite-instalador-v2.md is marked PASS with environment/version/date evidence. Any FAIL blocks release publication.

- [ ] **Step 6: Commit.**

    git add README.md docs src/test
    git commit -m "docs: registrar aceite do instalador v2"

## Self-review

- **Cobertura da especificação:** tarefas 1–2 tratam pacote, versão, schema e primeiro acesso; tarefas 3–4 tratam manifesto, estado, hash, DPAPI e PostgreSQL privado; tarefas 5–6 tratam launcher, atalho, ciclo de backup/encerramento, Inno e desinstalação; tarefa 7 trata atualização manual autenticada; tarefa 8 trata matriz real e documentação.
- **Entradas de risco:** os cinco itens de Review Focus possuem testes explícitos nas tarefas 3–7 e validação real na tarefa 8.
- **Consistência:** 54329, C:\ProgramData\FuneralControl\v2, app\versions, funeralcontrol, funeralcontrol_app, estado não secreto e FUNERALCONTROL_ALLOW_SCHEMA_MIGRATION são usados com o mesmo significado em todas as tarefas.
- **Proporção:** o plano define interfaces, artefatos e provas; não transcreve implementação PowerShell/React completa.
