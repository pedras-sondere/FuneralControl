# Modo local, ciclo de sessão e backup — Design

## Objetivo

Operar o FuneralControl em apenas um computador, sem publicação online. Um único atalho chamado `FuneralControl` inicia os serviços locais e abre o sistema no navegador. O sistema protege os dados por backups compactados e encerra sua execução automaticamente ao sair ou após duas horas sem uso.

## Premissas aprovadas

- PostgreSQL continua local e obrigatório.
- A interface continua no navegador, acessada somente por `localhost`.
- O único ponto de entrada do usuário é o atalho `FuneralControl`.
- Um encerramento por `Sair` ou duas horas de inatividade executa backup e encerra os serviços locais.
- O backup reúne banco PostgreSQL, documentos, cópias assinadas, logotipo, configurações e manifesto de integridade.
- O pacote será ZIP, por ser aberto e não depender de licença ou programa adicional.

## Inicialização e encerramento

O atalho inicia PostgreSQL quando necessário, sobe o servidor do FuneralControl e abre a página local no navegador. Cada inicialização cria uma sessão de trabalho.

Uma interação relevante do usuário reinicia o contador de inatividade. Aos 105 minutos o sistema alerta que a sessão termina em 15 minutos. Aos 120 minutos, ou quando o usuário clicar em `Sair`, o sistema bloqueia novas ações, executa o backup automático e encerra a aplicação local ao fim da rotina. Uma operação de backup já iniciada pode terminar antes do encerramento.

Após esse ponto, o sistema não volta a operar pela página ainda aberta: o usuário precisa abrir novamente o atalho `FuneralControl`.

## Três destinos de backup

### 1. Cópia local

O sistema mantém uma cópia ZIP em uma pasta local configurada na instalação. Esta cópia é obrigatória em cada encerramento e é a primeira a ser produzida.

### 2. Pasta sincronizada em nuvem

Nas configurações, o usuário seleciona uma pasta local já sincronizada por Google Drive, OneDrive, Dropbox ou serviço equivalente. O FuneralControl grava e valida o ZIP nessa pasta; o aplicativo de sincronização instalado no computador é responsável pelo envio à nuvem. Não haverá login OAuth nem dependência de API externa.

### 3. HD externo

O usuário informa uma pasta no HD externo e aciona explicitamente a opção de realizar o backup externo quando a unidade estiver conectada. O sistema valida o ZIP e registra a data/hora de sucesso. O controle é feito exclusivamente por essa última data válida, portanto o HD pode permanecer desconectado entre cópias.

O prazo máximo entre backups externos válidos é de 10 dias. Antes do vencimento, a interface mostra a data e o período restante. Vencido o prazo, a aplicação inicia em modo de consulta e backup: impede cadastros, edições, exclusões, emissões documentais e ações financeiras até que uma nova cópia externa seja concluída.

## Validação, histórico e alertas

Todo ZIP contém um manifesto com versão do sistema, data/hora, lista de conteúdo, tamanhos e hashes. Após criar cada pacote, o sistema confirma sua leitura e integridade antes de registrá-lo como concluído.

Será armazenado um histórico por destino com início, fim, resultado, caminho, tamanho, hash e mensagem de falha. A tela principal exibirá o estado das três frentes. Falha em qualquer destino gera alerta persistente no próximo uso e durante a sessão. A falha da cópia local ou nuvem não bloqueia imediatamente; a falha do HD externo somente leva ao bloqueio quando ultrapassa os 10 dias desde a última cópia externa válida.

## Segurança e recuperação

Não haverá envio de dados a um servidor da aplicação. Os arquivos permanecem no computador, na pasta sincronizada escolhida e no HD externo escolhido. As rotinas de restauração validarão o manifesto antes de substituir dados locais e exigirão confirmação explícita do gestor.

## Critérios de aceite

1. O atalho `FuneralControl` inicia o ambiente local e abre o navegador.
2. `Sair` e 2 horas de inatividade produzem backup e encerram a aplicação após a conclusão.
3. Cada backup é ZIP validado e contém banco, uploads e configurações.
4. Os resultados local, nuvem e HD externo são registrados separadamente.
5. A ausência temporária do HD externo não é tratada como falha por si só.
6. Após 10 dias sem backup externo válido, operações mutáveis ficam bloqueadas até nova cópia externa concluída.
7. Toda falha de destino fica visível ao usuário sem impedir consulta e recuperação.
