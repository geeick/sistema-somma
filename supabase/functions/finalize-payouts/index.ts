import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Unauthorized: Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user authentication
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      console.error('Unauthorized: Invalid token', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin, error: roleError } = await authClient.rpc('is_admin', { uid: user.id });
    if (roleError || !isAdmin) {
      console.error('Forbidden: User is not admin', roleError);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Payout finalization triggered by admin user: ${user.id}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find submissions that are 48+ hours old and haven't been finalized
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 48);

    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select('id, uploaded_at, status, payment_amount')
      .lte('uploaded_at', cutoffTime.toISOString())
      .neq('status', 'deleted')
      .is('payment_amount', null);

    if (submissionsError) {
      console.error('Error fetching submissions:', submissionsError);
      throw submissionsError;
    }

    console.log(`Found ${submissions?.length || 0} submissions ready for payout finalization`);

    let finalized = 0;
    let errors = 0;

    for (const submission of submissions || []) {
      try {
        // Call the database function to finalize payout
        const { error: finalizeError } = await supabase.rpc('finalize_submission_payout', {
          sub_id: submission.id,
        });

        if (finalizeError) {
          console.error(`Error finalizing payout for ${submission.id}:`, finalizeError);
          errors++;
          continue;
        }

        finalized++;
        console.log(`Finalized payout for submission ${submission.id}`);
      } catch (error) {
        console.error(`Error processing submission ${submission.id}:`, error);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        finalized,
        errors,
        total: submissions?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in finalize-payouts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
