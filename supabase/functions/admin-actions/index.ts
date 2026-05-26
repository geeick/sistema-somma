import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Use service role client for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, payload } = await req.json();
    console.log('Admin action:', action, 'by user:', user.id);

    let result;
    let auditLog;

    switch (action) {
      case 'verify_page': {
        const { page_id, verified } = payload;
        
        // Get current state
        const { data: currentPage } = await supabaseClient
          .from('pages')
          .select('*')
          .eq('id', page_id)
          .single();

        // Update page
        const { data, error } = await supabaseClient
          .from('pages')
          .update({ verified, updated_at: new Date().toISOString() })
          .eq('id', page_id)
          .select()
          .single();

        if (error) throw error;

        // Audit log
        auditLog = {
          actor_id: user.id,
          entity_type: 'page',
          entity_id: page_id,
          action: verified ? 'verify' : 'unverify',
          before_state: { verified: currentPage?.verified },
          after_state: { verified },
        };

        result = { success: true, data };
        break;
      }

      case 'toggle_user_status': {
        const { user_id, status } = payload;
        
        // Get current state
        const { data: currentProfile } = await supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', user_id)
          .single();

        // Update profile (we'll add a status field if needed)
        const { data, error } = await supabaseClient
          .from('profiles')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', user_id)
          .select()
          .single();

        if (error) throw error;

        // Audit log
        auditLog = {
          actor_id: user.id,
          entity_type: 'user',
          entity_id: user_id,
          action: 'toggle_status',
          before_state: currentProfile,
          after_state: { status },
          metadata: { status },
        };

        result = { success: true, data };
        break;
      }

      case 'add_strike': {
        const { user_id, level, reason } = payload;

        const { data, error } = await supabaseClient
          .from('strikes')
          .insert({
            user_id,
            level,
            reason,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;

        // Audit log
        auditLog = {
          actor_id: user.id,
          entity_type: 'strike',
          entity_id: data.id,
          action: 'add_strike',
          after_state: { user_id, level, reason },
        };

        result = { success: true, data };
        break;
      }

      case 'remove_strike': {
        const { strike_id } = payload;

        // Get current strike
        const { data: currentStrike } = await supabaseClient
          .from('strikes')
          .select('*')
          .eq('id', strike_id)
          .single();

        const { data, error } = await supabaseClient
          .from('strikes')
          .update({
            removed_at: new Date().toISOString(),
            removed_by: user.id,
          })
          .eq('id', strike_id)
          .select()
          .single();

        if (error) throw error;

        // Audit log
        auditLog = {
          actor_id: user.id,
          entity_type: 'strike',
          entity_id: strike_id,
          action: 'remove_strike',
          before_state: currentStrike,
          after_state: data,
        };

        result = { success: true, data };
        break;
      }

      case 'soft_delete_page': {
        const { page_id } = payload;

        // Get current state
        const { data: currentPage } = await supabaseClient
          .from('pages')
          .select('*')
          .eq('id', page_id)
          .single();

        // Soft delete by setting status to 'deleted'
        const { data, error } = await supabaseClient
          .from('pages')
          .update({ status: 'deleted', updated_at: new Date().toISOString() })
          .eq('id', page_id)
          .select()
          .single();

        if (error) throw error;

        // Audit log
        auditLog = {
          actor_id: user.id,
          entity_type: 'page',
          entity_id: page_id,
          action: 'soft_delete',
          before_state: currentPage,
          after_state: { status: 'deleted' },
        };

        result = { success: true, data };
        break;
      }

      case 'approve_submission': {
        const { submission_id } = payload;

        // Get current state
        const { data: currentSubmission } = await supabaseClient
          .from('submissions')
          .select('*')
          .eq('id', submission_id)
          .single();

        // Update submission status to approved
        const { data, error } = await supabaseClient
          .from('submissions')
          .update({ 
            status: 'approved',
            approved_at: new Date().toISOString()
          })
          .eq('id', submission_id)
          .select()
          .single();

        if (error) throw error;

        // Audit log
        auditLog = {
          actor_id: user.id,
          entity_type: 'submission',
          entity_id: submission_id,
          action: 'approve_submission',
          before_state: { status: currentSubmission?.status },
          after_state: { status: 'approved' },
        };

        result = { success: true, data };
        break;
      }

      case 'reject_submission': {
        const { submission_id, reason } = payload;

        // Get current state
        const { data: currentSubmission } = await supabaseClient
          .from('submissions')
          .select('*')
          .eq('id', submission_id)
          .single();

        // Update submission status to rejected
        const { data, error } = await supabaseClient
          .from('submissions')
          .update({ 
            status: 'rejected',
            reason_code: reason
          })
          .eq('id', submission_id)
          .select()
          .single();

        if (error) throw error;

        // Audit log
        auditLog = {
          actor_id: user.id,
          entity_type: 'submission',
          entity_id: submission_id,
          action: 'reject_submission',
          before_state: { status: currentSubmission?.status },
          after_state: { status: 'rejected', reason },
        };

        result = { success: true, data };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Write audit log
    if (auditLog) {
      await supabaseClient.from('audit_logs').insert(auditLog);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Admin action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
