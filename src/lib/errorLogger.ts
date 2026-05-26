import { supabase } from '@/integrations/supabase/client';

export interface ErrorLog {
  error_code: string;
  error_message: string;
  error_stack?: string;
  page_url?: string;
  user_agent?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, any>;
}

export async function logError(errorData: ErrorLog) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('error_logs')
      .insert({
        user_id: user?.id,
        error_code: errorData.error_code,
        error_message: errorData.error_message,
        error_stack: errorData.error_stack,
        page_url: errorData.page_url || window.location.href,
        user_agent: errorData.user_agent || navigator.userAgent,
        severity: errorData.severity || 'error',
        metadata: errorData.metadata || {},
      });

    if (error) {
      console.error('Failed to log error:', error);
    }
  } catch (err) {
    console.error('Error logging system failed:', err);
  }
}

export function generateErrorCode(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 7);
  return `ERR-${timestamp}-${randomStr}`.toUpperCase();
}
