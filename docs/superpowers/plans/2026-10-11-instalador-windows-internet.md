# Instalador Windows pela internet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um instalador Windows que baixa dependências oficiais, configura o FuneralControl localmente e cria o atalho único de uso.

**Architecture:** Um manifesto centraliza versões e URLs oficiais. Scripts PowerShell verificáveis tratam download, pré-requisitos, configuração idempotente de Node.js/PostgreSQL e lançamento local; o Inno Setup apenas pede elevação e orquestra o bootstrap. O instalador nunca remove banco, documentos ou backups existentes.

**Tech Stack:** Windows, PowerShell, Node.js LTS, PostgreSQL, Inno Setup, `pg_dump`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-11-instalador-windows-design.md`

## Global Constraints

- O sistema opera apenas em um computador, em `localhost`, sem hospedagem ou OAuth.
- O instalador requer internet e permissão administrativa somente para a instalação inicial.
- PostgreSQL e `pg_dump` permanecem locais e obrigatórios.
- O banco chama-se `funeralcontrol` e o usuário técnico `funeralcontrol_app`.
- A senha técnica não aparece na interface ou em logs comuns.
- Reexecução preserva banco, documentos, configurações e backups.
- O usuário final utiliza apenas o atalho `FuneralControl`.

## Review Focus

- Sem internet ou URL indisponível: parar antes de alterar a instalação e explicar a causa.
- Dependência oficial com hash divergente: recusar execução e não instalar arquivo baixado.
- Node.js/PostgreSQL já compatíveis: reutilizar sem substituir dados ou serviços.
- Falha na criação do banco: não marcar o atalho como pronto e mostrar ação de correção.
- Reinstalação após uso: preservar `.env`, uploads e diretórios de backup.

### Task 1: Manifesto e pré-verificação de dependências

**Files:**
- Create: `scripts/installer-manifest.psd1`
- Create: `scripts/Test-FuneralControlPrerequisites.ps1`
- Test: `src/test/installer-manifest.test.ts`

**Interfaces:**
- Produces: manifesto com `Node`, `PostgreSQL` e suas URLs HTTPS oficiais, versão esperada e hash opcional.
- Produces: `Test-FuneralControlPrerequisites.ps1 -CheckInternet -CheckDisk -CheckAdmin` com código de saída diferente de zero em falha.

- [ ] **Step 1: Write failing tests** para manifesto possuir apenas URLs HTTPS oficiais e para o relatório de pré-requisitos identificar falta de rede, espaço ou elevação.
- [ ] **Step 2: Run** `npm test -- src/test/installer-manifest.test.ts` — esperado: FAIL por manifesto/script ausente.
- [ ] **Step 3: Implement** manifesto e script de leitura sem alterar o computador; valide Windows, espaço livre, elevação e conexão HTTPS antes de qualquer instalação.
- [ ] **Step 4: Run** teste focado — esperado: PASS; execute o script em modo somente verificação.
- [ ] **Step 5: Commit** `feat: verificar pré-requisitos do instalador`.

### Task 2: Bootstrap idempotente local

**Files:**
- Create: `scripts/Install-FuneralControl.ps1`
- Create: `scripts/Configure-FuneralControlDatabase.ps1`
- Create: `scripts/Start-FuneralControl.ps1`
- Create: `FuneralControl.cmd`
- Test: `src/test/local-launcher.test.ts`

**Interfaces:**
- Consumes: `installer-manifest.psd1` e resultados da pré-verificação.
- Produces: `Install-FuneralControl.ps1 -InstallRoot <path>` e `Start-FuneralControl.ps1 -InstallRoot <path>`.
- Produces: banco `funeralcontrol`, usuário técnico `funeralcontrol_app`, `.env` local protegido e atalho chamando `FuneralControl.cmd`.

- [ ] **Step 1: Write failing tests** para inicializador preservar arquivo de configuração existente, atalho apontar somente para localhost e script recusar seguir após falha da conexão PostgreSQL.
- [ ] **Step 2: Run** `npm test -- src/test/local-launcher.test.ts` — esperado: FAIL sem scripts.
- [ ] **Step 3: Implement** bootstrap em etapas idempotentes: download validado, instalação silenciosa, criação condicional de banco/usuário, criação de `.env` somente se ausente e teste de conexão antes do atalho.
- [ ] **Step 4: Implement** lançador que inicia/reutiliza PostgreSQL, aguarda o servidor local, abre `http://localhost:<porta>` e deixa mensagens de falha em pt-BR.
- [ ] **Step 5: Run** teste focado e simulação sem permissões de administrador; commit `feat: preparar inicialização local do FuneralControl`.

### Task 3: Empacotamento, documentação e aceitação

**Files:**
- Create: `installer/FuneralControl.iss`
- Modify: `README.md`
- Modify: `docs/plano-sistema.md`
- Test: `src/test/installer-package.test.ts`

**Interfaces:**
- Consumes: scripts das Tarefas 1 e 2.
- Produces: definição Inno Setup do instalador `.exe` que exige elevação e chama o bootstrap.

- [ ] **Step 1: Write failing tests** para o pacote exigir administrador, chamar o bootstrap, criar o atalho `FuneralControl` e não conter senha técnica literal em texto visível.
- [ ] **Step 2: Run** `npm test -- src/test/installer-package.test.ts` — esperado: FAIL sem definição do instalador.
- [ ] **Step 3: Implement** script Inno Setup, documentação de requisitos/recuperação e instruções para validar PostgreSQL, `pg_dump` e os três destinos de backup após instalação.
- [ ] **Step 4: Run** `npm run lint`, `npm test`, `npm run build`, `git diff --check`; compilar o instalador em máquina Windows com Inno Setup e executar teste manual em ambiente limpo.
- [ ] **Step 5: Commit** `feat: criar instalador Windows pela internet`.
