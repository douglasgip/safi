# Integração SAFI ⇄ Conekto — lado do SAFI

Fonte da verdade: contrato `integracao-safi.md` fornecido pelo Conekto (não versionado aqui).


- **SAFI → Conekto:** edge function `conekto-sync` (código em `_ds/conekto-sync_index.ts`), chamada pela tela Funcionários
  ao salvar (POST), desligar (PATCH) e readmitir (POST), e pelo botão "Conferir no Conekto" (GET). Token: secret
  `CONEKTO_INTEGRATION_TOKEN` no Supabase. Erro 500/rede: até 3 tentativas. O `id` do Conekto fica em `funcionarios.conekto_id`.
  Colaborador desligado no SAFI nunca recebe POST (o POST readmite): editar alguém desligado reenvia só o PATCH.
- **Conekto → SAFI:** edge function `conekto-webhook` (`_ds/conekto-webhook_index.ts`), sem login do Supabase, autenticada por
  `Authorization: Bearer <CONEKTO_WEBHOOK_TOKEN>`. URL: `https://ujsoqyhkebasszwtexmp.supabase.co/functions/v1/conekto-webhook`.
  Aplica só os campos de `alteracoes`; grava direto no banco e não chama o Conekto (sem laço). Aviso mais antigo que a última
  alteração no SAFI é confirmado (200) sem sobrescrever. Colaborador não encontrado → 404 (o Conekto reenvia).
- **Chave liga/desliga:** `integracao_config.conekto_modo` = `desligado` | `teste` (só nomes começando por "TESTE") | `producao`.
- **Registro:** toda chamada e todo aviso ficam em `conekto_log` (só o admin lê).
- **Mapeamento do webhook:** `full_name`→nome, `admissao_date`→data_admissao, `desligamento_date`→data_desligamento (+ situação),
  `gestao` (`gip_ecommerce`…)→empresa, `empresa` (`isa`…)→CNPJ, `is_active`→situação. Campo fora do contrato é ignorado e registrado.
- **Pontos a confirmar com o Conekto:** troca de CPF feita pelo SAFI (o contrato não permite mudar o CPF de um `safi_id`
  pelo POST: o SAFI mostra a mensagem do Conekto); `is_active=false` sem data vira "desligado" no SAFI, sem último dia trabalhado.
