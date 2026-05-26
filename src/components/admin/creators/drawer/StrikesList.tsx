import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Strike {
  id: string;
  level: string;
  reason: string;
  created_at: string;
  removed_at: string | null;
}

export function StrikesList({ userId }: { userId: string }) {
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStrikes();
  }, [userId]);

  const fetchStrikes = async () => {
    try {
      const { data, error } = await supabase
        .from('strikes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStrikes(data || []);
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

  const removeStrike = async (strikeId: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'remove_strike',
          payload: { strike_id: strikeId },
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Strike removed',
      });

      fetchStrikes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'warning': return 'secondary';
      case 'moderate': return 'default';
      case 'severe': return 'destructive';
      default: return 'outline';
    }
  };

  if (loading) return <div className="text-center py-4">Loading...</div>;
  if (strikes.length === 0) return <div className="text-center py-4 text-muted-foreground">No strikes</div>;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Level</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {strikes.map((strike) => (
            <TableRow key={strike.id}>
              <TableCell>
                <Badge variant={getLevelColor(strike.level)}>
                  {strike.level}
                </Badge>
              </TableCell>
              <TableCell>{strike.reason}</TableCell>
              <TableCell>{new Date(strike.created_at).toLocaleDateString()}</TableCell>
              <TableCell>
                {strike.removed_at ? (
                  <Badge variant="outline">Removed</Badge>
                ) : (
                  <Badge>Active</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {!strike.removed_at && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStrike(strike.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
