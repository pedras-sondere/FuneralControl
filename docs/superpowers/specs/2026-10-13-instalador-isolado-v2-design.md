# Instalador Windows isolado v2 — Design

## Decisão aprovada

O FuneralControl continua sendo um sistema local para **um computador e uma
única conta Windows autorizada**. O atalho abre o sistema no navegador em
`localhost`. O PostgreSQL próprio do FuneralControl inicia junto com o sistema
e é encerrado de forma segura ao sair ou quando a sessão expira; ele não será
registrado como serviço permanente do Windows.

Esta versão substitui o modelo anterior que procurava Node.js, `psql.exe` e
serviços PostgreSQL instalados globalmente. A linha v1 fica congelada para
diagnóstico: ela não deve ser usada em novas instalações.

## Objetivo

Entregar um instalador pela internet que conclua uma instalação local
reproduzível, sem depender de Docker, `winget`, PATH, Node.js existente,
PostgreSQL existente ou `npm ci` no computador do cliente. O resultado só é
considerado instalado quando o atalho abre uma aplicação saudável conectada ao
seu banco local isolado.

O instalador não promete apagar ou reparar automaticamente instalações v1
parciais nem qualquer PostgreSQL externo. Essas situações precisam ser
identificadas, preservadas e diagnosticadas antes de uma ação explícita.

## Limites do escopo

- Windows 10/11 x64, acesso administrativo para instalar em `Program Files` e
  conexão com a internet na instalação inicial.
- Um único usuário Windows autorizado, o mesmo usuário que executa a instalação
  elevada. Executar como credenciais de outro usuário não é um fluxo suportado.
- PostgreSQL continua obrigatório, mas é uma distribuição privada do
  FuneralControl; Docker não participa do produto instalado.
- O login inicial da aplicação é `admin` / `admin`; na primeira entrada o
  sistema obriga a troca de senha antes de operações administrativas.
- Atualizações do sistema são verificadas somente na abertura, quando houver
  internet, e são aplicadas manualmente pelo gestor. Nenhuma atualização
  substitui dados, documentos ou backups.

## Arquitetura escolhida

### Componentes baixados e verificados

O instalador compacto contém um manifesto imutável com versão, URL HTTPS,
tamanho esperado e SHA-256 para cada artefato:

1. pacote binário ZIP oficial do PostgreSQL para Windows x64;
2. pacote ZIP oficial do Node.js para Windows x64;
3. pacote de runtime do FuneralControl produzido no pipeline de release.

O pacote de runtime contém a aplicação construída e todas as dependências de
produção necessárias. Portanto, o computador do cliente não executa `npm
install`, `npm ci`, `winget` nem instaladores opacos de terceiros.

O pacote é criado em uma área de staging por uma allowlist de runtime. Código
fonte, `.git`, documentação interna, caches, `.wrangler`, `.superpowers`,
arquivos de desenvolvimento e dependências de desenvolvimento não entram no
artefato instalado.

Todo download acontece numa área de staging. O hash e o tamanho são validados
antes da extração. Arquivos inválidos são descartados e a fase não é marcada
como concluída. Uma futura assinatura Authenticode do executável é desejável,
mas é uma etapa externa que exige certificado de assinatura de código; hashes
não a substituem.

### Layout isolado

```text
C:\Program Files\FuneralControl\
  launcher\                  # lançador controlado pelo produto
  runtime\node\              # Node portátil validado
  runtime\postgresql\        # binários PostgreSQL portáteis validados
  app\<versão>\              # runtime da aplicação, imutável por versão

C:\ProgramData\FuneralControl\v2\
  state\installation.json    # fases, versões, hashes, porta e SID autorizado
  postgres-data\             # cluster exclusivo do FuneralControl
  config\                    # configuração cifrada/protegida
  logs\                      # logs sanitizados
  staging\                   # downloads temporários e recuperáveis
  backups\                   # destino local padrão de backup
```

O diretório `v2` impede que a nova instalação modifique silenciosamente
resíduos da instalação v1. Se forem encontrados arquivos antigos, eles são
apenas relatados no diagnóstico; nunca são adotados, apagados ou usados como
fonte de senha.

### Banco de dados

- O launcher usa exclusivamente
  `runtime\\postgresql\\bin\\pg_ctl.exe`, `psql.exe`, `initdb.exe` e
  `pg_dump.exe` do caminho conhecido. Não pesquisa PATH, Registro, serviços ou
  `C:\\Program Files\\PostgreSQL`.
- O cluster é criado em `postgres-data` com autenticação SCRAM, UTF-8 e acesso
  apenas por loopback. Ele usa uma porta exclusiva do produto (proposta:
  `54329`), nunca a porta padrão `5432`.
- A senha inicial do administrador técnico do cluster é passada a `initdb` por
  arquivo temporário de uso único, e não pela linha de comando. Esse arquivo é
  removido após a inicialização e seu conteúdo nunca entra em logs.
- O instalador cria o banco `funeralcontrol` e o usuário técnico
  `funeralcontrol_app`. A aplicação usa somente esse usuário; migrações comuns
  não dependem de uma senha de superusuário persistida.
- A URL técnica de conexão fica cifrada por DPAPI para o SID Windows autorizado
  e é injetada apenas no ambiente do processo local iniciado pelo launcher. Não
  há `.env` com senha em texto simples em `Program Files` ou `ProgramData`.
