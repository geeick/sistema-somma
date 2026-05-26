import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Page {
  id: string;
  platform: string;
  handle: string;
  url: string;
  verified: boolean;
  follower_count: number | null;
  tags: string[] | null;
}

export function PagesList({ userId }: { userId: string }) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPages();
  }, [userId]);

  const fetchPages = async () => {
    try {
      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .eq('user_id', userId)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPages(data || []);
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

  const toggleVerify = async (pageId: string, currentVerified: boolean) => {
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'verify_page',
          payload: { page_id: pageId, verified: !currentVerified },
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Page ${!currentVerified ? 'verified' : 'unverified'}`,
      });

      fetchPages();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) return <div className="text-center py-4">Loading...</div>;
  if (pages.length === 0) return <div className="text-center py-4 text-muted-foreground">No pages</div>;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Platform</TableHead>
            <TableHead>Handle</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Verified</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.map((page) => (
            <TableRow key={page.id}>
              <TableCell className="capitalize">{page.platform}</TableCell>
              <TableCell>@{page.handle}</TableCell>
              <TableCell>
                <div className="flex gap-1 flex-wrap">
                  {page.tags && page.tags.length > 0 ? (
                    page.tags.slice(0, 2).map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {page.verified ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleVerify(page.id, page.verified)}
                  >
                    {page.verified ? 'Unverify' : 'Verify'}
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={page.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
