import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OEmbedResponse {
  html: string;
  thumbnail_url?: string;
  author_name?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metaAppId = Deno.env.get('META_APP_ID');
    const metaAppSecret = Deno.env.get('META_APP_SECRET');

    if (!metaAppId || !metaAppSecret) {
      console.error('META_APP_ID or META_APP_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Instagram oEmbed not configured', fallback: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get access token
    const accessToken = `${metaAppId}|${metaAppSecret}`;

    // Fetch oEmbed data
    const oembedUrl = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${accessToken}`;
    
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      console.error('Instagram oEmbed API error:', await response.text());
      return new Response(
        JSON.stringify({ error: 'Failed to fetch oEmbed data', fallback: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data: OEmbedResponse = await response.json();

    return new Response(
      JSON.stringify({
        html: data.html,
        thumbnail_url: data.thumbnail_url,
        author_name: data.author_name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in instagram-oembed function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        fallback: true 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
