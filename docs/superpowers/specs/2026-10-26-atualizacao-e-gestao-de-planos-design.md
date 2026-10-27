# Atualização segura e Gestão de Planos — Design

## Objetivo

Publicar uma atualização estável do FuneralControl e substituir Faturas por
**Gestão**, voltada a renovações anuais, ocorrências, falecimentos/utilizações,
receita mensal estimada e índice de utilização por plano.

O sistema continua local, em um único computador Windows com PostgreSQL
privado. Banco, documentos e configurações de backup nunca podem ser apagados
ou recriados por uma atualização.

## Entregas e ordem

1. Atualização **2.0.2**: corrigir o backup com PostgreSQL privado, integrar
   no `main` e publicar uma release estável detectável pelo sistema instalado.
2. Gestão de Planos: entregar o novo fluxo em uma release posterior, após os
   testes de preservação de dados e migração.

Nenhuma funcionalidade de Gestão será incluída na release 2.0.2.

## Atualização 2.0.2

- A instalação 2.0.1 reconhecerá `v2.0.2` como atualização.
- A release terá `FuneralControl-runtime-2.0.2.zip`, tamanho e SHA-256
  coerentes com os metadados publicados.
- A atualização é manual: o aviso aparece uma vez ao iniciar; download e
  elevação administrativa ocorrem somente após clique do gestor.
- Uma cópia local validada é exigida antes da atualização. O atualizador só
  muda a versão ativa após iniciar e validar a versão candidata; em falha,
  mantém a versão anterior.
- PostgreSQL, dados, uploads/documentos e configurações de backup ficam fora
  do pacote versionado e são preservados.
- O backup localiza `pg_dump.exe` em
  `C:\\Program Files\\FuneralControl\\runtime\\postgresql\\bin`; no desenvolvimento,
  mantém a procura pelo `PATH`.

## Abordagens consideradas

1. Painel Gestão central, com abas para Renovações, Ocorrências e
   Falecimentos/Utilizações. **Escolhida**, pois concentra a rotina diária.
2. Páginas independentes para cada assunto. Rejeitada por fragmentar a
   operação.
3. Somente alertas no painel e registros nas fichas individuais. Rejeitada por
   não permitir visão global das ocorrências e dos planos.

## Painel Gestão

O item Faturas será substituído por Gestão, contendo:

- resumo de receita mensal estimada, titulares ativos, renovações a vencer e
  ocorrências abertas;
- comparativo por plano: titulares ativos, receita mensal estimada,
  falecimentos/utilizações no período e índice de utilização;
- abas **Renovações**, **Ocorrências** e **Falecimentos/Utilizações**.

Sem custo operacional por funeral, o sistema não afirmará lucro monetário.
Mostrará receita mensal estimada, utilizações, índice de utilização e receita
estimada por utilização. O nome será _indicadores de utilização e
rentabilidade operacional_, nunca lucro líquido. Custos poderão ser incluídos
numa evolução posterior.

## Pessoas, histórico e sucessão

Nenhum cadastro será removido. Titulares e beneficiários terão situação atual:
`ativo`, `falecido` ou `cancelado`. A inativação exige data e cria um evento
de histórico. Pessoas inativas não podem ser escolhidas para novos vínculos,
sucessões ou operações que exijam cadastro ativo.

Ao registrar falecimento de titular, o gestor deverá selecionar um beneficiário
ativo do mesmo grupo para assumir a titularidade. O sistema manterá o titular
original como falecido, criará o novo titular com plano e dados do beneficiário
escolhido, registrará a sucessão e preservará o histórico de relações, sem
sobrescrever CPF nem apagar dados.

## Pesquisa unificada

A busca de Titulares aceitará nome ou CPF de titular **ou** beneficiário.
Resultado de beneficiário identificará a pessoa encontrada, parentesco e grupo,
e abrirá a ficha do titular correspondente. Pessoas falecidas e canceladas
continuam pesquisáveis com sua situação visível.

## Planos

- Planos ativos terão destaque visual; inativos aparecerão em cartão ou seção
  secundária, identificada como “Inativo”.
- Inativos continuam visíveis para histórico e edição, mas não podem ser
  escolhidos para titular novo nem para alterar o plano de um titular.
- O bloqueio será validado no servidor, não apenas na tela.

## Renovação anual

Titulares terão **data de adesão/contratação** e **data da mensalidade**.
Esta segunda data calcula a próxima renovação anual. O painel alertará com 30,
60 e 90 dias de antecedência. A conclusão registra data, usuário e observação,
avançando o próximo controle sem criar boleto, PIX, carnê, PDF ou fatura.

## Ocorrências

Ocorrências imutáveis serão ligadas a titular, beneficiário ou grupo familiar,
com tipo, data, descrição e usuário. Tipos iniciais: inadimplência,
cancelamento, falecimento/utilização, renovação concluída e outro.
Inadimplência será anotação administrativa; a conciliação de boletos continua
no banco. O histórico aparece na ficha e pode ser filtrado em Gestão.

## Compatibilidade e aceite

As migrações serão apenas aditivas. `plans`, `holders`, `beneficiaries`,
`invoices`, documentos e backups existentes serão preservados. Faturas sai do
menu, mas seus registros históricos permanecem no banco e na ficha do titular.

1. Atualização de 2.0.1 para 2.0.2 preserva banco, documentos, backups e
   atalho funcional.
2. Backup usa PostgreSQL privado e gera ZIP validado.
3. Busca por beneficiário abre o grupo certo.
4. Falecimento/cancelamento nunca exclui dados e exige data.
5. Falecimento de titular exige sucessor ativo e registra a sucessão.
6. Plano inativo é distinto visualmente e rejeitado no servidor para novos
   vínculos.
7. Gestão registra renovação concluída sem gerar cobrança.
8. Ocorrências permanecem no histórico individual.
