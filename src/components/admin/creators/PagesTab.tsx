import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, CheckCircle, XCircle, Trash2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/LoadingState';

interface Page {
  id: string;
  user_id: string;
  platform: string;
  handle: string;
  url: string;
  verified: boolean;
  follower_count: number | null;
  tags: string[] | null;
  created_at: string;
  owner_name?: string;
  owner_email?: string;
}

export function PagesTab() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchPages();
  }, [searchTerm]);

  const fetchPages = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('pages')
        .select('*, profiles!inner(full_name, email)')
        .neq('status', 'deleted');

      if (searchTerm) {
        query = query.or(`handle.ilike.%${searchTerm}%,url.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const enhancedPages = (data || []).map((page: any) => ({
        ...page,
        owner_name: page.profiles?.full_name,
        owner_email: page.profiles?.email,
      }));

      setPages(enhancedPages);
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
        description: `Page ${!currentVerified ? 'verified' : 'unverified'} successfully`,
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

  const softDeletePage = async (pageId: string) => {
    if (!confirm('Are you sure you want to delete this page?')) return;

    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'soft_delete_page',
          payload: { page_id: pageId },
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Page deleted successfully',
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

  const exportCSV = () => {
    const csv = [
      ['Creator Name', 'Creator Email', 'Platform', 'Handle', 'Tags', 'Verified', 'Followers', 'Created', 'URL'],
      ...pages.map(p => [
        p.owner_name || '',
        p.owner_email || '',
        p.platform,
        p.handle,
        p.tags?.join('; ') || '',
        p.verified ? 'Yes' : 'No',
        p.follower_count?.toString() || 'N/A',
        new Date(p.created_at).toLocaleDateString('pt-BR'),
        p.url,
      ]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paginas-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por handle ou URL..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={exportCSV} disabled={pages.length === 0}>
            Exportar CSV
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creator Name</TableHead>
                <TableHead>Creator Email</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Handle</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Followers</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <LoadingState label="Carregando páginas..." compact className="mx-auto" />
                  </TableCell>
                </TableRow>
              ) : pages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No pages found
                  </TableCell>
                </TableRow>
              ) : (
                pages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell className="font-medium">{page.owner_name || 'N/A'}</TableCell>
                    <TableCell className="text-muted-foreground">{page.owner_email}</TableCell>
                    <TableCell className="capitalize">{page.platform}</TableCell>
                    <TableCell>
                      <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {page.handle}
                      </a>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {page.tags && page.tags.length > 0 ? (
                          page.tags.slice(0, 2).map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">No tags</span>
                        )}
                        {page.tags && page.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{page.tags.length - 2}
                          </Badge>
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
                    <TableCell>
                      {page.follower_count ? page.follower_count.toLocaleString() : 'N/A'}
                    </TableCell>
                    <TableCell>{new Date(page.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleVerify(page.id, page.verified)}
                        >
                          {page.verified ? 'Unverify' : 'Verify'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => softDeletePage(page.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
