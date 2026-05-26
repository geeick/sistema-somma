import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHEETS_URL = "https://script.google.com/macros/s/AKfycbwa9itWuMRFIkGfkPmA6t_b47ENi8yo0v7_a-WoGJiDzo_gKgtq6vex1arTsioYhfsi3g/exec";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const postLink = String(payload?.postLink ?? payload?.link ?? "").trim();
    const campaignName = String(payload?.campaignName ?? "").trim();
    const platform = String(payload?.platform ?? "").trim();

    if (!postLink) {
      return new Response(JSON.stringify({ status: "error", message: "postLink obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstreamResponse = await fetch(SHEETS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postLink,
        link: postLink,
        campaignName,
        platform,
      }),
      redirect: "follow",
    });

    const upstreamText = await upstreamResponse.text();

    let upstreamJson: { status?: string; message?: string } | null = null;
    try {
      upstreamJson = JSON.parse(upstreamText);
    } catch {
      upstreamJson = null;
    }

    if (!upstreamResponse.ok) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Falha ao enviar para a API da planilha",
          upstreamStatus: upstreamResponse.status,
          upstreamBody: upstreamText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (upstreamJson?.status === "error") {
      return new Response(
        JSON.stringify({
          status: "error",
          message: upstreamJson.message || "API da planilha rejeitou o link",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        status: "success",
        message: "Link enviado para planilha",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";

    return new Response(JSON.stringify({ status: "error", message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
