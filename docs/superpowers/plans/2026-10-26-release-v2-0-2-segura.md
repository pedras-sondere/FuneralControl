# Atualização segura v2.0.2

> **Para execução:** seguir este plano na ordem indicada, preservando a base PostgreSQL, os arquivos enviados e os três destinos de backup já configurados.

**Objetivo:** publicar a versão `2.0.2` como uma atualização pequena e segura para a instalação local que está em uso. Ela corrige a geração de backup PostgreSQL no computador instalado e garante que dados permanentes não dependam de uma pasta versionada do aplicativo.

**Escopo:** somente manutenção, backup, inicialização e distribuição da atualização. A substituição de Faturas por Gestão está explicitamente fora desta versão e será feita pelo plano separado.

## Restrições globais

- Nunca apagar ou recriar a base PostgreSQL existente durante uma atualização.
- Nunca sobrescrever, mover sem validação ou excluir documentos já enviados.
- Preservar as três configurações de backup e o histórico de execuções.
- Manter atualização opcional: consulta ao GitHub somente ao iniciar o programa; instalação apenas após o gestor clicar no aviso.
- Usar um runtime novo em paralelo, validá-lo e só então marcá-lo como ativo.
- Não publicar uma release se os artefatos, hash e testes não forem conferidos.

## Foco da revisão

- O `pg_dump.exe` deve vir do PostgreSQL privado instalado, não da variável global `Path` do Windows.
- A atualização não pode tornar inacessível um documento armazenado em uma versão anterior do aplicativo.
- A release estável precisa obedecer exatamente ao formato que o verificador local aceita: tag `v2.0.2`, ativo `FuneralControl-runtime-2.0.2.zip` e `SHA256: <hash>` no corpo da release.
- Confirmar que a aplicação mantém a compatibilidade com o esquema de banco atual antes de divulgar a atualização.

## Etapa 1 — Corrigir o backup PostgreSQL privado

**Arquivos:**
- Modificar: `src/lib/backup-service.server.ts`
- Criar: `src/test/postgres-dump.test.ts`
- Validar sem regressão: `src/test/backup-service.test.ts`

1. Escrever os testes primeiro, injetando o executor de processos para provar os três cenários: instalação local usa `runtime/postgresql/bin/pg_dump.exe`; desenvolvimento mantém o comando `pg_dump`; ausência do executável retorna uma mensagem em pt-BR compreensível.
2. Alterar `createPostgresDump` para resolver o executável a partir de `FUNERALCONTROL_INSTALL_ROOT`, quando essa variável existir. O caminho deve usar `path.join` e nunca concatenar comandos em texto.
3. Converter exclusivamente o erro `ENOENT` em instrução de diagnóstico; preservar o erro genérico para falha real do dump.
4. Executar: `npx vitest run src/test/postgres-dump.test.ts src/test/backup-service.test.ts`.

## Etapa 2 — Tornar documentos independentes da versão do aplicativo

**Arquivos:**
- Modificar: `scripts/Start-FuneralControlV2.ps1`
- Modificar: `scripts/Update-FuneralControlV2.ps1`
- Modificar, se necessário, `src/lib/storage.server.ts`
- Criar: testes unitários do resolvedor/migração de diretório de uploads em `src/test/`

1. Definir o diretório permanente de uploads pelo valor protegido já gravado em `C:\ProgramData\FuneralControl\v2`, e exportá-lo como `UPLOAD_DIR` ao iniciar o Node.js.
2. Antes da ativação de `2.0.2`, detectar apenas os diretórios legados de uploads que pertençam ao próprio FuneralControl e que estejam abaixo de `C:\Program Files\FuneralControl\app`.
3. Copiar os arquivos legados para o diretório permanente, preservando nomes; para cada arquivo, comparar tamanho e SHA-256 antes de considerar a cópia válida. Em colisão diferente, interromper a atualização sem apagar a origem.
4. Manter os arquivos antigos intactos nesta versão. A limpeza só poderá ocorrer em uma futura manutenção, após confirmação explícita e backup validado.
5. Registrar no log de atualização quantos arquivos foram encontrados, copiados, já existentes e verificados, sem expor dados pessoais.
6. Criar testes para: origem vazia; cópia válida; arquivo idêntico já presente; colisão divergente; origem fora do diretório permitido.

## Etapa 3 — Conferir o mecanismo de atualização

**Arquivos:**
- Modificar/testar: `src/lib/github-releases.server.ts`
- Validar: `src/components/app-layout.tsx`, `src/components/update-notice.tsx`, `scripts/Update-FuneralControlV2.ps1`
- Criar/atualizar: testes de parser em `src/test/`

1. Manter uma única consulta ao endpoint de releases por abertura da aplicação, com falha silenciosa quando não houver internet.
2. Confirmar por teste que release de pré-lançamento, versão inválida, ativo com nome divergente ou hash ausente não aparece como atualização.
3. Confirmar por teste que uma release estável `v2.0.2`, com ativo e hash corretos, aparece e só inicia a atualização por ação manual.
4. Verificar que o atualizador executa o backup local prévio, valida o ZIP e hash, preserva `C:\ProgramData\FuneralControl\v2`, e só altera a versão ativa depois da validação completa.

## Etapa 4 — Produzir e verificar o runtime 2.0.2

**Arquivos:**
- Modificar: `package.json` e `package-lock.json`
- Usar: scripts de empacotamento já existentes em `scripts/`
- Gerar fora do controle de versão: `release/FuneralControl-runtime-2.0.2.zip` e metadados de hash

1. Atualizar a versão do pacote para `2.0.2`.
2. Executar os testes diretamente ligados à alteração e `npm run build`.
3. Criar o runtime ZIP sem `.env`, banco, uploads, logs, backups, chaves, credenciais ou dados de máquina.
4. Calcular SHA-256 e tamanho final do ZIP; validar o metadado contra o arquivo final, não contra um artefato intermediário.
5. Conferir que o runtime declara compatibilidade com o esquema de banco já instalado; esta release não deve exigir recriação de banco.

## Etapa 5 — Publicar e atualizar sem risco

**Arquivos/processo:**
- Branch de trabalho atual: `codex/installer-v2-rebuild`
- Destino: `main`
- GitHub Release estável: `v2.0.2`

1. Revisar o diff, incluindo somente a correção de backup, persistência de uploads, testes e documentação da release.
2. Criar commit atômico e abrir PR de `codex/installer-v2-rebuild` para `main`; não incluir o arquivo local não rastreado `GEMINI.md`.
3. Após revisão e merge, publicar a release estável `v2.0.2` com o ZIP anexado e a linha exata `SHA256: <hash-em-minúsculas>` no texto da release.
4. Testar em uma cópia controlada da instalação: abrir o sistema, conferir o aviso, iniciar manualmente a atualização, autenticar, gerar backup externo, abrir documento existente e criar novo registro de titular.
5. Só então orientar a instalação em uso a aplicar o aviso manual de atualização; não é necessário reinstalar nem desinstalar.

## Critérios de aceite

- O backup para HD externo deixa de apresentar `spawn pg_dump ENOENT` sem depender de alteração manual no `Path` do Windows.
- Banco, usuários, contratos, anexos e backups anteriores permanecem acessíveis depois da atualização.
- Falha de rede, hash, cópia de arquivo ou backup prévio impede ativação parcial e mantém a versão anterior utilizável.
- O aviso de atualização aparece apenas para uma release estável, válida e mais recente, e só instala após clique do gestor.
