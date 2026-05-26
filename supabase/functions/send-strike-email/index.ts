import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StrikeEmailPayload {
  user_id: string;
  level: string;
  reason: string;
  strike_count: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create client with user's auth for verification
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify admin access
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isAdmin } = await authClient.rpc('is_admin', { uid: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user_id, level, reason, strike_count }: StrikeEmailPayload = await req.json();

    // Use service role client for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user email
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('email, full_name')
      .eq('id', user_id)
      .single();

    if (profileError || !profile?.email) {
      console.error('Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'User email not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Send email notification
    // Note: This requires RESEND_API_KEY to be configured
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (resendApiKey) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 8px; margin: 20px 0; }
            .strike-level { 
              display: inline-block; 
              padding: 8px 16px; 
              border-radius: 4px; 
              font-weight: bold; 
              margin: 10px 0;
            }
            .warning { background-color: #fef3c7; color: #92400e; }
            .moderate { background-color: #fed7aa; color: #9a3412; }
            .severe { background-color: #fecaca; color: #991b1b; }
            .strike-count { font-size: 24px; font-weight: bold; color: #ef4444; margin: 15px 0; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Advertência Recebida</h1>
            </div>
            <div class="content">
              <p>Olá ${profile.full_name || 'Criador'},</p>
              
              <p>Você recebeu uma advertência (strike) em sua conta na plataforma Somma.</p>
              
              <div class="strike-level ${level}">
                Nível: ${level === 'warning' ? 'Aviso' : level === 'moderate' ? 'Moderado' : 'Grave'}
              </div>
              
              <p><strong>Motivo:</strong></p>
              <p style="background-color: white; padding: 15px; border-left: 4px solid #ef4444; margin: 10px 0;">
                ${reason}
              </p>
              
              <div class="strike-count">
                Total de strikes: ${strike_count}
              </div>
              
              ${strike_count >= 3 ? `
                <div style="background-color: #fee2e2; border: 2px solid #ef4444; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <strong style="color: #991b1b;">⛔ ATENÇÃO:</strong>
                  <p style="margin: 10px 0; color: #991b1b;">
                    Você atingiu 3 ou mais strikes. Suas páginas foram <strong>bloqueadas</strong> e não poderão mais participar de campanhas até que a situação seja resolvida.
                  </p>
                  <p style="margin: 10px 0; color: #991b1b;">
                    Entre em contato com o suporte para mais informações.
                  </p>
                </div>
              ` : `
                <p style="color: #92400e; background-color: #fef3c7; padding: 10px; border-radius: 4px;">
                  <strong>Lembrete:</strong> Após 3 strikes, suas páginas serão bloqueadas e não poderão participar de campanhas.
                </p>
              `}
              
              <p style="margin-top: 20px;">
                Se você acredita que este strike foi dado por engano, entre em contato com nossa equipe de suporte.
              </p>
            </div>
            <div class="footer">
              <p>Esta é uma mensagem automática. Por favor, não responda a este email.</p>
              <p>© 2024 Somma - Plataforma de Criadores</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Somma <onboarding@resend.dev>',
          to: [profile.email],
          subject: `⚠️ Você recebeu um strike - ${strike_count} strike(s) total`,
          html: emailHtml,
        }),
      });

      const emailResult = await emailResponse.json();
      
      if (!emailResponse.ok) {
        console.error('Error sending email:', emailResult);
      } else {
        console.log('Strike notification email sent successfully:', emailResult);
      }
    } else {
      console.warn('RESEND_API_KEY not configured - skipping email notification');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Strike email notification processed',
        email_sent: !!resendApiKey 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-strike-email function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});