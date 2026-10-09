# Documentos, identidade institucional e faturamento — Design

## Objetivo

Evoluir o FuneralControl para que a empresa configure sua identidade, emita
contratos e Anexos 1 em PDF com versionamento e auditoria, e registre faturas
de forma flexível para controle interno. O sistema continuará local, usando
PostgreSQL e armazenamento de arquivos local, preparado para posterior VPS.

## Resultado esperado

- A identidade visual usa a marca dos planos e o logo da empresa, sem exibir
  o nome fixo FuneralControl.
- Contrato e Anexo 1 são documentos oficiais em PDF, gerados pelo servidor,
  versionados e confirmados por upload da cópia física assinada.
- Cada plano define cláusulas de contrato, máximo e mínimo obrigatório de
  beneficiários.
- As faturas podem ser registradas para um titular ou para todos os ativos,
  em qualquer quantidade de competências, sem gerar boleto, PIX, carnê ou PDF
  de cobrança.

## Identidade da empresa e marca dos planos

Haverá uma configuração institucional única no banco. Antes de emitir um
contrato, ela deverá conter: razão social ou nome empresarial, CNPJ válido,
endereço completo, telefone, e-mail e logotipo.

Também haverá o nome da marca dos planos. Empresa e marca são conceitos
distintos: por exemplo, a empresa pode ser “Funerária Bom Jesus” e a marca
dos planos “Prevenir”.

No cabeçalho, o canto esquerdo mostrará o logotipo da empresa junto à marca
dos planos. O canto direito mostrará o nome da empresa e, abaixo, o usuário
conectado; depois ficarão os botões de configurações e sair. A tela de
configurações será acessada pelo ícone de engrenagem ao lado de sair.

Alterações de identidade institucional valem apenas para documentos emitidos
depois da alteração. Contratos e anexos assinados mantêm a empresa, marca e
logo que possuíam no momento de sua emissão e não são marcados como pendentes
por essa alteração.

## Configuração de planos e cláusulas

Cada plano continuará com nome, mensalidade, descrição, situação ativa e
quantidade máxima de beneficiários. Será acrescentada a quantidade mínima
obrigatória de beneficiários.

`0 <= quantidade obrigatória <= quantidade máxima` será exigido no cliente e
no servidor. A quantidade obrigatória é o mínimo necessário para que o Anexo
1 seja emitido como válido; o contrato do titular pode ser emitido sem
beneficiários.

O antigo conceito de importar um contrato genérico é substituído por uma
configuração de cláusulas dentro do sistema. Cada plano terá sua própria lista
ordenada de cláusulas. O gestor poderá incluir, editar, reordenar e excluir
uma cláusula por vez em um modal próprio. Mudanças nas cláusulas serão
auditadas e afetarão somente os contratos dos titulares vinculados àquele
plano.

## Documentos, versões e assinatura

O sistema gerará PDFs reais pelo servidor e preservará o arquivo emitido.
Haverá dois tipos de documento:

1. **Contrato**: reúne empresa, marca dos planos, dados do titular, dados do
   plano e cláusulas ativas do plano.
2. **Anexo 1**: reúne empresa, marca dos planos, titular e a relação vigente
   de beneficiários.

Na ficha do titular, a seção atual de contrato será substituída por
**Documentos**, contendo cartões independentes para Contrato e Anexo 1. Cada
cartão exibirá situação, versão atual, data de emissão, ações de gerar PDF,
baixar versão emitida, enviar cópia assinada e consultar histórico.

O contrato só poderá ser emitido quando os dados obrigatórios da empresa e do
titular estiverem preenchidos: nome completo, CPF válido, data de nascimento,
telefone, endereço completo, plano, data de adesão e dia de vencimento.
E-mail do titular será opcional. O Anexo 1 só poderá ser emitido como válido
quando a quantidade de beneficiários alcançar o mínimo configurado no plano.

Uma emissão cria uma nova versão imutável do PDF, com uma fotografia dos dados
e cláusulas naquele instante. Após imprimir/baixar essa versão, ela ficará
**pendente de assinatura** até que o gestor envie a digitalização assinada. O
upload da cópia assinada encerra a pendência e torna a versão vigente como
**assinada**.

Uma alteração relevante mantém o documento anterior disponível, mas marca o
tipo documental afetado como **pendente de assinatura** para atualização. São
relevantes:

