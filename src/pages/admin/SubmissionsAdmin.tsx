import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, ExternalLink, Instagram, Youtube, Video, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Submission {
  id: string;
  title: string;
  description: string | null;
  platform: string;
  status: string;
  views_count: number | null;
  uploaded_at: string;
  post_url: string | null;
  thumbnail_url: string | null;
  user_id: string;
  campaign_id: string | null;
  reason_code: string | null;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
  campaigns: {
    title: string;
  } | null;
}

export default function SubmissionsAdmin() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [viewDialog, setViewDialog] = useState<Submission | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Submission | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { toast } = useToast();

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return <Instagram className="h-4 w-4" />;
      case 'youtube':
        return <Youtube className="h-4 w-4" />;
      case 'tiktok':
      case 'kwai':
        return <Video className="h-4 w-4" />;
      default:
        return <Video className="h-4 w-4" />;
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  useEffect(() => {
    filterSubmissions();
  }, [submissions, statusFilter, platformFilter]);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          profiles:user_id (full_name, email),
          campaigns:campaign_id (title)
        `)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load submissions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterSubmissions = () => {
    let filtered = submissions;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }

    if (platformFilter !== 'all') {
      filtered = filtered.filter(s => s.platform === platformFilter);
    }

    setFilteredSubmissions(filtered);
  };


  const handleDelete = async () => {
    if (!deleteDialog) return;

    setDeleteLoading(true);
    try {
      // Call the reverse payout function
      const { error: reverseError } = await supabase.rpc('reverse_submission_payout', {
        submission_id: deleteDialog.id,
      });

      if (reverseError) throw reverseError;

      // Update submission status to deleted
      const { error: updateError } = await supabase
        .from('submissions')
        .update({ status: 'deleted' })
        .eq('id', deleteDialog.id);

      if (updateError) throw updateError;

      // Log to audit
      await supabase.from('audit_logs').insert({
        entity_type: 'submission',
        action: 'deleted',
        entity_id: deleteDialog.id,
        metadata: {
          title: deleteDialog.title,
          platform: deleteDialog.platform,
        },
      });

      toast({
        title: 'Success',
        description: 'Submission deleted and earnings reversed',
      });

      setDeleteDialog(null);
      fetchSubmissions();
    } catch (error) {
      console.error('Error deleting submission:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete submission',
        variant: 'destructive',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      approved: 'default',
      rejected: 'destructive',
      deleted: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">Submissões de Conteúdo</h1>
          <p className="text-muted-foreground">Ver todas as submissões com sincronização automática de métricas do Instagram</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            const csv = [
              ['Criador', 'Email', 'Título', 'Campanha', 'Plataforma', 'Visualizações', 'Status', 'Data de Upload', 'URL do Post'],
              ...filteredSubmissions.map(s => [
                s.profiles?.full_name || 'Desconhecido',
                s.profiles?.email || '',
                s.title,
                s.campaigns?.title || 'N/A',
                s.platform,
                s.views_count?.toString() || '0',
                s.status,
                new Date(s.uploaded_at).toLocaleDateString('pt-BR'),
                s.post_url || '',
              ]),
            ].map(row => row.join(',')).join('\n');
            
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `submissoes-${new Date().toISOString()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          disabled={filteredSubmissions.length === 0}
        >
          Exportar CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <div className="flex gap-4 mt-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
              </SelectContent>
            </Select>

            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="kwai">Kwai</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creator</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubmissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No submissions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSubmissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{submission.profiles?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{submission.profiles?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{submission.title}</TableCell>
                    <TableCell>{submission.campaigns?.title || 'N/A'}</TableCell>
                    <TableCell className="capitalize">{submission.platform}</TableCell>
                    <TableCell>{submission.views_count?.toLocaleString() || '0'}</TableCell>
                    <TableCell>{getStatusBadge(submission.status)}</TableCell>
                    <TableCell>{format(new Date(submission.uploaded_at), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewDialog(submission)}
                          title="View submission"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {submission.post_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a 
                              href={submission.post_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              title="Open post in Instagram (requires login)"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteDialog(submission)}
                          title="Delete submission"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Submission Dialog */}
      <Dialog open={!!viewDialog} onOpenChange={() => setViewDialog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewDialog && getPlatformIcon(viewDialog.platform)}
              {viewDialog?.title}
            </DialogTitle>
            <DialogDescription>
              Submitted by {viewDialog?.profiles?.full_name || 'Unknown'} on{' '}
              {viewDialog && format(new Date(viewDialog.uploaded_at), 'MMM dd, yyyy')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {viewDialog?.post_url && (
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Post URL</span>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a
                      href={viewDialog.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in Instagram
                    </a>
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground break-all">
                  {viewDialog.post_url}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-sm font-medium">Campaign</span>
                <p className="text-sm text-muted-foreground">
                  {viewDialog?.campaigns?.title || 'N/A'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium">Platform</span>
                <p className="text-sm text-muted-foreground capitalize">
                  {viewDialog?.platform}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium">Status</span>
                <div>{viewDialog && getStatusBadge(viewDialog.status)}</div>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium">Views</span>
                <p className="text-sm text-muted-foreground">
                  {viewDialog?.views_count?.toLocaleString() || 'Not synced yet'}
                </p>
              </div>
            </div>

            {viewDialog?.description && (
              <div className="space-y-1">
                <span className="text-sm font-medium">Description</span>
                <p className="text-sm text-muted-foreground">{viewDialog.description}</p>
              </div>
            )}

            {viewDialog?.reason_code && (
              <div className="space-y-1">
                <span className="text-sm font-medium text-destructive">Rejection Reason</span>
                <p className="text-sm text-muted-foreground">{viewDialog.reason_code}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this submission? This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Mark the submission as deleted</li>
                <li>Exclude it from all totals and leaderboards</li>
                <li>Reverse any earnings already accrued</li>
                <li>Create a negative ledger entry</li>
              </ul>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
