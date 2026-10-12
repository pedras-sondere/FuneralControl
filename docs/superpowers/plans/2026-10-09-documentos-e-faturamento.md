# Documentos, identidade institucional e faturamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que a empresa configure sua identidade, emita e audite contratos/Anexos 1 em PDF e registre faturas internas flexíveis com situação de envio separada do pagamento.

**Architecture:** O PostgreSQL receberá tabelas aditivas para configuração institucional, cláusulas por plano, estados/versões de documentos, eventos de auditoria e lotes de faturas. Server Functions autenticadas coordenarão regras, persistência e arquivos; PDFs serão gerados no servidor por `@react-pdf/renderer`, armazenados localmente e entregues por rota protegida. As rotas React reutilizarão o layout atual, recebendo a identidade institucional carregada em seus loaders.

**Tech Stack:** React 19, TanStack Start/Router, TypeScript, Zod, PostgreSQL/`pg`, `@react-pdf/renderer` 4.9.x, Tailwind CSS v4, shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-documentos-e-faturamento-design.md`

## Global Constraints

- O desenvolvimento e os testes permanecem locais; o deploy em VPS é posterior.
- PostgreSQL continua obrigatório; não haverá fallback de banco ou serviço de arquivos externo.
- Todas as mensagens, validações e regras de negócio devem ficar em pt-BR.
- Documentos gerados e cópias assinadas são imutáveis; arquivos e registros legados nunca serão apagados pelo novo fluxo.
- Alterações de empresa/marca aplicam-se somente a novas emissões e não geram pendência em documentos já assinados.
- Não haverá boleto, PIX, código de barras, carnê ou PDF financeiro automático.
- Uploads continuam locais, com validação de assinatura de arquivo; logos aceitam somente PNG ou JPEG para renderização confiável nos PDFs.
- Rotas geradas em `src/routeTree.gen.ts` devem ser atualizadas pelo plugin TanStack, nunca editadas manualmente.
- Commits devem conter apenas arquivos da tarefa correspondente e devem preservar `GEMINI.md` e outras alterações do usuário.

## Review Focus

- **Tarefa 2:** CNPJ inválido, e-mail inválido ou logo com tipo não suportado não pode deixar a configuração apta a emitir documentos.
- **Tarefa 3:** Mínimo de beneficiários igual a zero, igual ao máximo e maior que o máximo deve ter comportamento determinístico no formulário e no servidor.
- **Tarefa 4:** Edição de cláusula ou dados do titular deve criar pendência sem reescrever o PDF ou a cópia assinada anterior.
- **Tarefa 5:** Inclusão, edição ou exclusão de beneficiário deve afetar somente o Anexo 1 e respeitar o mínimo configurado para emissão válida.
- **Tarefa 6:** Lotes sobrepostos, titulares cancelados, data de adesão futura e faturas já existentes não podem produzir duplicidade nem alterar indevidamente a situação de envio.

---

## Estrutura de arquivos

- `src/lib/cnpj.ts` — normalização e validação pura do CNPJ.
- `src/lib/document-rules.ts` — tipos e regras puras de emissão, pendência e mínimo de beneficiários.
- `src/lib/document-pdf.server.tsx` — componentes e renderização dos PDFs de Contrato e Anexo 1.
- `src/lib/document-service.server.ts` — criação de versões, snapshots, auditoria, upload assinado e invalidação de documentos.
- `src/lib/company-settings.server.ts` — leitura e persistência da configuração institucional e do logotipo.
- `src/lib/invoice-batch.server.ts` — emissão transacional de lotes e registro da situação de envio.
- `src/lib/api.functions.ts` — Server Functions autenticadas que expõem os módulos acima ao frontend.
- `src/routes/settings.tsx` — tela de configurações da empresa e da marca dos planos.
- `src/routes/api/documents.$id.ts` — download protegido de PDFs gerados e cópias assinadas.
- `src/components/document-status-card.tsx` — cartão reutilizável de documento, versão, ações e auditoria.
- `src/components/invoice-generation-dialog.tsx` — modal reutilizável para emissão individual ou em lote de faturas internas.
- `src/test/cnpj.test.ts`, `src/test/document-rules.test.ts`, `src/test/document-service.test.ts`, `src/test/invoice-batch.test.ts` — cobertura unitária de regras e serviços.

### Task 1: Criar validações e regras puras do domínio

**Files:**

- Create: `src/lib/cnpj.ts` — exportar `normalizeCnpj(value: string): string` e `isValidCnpj(value: string): boolean`.
- Create: `src/lib/document-rules.ts` — exportar `DocumentType`, `DocumentStatus`, `canIssueAnnex(beneficiaryCount: number, requiredCount: number): boolean`, `isRequiredBeneficiaryCountValid(required: number, maximum: number): boolean` e `documentTypesAffectedByChange(change: "holder" | "plan" | "clauses" | "beneficiary"): DocumentType[]`.
- Modify: `src/lib/business-rules.ts` — manter `canAddBeneficiary`/`shouldCreateInvoice` e reexportar somente regras que ainda sejam de uso financeiro genérico.
- Test: `src/test/cnpj.test.ts`, `src/test/document-rules.test.ts`.

**Interfaces:**

- Produces: validadores sem acesso a banco ou navegador para que Server Functions e formulários compartilhem as mesmas regras.
- Consumes: somente strings/números e tipos locais; não depende de React, `pg` ou variáveis de ambiente.

- [ ] **Step 1: Write failing tests** para CNPJ formatado válido, CNPJ com dígitos verificadores inválidos, CNPJ de dígitos repetidos, mínimo `0`, mínimo igual ao máximo, mínimo maior que o máximo e mapeamento de mudanças para Contrato/Anexo 1.
- [ ] **Step 2: Run the focused tests** — `npm test -- src/test/cnpj.test.ts src/test/document-rules.test.ts`; esperado: FAIL porque os módulos ainda não existem.
- [ ] **Step 3: Implement `normalizeCnpj`, `isValidCnpj` e as regras documentais** com retorno booleano determinístico e nomes em inglês no código, mantendo mensagens da interface em pt-BR.
- [ ] **Step 4: Run the focused tests again** — mesmo comando; esperado: PASS.
- [ ] **Step 5: Commit** — `git add src/lib/cnpj.ts src/lib/document-rules.ts src/lib/business-rules.ts src/test/cnpj.test.ts src/test/document-rules.test.ts && git commit -m "feat: adicionar regras de documentos e CNPJ"`.

### Task 2: Persistir configuração institucional e aplicar a marca ao layout

**Files:**

- Modify: `src/lib/db.server.ts` — adicionar a tabela singleton `company_settings` com campos inicialmente nulos para razão/nome, CNPJ, endereço, telefone, e-mail, marca, metadados do logo e timestamps.
- Create: `src/lib/company-settings.server.ts` — definir `CompanySettings`, `getCompanySettings()`, `saveCompanySettings(input)` e `saveCompanyLogo(file)`; usar PNG/JPEG detectados pelo conteúdo e `storage.server.ts`.
- Modify: `src/lib/storage.server.ts` — adicionar `saveBuffer(nameHint: string, bytes: Uint8Array): Promise<string>` para PDFs gerados e arquivos internos, preservando o nome aleatório seguro.
- Modify: `src/lib/api.functions.ts` — expor `getCompanySettings`, `saveCompanySettings` e `uploadCompanyLogo` com autenticação e validadores Zod.
- Create: `src/routes/settings.tsx` — formulário de dados obrigatórios, marca e logo, com pré-visualização e mensagens de validação em pt-BR.
- Modify: `src/components/app-layout.tsx`, `src/routes/index.tsx`, `src/routes/holders/index.tsx`, `src/routes/holders/$id.tsx`, `src/routes/plans/index.tsx`, `src/routes/invoices/index.tsx`, `src/routes/__root.tsx` — carregar/passar a identidade, substituir FuneralControl/Operador, incluir engrenagem e usar título genérico antes da configuração.
- Test: `src/test/company-settings.test.ts`, `src/test/route-pages.test.tsx`.

**Interfaces:**

- Produces: `CompanySettings` com campos opcionais para bootstrap e `isComplete` calculado somente quando todos os campos obrigatórios e o logo existem.
- Produces: rota protegida `/settings` e `AppLayout` com prop `company: CompanySettings | null`.
- Consumes: `detectAllowedFileType`, `normalizeCnpj`, `isValidCnpj`, `saveFile`/`saveBuffer` e usuário autenticado.

- [ ] **Step 1: Write failing tests** para rejeitar CNPJ/logo inválido, aceitar o perfil completo e afirmar que a rota `/settings` não cai no 404.
- [ ] **Step 2: Run the focused tests** — `npm test -- src/test/company-settings.test.ts src/test/route-pages.test.tsx`; esperado: FAIL sem validação e sem rota de configurações.
- [ ] **Step 3: Implement the additive schema and server services**; logo deve ser mantido no diretório de uploads, a configuração pode nascer incompleta e nenhum documento poderá depender dela ainda nesta tarefa.
- [ ] **Step 4: Implement the settings UI and shell branding**; o canto esquerdo usa logo + marca, o direito usa empresa e usuário, e a engrenagem navega para `/settings`.
- [ ] **Step 5: Run focused tests and visual local check** — mesmo comando e `npm run dev`; esperado: testes PASS, configuração salva e cabeçalho atualizado sem exibir “Operador” ou “FuneralControl” quando a marca existe.
- [ ] **Step 6: Commit** — incluir somente arquivos de configuração, layout, rota e testes em `git commit -m "feat: configurar identidade da empresa"`.

### Task 3: Estender planos com mínimo de beneficiários e cláusulas auditáveis

**Files:**

- Modify: `src/lib/db.server.ts` — adicionar `required_beneficiaries int NOT NULL DEFAULT 0`, `CHECK (required_beneficiaries >= 0 AND required_beneficiaries <= max_beneficiaries)` e tabela `plan_clauses(id, plan_id, position, content, created_at, updated_at)` com unicidade de posição por plano.
- Modify: `src/lib/api.functions.ts` — estender `Plan`, `planSchema`, `listPlans` e `savePlan`; expor `listPlanClauses`, `savePlanClause`, `movePlanClause` e `deletePlanClause`.
- Modify: `src/routes/plans/index.tsx` — adicionar o campo “Quantidade obrigatória de beneficiários” e modal de cláusulas com inclusão, edição, exclusão e botões de reordenação.
- Create: `src/test/plan-contract-rules.test.ts` — cobrir limite mínimo/máximo, ordenação e validação de payload.

**Interfaces:**

- Produces: `Plan.required_beneficiaries: number` e `PlanClause { id: number; plan_id: number; position: number; content: string }`.
- Produces: operações autenticadas que sempre devolvem cláusulas ordenadas por `position`.
- Consumes: `isRequiredBeneficiaryCountValid` e, na Tarefa 4, `documentTypesAffectedByChange("clauses")`.

- [ ] **Step 1: Write failing tests** para plano com mínimo maior que máximo, plano com zero beneficiários obrigatórios, cláusulas ordenadas e reposicionamento que não duplica posição.
- [ ] **Step 2: Run the focused tests** — `npm test -- src/test/plan-contract-rules.test.ts`; esperado: FAIL porque o campo e as operações não existem.
- [ ] **Step 3: Implement schema, validadores e Server Functions** usando atualização transacional para reordenar cláusulas e persistindo `required_beneficiaries` sem alterar planos existentes além do default `0`.
- [ ] **Step 4: Implement the Plans UI** com validação antes do envio e modal de cláusulas por plano; não haverá importação de arquivo de contrato.
- [ ] **Step 5: Run focused tests and local smoke test** — mesmo comando; esperado: PASS e o gestor consegue salvar plano com mínimo válido e ordenar cláusulas.
- [ ] **Step 6: Commit** — incluir os arquivos da tarefa em `git commit -m "feat: configurar cláusulas e mínimo por plano"`.

### Task 4: Implementar versões, PDFs e auditoria documental no servidor

**Files:**

- Modify: `package.json`, `package-lock.json` — adicionar `@react-pdf/renderer@^4.9.0`.
- Modify: `src/lib/db.server.ts` — criar `holder_document_state`, `document_versions` e `document_events`; preservar a tabela `contracts` e os arquivos já armazenados.
- Create: `src/lib/document-pdf.server.tsx` — exportar `renderContractPdf(snapshot): Promise<Uint8Array>` e `renderAnnexPdf(snapshot): Promise<Uint8Array>` com páginas A4, logo, dados institucionais, dados do titular e conteúdo aplicável.
- Create: `src/lib/document-service.server.ts` — exportar `getHolderDocumentSummary(holderId)`, `generateDocument(input)`, `uploadSignedDocument(input)`, `markDocumentsPending(input)` e `listDocumentEvents(holderId, type)`.
- Modify: `src/lib/api.functions.ts` — expor `getHolderDocuments`, `generateHolderDocument`, `uploadSignedHolderDocument` e `listHolderDocumentEvents`; integrar invalidação em `saveHolder`, `savePlan`, `savePlanClause`, `movePlanClause` e `deletePlanClause`.
- Create: `src/routes/api/documents.$id.ts` — entregar PDF emitido ou cópia assinada por ID, com sessão obrigatória, `nosniff`, cache privado e download por padrão.
- Test: `src/test/document-service.test.ts`, `src/test/document-pdf.test.ts`.

**Interfaces:**

- Produces: `DocumentType = "contract" | "annex_1"`, estados `not_issued | pending_signature | signed`, versões incrementais por titular/tipo e snapshots JSONB imutáveis.
- Produces: eventos somente de inclusão com `actor_user_id`, `document_type`, `document_version_id` opcional, `action`, `description` e `created_at`.
- Consumes: configuração institucional completa, plano/cláusulas, titular, beneficiários, `saveBuffer`, `detectAllowedFileType` e usuário de sessão.

- [ ] **Step 1: Write failing tests** para bloquear contrato sem perfil institucional/titular completo, bloquear Anexo 1 abaixo do mínimo, criar PDF iniciado por `%PDF`, preservar snapshot da versão e impedir upload assinado para versão inexistente ou já assinada.
- [ ] **Step 2: Run the focused tests** — `npm test -- src/test/document-service.test.ts src/test/document-pdf.test.ts`; esperado: FAIL porque os serviços e renderizadores não existem.
- [ ] **Step 3: Install the renderer and implement the additive schema**; rodar `npm install @react-pdf/renderer@^4.9.0` e manter `package-lock.json` sincronizado.
- [ ] **Step 4: Implement renderers, service and protected download route**; cada emissão grava PDF, snapshot, versão e evento em conjunto lógico, removendo arquivo gerado se a persistência falhar.
- [ ] **Step 5: Integrate automatic pending state and audit events**; mudança de titular/plano/cláusula marca apenas Contrato, sem alterar PDF assinado anterior; mudanças institucionais não chamam esse fluxo.
- [ ] **Step 6: Run focused tests and manual protected-download check** — mesmo comando; esperado: PASS, PDF baixável com sessão e 401 sem sessão.
- [ ] **Step 7: Commit** — incluir dependência, banco, serviços, rota e testes em `git commit -m "feat: versionar documentos e gerar PDFs"`.

### Task 5: Substituir o contrato digitalizado pela central de documentos do titular

**Files:**

- Create: `src/components/document-status-card.tsx` — receber resumo, versão, eventos e callbacks de gerar/enviar/baixar; renderizar status e linha do tempo em pt-BR.
- Modify: `src/lib/api.functions.ts` — em `saveBeneficiary` e `deleteBeneficiary`, chamar `markDocumentsPending` somente para `annex_1`, incluindo descrição com nome e tipo da alteração; incluir `documents` e `legacyContracts` no retorno de `getHolder`.
- Modify: `src/routes/holders/$id.tsx` — trocar a aba “Contrato Digitalizado” por “Documentos”, usar dois cartões, apresentar anexos legados separadamente e adicionar modal de upload da cópia assinada.
- Modify: `src/routes/holders/index.tsx` — tornar obrigatórios no formulário os campos do titular exigidos para contrato (exceto e-mail), sem exigir beneficiário no cadastro.
- Test: `src/test/document-lifecycle.test.ts`, `src/test/route-pages.test.tsx`.

**Interfaces:**

- Consumes: `getHolderDocuments`, `generateHolderDocument`, `uploadSignedHolderDocument`, `listHolderDocumentEvents` e `canIssueAnnex`.
- Produces: cards de Contrato/Anexo 1 que mostram estado atual, motivo de pendência, versão e histórico sem expor implementação de storage.

- [ ] **Step 1: Write failing tests** para adição/edição/remoção de beneficiário afetar somente Anexo 1, para versão antiga continuar presente e para a rota do titular conter a central de documentos.
- [ ] **Step 2: Run the focused tests** — `npm test -- src/test/document-lifecycle.test.ts src/test/route-pages.test.tsx`; esperado: FAIL porque a ficha ainda usa o upload genérico de contratos.
- [ ] **Step 3: Implement beneficiary invalidation and holder response**; cada ação cria evento humano e mantém `contracts` antigos sob `legacyContracts`, sem removê-los.
- [ ] **Step 4: Implement the Documents UI**; bloquear ações com motivo claro, usar o mínimo do plano no Anexo 1, abrir download na rota protegida e permitir upload apenas para versão pendente.
- [ ] **Step 5: Run focused tests and full holder flow locally** — mesmo comando; esperado: PASS e inclusão de beneficiário deixa somente o Anexo 1 pendente até a nova versão assinada.
- [ ] **Step 6: Commit** — incluir central de documentos, integração de beneficiários e testes em `git commit -m "feat: centralizar documentos do titular"`.

### Task 6: Emitir faturas internas flexíveis e registrar envio ao cliente

**Files:**

- Modify: `src/lib/db.server.ts` — criar `invoice_batches` e adicionar `batch_id`, `sent_at` e `sent_by_user_id` a `invoices`, mantendo a unicidade atual de titular/competência.
- Create: `src/lib/invoice-batch.server.ts` — exportar `generateInvoiceBatch(input)` e `markInvoicesSent(input)`; calcular competências sequenciais, excluir cancelados, respeitar data de adesão, criar lote e retornar `created`/`existing` por referência.
- Modify: `src/lib/api.functions.ts` — substituir a geração mensal por `generateInvoiceBatch`, estender `listInvoices`/`getHolder` com situação de envio e expor `markInvoicesSent`.
- Create: `src/components/invoice-generation-dialog.tsx` — modal com destino, mês inicial, quantidade, prévia e confirmação “As faturas já foram enviadas ao cliente?”.
- Modify: `src/routes/invoices/index.tsx`, `src/routes/holders/$id.tsx` — usar o modal em lote/individual, exibir situação de envio e oferecer ação para marcar pendentes como enviadas.
- Test: `src/test/invoice-batch.test.ts`, `src/test/invoice-rules.test.ts`.

**Interfaces:**

- Produces: `generateInvoiceBatch({ holder_id?: number; start_month: string; installments: number; already_sent: boolean }): { batch_id: number; created: number; existing: Array<{ holder_id: number; reference_month: string }> }`.
- Produces: `Invoice.sent_at: string | null`; envio é “pendente” quando nulo e “enviada” quando preenchido, independente de `status`/`paid_at`.
- Consumes: sessão, plano do titular, dia de vencimento, data de adesão e a regra de não duplicar competência.

- [ ] **Step 1: Write failing tests** para geração individual com 6 competências, geração em lote com 12, envio já informado, envio posterior, competência duplicada, titular cancelado e titular cuja adesão é posterior à competência.
- [ ] **Step 2: Run the focused tests** — `npm test -- src/test/invoice-batch.test.ts src/test/invoice-rules.test.ts`; esperado: FAIL porque a API atual só recebe um mês e não registra envio.
- [ ] **Step 3: Implement schema and `generateInvoiceBatch` transactionally**; usar uma lista de competências calculada no servidor, preservar faturas existentes e criar o lote mesmo quando parte das referências for conflito, retornando o resumo exato.
- [ ] **Step 4: Implement `markInvoicesSent` and UI**; o modal deve confirmar explicitamente a situação de envio, e a tabela deve mostrar envio separado de aberta/vencida/paga/cancelada.
- [ ] **Step 5: Run focused tests and local end-to-end check** — mesmo comando; esperado: PASS, sem PDFs financeiros, sem duplicidades e com faturas abertas marcadas corretamente como enviadas ou pendentes.
- [ ] **Step 6: Commit** — incluir geração, UI, banco e testes em `git commit -m "feat: flexibilizar geração interna de faturas"`.

### Task 7: Atualizar documentação e executar a verificação final

**Files:**

- Modify: `docs/plano-sistema.md`, `README.md` — refletir configuração institucional, documentos versionados, Anexo 1, cláusulas por plano e faturas internas sem cobrança automática.
- Modify: `src/test/route-pages.test.tsx`, `src/test/protected-data.test.ts` — cobrir rota de configurações e proteção de download dos documentos.
- Modify: `src/routeTree.gen.ts` — somente se regenerado automaticamente pela criação de `/settings` e `/api/documents/$id`.

**Interfaces:**

- Consumes: todas as tarefas anteriores.
- Produces: documentação operacional coerente e build/testes que comprovam os fluxos aprovados.

- [ ] **Step 1: Extend failing route/protection tests** para `/settings`, `/api/documents/$id` sem sessão e a ausência de geração de carnê/boleto nas telas financeiras.
- [ ] **Step 2: Run the focused tests** — `npm test -- src/test/route-pages.test.tsx src/test/protected-data.test.ts`; esperado: FAIL até as rotas e mensagens finais refletirem o fluxo aprovado.
- [ ] **Step 3: Update documentation and route artifacts**; descrever apenas comportamento entregue, sem prometer integração bancária ou cloud.
- [ ] **Step 4: Run final verification** — `npm run lint`, `npm test`, `npm run build` e `git diff --check`; esperado: lint/test/build sem erros e diff sem espaços inválidos.
- [ ] **Step 5: Verify PostgreSQL manually** — com o contêiner `funeralcontrol_db`, configurar empresa, criar plano/cláusulas, emitir/assinar documentos, alterar beneficiário e emitir lote de faturas; confirmar versões, eventos, pendências e envio no banco e na interface.
- [ ] **Step 6: Commit** — incluir somente documentação, testes finais e arquivos gerados em `git commit -m "docs: documentar fluxos de documentos e faturas"`.

## Self-review

- **Cobertura da spec:** Tarefas 2 e 3 cobrem identidade, marca, logo, mínimo/máximo e cláusulas; Tarefas 4 e 5 cobrem PDF, versões, assinatura, Anexo 1 e auditoria; Tarefa 6 cobre faturas internas e envio; Tarefa 7 cobre compatibilidade e verificação.
- **Consistência de interfaces:** `CompanySettings`, `PlanClause`, `DocumentType`, `DocumentStatus`, `generateInvoiceBatch` e `sent_at` são definidos antes de seus consumidores de rota e UI.
- **Focos de revisão:** cada classe de entrada do topo aparece em testes nomeados nas Tarefas 2 a 6.
- **Proporção:** as tarefas definem interfaces, comportamento e verificações sem transcrever implementações inteiras.

## Handoff

Executar as tarefas na ordem apresentada. Cada tarefa deve passar seus testes
focados e criar seu commit antes da próxima. Ao término, usar o fluxo de
verificação e revisão antes de declarar a funcionalidade pronta.
