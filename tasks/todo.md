# Instalador Windows final — acompanhamento

## Etapa 1 — Estado, versão e diagnóstico

- [x] Criar testes de regressão do estado e identificação do build.
- [x] Simplificar a gravação e estruturar logs por execução/etapa.
- [x] Verificar em diretório temporário e fazer commit.

## Etapa 2 — Desinstalação completa e independente

- [ ] Garantir por teste que desinstalar não copia para `Program Files`.
- [ ] Executar o removedor a partir de `%TEMP%`.
- [ ] Parar somente processos privados e apagar diretórios autorizados/atalho.
- [ ] Persistir log externo e comprovar ausência dos alvos.
- [ ] Compilar e fazer commit.

## Checkpoint 1

- [ ] Estado repetido passa.
- [ ] Desinstalação temporária passa.
- [ ] Inno Setup compila.

## Etapa 3 — Base de programas e arquivos

- [ ] Validar espaço, internet, arquitetura e elevação.
- [ ] Testar manifesto, tamanhos, hashes e ZIP seguro.
- [ ] Validar Node.js, PostgreSQL e aplicação privados.
- [ ] Fazer commit.

## Etapa 4 — GitHub Releases

- [ ] Auditar pacote, allowlist e ausência de conteúdo pessoal.
- [ ] Confirmar origem do GitHub e ativo imutável.
- [ ] Testar atualização manual na abertura.
- [ ] Fazer commit.

## Checkpoint 2

- [ ] Downloads e hashes passam.
- [ ] Runtime corresponde ao manifesto.
- [ ] Nenhum runtime/serviço global é usado.

## Etapa 5 — PostgreSQL e banco

- [ ] Testar porta 54329, SCRAM, loopback, DPAPI e ACLs.
- [ ] Confirmar que logs não contêm segredos.
- [ ] Confirmar consulta SQL antes de avançar.
- [ ] Fazer commit.

## Etapa 6 — Aplicação, saúde e atalho

- [ ] Testar ordem PostgreSQL → aplicação → saúde.
- [ ] Validar `/api/health` com versão e banco.
- [ ] Criar e conferir atalho no Desktop informado.
- [ ] Fazer commit.

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
