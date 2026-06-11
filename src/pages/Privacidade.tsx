import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { SEO } from "@/components/seo/SEO";

/**
 * Política de Privacidade pública (LGPD).
 * Rota: /privacidade — acessível sem autenticação.
 * Conteúdo mínimo exigido pelo go-live beta.
 */
const Privacidade = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Política de Privacidade | SISLAC"
        description="Como o SISLAC coleta, usa e protege os dados de pacientes e usuários, em conformidade com a LGPD."
      />

      <header className="border-b border-border/60 px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            LGPD
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">Política de Privacidade</h1>
        <p className="mb-10 text-sm text-muted-foreground">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="mb-3 text-lg font-semibold">1. Quem somos</h2>
            <p>
              O <strong>SISLAC</strong> é um sistema de gestão laboratorial clínica (LIS)
              utilizado por laboratórios para organizar atendimentos, coletas, análises e
              entrega de resultados. Esta política descreve como tratamos os dados pessoais
              processados na plataforma, em conformidade com a{" "}
              <strong>Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD)</strong>.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">2. Quais dados coletamos</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><strong>Dados de pacientes:</strong> nome, CPF, data de nascimento, sexo, contato (telefone, e-mail), endereço e dados do responsável legal (quando aplicável).</li>
              <li><strong>Dados clínicos:</strong> exames solicitados, amostras, resultados laboratoriais, observações técnicas e laudos.</li>
              <li><strong>Dados operacionais do laboratório:</strong> usuários, perfis, unidades, tabelas de preço e registros financeiros.</li>
              <li><strong>Dados de auditoria:</strong> logs de acesso, alterações e impressões — necessários para rastreabilidade clínica.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">3. Finalidade do tratamento</h2>
            <p className="mb-2">Utilizamos os dados exclusivamente para:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Executar o ciclo laboratorial completo (recepção → coleta → análise → laudo);</li>
              <li>Cumprir obrigações regulatórias (RDC ANVISA 786/2023, CFM, MS);</li>
              <li>Garantir rastreabilidade da amostra e validação de valores críticos;</li>
              <li>Emitir comprovantes, recibos e relatórios de produção;</li>
              <li>Fornecer suporte técnico e prevenção de fraude.</li>
            </ul>
            <p className="mt-3">
              <strong>Não comercializamos</strong> dados de pacientes nem os utilizamos para
              fins de marketing.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">4. Base legal</h2>
            <p>
              O tratamento de dados de saúde é fundamentado no{" "}
              <strong>art. 11, II, "a", "f" e "g"</strong> da LGPD (tutela da saúde,
              cumprimento de obrigação legal e proteção da vida) e, quando aplicável, no
              <strong> consentimento expresso</strong> do titular ou de seu responsável legal,
              coletado no momento do cadastro.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">5. Onde os dados são armazenados</h2>
            <p>
              Os dados são armazenados em infraestrutura cloud gerenciada (Supabase / AWS),
              em datacenters com criptografia em trânsito (TLS) e em repouso. O acesso é
              restrito por <strong>Row-Level Security (RLS)</strong> com isolamento por
              tenant — cada laboratório só acessa seus próprios dados.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">6. Compartilhamento</h2>
            <p>
              Dados podem ser compartilhados com <strong>laboratórios de apoio</strong> quando
              um exame for terceirizado (necessário para a execução do serviço) e com
              <strong> autoridades</strong> mediante requisição legal. Não há compartilhamento
              comercial com terceiros.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">7. Direitos do titular</h2>
            <p className="mb-2">
              Nos termos do art. 18 da LGPD, o titular dos dados pode solicitar:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Confirmação da existência de tratamento;</li>
              <li>Acesso aos seus dados;</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
              <li>Portabilidade dos dados;</li>
              <li>Revogação do consentimento.</li>
            </ul>
            <p className="mt-3">
              Solicitações devem ser enviadas para o canal de contato abaixo. Atenderemos em
              até <strong>15 dias úteis</strong>, conforme prazo legal.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">8. Retenção</h2>
            <p>
              Dados clínicos são mantidos pelo prazo mínimo exigido pela legislação sanitária
              (em regra, <strong>5 anos</strong> para registros laboratoriais). Após esse
              período, os dados podem ser anonimizados ou eliminados, salvo obrigação legal
              em contrário.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">9. Segurança</h2>
            <p>
              Adotamos medidas técnicas e organizacionais — autenticação multifator quando
              disponível, controle granular por perfil, logs de auditoria, criptografia,
              backups periódicos e revisões de segurança — para proteger os dados contra
              acesso não autorizado, perda ou alteração indevida.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">10. Contato — Encarregado (DPO)</h2>
            <p>
              Para dúvidas, solicitações de exercício de direitos ou comunicação de
              incidentes:
            </p>
            <p className="mt-2">
              <strong>E-mail:</strong>{" "}
              <a className="text-primary underline-offset-4 hover:underline" href="mailto:suporte@sislac.com.br">
                suporte@sislac.com.br
              </a>
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">11. Atualizações desta política</h2>
            <p>
              Esta política pode ser atualizada para refletir mudanças regulatórias ou
              operacionais. A versão vigente estará sempre disponível nesta página, com a
              data de atualização no topo.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Privacidade;