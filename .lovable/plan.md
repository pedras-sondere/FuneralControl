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

## Detalhes técnicos
- Lovable Cloud: autenticação por e-mail, banco de dados e armazenamento privado para contratos.
- Tabelas: plans, holders, beneficiaries, contracts (arquivo), invoices; acesso restrito a usuários logados (RLS).
- Rotas protegidas sob layout autenticado; leituras via server functions com React Query.
