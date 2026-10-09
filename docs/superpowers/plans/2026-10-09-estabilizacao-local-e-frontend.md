# Estabilização local e frontend completo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover acoplamentos de plataforma, estabilizar o uso local obrigatório de PostgreSQL e concluir os fluxos de Planos e Faturas do frontend.

**Architecture:** A aplicação será executada como TanStack Start em Node.js, com Vite/TanStack configurados diretamente e PostgreSQL acessado por `pg`. O backend manterá Server Functions autenticadas e armazenamento de contratos no filesystem local configurável; o frontend será completado sobre o layout e os componentes existentes.

**Tech Stack:** React 19, TanStack Start/Router, Vite, Tailwind CSS v4, shadcn/ui, Zod, Node.js, `pg`, PostgreSQL, Vitest e Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-09-seguranca-vps-design.md`

## Global Constraints

- O desenvolvimento e os testes rodam localmente; o deploy em VPS é posterior.
- PostgreSQL é obrigatório; não haverá fallback para PGlite ou outro banco local embutido.
- Credenciais locais de provisionamento são `admin`/`admin`, somente por variáveis de ambiente; a interface não as exibe nem preenche.
- Todas as mensagens e regras de negócio permanecem em pt-BR.
- Contratos aceitam PDF, JPEG, PNG e WebP até 20 MB, com verificação de assinatura do conteúdo.
- Nenhuma dependência ou configuração de execução deve permanecer vinculada a Lovable, Cloudflare ou Wrangler.
- Alterações locais existentes devem ser preservadas; commits devem incluir somente arquivos da tarefa correspondente.

## Review Focus

- `DATABASE_URL` ausente ou PostgreSQL indisponível deve falhar explicitamente, sem criar dados em outro banco.
- CPF formatado, CPF inválido, sequência repetida e CPF duplicado devem produzir resultado determinístico em pt-BR.
- Arquivo com MIME permitido, mas assinatura incompatível, deve ser recusado antes de gravar.
- Sessão ausente ou expirada não pode carregar nem alterar dados protegidos.
- Plano sem beneficiários permitidos e fatura já gerada no mês não devem permitir operações inválidas ou duplicadas.

### Task 1: Remover acoplamentos de plataforma e configurar execução Node

**Files:**
- Modify: `package.json` — remover `@lovable.dev/vite-tanstack-config` e dependências exclusivas de plataforma.
- Modify: `vite.config.ts` — declarar plugins Vite/TanStack/Tailwind diretamente e preset de servidor Node.
- Modify: `bunfig.toml`, `.gitignore`, `README.md`, `docs/plano-sistema.md` — remover referências operacionais a Lovable, Cloudflare, Wrangler e Drizzle quando incompatíveis com o código atual.
- Delete: arquivos `.lovable/*` e módulos de relatório específicos da plataforma que ainda estiverem presentes.
- Test: `src/test/platform-config.test.ts` — verificar que a configuração não declara alvos ou pacotes removidos.

**Interfaces:**
- Produces: build local Node executável e configuração/documentação coerentes com React/TanStack/`pg`.

- [ ] **Step 1: Write the failing test** `platform configuration contains no managed-platform reference`, lendo `package.json`, `vite.config.ts` e `docs/plano-sistema.md` e afirmando ausência das strings proibidas.
- [ ] **Step 2: Run test to verify it fails** — `npm test -- src/test/platform-config.test.ts`; esperado: FAIL porque a configuração atual importa o preset Lovable e menciona Cloudflare.
- [ ] **Step 3: Implement the native Node configuration** — substituir o preset gerenciado por plugins Vite/TanStack Start/Tailwind/paths disponíveis nas dependências, definir preset Node e remover somente resíduos não utilizados.
- [ ] **Step 4: Run test to verify it passes** — `npm test -- src/test/platform-config.test.ts`; esperado: PASS.
- [ ] **Step 5: Verify build** — `npm run build`; esperado: client, SSR e servidor Node concluídos sem alerta de plataforma gerenciada.
- [ ] **Step 6: Commit** — `git add` apenas dos arquivos da tarefa e `git commit -m "chore: remover acoplamentos de plataforma"`.

### Task 2: Tornar PostgreSQL local obrigatório e bootstrap explícito

**Files:**
- Create: `src/lib/runtime-config.server.ts` — funções puras `readDatabaseConfig(env)` e `readAdminConfig(env)` para validar ambiente.
- Modify: `src/lib/db.server.ts` — remover PGlite, usar somente `pg.Pool`, falhar sem `DATABASE_URL`/conexão e exigir `ADMIN_EMAIL`/`ADMIN_PASSWORD` quando o banco estiver vazio.
- Modify: `.env.example`, `docker-compose.yml`, `README.md` — documentar PostgreSQL local e credenciais de desenvolvimento sem exibi-las na UI.
- Test: `src/test/runtime-config.test.ts`, `src/test/db-bootstrap.test.ts` — cobrir ambiente ausente, ambiente válido e erro de conexão sem fallback.

**Interfaces:**
- Consumes: `DATABASE_URL`, `DATABASE_SSL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- Produces: `readDatabaseConfig(env: NodeJS.ProcessEnv)` e `readAdminConfig(env: NodeJS.ProcessEnv)` com erros operacionais em português; `db()` sempre retorna cliente PostgreSQL pronto.

- [ ] **Step 1: Write the failing tests** para ausência de `DATABASE_URL`, ausência de credenciais de bootstrap e aceitação de `admin`/`admin` fornecidos pelo ambiente.
- [ ] **Step 2: Run tests to verify they fail** — `npm test -- src/test/runtime-config.test.ts src/test/db-bootstrap.test.ts`; esperado: FAIL porque o código atual cria PGlite e usa defaults.
- [ ] **Step 3: Implement configuration and database changes** com pool PostgreSQL único, `ready` reinicializável após falha e mensagem sem revelar senha.
- [ ] **Step 4: Run tests to verify they pass** — mesmo comando; esperado: PASS.
- [ ] **Step 5: Verify local service** — iniciar o PostgreSQL do Compose, executar a suíte e confirmar criação das tabelas e do administrador uma única vez.
- [ ] **Step 6: Commit** — `git add` apenas dos arquivos da tarefa e `git commit -m "fix: exigir PostgreSQL local"`.

### Task 3: Corrigir autenticação, validação de entrada e armazenamento de sessão

**Files:**
- Modify: `src/lib/auth.server.ts` — armazenar hash do token de sessão e manter cookie HTTP-only, SameSite e Secure em produção.
- Modify: `src/lib/api.functions.ts` — trocar `inputValidator` por `validator`, tipar erros e manter todas as funções protegidas por sessão.
- Modify: `src/routes/login.tsx`, `src/components/app-layout.tsx`, `src/routes/__root.tsx` — remover qualquer credencial visível/preenchida e traduzir mensagens restantes para pt-BR.
- Test: `src/test/auth.test.ts`, `src/test/login-copy.test.tsx` — verificar hash de sessão, expiração e ausência de credenciais na interface.

**Interfaces:**
- Consumes: `q`, `hashPassword`, `verifyPassword`, cookies TanStack Start.
- Produces: sessões persistidas por hash e Server Functions usando `.validator(...)`.

- [ ] **Step 1: Write failing tests** para token persistido diferente do cookie original, sessão expirada rejeitada e login sem texto `admin`/`admin`.
- [ ] **Step 2: Run tests to verify failure** — `npm test -- src/test/auth.test.ts src/test/login-copy.test.tsx`; esperado: FAIL com token em claro ou credencial presente.
- [ ] **Step 3: Implement the authentication changes** usando digest SHA-256 do token antes de inserir/consultar/remover e removendo a demonstração de credenciais.
- [ ] **Step 4: Run tests to verify pass** — mesmo comando; esperado: PASS.
- [ ] **Step 5: Commit** — `git add` apenas dos arquivos da tarefa e `git commit -m "fix: endurecer autenticação local"`.

### Task 4: Validar CPF e arquivos no servidor

**Files:**
- Create: `src/lib/cpf.ts` — `normalizeCpf(value: string): string` e `isValidCpf(value: string): boolean`.
- Create: `src/lib/file-signature.ts` — `detectAllowedFileType(bytes: Uint8Array): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | null`.
- Modify: `src/lib/api.functions.ts` — usar CPF normalizado/validado, criar índice único parcial para CPF de beneficiário e validar assinatura antes de `saveFile`.
- Modify: `src/lib/storage.server.ts`, `src/routes/api/contracts.$id.ts` — usar nomes seguros, `X-Content-Type-Options: nosniff` e download como anexo por padrão.
- Test: `src/test/cpf.test.ts`, `src/test/file-signature.test.ts` — cobrir CPFs válidos/inválidos e assinaturas reais/falsas.

**Interfaces:**
- Consumes: strings de formulário e bytes do `File`.
- Produces: CPF de 11 dígitos ou erro de domínio; tipo MIME detectado por assinatura ou `null`.

- [ ] **Step 1: Write failing tests** para CPF válido, CPF repetido, CPF formatado, MIME falso e assinatura válida de cada formato permitido.
- [ ] **Step 2: Run tests to verify failure** — `npm test -- src/test/cpf.test.ts src/test/file-signature.test.ts`; esperado: FAIL porque hoje só há contagem de caracteres e MIME declarado.
- [ ] **Step 3: Implement pure validators** e integrar as Server Functions antes de persistir dados/arquivos.
- [ ] **Step 4: Run tests to verify pass** — mesmo comando; esperado: PASS.
- [ ] **Step 5: Verify schema behavior** — iniciar banco limpo, criar titulares/beneficiários duplicados e confirmar erro controlado em pt-BR.
- [ ] **Step 6: Commit** — `git add` apenas dos arquivos da tarefa e `git commit -m "fix: validar CPF e contratos"`.

### Task 5: Concluir telas e fluxos de Planos e Faturas

**Files:**
- Create: `src/routes/plans/index.tsx` — listagem, criação, edição e ativação/inativação usando `listPlans`/`savePlan`.
- Create: `src/routes/invoices/index.tsx` — filtros por status/mês, geração mensal, baixa e cancelamento usando as Server Functions existentes.
- Modify: `src/routes/index.tsx`, `src/components/app-layout.tsx` — ligar botões e links de titulares, planos e faturas às rotas reais.
- Modify: `src/lib/api.functions.ts` — tipar retornos, aplicar transação/idempotência nas operações de geração e baixa quando necessário.
- Test: `src/test/route-pages.test.tsx`, `src/test/invoice-rules.test.ts` — verificar rotas e regras de geração/duplicidade/status.

**Interfaces:**
- Consumes: `listPlans`, `savePlan`, `listInvoices`, `generateInvoices`, `payInvoice`, `setInvoiceStatus`.
- Produces: rotas `/plans` e `/invoices` navegáveis, com formulários pt-BR e estados de carregamento/erro/vazio.

- [ ] **Step 1: Write failing route tests** para `/plans` e `/invoices`, além de teste de geração idempotente e limite de beneficiários.
- [ ] **Step 2: Run tests to verify failure** — `npm test -- src/test/route-pages.test.tsx src/test/invoice-rules.test.ts`; esperado: FAIL porque as rotas não existem e as regras não estão isoladas/testadas.
- [ ] **Step 3: Implement pages and business wiring** em pequenas unidades reutilizáveis, mantendo o layout existente e todos os textos em pt-BR.
- [ ] **Step 4: Run tests to verify pass** — mesmo comando; esperado: PASS.
- [ ] **Step 5: Verify full local flow** — com PostgreSQL local, cadastrar plano, titular, gerar fatura, registrar pagamento e confirmar atualização do dashboard.
- [ ] **Step 6: Commit** — `git add` apenas dos arquivos da tarefa e `git commit -m "feat: concluir frontend de planos e faturas"`.

### Task 6: Corrigir qualidade, documentação e validação final

**Files:**
- Modify: `.prettierrc`, `.gitattributes` — normalizar newline sem gerar milhares de falsos erros no Windows.
- Modify: `src/**/*.ts`, `src/**/*.tsx` — corrigir `any`, formatação e mensagens de erro identificadas pelo lint.
- Modify: `README.md`, `docs/plano-sistema.md` — refletir ambiente local, PostgreSQL, execução e fluxo futuro de VPS.
- Test: `src/test/app-routing.test.tsx` e suíte completa existente.

**Interfaces:**
- Consumes: todos os módulos e rotas das tarefas anteriores.
- Produces: projeto reproduzível localmente e documentação operacional coerente.

- [ ] **Step 1: Write/extend tests** para rotas protegidas, falha de banco e fluxos principais ainda não cobertos.
- [ ] **Step 2: Run the focused tests** e confirmar que cada novo teste falha antes do ajuste correspondente.
- [ ] **Step 3: Apply formatting and type fixes** sem alterar regras de negócio já aprovadas.
- [ ] **Step 4: Run final verification** — `npm run lint`, `npm test`, `npm run build` e `npm audit --omit=dev`; esperado: lint/test/build sem erro e nenhuma vulnerabilidade de produção.
- [ ] **Step 5: Review repository state** — confirmar que não há resíduos proibidos, segredos ou arquivos locais de dados rastreados.
- [ ] **Step 6: Commit** — `git add` somente dos arquivos da tarefa e `git commit -m "chore: estabilizar qualidade do projeto"`.

## Handoff

Depois do plano aprovado, executar as tarefas em ordem, validando cada fase
antes da próxima. A implementação deve ocorrer no checkout atual para
preservar o trabalho local existente; não usar reset, checkout destrutivo ou
mesclar os seis commits remotos enquanto houver alterações não commitadas.
