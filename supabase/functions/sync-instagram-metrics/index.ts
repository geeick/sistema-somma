import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InstagramMedia {
  id: string;
  media_type: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  media_url?: string;
  thumbnail_url?: string;
  caption?: string;
}

interface InstagramInsights {
  data: Array<{
    name: string;
    values: Array<{
      value: number;
    }>;
  }>;
}

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

    console.log(`Sync triggered by admin user: ${user.id}`);

    const instagramAccessToken = Deno.env.get('INSTAGRAM_ACCESS_TOKEN');

    if (!instagramAccessToken) {
      console.error('INSTAGRAM_ACCESS_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Instagram API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all approved Instagram submissions that need syncing
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select('id, post_url, user_id')
      .eq('platform', 'instagram')
      .eq('status', 'approved')
      .not('post_url', 'is', null);

    if (submissionsError) {
      console.error('Error fetching submissions:', submissionsError);
      throw submissionsError;
    }

    console.log(`Found ${submissions?.length || 0} Instagram submissions to sync`);

    let synced = 0;
    let errors = 0;

    for (const submission of submissions || []) {
      try {
        // Extract Instagram post ID from URL
        const postId = extractInstagramPostId(submission.post_url);
        if (!postId) {
          console.error(`Could not extract post ID from URL: ${submission.post_url}`);
          errors++;
          continue;
        }

        // Fetch media data from Instagram Graph API
        const mediaResponse = await fetch(
          `https://graph.instagram.com/${postId}?fields=like_count,comments_count,media_url,thumbnail_url,caption,timestamp,media_type,permalink&access_token=${instagramAccessToken}`
        );

        if (!mediaResponse.ok) {
          console.error(`Instagram API error for post ${postId}:`, await mediaResponse.text());
          errors++;
          continue;
        }

        const mediaData: InstagramMedia = await mediaResponse.json();

        // Fetch insights (views/impressions) - only available for business accounts
        let impressions = 0;
        let reach = 0;
        
        try {
          const insightsResponse = await fetch(
            `https://graph.instagram.com/${postId}/insights?metric=impressions,reach&access_token=${instagramAccessToken}`
          );
          
          if (insightsResponse.ok) {
            const insightsData: InstagramInsights = await insightsResponse.json();
            const impressionsMetric = insightsData.data.find(m => m.name === 'impressions');
            const reachMetric = insightsData.data.find(m => m.name === 'reach');
            
            impressions = impressionsMetric?.values[0]?.value || 0;
            reach = reachMetric?.values[0]?.value || 0;
          }
        } catch (insightsError) {
          console.log(`Could not fetch insights for ${postId} (may not be a business account)`);
        }

        // Insert snapshot
        const { error: snapshotError } = await supabase
          .from('snapshots')
          .insert({
            submission_id: submission.id,
            views: impressions || reach,
            likes: mediaData.like_count || 0,
            comments: mediaData.comments_count || 0,
            shares: 0, // Instagram API doesn't provide share count
          });

        if (snapshotError) {
          console.error(`Error inserting snapshot for ${submission.id}:`, snapshotError);
          errors++;
          continue;
        }

        // Update submission with latest view count and thumbnail
        const { error: updateError } = await supabase
          .from('submissions')
          .update({
            views_count: impressions || reach,
            thumbnail_url: mediaData.thumbnail_url || mediaData.media_url,
            description: mediaData.caption,
          })
          .eq('id', submission.id);

        if (updateError) {
          console.error(`Error updating submission ${submission.id}:`, updateError);
          errors++;
          continue;
        }

        synced++;
        console.log(`Synced metrics for submission ${submission.id}`);
      } catch (error) {
        console.error(`Error processing submission ${submission.id}:`, error);
        errors++;
      }
    }

    // Calculate provisional payouts for all updated submissions
    console.log('Calculating provisional payouts...');
    const { error: payoutError } = await supabase.rpc('calculate_provisional_payout');
    
    if (payoutError) {
      console.error('Error calculating provisional payouts:', payoutError);
    } else {
      console.log('Provisional payouts calculated successfully');
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        errors,
        total: submissions?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-instagram-metrics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractInstagramPostId(url: string): string | null {
  try {
    // Instagram URLs can be: /p/POST_ID/ (posts) or /reel/POST_ID/ (reels)
    const match = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
