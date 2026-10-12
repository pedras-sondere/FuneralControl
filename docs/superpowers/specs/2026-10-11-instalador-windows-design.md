# Instalador Windows pela internet — Design

## Objetivo

Entregar o FuneralControl como aplicação local para um único computador Windows. O gestor utiliza apenas o atalho `FuneralControl`; a aplicação abre em `localhost` no navegador e mantém PostgreSQL, documentos e backups no próprio computador.

## Escopo

O instalador `.exe` será executado uma vez com permissão de administrador. Ele verifica os pré-requisitos, baixa instaladores oficiais do Node.js LTS e PostgreSQL, instala o FuneralControl, cria o banco local e registra o atalho de uso diário.

Não haverá hospedagem, VPS, conta em nuvem, OAuth ou acesso externo ao banco.

## Componentes

### Instalador

Um instalador Windows (Inno Setup ou NSIS, definido na implementação) orquestra um script PowerShell assinado/embutido. Antes de alterar o computador, ele valida Windows compatível, conectividade, espaço em disco, elevação administrativa e disponibilidade dos URLs oficiais.

### Dependências instaladas

- Node.js LTS, obtido do distribuidor oficial;
- PostgreSQL compatível, obtido do distribuidor oficial;
- aplicativo FuneralControl e suas dependências de produção;
- `pg_dump`, fornecido com PostgreSQL e exigido para os backups ZIP.

As versões e URLs ficam centralizadas em um manifesto versionado, permitindo atualização controlada sem alterar a lógica do instalador.

### Banco de dados

O instalador cria o banco `funeralcontrol` e o usuário técnico exclusivo `funeralcontrol_app`. A senha é fixa, forte e interna ao instalador; não é o login do gestor, não aparece na interface e não é apresentada em mensagens de erro.

O arquivo `.env` fica em diretório de dados local protegido por permissões do Windows. Ele contém a conexão do banco e as credenciais administrativas iniciais. Nenhum dado é enviado para fora do computador.

### Uso diário

O atalho `FuneralControl` chama o lançador local. Ele verifica/inicia PostgreSQL quando necessário, inicia o servidor do sistema, aguarda `localhost` responder e abre o navegador. O encerramento normal realiza o backup configurado e encerra a sessão.

## Fluxo de instalação

1. Exibir requisitos e solicitar confirmação/elevação administrativa.
2. Validar internet, disco e incompatibilidades de instalação.
3. Baixar e validar os instaladores oficiais por URL, versão e hash publicado quando disponível.
4. Instalar Node.js e PostgreSQL silenciosamente.
5. Criar usuário técnico, banco e estrutura inicial do FuneralControl.
6. Instalar os arquivos do aplicativo e gerar configuração local.
7. Criar o atalho único `FuneralControl` no menu Iniciar e/ou área de trabalho.
8. Testar conexão PostgreSQL e abertura local antes de informar sucesso.

## Falhas e recuperação

- Falha de download, ausência de internet, falta de espaço ou falta de permissão interrompe a instalação com mensagem clara e sem apagar dados já existentes.
- Se uma dependência já estiver instalada em versão compatível, ela será reutilizada.
- Se PostgreSQL não iniciar ou o banco não puder ser criado, o atalho não é finalizado como pronto; o instalador apresenta ação de correção ou reexecução.
- Reexecutar o instalador é idempotente: preserva banco, documentos, configurações e backups existentes.

## Segurança

- O banco aceita apenas conexões locais.
- A senha do banco não é mostrada na interface ou nos logs comuns.
- O instalador baixa apenas URLs oficiais definidos no manifesto.
- Backups continuam em ZIP validado e permanecem sob controle das pastas escolhidas pelo gestor.

## Testes de aceitação

- Em computador sem Node.js/PostgreSQL, o instalador baixa e configura tudo, depois abre o sistema pelo atalho.
- Em computador com versões compatíveis, o instalador não remove nem reinstala dados desnecessariamente.
- Sem internet, ele falha antes de modificar a instalação e informa o motivo.
- Após instalar, o aplicativo conecta ao PostgreSQL local e gera backup contendo dump válido.
- Uma reinstalação preserva titulares, documentos e histórico de backup.
