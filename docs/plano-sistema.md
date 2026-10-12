# Sistema de Controle de Planos Funerários

Sistema interno, visual limpo (fundo claro, tipografia sóbria, tom azul-petróleo discreto), para a equipe gerenciar titulares, beneficiários, contratos e mensalidades.

## Telas

1. **Login** — acesso só para a equipe (e-mail e senha).
2. **Painel** — resumo: titulares ativos, faturas em aberto, vencidas e recebido no mês; lista de próximos vencimentos.
3. **Planos** — cadastro de planos (nome, valor mensal, nº máximo de beneficiários, descrição, ativo/inativo).
4. **Titulares** — lista com busca (nome/CPF) e filtro por situação (ativo, inadimplente, cancelado).
5. **Ficha do titular** — dados pessoais (nome, CPF, nascimento, telefone, e-mail, endereço), plano, dia de vencimento, data de adesão, e abas:
   - **Beneficiários**: adicionar/editar/remover (nome, CPF, nascimento, parentesco), respeitando o limite do plano.
   - **Contrato**: enviar PDF/imagem do contrato digitalizado, visualizar e baixar.
   - **Faturas**: histórico de mensalidades com status.
6. **Faturas** — lista geral com filtros (em aberto, pagas, vencidas, mês), ação "marcar como paga" (data e forma de pagamento) e "gerar faturas do mês" para todos os titulares ativos.

## Regras

- Fatura gerada com o valor do plano e o dia de vencimento do titular; não duplica no mesmo mês.
- Fatura em aberto após o vencimento aparece como **vencida**.
- Titular com fatura vencida aparece como **inadimplente**.

## Operação local e detalhes técnicos

- O sistema é executado localmente em um único computador Windows, pelo atalho `FuneralControl`, abrindo no navegador em `localhost`.
- O instalador inicial baixa Node.js e PostgreSQL, configura o banco local e preserva os dados ao ser executado novamente. Não há hospedagem, VPS, Cloudflare, Lovable ou OAuth nesta operação.
- Banco PostgreSQL acessado via `DATABASE_URL` com SQL parametrizado; a estratégia de migração será versionada no repositório.
- Autenticação própria da equipe: usuários com senha (hash scrypt) e sessão por cookie httpOnly; sem cadastro público (usuário admin inicial via variáveis de ambiente).
- Contratos digitalizados salvos em pasta privada local configurável, servidos apenas para usuários logados.
- Backups ZIP validados incluem dump PostgreSQL, documentos e configuração. Há cópia local, cópia em pasta sincronizada com nuvem e cópia obrigatória no HD externo a cada 10 dias.
- Tabelas: users, sessions, plans, holders, beneficiaries, contracts (arquivo), invoices, backup_settings, backup_runs.
- Rotas protegidas sob layout autenticado; leituras via server functions com React Query, todas verificando a sessão.
