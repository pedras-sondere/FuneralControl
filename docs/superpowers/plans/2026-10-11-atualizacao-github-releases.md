# Atualização por GitHub Releases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avisar e aplicar manualmente atualizações publicadas em GitHub Releases, preservando todos os dados locais.

**Architecture:** Um módulo puro compara versões e valida metadados de release; uma Server Function consulta GitHub uma vez por abertura sem bloquear a interface. O atualizador PowerShell exige backup validado, confere SHA-256, troca apenas a pasta de programa com reversão e reinicia o lançador local.

**Tech Stack:** React 19, TanStack Start, Node.js, PowerShell, GitHub Releases API, SHA-256, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-11-atualizacao-github-releases-design.md`

## Global Constraints

- Consulta ocorre somente uma vez a cada abertura e não bloqueia o uso offline.
- Atualização começa apenas após clique manual do gestor.
- Aceitar somente release HTTPS do repositório `pedras-sondere/FuneralControl`.
- Backup local ZIP validado é obrigatório antes de alterar arquivos.
- Banco PostgreSQL, uploads, configurações e backups nunca são alterados pelo atualizador.
- Falha de download, hash ou substituição preserva/restaura a versão atual.

## Review Focus

- Sem internet: nenhuma mensagem técnica ou repetição de requisições durante a abertura.
- Tag inválida/pré-release: não oferecer atualização ao gestor.
- Hash ausente ou divergente: descartar pacote e preservar instalação atual.
- Backup falho: não iniciar download/substituição.
- Arquivos de dados dentro da instalação por engano: exclusão explícita da troca de programa.

### Task 1: Metadados e comparação de releases

**Files:**
- Create: `src/lib/update-rules.ts`
- Create: `src/lib/github-releases.server.ts`
- Test: `src/test/update-rules.test.ts`

**Interfaces:**
- Produces: `isNewerVersion(local: string, remote: string): boolean`.
- Produces: `getAvailableRelease(): Promise<AvailableRelease | null>`.

- [ ] **Step 1: Write failing tests** para versões semânticas, tags inválidas/pré-release e release sem pacote/hash.
- [ ] **Step 2: Run** `npm test -- src/test/update-rules.test.ts` — esperado: FAIL por módulo inexistente.
- [ ] **Step 3: Implement** regras puras e consulta HTTPS com timeout ao endpoint oficial do repositório; falhas retornam `null`.
- [ ] **Step 4: Run** teste focado — esperado: PASS.
- [ ] **Step 5: Commit** `feat: consultar atualizações do GitHub`.

### Task 2: Aviso manual no aplicativo

**Files:**
- Modify: `src/lib/api.functions.ts`
- Create: `src/components/update-notice.tsx`
- Modify: `src/components/app-layout.tsx`
- Test: `src/test/update-notice.test.tsx`

**Interfaces:**
- Consumes: `getAvailableRelease(): Promise<AvailableRelease | null>`.
- Produces: `checkForUpdate()` e aviso visual com ação manual `Atualizar sistema`.

- [ ] **Step 1: Write failing tests** para aviso exibido com release válida, ausência de aviso offline e ação manual sem download automático.
- [ ] **Step 2: Run** `npm test -- src/test/update-notice.test.tsx` — esperado: FAIL.
- [ ] **Step 3: Implement** consulta única após montagem autenticada e aviso discreto em pt-BR; não repetir a chamada na mesma abertura.
- [ ] **Step 4: Run** teste focado e teste de rota existente — esperado: PASS.
- [ ] **Step 5: Commit** `feat: avisar atualização disponível`.

### Task 3: Aplicação segura do pacote Windows

**Files:**
- Create: `scripts/Update-FuneralControl.ps1`
- Modify: `scripts/Start-FuneralControl.ps1`
- Modify: `README.md`
- Test: `src/test/update-launcher.test.ts`

**Interfaces:**
- Consumes: URL e SHA-256 de `AvailableRelease`, backup validado e `InstallRoot`.
- Produces: `Update-FuneralControl.ps1 -PackageUrl <url> -Sha256 <hash> -InstallRoot <path>`.

- [ ] **Step 1: Write failing tests** para modo seguro: hash incorreto não troca arquivos; dados locais ficam fora da lista de troca; reinício ocorre somente após sucesso.
- [ ] **Step 2: Run** `npm test -- src/test/update-launcher.test.ts` — esperado: FAIL.
- [ ] **Step 3: Implement** download temporário, hash obrigatório, cópia reversível da pasta de programa e reinício pelo lançador; exigir confirmação de backup antes da substituição.
- [ ] **Step 4: Run** teste focado, `npm run lint`, `npm test`, `npm run build`, `git diff --check`.
- [ ] **Step 5: Commit** `feat: aplicar atualização local com segurança`.
