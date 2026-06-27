import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const AGENT_ID = "agent_2801kw31qjftetpbefenctpfnm8n";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ELEVENLABS_API_KEY ausente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agent_id") || AGENT_ID;

    const r = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { "xi-api-key": apiKey } },
    );
    const body = await r.text();
    if (!r.ok) {
      console.error("[elevenlabs-conversation-token] upstream", r.status, body);
      return new Response(
        JSON.stringify({ error: "upstream", status: r.status, detail: body }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(body, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[elevenlabs-conversation-token] error", e);
    return new Response(
      JSON.stringify({ error: String((e as Error)?.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
