-- Remover bloqueio rígido de edição clínica.
-- Nova política: edição é PERMITIDA mesmo após finalização/cancelamento ou 24h,
-- com alerta no frontend e rastreabilidade total via triggers de auditoria
-- (audit_atendimentos / audit_atendimento_exames / audit_atendimento_pagamentos).
DROP TRIGGER IF EXISTS trg_guard_exames_finalizado ON public.atendimento_exames;
DROP FUNCTION IF EXISTS public.guard_exames_when_atendimento_finalizado();