# Plano de implementação: instalador Windows final do FuneralControl

## Objetivo

Reconstruir o instalador como um assistente único de instalação e desinstalação, com etapas isoladas, logs distintos, runtimes privados de Node.js e PostgreSQL, aplicação obtida de GitHub Releases, banco local validado e atalho criado somente depois que a aplicação responder com saúde.

O artefato final terá versão e nome próprios e imutáveis. Não será substituído sob a mesma URL, evitando cache de builds antigos.

## Diagnóstico confirmado

- O mesmo nome, versão e URL do instalador foram sobrescritos várias vezes no GitHub, permitindo reutilização de um arquivo antigo pelo cache.
- O fluxo atual de desinstalação copia arquivos para `Program Files` antes de tentar apagar esse mesmo diretório.
- A desinstalação apaga somente `C:\ProgramData\FuneralControl\v2`, deixando resíduos no diretório pai.
- Não existe log persistente da desinstalação fora da pasta removida; o assistente mostra apenas mensagem genérica.
- O estado usa troca de arquivo desnecessariamente complexa e a falha atual ocorre antes de download, banco ou atalho.
- O atalho só é criado no final. Sua ausência é consequência das falhas anteriores.

## Decisões

- O assistente mostrará **Instalação** e **Desinstalação completa** antes de avançar.
- Na desinstalação, somente o removedor será extraído para `%TEMP%`; nenhum arquivo será instalado antes da remoção.
- A remoção encerrará apenas processos privados do FuneralControl e apagará os alvos confirmados: `C:\Program Files\FuneralControl`, `C:\ProgramData\FuneralControl` e o atalho.
- Logs técnicos ficarão em `C:\ProgramData\FuneralControl-Installer\logs`, fora dos diretórios apagados e sem segredos.
- Cada execução terá identificador, versão do instalador, operação e etapa. Erros indicarão a etapa e o caminho exato do log.
- A instalação seguirá: pré-verificação → downloads/hashes → runtimes privados → aplicação/GitHub → PostgreSQL → saúde → atalho → conclusão.
- O Desktop será passado pelo assistente elevado e o atalho será conferido após ser salvo.
- Cada release candidata usará versão e nome de arquivo únicos. Um ativo publicado não será sobrescrito.

## Etapa 1 — Estado, versão e diagnóstico

Arquivos previstos: módulo comum, instalador PowerShell e testes de estado/bootstrap.

Aceite:

- Criar e sobrescrever o estado repetidamente sem colisão.
- Primeiro registro contendo build, operação e identificador da execução.
- Falhas com etapa, tipo e mensagem sanitizada.

Verificação: testes focados e execução repetida em diretório temporário real.

## Etapa 2 — Desinstalação completa e independente

Arquivos previstos: Inno Setup, removedor e testes de limpeza/empacotamento.

Aceite:

- Operações com nomenclatura distinta.
- Desinstalação sem instalar ou sobrescrever arquivos do programa.
- Removedor executado de `%TEMP%`, parando só processos privados, removendo os dois diretórios autorizados e o atalho.
- Log externo preservado e comprovação de que os alvos deixaram de existir.

Verificação: testes de caminhos, cenário em raiz temporária e compilação Inno.

## Etapa 3 — Base de programas e arquivos privados

Arquivos previstos: instalador, módulo comum, manifesto e testes do manifesto.

Aceite:

- Node.js, PostgreSQL e runtime baixados somente de URLs HTTPS permitidas.
- Tamanho e SHA-256 validados antes da extração.
- Extração em staging bloqueando caminhos externos e entradas duplicadas.
- Nenhum Docker, PATH, serviço global, Node global ou `npm install` no cliente.

Verificação: testes de manifesto, hash, ZIP, estrutura, espaço, arquitetura e privilégios.

## Etapa 4 — GitHub Releases e identidade do aplicativo

Arquivos previstos: manifesto, empacotador, consulta de releases e testes de runtime/update.

Aceite:

- Runtime exato vindo de `pedras-sondere/FuneralControl`.
- Pacote sem código-fonte, `.env`, chaves ou dependências de desenvolvimento.
- Atualização manual consultada somente na abertura e sem token do GitHub.
- Versões do runtime, manifesto e saúde coerentes.

Verificação: allowlist do ZIP, testes de release/update e SHA-256 remoto.

## Etapa 5 — PostgreSQL privado e banco local

Arquivos previstos: configuração do banco, módulo comum, launcher e testes do PostgreSQL.

Aceite:

- Cluster privado em `127.0.0.1:54329`, UTF-8 e SCRAM.
- Nenhuma senha em texto, argumento, estado ou log.
- Configuração protegida por DPAPI e ACLs da conta autorizada, SYSTEM e Administradores.
- Consulta SQL confirmada antes de avançar.

Verificação: testes de segurança e inicialização/consulta/parada em dados temporários.

## Etapa 6 — Aplicação, saúde e atalho

Arquivos previstos: launcher, instalador, comando de abertura e testes do launcher.

Aceite:

- Ordem PostgreSQL → aplicação → saúde.
- `/api/health` confirmando aplicação, versão e banco.
- Atalho no Desktop correto somente após saúde aprovada.
- Existência, destino e abertura do atalho conferidos antes da conclusão.

Verificação: testes do launcher/atalho e abertura real no localhost.

## Etapa 7 — Release candidata e aceite final

Arquivos previstos: Inno Setup, documentação e testes de pacote.

Aceite:

- Nome e versão únicos no executável, interface, log e GitHub Release.
- Lint sem erros, testes focados/completos, build e Inno aprovados.
- Release imutável; correção futura gera nova versão e ativo.
- Matriz em Windows limpo cobrindo remoção, instalação, banco, saúde, atalho, abertura, reinício e atualização.

Verificação: SHA-256 local/remoto e instalação limpa real antes de declarar final.

## Ordem

1. Estado, logs e versão.
2. Desinstalação independente.
3. Downloads e extração.
4. GitHub/runtime.
5. PostgreSQL/banco.
6. Saúde/atalho.
7. Release candidata e matriz real.

Cada etapa depende das anteriores e termina com testes e commit próprio.

## Riscos

| Risco | Mitigação |
|---|---|
| Cache usar build antigo | Nome/versionamento imutáveis e build ID no primeiro log |
| Processo manter arquivo bloqueado | Removedor em `%TEMP%`, parada e verificação antes de apagar |
| Elevação em outra conta | Verificação de identidade e Desktop passado pelo assistente |
| Resíduo ser tratado como instalação válida | Marcador de propriedade e fases verificáveis |
| Log ser apagado com os dados | Log externo em `FuneralControl-Installer\logs` |
| Publicação prematura | Release candidata bloqueada até matriz limpa aprovada |

## Critério de conclusão

O executável será **candidato final** após todas as verificações automatizadas. A denominação **versão final aprovada** exige instalação limpa bem-sucedida no computador de teste, PostgreSQL operacional, aplicação saudável e atalho abrindo o localhost.
