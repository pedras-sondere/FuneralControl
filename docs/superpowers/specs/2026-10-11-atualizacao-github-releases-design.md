# Atualização local por GitHub Releases — Design

## Objetivo

Permitir atualizar o programa FuneralControl instalado localmente a partir de versões publicadas no GitHub Releases, sem transformar o sistema em serviço online e sem tocar nos dados do gestor.

## Comportamento

- O aplicativo consulta a última release somente uma vez a cada abertura do FuneralControl.
- A consulta é curta e não bloqueia a abertura: sem internet, erro no GitHub ou resposta inválida apenas suprimem o aviso daquela abertura.
- Quando a versão publicada for mais nova que a instalada, o gestor vê um aviso discreto com versão, notas e botão `Atualizar sistema`.
- A atualização começa apenas após ação manual explícita do gestor.

## Distribuição

Cada release do repositório `pedras-sondere/FuneralControl` contém:

- identificador de versão semântico, como `v1.0.1`;
- notas de atualização em português;
- pacote do aplicativo/atualizador para Windows;
- hash SHA-256 do pacote publicado no mesmo release.

O aplicativo consulta a API pública de releases do GitHub usando HTTPS. Não utiliza token, não envia dados do cliente e não baixa código diretamente de branches.

## Fluxo de atualização

1. Ao iniciar, o lançador lê a versão local em arquivo de manifesto instalado.
2. Em segundo plano, consulta a última release estável do GitHub.
3. Se houver versão mais nova, mostra aviso; caso contrário, não faz nada.
4. Após o clique do gestor, o atualizador cria um backup local ZIP validado.
5. Baixa o pacote da release para área temporária e confere o SHA-256 publicado.
6. Fecha somente o processo local do FuneralControl, substitui os arquivos do aplicativo e reinicia pelo atalho.

## Proteção de dados

O atualizador só pode alterar a pasta de código do aplicativo. Ele nunca altera ou remove:

- banco PostgreSQL `funeralcontrol`;
- documentos enviados e cópias assinadas;
- arquivo local de configuração e identidade da empresa;
- pastas de backup e histórico de execuções.

Antes de substituir arquivos, um backup local validado é obrigatório. Se ele falhar, a atualização não inicia.

## Falhas e recuperação

- Sem internet, GitHub indisponível ou release inválida: aplicação segue na versão atual sem alerta de erro técnico ao gestor.
- Hash divergente: pacote é descartado, arquivos atuais não são alterados e o gestor recebe mensagem clara.
- Falha de download ou substituição: arquivos atuais são preservados; se já houve substituição parcial, o atualizador restaura a cópia temporária anterior.
- Reexecução é segura: uma atualização já aplicada não volta a ser oferecida.

## Segurança e privacidade

- Apenas GitHub Releases HTTPS do repositório configurado são aceitos.
- O cliente não transmite dados do banco, documentos, empresa ou usuários.
- Nenhum token do GitHub é necessário no computador local.
- O pacote é aceito somente quando a versão e hash correspondem à release consultada.

## Testes de aceitação

- Uma versão local inferior exibe aviso uma única vez na abertura.
- Sem internet, o sistema abre normalmente sem repetição de tentativas.
- Clique do gestor dispara backup válido antes do download.
- Hash inválido não altera nenhum arquivo da instalação.
- Atualização bem-sucedida reinicia a nova versão e preserva banco, documentos, configurações e backups.
