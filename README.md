# FuneralControl - Sistema de Gestão de Planos Funerários

Sistema interno para gerenciamento completo de planos funerários, titulares, beneficiários, faturas e contratos.

## Funcionalidades

- **Autenticação**: Acesso restrito para colaboradores da empresa.
- **Painel Geral (Dashboard)**: Métricas em tempo real de titulares ativos, mensalidades recebidas, vencidas e a vencer.
- **Gestão de Planos**: Cadastro, limites de dependentes e definição de mensalidades.
- **Gestão de Titulares & Beneficiários**: Cadastro completo com validação de CPF e controle de dependentes.
- **Contratos Digitalizados**: Armazenamento e download de documentos anexos dos titulares.
- **Faturamento e Mensalidades**: Geração de faturas, baixa de pagamentos e controle de inadimplência.
- **Backups**: Cópias ZIP validadas no computador, em uma pasta sincronizada na nuvem e no HD externo.

## Execução Local

### Pré-requisitos

- Node.js (v20+)
- PostgreSQL (v14+)

### Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente no arquivo .env
# (copie de .env.example)

# Iniciar o serviço PostgreSQL nativo pelo Windows (Serviços)

# Iniciar o servidor de desenvolvimento
npm run dev
```

## Proteção e atualização

- Configure as três pastas em **Backups**. A pasta de nuvem deve ser uma pasta já sincronizada pelo Google Drive, OneDrive ou serviço equivalente.
- Ao sair ou após duas horas sem uso, o sistema tenta criar cópias nos destinos configurados e registra o resultado. O HD externo deve receber uma cópia validada a cada 10 dias; após esse prazo, novos cadastros e alterações ficam bloqueados até a regularização.
- O aplicativo consulta atualizações do GitHub somente uma vez ao iniciar. Quando houver uma versão disponível, o gestor escolhe **Atualizar sistema**. Em uma instalação feita pelo atalho do Windows, o sistema cria antes um backup local validado, confere o pacote e reinicia após a atualização. Dados, documentos, banco e backups são preservados.

## Instalador Windows

O arquivo `installer/FuneralControl.iss` gera o instalador `.exe` pelo Inno Setup em um computador Windows. A instalação inicial exige internet e permissões de administrador. Ela verifica os requisitos, instala Node.js e PostgreSQL quando necessário, cria o banco local e deixa apenas o atalho **FuneralControl** na área de trabalho.

Antes de considerar a instalação concluída, confirme: conexão ao PostgreSQL, disponibilidade do `pg_dump`, abertura em `http://localhost:3000` e configuração das três pastas de backup. Reexecutar o instalador preserva o banco, `.env`, documentos e backups já existentes.
