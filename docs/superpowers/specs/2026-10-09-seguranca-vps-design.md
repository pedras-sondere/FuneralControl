# Segurança e implantação em VPS

## Objetivo

Preparar o FuneralControl para desenvolvimento e validação locais com
PostgreSQL local, preservando a compatibilidade para futura execução em uma
VPS com PostgreSQL no próprio servidor. A mudança elimina dependências de
plataforma gerenciada e reduz riscos no tratamento de dados pessoais e
contratos digitalizados.

## Ordem de execução

O trabalho será realizado em três fases sequenciais. Uma fase só começa após
as verificações da anterior estarem aprovadas.

1. Remover dependências e configurações de plataforma não utilizadas.
2. Estabilizar o ambiente local com PostgreSQL obrigatório.
3. Concluir as telas e fluxos previstos para o frontend.

## Fase 1 — Plataforma e dependências

O projeto deixará de usar o pacote de configuração do Lovable. A configuração
Vite/TanStack Start será nativa, voltada a Node.js, sem alvo Cloudflare. Serão
removidas referências a Lovable, Cloudflare, Wrangler e PGlite de dependências,
configuração, documentação e arquivos ignorados, quando não forem necessárias
ao desenvolvimento local.

## Fase 2 — Ambiente local seguro

O Docker Compose continuará fornecendo PostgreSQL local. A aplicação exigirá
`DATABASE_URL` e interromperá sua inicialização se o banco não puder ser
alcançado. Para desenvolvimento, `.env.example` documentará `admin` e `admin`
como credenciais de provisionamento, mas a interface e os logs não as exibirão.

Esta fase inclui a validação completa e normalização de CPF, validação de
assinatura dos arquivos enviados, migração de APIs obsoletas, eliminação dos
erros de lint e ampliação dos testes automatizados.

## Fase 3 — Frontend completo

O frontend existente será completado sem alterar a identidade visual atual.
Serão criadas as rotas de Planos e Faturas previstas no menu, incluindo:

- cadastro, edição e ativação de planos;
- listagem de faturas por situação e mês;
- geração mensal de faturas e baixa de pagamento;
- ações navegáveis no painel para titulares e faturas;
- estados de carregamento, vazio, erro, validação e responsividade em todos os
  fluxos principais.

## Decisões aprovadas

- A aplicação será executada localmente como servidor Node.js durante o
  desenvolvimento. O deploy em VPS será uma etapa posterior.
- PostgreSQL é obrigatório. Uma indisponibilidade do banco deve impedir a
  aplicação de iniciar; não haverá banco alternativo local.
- Os contratos ficarão em diretório local configurável por `UPLOAD_DIR`; no
  futuro, esse diretório será mapeado para volume persistente na VPS.
- O primeiro administrador é criado somente quando `ADMIN_EMAIL` e
  `ADMIN_PASSWORD` estão definidos. Para desenvolvimento local, os valores
  documentados serão `admin` e `admin`.
- A interface nunca exibe nem preenche credenciais.

## Arquitetura de execução

O build deixará de ter como alvo Cloudflare e será produzido para ambiente
Node. Localmente, a conexão PostgreSQL usará o serviço definido no
`docker-compose.yml` ou uma instância PostgreSQL instalada na máquina. Em
produção futura, usará `DATABASE_URL` da VPS e SSL só poderá ser habilitado
com validação normal de certificado. O diretório de uploads local será
substituído por volume persistente na etapa de deploy.

Não haverá PGlite, fallback automático de banco, nem configuração de deploy
específica de Lovable ou Cloudflare no código de produção.

## Autenticação e administração

As sessões existentes continuam usando cookie HTTP-only, `sameSite=lax` e
`secure` em produção. O token da sessão será armazenado como hash no banco,
de forma que uma exposição do banco não reutilize sessões ativas.

O provisionamento do administrador será explícito: se o banco não tiver
usuários e as variáveis do administrador estiverem ausentes, a inicialização
falhará com mensagem operacional clara. Não haverá senha codificada no
repositório, nos logs ou na tela de login.

## Dados e regras de negócio

CPF de titular e beneficiário será normalizado para 11 dígitos e validado
pelos dígitos verificadores antes da persistência. CPF inválido, sequência
repetida e duplicidade serão recusados. O banco aplicará unicidade para CPF
de beneficiário quando informado.

Operações de cadastro continuarão parametrizadas. A geração de faturas e o
limite de beneficiários serão protegidos por transação onde houver risco de
concorrência.

## Contratos digitalizados

O envio aceitará PDF, JPEG, PNG e WebP até 20 MB. Além do MIME declarado,
o servidor verificará a assinatura do conteúdo antes de gravar o arquivo.
Nomes físicos continuarão aleatórios; downloads usarão `nosniff`, cache
privado e anexo por padrão para reduzir execução no navegador.

## Qualidade e compatibilidade

As Server Functions migrarão de `inputValidator` para `validator`. O projeto
terá testes unitários para credenciais de bootstrap, validação de CPF,
política de arquivos e comportamento de falha de banco. A configuração de
formatação será ajustada para não reprovar arquivos CRLF no Windows; os erros
restantes de tipo e formatação serão corrigidos.

## Critérios de aceite

1. Não há credencial padrão no código de execução, logs ou tela de login.
2. Sem `DATABASE_URL` ou sem conexão PostgreSQL, a aplicação falha de forma
   explícita e não cria banco alternativo.
3. Execução e build Node locais concluem sem referência operacional a
   Cloudflare ou Lovable.
4. CPF inválido não é persistido e CPF normalizado duplicado é recusado.
5. Arquivo com MIME falso é recusado antes de ser gravado.
6. Lint, testes e build passam sem erros; avisos de APIs obsoletas são
   removidos.
7. Não há dependência, configuração ou fluxo de execução destinado a Lovable,
   Cloudflare, Wrangler ou PGlite.
8. As telas de Planos e Faturas funcionam de ponta a ponta com as Server
   Functions existentes, e os atalhos do painel levam ao fluxo correto.
