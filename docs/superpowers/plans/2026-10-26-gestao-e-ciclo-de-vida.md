# Gestão, ciclo de vida e pesquisa familiar

> **Para execução:** iniciar somente depois de a versão `2.0.2` estar publicada, atualizada e validada em uma cópia real dos dados.

**Objetivo:** substituir o módulo visual de Faturas por Gestão, sem remover o histórico financeiro legado, e acrescentar controle de renovação, ocorrências, falecimentos, cancelamentos, sucessão de titularidade, pesquisa familiar e indicadores operacionais.

## Restrições globais

- Não haverá exclusão definitiva de titular ou beneficiário pelo sistema.
- Falecimento e cancelamento exigem data informada pelo gestor e deixam histórico permanente.
- O banco do cliente continua sendo a fonte de pagamento de boletos; o sistema não gera novas faturas, carnês ou baixa automática nesta etapa.
- A renovação é anual (12 meses), com lembrete e registro de conclusão, não uma cobrança mensal automática.
- Cadastros, documentos, contratos, anexos, ocorrências e faturas legadas precisam sobreviver a qualquer migração.
- Regras críticas devem ser validadas no servidor, mesmo que a interface já impeça a ação.

## Foco da revisão

- Uma transferência de titularidade deve preservar os vínculos e eventos, nunca trocar identidades historicamente.
- Um plano inativo não pode ser escolhido por uma chamada direta ao servidor.
- A busca por dependente deve retornar a família correta sem expor CPF além do necessário.
- Os indicadores devem ser honestos: sem custo funerário cadastrado, não chamar resultado de lucro líquido.

## Etapa 1 — Esquema incremental e compatível

**Arquivos:**

- Modificar: `src/lib/db.server.ts`
- Modificar: `src/lib/schema-version.ts`
- Criar: testes de compatibilidade/migração em `src/test/`

1. Criar uma migração incremental, idempotente e transacional para acrescentar, sem apagar colunas ou tabelas existentes:
   - estado e data de estado em `beneficiaries`;
   - data de adesão e data-base da mensalidade/renovação em `holders`;
   - tabela de ocorrências imutáveis vinculada ao grupo familiar e, quando aplicável, à pessoa;
   - tabela de eventos de sucessão de titularidade;
   - tabela de conclusões de renovação, com data de referência e data de conclusão.
2. Padronizar estados permitidos: `ativo`, `falecido`, `cancelado`. Para os registros legados, manter `ativo` como valor inicial e conservar a data de adesão já existente; a data-base ausente deve ser solicitada no próximo salvamento, jamais inventada silenciosamente.
3. Não alterar nem apagar a tabela `invoices`: ela permanece como histórico legado e deixa de orientar o fluxo principal.
4. Incrementar a versão de esquema e adicionar testes que comprovem primeira execução, repetição segura, dados legados preservados e bloqueio de runtime incompatível.

## Etapa 2 — Regras de domínio testadas antes da interface

**Arquivos:**

- Criar: `src/lib/lifecycle-rules.ts`
- Criar: `src/lib/renewal-rules.ts`
- Criar: `src/test/lifecycle-rules.test.ts`
- Criar: `src/test/renewal-rules.test.ts`

1. Criar testes antes da implementação para transições válidas/inválidas, data obrigatória, eleição de sucessor ativo e impedimento de beneficiar falecido ou cancelado como novo titular.
2. Calcular a próxima renovação anual a partir da data-base e da última conclusão registrada, com lembretes em 90, 60 e 30 dias e vencidos destacados.
3. Definir tipos de ocorrência pelo menos para inadimplência, cancelamento, atendimento/utilização, observação e outro; preservar texto, data do fato, autor e criação.
4. Expor indicadores de receita mensal estimada, quantidade de utilizações/falecimentos, índice de utilização e receita estimada por utilização. O rótulo será “indicadores de utilização e rentabilidade operacional”, não lucro líquido.

## Etapa 3 — Operações de servidor e integridade histórica

**Arquivos:**

- Modificar: `src/lib/api.functions.ts`
- Modificar/criar: módulos de serviço em `src/lib/`
- Criar: testes de funções de servidor e consultas em `src/test/`

