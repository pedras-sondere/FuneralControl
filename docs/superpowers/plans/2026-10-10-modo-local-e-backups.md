# Modo local e backups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Executar o FuneralControl em um único computador por atalho local e proteger seus dados com backups ZIP validados em três destinos.

**Architecture:** Um serviço de backup isolado exporta PostgreSQL, reúne uploads/configurações e produz ZIP com manifesto e hashes. O PostgreSQL registra destinos, execuções e a última cópia externa válida; funções autenticadas expõem configuração, status, execução e bloqueio de operações mutáveis. Um lançador Windows inicia os serviços e o navegador; logout ou inatividade dispara backup e encerra o processo local.

**Tech Stack:** Node.js, TypeScript, TanStack Start Server Functions, PostgreSQL/pg, PowerShell, `pg_dump`, `archiver`, React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-modo-local-e-backup-design.md`

## Global Constraints

- O sistema opera somente em um computador, através de `localhost`; não haverá deploy online.
- PostgreSQL permanece obrigatório e local.
- Um único atalho, `FuneralControl`, inicia o ambiente.
- Todo backup é ZIP e contém dump PostgreSQL, uploads, configurações e manifesto com hashes.
- A pasta de nuvem é um diretório local escolhido pelo usuário; não haverá OAuth nem API externa.
- HD externo é validado pela última cópia concluída, não pela presença da unidade.
- Após 10 dias sem backup externo válido, somente consulta e backup permanecem disponíveis.
- Mensagens e regras de negócio ficam em pt-BR.

## Review Focus

- Pasta em nuvem removida ou sem permissão deve registrar falha, alertar e não bloquear antes do prazo externo.
- HD desconectado não é falha se a última cópia válida tiver menos de 10 dias; após isso bloqueia toda mutação.
- ZIP parcial, dump inválido ou manifesto com hash divergente nunca pode ser marcado como concluído.
- Logout/inatividade deve aguardar a finalização do backup e não eliminar o registro da falha.
- Falha de PostgreSQL ou `pg_dump` deve manter o servidor em execução e informar o usuário, sem apagar cópias anteriores.

### Task 1: Persistência e regras puras de backup

**Files:**
- Modify: `src/lib/db.server.ts` — tabelas `backup_settings`, `backup_runs` e configuração singleton.
- Create: `src/lib/backup-rules.ts` — cálculo de vencimento externo e bloqueio.
- Test: `src/test/backup-rules.test.ts`.

**Interfaces:**
- Produces: `isExternalBackupOverdue(lastSuccess: Date | null, now: Date): boolean` e `canMutateForBackup(status): boolean`.
- Produces: registros por destino `local | cloud | external`, com resultado, caminho, hash e datas.

- [ ] **Step 1: Write the failing test** para cópia externa válida com 9 dias, vencimento com 10 dias, ausência de data e permissões de consulta versus mutação.
- [ ] **Step 2: Run** `npm test -- src/test/backup-rules.test.ts` — esperado: FAIL por módulo inexistente.
- [ ] **Step 3: Implement** regras puras e esquema aditivo; mantenha configurações de destino vazias até o primeiro uso.
- [ ] **Step 4: Run** o teste focado — esperado: PASS.
- [ ] **Step 5: Commit** `feat: registrar status de backup`.

### Task 2: Serviço ZIP validado e manifesto

**Files:**
- Modify: `package.json`, `package-lock.json` — adicionar `archiver` e tipos necessários.
- Create: `src/lib/backup-service.server.ts` — exportação, compactação, hash e histórico.
- Modify: `src/lib/storage.server.ts` — expor diretório de uploads de modo seguro para inclusão no backup.
- Test: `src/test/backup-service.test.ts`.

**Interfaces:**
- Produces: `runBackup({ destinations, actorUserId }): Promise<BackupRunResult[]>`.
- Produces: `validateBackupZip(path): Promise<{ manifestHash: string; sizeBytes: number }>`.
- Consumes: `DATABASE_URL`, `UPLOAD_DIR`, `pg_dump` e regras da Tarefa 1.

- [ ] **Step 1: Write failing tests** para manifesto com hashes, ZIP legível, arquivo ausente e destino sem permissão.
- [ ] **Step 2: Run** `npm test -- src/test/backup-service.test.ts` — esperado: FAIL sem serviço.
- [ ] **Step 3: Implement** dump temporário via `pg_dump`, cópia de uploads/configurações, ZIP por destino e limpeza somente dos temporários.
- [ ] **Step 4: Validate** o ZIP antes de registrar `success`; em falha, grave `failed` sem apagar backups anteriores.
- [ ] **Step 5: Run** teste focado e `npm test`; commit `feat: gerar backups ZIP validados`.

### Task 3: Configuração, alertas e bloqueio de operações

**Files:**
- Modify: `src/lib/api.functions.ts` — funções de configuração/status/execução e guarda de mutações.
- Create: `src/lib/backup-guard.server.ts` — `requireMutableOperation()`.
- Create: `src/routes/backups.tsx` — destinos, histórico, status e ação manual de HD externo.
- Modify: `src/components/app-layout.tsx`, `src/routes/index.tsx`, `src/routeTree.gen.ts` — alerta persistente e acesso a backups.
- Test: `src/test/backup-guard.test.ts`, `src/test/route-pages.test.ts`.

**Interfaces:**
- Produces: `getBackupStatus()`, `saveBackupSettings()`, `runExternalBackup()` e `requireMutableOperation()`.
- Consumes: `isExternalBackupOverdue()` e `runBackup()`.

- [ ] **Step 1: Write failing tests** para bloquear cadastro/fatura com prazo vencido, permitir consulta e rota `/backups`.
- [ ] **Step 2: Run** os testes focados — esperado: FAIL.
- [ ] **Step 3: Implement** guard antes das Server Functions mutáveis e permita explicitamente configuração/restauração/backup.
- [ ] **Step 4: Implement** tela que seleciona pastas, mostra três estados, última cópia e histórico de falhas.
- [ ] **Step 5: Run** testes e smoke local; commit `feat: configurar alertas e bloqueio de backup`.

### Task 4: Sessão de 2 horas e encerramento com backup

**Files:**
- Modify: `src/lib/auth.server.ts`, `src/lib/api.functions.ts` — expiração e encerramento coordenado.
- Create: `src/components/session-timeout.tsx` — contador de atividade e aviso aos 105 minutos.
- Modify: `src/components/app-layout.tsx` — disparar logout seguro e apresentar progresso.
- Create: `src/routes/api/local-shutdown.ts` — endpoint local protegido para sinalizar encerramento após backup.
- Test: `src/test/session-timeout.test.ts`, `src/test/logout-backup.test.ts`.

**Interfaces:**
- Produces: `logoutWithBackup({ reason: "manual" | "inactive" })` e aviso de 15 minutos.
- Consumes: `runBackup()` e `destroySession()`.

- [ ] **Step 1: Write failing tests** para aviso aos 105 minutos, logout aos 120, backup antes de destruição da sessão e persistência de erro.
- [ ] **Step 2: Run** testes focados — esperado: FAIL.
- [ ] **Step 3: Implement** rastreamento de atividade no cliente e função de encerramento no servidor que tenta os três destinos antes de sinalizar término.
- [ ] **Step 4: Run** testes focados e fluxo manual; commit `feat: encerrar sessão com backup automático`.

### Task 5: Lançador Windows, documentação e verificação final

**Files:**
- Create: `scripts/Start-FuneralControl.ps1` — inicia PostgreSQL, servidor local e navegador; trata processo pré-existente.
- Create: `FuneralControl.cmd` — atalho executável que chama o script sem expor comandos ao usuário.
- Modify: `README.md`, `docs/plano-sistema.md` — instalação local, requisitos `pg_dump`, destinos e recuperação.
- Test: `src/test/local-launcher.test.ts`.

**Interfaces:**
- Produces: comando único `FuneralControl.cmd` para iniciar e abrir `http://localhost:<porta>`.
- Consumes: endpoint de encerramento da Tarefa 4.

- [ ] **Step 1: Write failing tests** que verificam atalho único, início do PostgreSQL e abertura em localhost.
- [ ] **Step 2: Run** `npm test -- src/test/local-launcher.test.ts` — esperado: FAIL.
- [ ] **Step 3: Implement** scripts PowerShell/CMD sem apagar dados, com mensagens orientadas a falha de serviço ou dependência ausente.
- [ ] **Step 4: Run** `npm run lint`, `npm test`, `npm run build`, `git diff --check` e teste manual de iniciar, sair, validar ZIP e reiniciar.
- [ ] **Step 5: Commit** `feat: iniciar FuneralControl localmente`.