- A configuração e as ACLs permitem leitura à conta autorizada, `SYSTEM` e
  Administradores locais apenas quando indispensável. Outro usuário comum do
  computador não pode ler a configuração nem iniciar uma cópia funcional do
  banco.

### Inicialização e encerramento

1. O atalho `FuneralControl` chama somente o launcher privado do produto.
2. O launcher confere o manifesto de instalação, a identidade do usuário e a
   disponibilidade da porta exclusiva.
3. Ele inicia o cluster privado com `pg_ctl`, aguarda uma consulta de saúde e
   só então inicia o Node privado e a aplicação em `127.0.0.1`.
4. Depois de receber a saúde HTTP esperada, abre o navegador local.
5. Ao sair, ao encerrar a sessão por inatividade ou ao escolher “Backup e
   Encerrar”, o fluxo de backup existente é executado e o launcher encerra
   somente os processos que ele próprio iniciou.

Se a porta exclusiva estiver ocupada por outro processo, o launcher não tenta
matá-lo: apresenta um diagnóstico com PID/processo e interrompe a abertura.

## Instalação retomável e reparo

`installation.json` registra uma máquina de estados, sem segredos:

```text
pré-verificado → baixado → hash-validado → runtime-extraído
→ cluster-inicializado → banco-configurado → app-validado
→ atalho-criado
```

Cada fase é idempotente e só avança após sua verificação. Ao reexecutar o
instalador, fases válidas são preservadas; uma fase incompleta é refeita no
staging. O atalho somente é criado ou substituído após o teste de banco e a
verificação HTTP local concluírem com sucesso.

O modo “Reparar” coleta versões, caminhos, hash do estado, porta, PID, serviço
eventualmente conflitante e última fase. Ele nunca mostra senhas, tokens,
conteúdo DPAPI, `DATABASE_URL` ou dumps de banco. Uma falha de rede, espaço,
hash ou permissão encerra antes de adotar componentes externos ou de marcar a
instalação como pronta.

## Atualizações

Na abertura, o aplicativo pode consultar a release mais recente do GitHub. A
interface apenas avisa o gestor; baixar e aplicar requer sua confirmação.

O atualizador baixa um manifesto de release assinado por Ed25519 e verifica a
assinatura com a chave pública embutida no launcher. O manifesto informa a
versão, compatibilidade de esquema, nome, tamanho e SHA-256 do pacote. A chave
privada de publicação fica fora do repositório, em segredo controlado do fluxo
de release. O hash por si só protege corrupção de transporte, mas não basta
para autenticar uma conta de publicação comprometida.

O atualizador baixa um pacote de aplicação versionado, valida assinatura, hash,
tamanho e allowlist de caminhos, extrai em staging e instala somente em
`app\\versions\\<versão>` após confirmar o encerramento do processo local. Ele
mantém a versão anterior para reversão se a saúde falhar e troca o ponteiro de
versão ativa apenas após o endpoint local confirmar a versão esperada.

Uma atualização normal só é aceita se declarar compatibilidade com o esquema
de banco ativo. Ela não pode executar migração automática que torne o rollback
inseguro. Mudanças de esquema, Node, PostgreSQL ou launcher são classificadas
como atualização de plataforma: exigem backup confirmado, aviso explícito e
instalador/assistente compatível separado.

Banco, documentos, configurações institucionais, arquivos assinados e backups
não ficam no pacote atualizável e não podem ser substituídos pelo processo de
update.

## Compatibilidade com instalações anteriores

- PostgreSQL, Node.js e Docker preexistentes são ignorados; eles não são
  reutilizados, parados, reconfigurados ou desinstalados.
- Uma instalação v1 parcial em `ProgramData\\FuneralControl` é preservada e
  reportada como legado. A v2 só usa o subdiretório `v2` com manifesto próprio.
- A migração de dados de uma instalação v1 comprovadamente saudável, se
  necessária no futuro, será uma ferramenta explícita com backup e confirmação;
  não faz parte do bootstrap.

## Critérios de aceitação

Antes de publicar como release final, a matriz abaixo deve ser registrada em
Windows limpo ou VM descartável:

1. instalação limpa sem Node/PostgreSQL/Docker, com criação do atalho e abertura
   saudável;
2. computador com Node e PostgreSQL externos, inclusive um PostgreSQL na porta
   5432, sem alteração desses componentes;
3. falta de internet, URL indisponível, hash divergente e falta de espaço,
   todos sem criar atalho “pronto” nem corromper estado;
4. interrupção durante download, extração, inicialização do banco e criação do
   banco, seguida de reexecução e recuperação segura;
5. reinicialização do Windows, nova abertura pelo atalho, encerramento por
   inatividade e backup/encerramento;
6. atualização manual de aplicativo, reversão após falha de saúde e preservação
   de dados, inclusive recusa de pacote sem assinatura válida, com hash
   divergente ou que tente escrever fora de `app\\versions`;
7. tentativa por outra conta Windows, que deve falhar sem expor configuração;
8. desinstalação e reinstalação preservando dados, documentos e backups;
9. verificação manual de que logs e diagnósticos não contêm senha, URL de banco
   ou conteúdo de backup;
10. inspeção do pacote de instalação para confirmar que não carrega árvore de
    desenvolvimento, fontes, caches ou dependências de desenvolvimento.

“100% finalizado” só poderá ser declarado depois da automação aplicável e dessa
matriz manual em ambiente limpo. O instalador não deve ser liberado com base
apenas em testes no computador de desenvolvimento.
