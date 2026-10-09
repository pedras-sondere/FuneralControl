# FuneralControl - Sistema de Gestão de Planos Funerários

Sistema interno para gerenciamento completo de planos funerários, titulares, beneficiários, faturas e contratos.

## Funcionalidades

- **Autenticação**: Acesso restrito para colaboradores da empresa.
- **Painel Geral (Dashboard)**: Métricas em tempo real de titulares ativos, mensalidades recebidas, vencidas e a vencer.
- **Gestão de Planos**: Cadastro, limites de dependentes e definição de mensalidades.
- **Gestão de Titulares & Beneficiários**: Cadastro completo com validação de CPF e controle de dependentes.
- **Contratos Digitalizados**: Armazenamento e download de documentos anexos dos titulares.
- **Faturamento e Mensalidades**: Geração mensal de faturas, baixa de pagamentos e controle de inadimplência.

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

# Subir o PostgreSQL local
docker compose up -d postgres

# Iniciar o servidor de desenvolvimento
npm run dev
```