- alteração de dados do titular, plano ou cláusulas do plano para o contrato;
- inclusão, edição ou remoção de beneficiário para o Anexo 1.

O sistema não altera nem substitui PDFs históricos, cópias assinadas ou seus
dados de origem. Uploads de cópias físicas continuarão aceitando somente PDF,
JPEG, PNG e WebP com validação de assinatura de arquivo e limite de tamanho
já existente.

## Auditoria

Cada documento terá uma linha do tempo própria. A auditoria registrará usuário,
data/hora, documento, versão, ação e descrição humana do motivo. Exemplos:

- “Anexo 1 atualizado: beneficiário João Silva incluído.”
- “Contrato atualizado: cláusula 5 alterada.”
- “Contrato versão 3 emitido em PDF.”
- “Contrato versão 3 assinado e anexado.”

Registros de auditoria são somente adicionados; não serão editados nem
apagados por fluxos normais da aplicação.

## Faturas para controle interno

Faturas não são documentos de cobrança. A aplicação não gerará carnê, boleto,
PIX, código de barras ou PDF financeiro automático.

A página de Faturas terá um modal de geração com os seguintes dados:

- destino: um titular específico ou todos os titulares ativos;
- mês inicial;
- quantidade de parcelas/competências, livremente informada pelo gestor;
- prévia do período que será criado.

A ficha do titular terá a mesma ação, já direcionada ao titular selecionado.
O valor de cada fatura virá da mensalidade do plano, e o vencimento usará o
dia de vencimento do titular. A geração continuará impedindo duplicidade por
titular e competência.

Antes de gravar as faturas, o modal perguntará: “As faturas já foram enviadas
ao cliente?”. A resposta “sim” grava data de envio e situação de envio
**enviada**. A resposta “não” grava situação **pendente de envio**. A situação
de envio é independente da situação financeira (aberta, vencida, paga ou
cancelada); o gestor poderá marcar posteriormente uma fatura ou um conjunto
de faturas como enviado.

Ao concluir a operação, o sistema informará quantas faturas foram criadas e
quais competências já existiam e foram preservadas.

## Persistência e compatibilidade

O PostgreSQL receberá estruturas novas para:

- configuração institucional e referências do logotipo;
- cláusulas ordenadas por plano;
- versões de documentos emitidos, seus snapshots, arquivos PDF e cópias
  assinadas;
- eventos de auditoria documental;
- lotes de geração de faturas e situação/data de envio.

Os dados já existentes em `plans`, `holders`, `beneficiaries`, `contracts` e
`invoices` serão preservados. Arquivos enviados no fluxo antigo continuarão
acessíveis como anexos históricos; a nova emissão versionada ocorrerá nas
novas estruturas, sem apagar contratos existentes.

## Tratamento de erros

- A geração de PDF falha com mensagem clara se faltar dado obrigatório,
  configuração institucional ou cláusula aplicável.
- O upload assinado só é aceito para uma versão emitida e pendente.
- A exclusão ou alteração de cláusula não reescreve documentos já emitidos.
- A geração de faturas informa conflitos sem duplicar registros.
- Emissão em lote respeita titulares cancelados e data de adesão, como o fluxo
  atual.

## Qualidade e critérios de aceite

1. A interface não apresenta o nome fixo FuneralControl após a configuração
   institucional estar completa.
2. Contrato e Anexo 1 emitidos podem ser baixados como PDFs preservados e têm
   versão, status e cópia assinada associados.
3. Beneficiário adicionado, editado ou removido cria pendência auditável do
   Anexo 1, sem substituir a versão assinada anterior.
4. Alteração de cláusula cria pendência auditável do contrato para titulares
   do plano correspondente, sem reescrever versões assinadas.
5. O Anexo 1 é bloqueado abaixo do mínimo do plano e o cadastro bloqueia
   mínimo maior que máximo.
6. Faturas podem ser geradas individualmente ou em lote, para qualquer número
   de competências, sem duplicidade por titular e mês.
7. O envio ao cliente é registrado separadamente do pagamento e pode ser
   informado na geração ou posteriormente.
8. Testes cobrem as regras de mínimo/máximo, pendências documentais,
   versionamento, auditoria, duplicidade de faturas e situação de envio.
