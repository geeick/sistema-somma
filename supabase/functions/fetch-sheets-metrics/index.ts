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
    const response = await fetch(SHEETS_URL, {
      method: "GET",
      redirect: "follow",
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({ status: "error", message: "Failed to parse sheets response", raw: text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ status: "success", data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ status: "error", message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
