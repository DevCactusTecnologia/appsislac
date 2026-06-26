// supabase/functions/chat-agent/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Anthropic } from "https://esm.sh/@anthropic-ai/sdk";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BLOCKED_KEYWORDS = ["codigo", "fonte", "senha", "token", "chave", "admin"];
const DANGEROUS_SQL = ["DELETE", "DROP", "INSERT", "UPDATE", "TRUNCATE"];

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { prompt, tenant_id, user_id } = await req.json();

    // Validar prompt
    const promptLower = prompt.toLowerCase();
    if (BLOCKED_KEYWORDS.some(k => promptLower.includes(k))) {
      return new Response(
        JSON.stringify({ error: "Pergunta contém termos não permitidos" }),
        { status: 400 }
      );
    }

    // Validar usuário e tenant
    const { data: user, error: userError } = await supabase
      .from("usuarios")
      .select("id, role")
      .eq("id", user_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // System prompt
    const systemPrompt = `Você é agente de laboratório SISLAC.
REGRAS:
- NUNCA responda sobre código/senha/token
- APENAS SELECT, sem DELETE/UPDATE/INSERT
- Respeite tenant_id = '${tenant_id}'
- Role do usuário: ${user.role}
- Português BR natural

SCHEMA:
- pacientes (id, nome, sexo, data_nascimento, tenant_id)
- atendimentos (id, protocolo, paciente_id, criado_em, tenant_id)
- exames (id, nome, descricao, tenant_id)
- resultados (id, exame_id, atendimento_id, valor, criado_em, tenant_id)

Se precisar SQL:
1. Inclua WHERE tenant_id = $1
2. Explique o SQL
3. Formato: \`\`\`sql ... \`\`\``;

    // Chamar Claude
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const response = message.content[0];
    if (response.type !== "text") {
      return new Response(JSON.stringify({ error: "Invalid response" }), { status: 500 });
    }

    const text = response.text;

    // Log de auditoria
    await supabase.from("agent_audit_log").insert({
      tenant_id,
      user_id,
      action: "query",
      prompt: prompt.substring(0, 500),
      response: text.substring(0, 500),
      status: "success",
      created_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        resposta: text,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});
