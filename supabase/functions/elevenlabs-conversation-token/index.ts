const AGENT_ID = "agent_2801kw31qjftetpbefenctpfnm8n";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const tokenRequest = fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { "xi-api-key": apiKey } },
    );

    // Também gera signed_url para fallback em modo texto quando não houver microfone.
    const signedUrlRequest = fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { "xi-api-key": apiKey } },
    );

    const [tokenResponse, signedUrlResponse] = await Promise.all([tokenRequest, signedUrlRequest]);
    const tokenBody = await tokenResponse.text();
    if (!tokenResponse.ok) {
      console.error("[elevenlabs-conversation-token] token upstream", tokenResponse.status, tokenBody);
      return new Response(
        JSON.stringify({ error: "upstream", status: tokenResponse.status, detail: tokenBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = JSON.parse(tokenBody) as Record<string, unknown>;
    const signedUrlBody = await signedUrlResponse.text();
    if (signedUrlResponse.ok) {
      try {
        const signedPayload = JSON.parse(signedUrlBody) as Record<string, unknown>;
        payload.signed_url = signedPayload.signed_url ?? signedPayload.signedUrl;
      } catch {
        payload.signed_url = signedUrlBody;
      }
    } else {
      console.warn("[elevenlabs-conversation-token] signed-url upstream", signedUrlResponse.status, signedUrlBody);
      payload.signed_url_error = { status: signedUrlResponse.status, detail: signedUrlBody };
    }

    return new Response(JSON.stringify(payload), {
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