1. Adaptar a listagem/pesquisa de pessoas para aceitar nome ou CPF de titular e beneficiário em uma única consulta; resultado de dependente deve apontar claramente o titular/família correspondente.
2. Criar operações autenticadas e protegidas pela exigência de backup externo para: registrar ocorrência; cancelar; registrar falecimento; concluir renovação; transferir titularidade; e atualizar datas de adesão/mensalidade.
3. No falecimento do titular, exigir a seleção de um beneficiário ativo do mesmo grupo. Em uma transação, preservar o titular original como falecido, criar a sucessão auditável e promover o beneficiário escolhido sem apagar a relação original.
4. Proibir exclusão física de beneficiários pela rota existente; substituir a ação por cancelamento/falecimento e manter uma compatibilidade explícita para registros históricos.
5. Ao criar titular ou trocar plano, consultar o estado do plano no banco e recusar plano inativo. Beneficiários permanecem vinculados a seu grupo, sem seleção de plano próprio.

## Etapa 4 — Titulares, beneficiários e planos na interface

**Arquivos:**

- Modificar: `src/routes/holders/index.tsx`
- Modificar: `src/routes/holders/$id.tsx`
- Modificar: `src/routes/plans/index.tsx`
- Modificar/criar: componentes em `src/components/`
- Atualizar: testes de rotas relevantes em `src/test/`

1. Trocar a pesquisa atual por uma pesquisa unificada, com identificação visual de “Titular” ou “Beneficiário de [titular]”, nome e CPF mascarado conforme o padrão já utilizado.
2. Exibir selos de estado em pessoas e manter as relações/histórico na página familiar. Remover botões de exclusão definitiva.
3. Criar diálogos claros para falecimento e cancelamento, exigindo data e justificativa quando o gestor registrar uma ocorrência associada.
4. No falecimento de titular, abrir o fluxo de escolha de sucessor antes da confirmação e mostrar o que ocorrerá com o histórico.
5. Diferenciar os cards de planos ativos e inativos: ativos em maior destaque; inativos em tratamento visual secundário e rótulo inequívoco. Ocultar/desabilitar inativos nos seletores de novos cadastros e explicar o motivo.

## Etapa 5 — Novo módulo Gestão

**Arquivos:**

- Criar/modificar: `src/routes/management/index.tsx` (ou rota equivalente definida pelo roteador)
- Modificar: `src/components/app-layout.tsx`
- Manter rota legada somente para consulta: `src/routes/invoices/index.tsx`
- Criar: componentes de dashboard/abas em `src/components/`
- Criar: testes de rota e regras em `src/test/`

1. Substituir o item principal “Faturas” por “Gestão” no menu e cabeçalho.
2. Construir um painel central com abas **Renovações**, **Ocorrências** e **Falecimentos/Utilizações**.
3. Em Renovações, listar em prioridade: vencidas, até 30, até 60 e até 90 dias; permitir registrar “renovação concluída” com data e observação, sem gerar cobrança.
4. Em Ocorrências, permitir registro por titular/beneficiário e mostrar a linha do tempo na ficha familiar.
5. Em Falecimentos/Utilizações, listar eventos, período e plano; apresentar os indicadores operacionais sem afirmar lucro contábil.
6. Manter a rota de faturas antigas apenas para consulta e identificá-la como histórico enquanto houver registros existentes; não criar mais gerações mensais pelo fluxo novo.

## Etapa 6 — Verificação, documentação e distribuição posterior

**Arquivos:**

- Modificar: `README.md`, `docs/plano-sistema.md` e documentação de uso aplicável
- Modificar: `package.json`, `package-lock.json` somente na release futura

1. Executar testes unitários das regras, testes das funções de servidor, testes de rotas afetadas e `npm run build`.
2. Fazer teste manual com cópia do banco: busca por dependente, plano inativo, falecimento com sucessor, cancelamento, ocorrência de inadimplência, renovação anual e consulta de dados antigos.
3. Validar backup antes e depois da migração, inclusive restauração em ambiente de teste.
4. Versionar como próxima versão menor (`v2.1.0`, salvo decisão diferente antes da publicação), empacotar runtime, calcular hash e publicar seguindo a mesma cadeia segura validada na v2.0.2.

## Critérios de aceite

- Busca retorna titular e beneficiário por nome ou CPF, mantendo a identificação familiar.
- Nenhuma pessoa é apagada; falecimento/cancelamento aparecem com data e histórico.
- Falecimento de titular só conclui com sucessor ativo escolhido ou com registro explícito de que não há sucessor.
- Planos inativos não podem ser aplicados a novos cadastros, nem pela interface nem por acesso direto à função de servidor.
- Gestão mostra renovações anuais, ocorrências e utilizações; não gera faturas novas.
- Dados e backups existentes permanecem íntegros após a migração.
