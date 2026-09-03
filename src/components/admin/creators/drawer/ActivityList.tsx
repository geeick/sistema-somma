import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { LoadingState } from '@/components/LoadingState';

interface Submission {
  id: string;
  title: string;
  platform: string;
  status: string;
  views_count: number | null;
  uploaded_at: string;
  campaign_id: string | null;
}

export function ActivityList({ userId }: { userId: string }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSubmissions();
  }, [userId]);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      case 'pending': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) return <LoadingState label="Carregando envios..." compact />;
  if (submissions.length === 0) return <div className="text-center py-4 text-muted-foreground">No submissions</div>;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Views</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((submission) => (
            <TableRow key={submission.id}>
              <TableCell className="font-medium">{submission.title}</TableCell>
              <TableCell className="capitalize">{submission.platform}</TableCell>
              <TableCell>{submission.views_count?.toLocaleString() || 'N/A'}</TableCell>
              <TableCell>
                <Badge variant={getStatusColor(submission.status)}>
                  {submission.status}
                </Badge>
              </TableCell>
              <TableCell>{new Date(submission.uploaded_at).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
