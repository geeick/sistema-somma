import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AddStrikeDialogProps {
  open: boolean;
  userIds: string[];
  onClose: () => void;
}

export function AddStrikeDialog({ open, userIds, onClose }: AddStrikeDialogProps) {
  const [level, setLevel] = useState('warning');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast({
        title: 'Erro',
        description: 'Por favor, forneça um motivo para o strike',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      console.log('Adding strikes to users:', userIds);

      // Add strike for each selected user
      for (const userId of userIds) {
        console.log('Adding strike to user:', userId, { level, reason });
        
        const { data, error } = await supabase.functions.invoke('admin-actions', {
          body: {
            action: 'add_strike',
            payload: { user_id: userId, level, reason },
          },
        });

        console.log('Strike response:', { data, error });

        if (error) {
          console.error('Strike error:', error);
          throw error;
        }

        // Get current strike count for this user
        const { count } = await supabase
          .from('strikes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .is('removed_at', null);

        const strikeCount = count || 0;

        // Send email notification
        try {
          await supabase.functions.invoke('send-strike-email', {
            body: {
              user_id: userId,
              level,
              reason,
              strike_count: strikeCount,
            },
          });
        } catch (emailError) {
          console.error('Failed to send strike email:', emailError);
          // Continue even if email fails
        }

        // If user has 3 or more strikes, block all their pages
        if (strikeCount >= 3) {
          const { error: blockError } = await supabase
            .from('pages')
            .update({ status: 'blocked' })
            .eq('user_id', userId);

          if (blockError) {
            console.error('Failed to block pages:', blockError);
          }
        }
      }

      toast({
        title: 'Sucesso',
        description: `Strike(s) adicionado(s) para ${userIds.length} criador(es)`,
      });

      // Reset form
      setReason('');
      setLevel('warning');
      onClose();
    } catch (error: any) {
      console.error('Failed to add strike:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao adicionar strike. Verifique o console para mais detalhes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Strike</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Nível</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warning">Aviso</SelectItem>
                <SelectItem value="moderate">Moderado</SelectItem>
                <SelectItem value="severe">Grave</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Motivo</Label>
            <Textarea
              placeholder="Explique por que este strike está sendo emitido..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            Este strike será aplicado a {userIds.length} criador(es). Após 3 strikes, as páginas do criador serão bloqueadas.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Adicionando...' : 'Adicionar Strike'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
