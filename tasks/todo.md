# Instalador Windows final — acompanhamento

## Etapa 1 — Estado, versão e diagnóstico

- [x] Criar testes de regressão do estado e identificação do build.
- [x] Simplificar a gravação e estruturar logs por execução/etapa.
- [x] Verificar em diretório temporário e fazer commit.

## Etapa 2 — Desinstalação completa e independente

- [x] Garantir por teste que desinstalar não copia para `Program Files`.
- [x] Executar o removedor a partir de `%TEMP%`.
- [x] Parar somente processos privados e apagar diretórios autorizados/atalho.
- [x] Persistir log externo e comprovar ausência dos alvos.
- [x] Compilar e fazer commit.

## Checkpoint 1

- [x] Estado repetido passa.
- [x] Desinstalação temporária passa.
- [x] Inno Setup compila.

## Etapa 3 — Base de programas e arquivos

- [x] Validar espaço, internet, arquitetura e elevação.
- [x] Testar manifesto, tamanhos, hashes e ZIP seguro.
- [x] Validar Node.js, PostgreSQL e aplicação privados.
- [x] Fazer commit.

## Etapa 4 — GitHub Releases

- [x] Auditar pacote, allowlist e ausência de conteúdo pessoal.
- [ ] Confirmar origem do GitHub e ativo imutável.
- [x] Testar atualização manual na abertura.
- [x] Fazer commit.

## Checkpoint 2

- [ ] Downloads e hashes passam.
- [x] Runtime corresponde ao manifesto.
- [x] Nenhum runtime/serviço global é usado.

## Etapa 5 — PostgreSQL e banco

- [x] Testar porta 54329, SCRAM, loopback, DPAPI e ACLs.
- [x] Confirmar que logs não contêm segredos.
- [ ] Confirmar consulta SQL antes de avançar.
- [x] Fazer commit.

## Etapa 6 — Aplicação, saúde e atalho

- [x] Testar ordem PostgreSQL → aplicação → saúde.
- [x] Validar `/api/health` com versão e banco.
- [ ] Criar e conferir atalho no Desktop informado.
- [x] Fazer commit.

## Checkpoint 3

- [ ] Banco responde.
- [ ] Aplicação responde.
- [ ] Atalho existe e abre localhost.

## Etapa 7 — Release candidata e aceite

- [ ] Gerar versão/nome únicos e imutáveis.
- [ ] Executar lint, testes, build e Inno.
- [ ] Auditar segredos e conteúdo do pacote.
- [ ] Publicar candidato com SHA-256 verificado.
- [ ] Executar matriz em Windows limpo.
- [ ] Marcar como final somente após instalação real aprovada.
