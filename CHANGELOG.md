# Histórico de versões

## 2.1.1 — 06/11/2026

### Corrigido

- A atualização local não encerra mais o sistema por tempo fixo antes de o Windows iniciar o processo elevado. O próprio atualizador passa a encerrar a versão anterior após criar o log e iniciar a execução.

## 2.1.0 — 26/10/2026

### Alterado

- Os avisos de renovação anual passam a ser exibidos a partir do mesmo dia do mês anterior à data-base. Por exemplo: renovação em 01/01 passa a aparecer em 01/12.
- A tela inicial agora destaca famílias, planos, falecimentos e cancelamentos, sem indicadores de cobrança bancária.

### Removido

- O módulo legado de faturas, incluindo geração, baixa, consulta e indicadores de faturas.
- Na atualização do banco, os registros legados de faturas são excluídos definitivamente, conforme decisão do gestor. Titulares, beneficiários, contratos, ocorrências, renovações e backups não são afetados.

### Corrigido

- O aviso de atualização bloqueia o uso da tela enquanto a atualização local é aplicada e reabre o sistema automaticamente ao concluir ou restaurar a versão anterior.
- Atualizadas as dependências de execução e de compilação para corrigir vulnerabilidades conhecidas antes da publicação.
