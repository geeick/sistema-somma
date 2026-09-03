import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, UserPlus, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CreatorProfileDrawer } from './CreatorProfileDrawer';
import { AddStrikeDialog } from './AddStrikeDialog';
import { LoadingState } from '@/components/LoadingState';

interface Creator {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  total_pages?: number;
  total_earned?: number;
  strikes_count?: number;
}

export function CreatorsTab() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const [showStrikeDialog, setShowStrikeDialog] = useState(false);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchCreators();
  }, [searchTerm]);

  const fetchCreators = async () => {
    try {
      setLoading(true);
      
      // Get all users who have pages (these are the creators)
      const { data: pagesData } = await supabase
        .from('pages')
        .select('user_id');

      if (!pagesData || pagesData.length === 0) {
        setCreators([]);
        setLoading(false);
        return;
      }

      // Get unique user IDs from pages
      const creatorIds = [...new Set(pagesData.map(p => p.user_id))];

      // Get profiles for these users
      let query = supabase
        .from('profiles')
        .select('*')
        .in('id', creatorIds);

      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { data: profiles, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Enhance with counts
      const enhancedCreators = await Promise.all(
        (profiles || []).map(async (profile) => {
          const [pagesResult, earningsResult, strikesResult] = await Promise.all([
            supabase.from('pages').select('id', { count: 'exact' }).eq('user_id', profile.id),
            supabase.from('profiles').select('total_earnings').eq('id', profile.id).single(),
            supabase.from('strikes').select('id', { count: 'exact' }).eq('user_id', profile.id).is('removed_at', null),
          ]);

          return {
            ...profile,
            total_pages: pagesResult.count || 0,
            total_earned: earningsResult.data?.total_earnings || 0,
            strikes_count: strikesResult.count || 0,
          };
        })
      );

      setCreators(enhancedCreators);
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

  const exportCSV = () => {
    const csv = [
      ['Name', 'Email', 'Phone', 'Total Pages', 'Total Earned', 'Strikes', 'Created At'],
      ...creators.map(c => [
        c.full_name || '',
        c.email || '',
        c.phone || '',
        c.total_pages || 0,
        c.total_earned || 0,
        c.strikes_count || 0,
        new Date(c.created_at).toLocaleDateString(),
      ]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `creators-${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={exportCSV} disabled={creators.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowStrikeDialog(true)}
            disabled={selectedCreatorIds.length === 0}
          >
            <Shield className="h-4 w-4 mr-2" />
            Add Strike
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedCreatorIds.length === creators.length && creators.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCreatorIds(creators.map(c => c.id));
                      } else {
                        setSelectedCreatorIds([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Pages</TableHead>
                <TableHead>Earned</TableHead>
                <TableHead>Strikes</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <LoadingState label="Carregando criadores..." compact className="mx-auto" />
                  </TableCell>
                </TableRow>
              ) : creators.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No creators found
                  </TableCell>
                </TableRow>
              ) : (
                creators.map((creator) => (
                  <TableRow key={creator.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedCreatorIds.includes(creator.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCreatorIds([...selectedCreatorIds, creator.id]);
                          } else {
                            setSelectedCreatorIds(selectedCreatorIds.filter(id => id !== creator.id));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell onClick={() => setSelectedCreator(creator)}>{creator.full_name || 'N/A'}</TableCell>
                    <TableCell onClick={() => setSelectedCreator(creator)}>{creator.email}</TableCell>
                    <TableCell onClick={() => setSelectedCreator(creator)}>{creator.phone || 'N/A'}</TableCell>
                    <TableCell onClick={() => setSelectedCreator(creator)}>{creator.total_pages}</TableCell>
                    <TableCell onClick={() => setSelectedCreator(creator)}>
                      R$ {(creator.total_earned || 0).toFixed(2)}
                    </TableCell>
                    <TableCell onClick={() => setSelectedCreator(creator)}>
                      {creator.strikes_count ? (
                        <span className="text-destructive font-medium">{creator.strikes_count}</span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell onClick={() => setSelectedCreator(creator)}>
                      {new Date(creator.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedCreator(creator)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {selectedCreator && (
        <CreatorProfileDrawer
          creator={selectedCreator}
          open={!!selectedCreator}
          onClose={() => {
            setSelectedCreator(null);
            fetchCreators();
          }}
        />
      )}

      {showStrikeDialog && (
        <AddStrikeDialog
          open={showStrikeDialog}
          userIds={selectedCreatorIds}
          onClose={() => {
            setShowStrikeDialog(false);
            setSelectedCreatorIds([]);
            fetchCreators();
          }}
        />
      )}
    </div>
  );
}
