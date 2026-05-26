import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
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

interface Campaign {
  id: string;
  title: string;
  code?: string | null;
  client: string;
  status: string;
  start_date: string;
  end_date: string;
  budget: number;
  platforms: string[];
  required_tags: string[];
}

interface CampaignCost {
  campaign_id: string;
  total_submissions: number;
  total_cost: number;
  total_views: number;
  remaining_budget: number;
}

export default function CampaignsAdmin() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignCosts, setCampaignCosts] = useState<Record<string, CampaignCost>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchCampaigns();
    fetchCampaignCosts();

    // Subscribe to submission changes to update costs in real-time
    const channel = supabase
      .channel('campaigns-costs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submissions',
        },
        () => {
          fetchCampaignCosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchCampaigns() {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast({
        title: 'Error',
        description: 'Failed to load campaigns',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchCampaignCosts() {
    try {
      const { data, error } = await supabase
        .from('campaign_costs')
        .select('*');

      if (error) throw error;
      
      const costsMap: Record<string, CampaignCost> = {};
      data?.forEach((cost) => {
        costsMap[cost.campaign_id] = cost;
      });
      setCampaignCosts(costsMap);
    } catch (error) {
      console.error('Error fetching campaign costs:', error);
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Campaign deleted successfully',
      });
      fetchCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete campaign',
        variant: 'destructive',
      });
    }
    setDeleteId(null);
  }

  async function handleDuplicate(campaign: Campaign) {
    try {
      const { id, ...campaignData } = campaign;
      const { error } = await supabase
        .from('campaigns')
        .insert([{
          ...campaignData,
          title: `${campaign.title} (Copy)`,
          status: 'draft',
          platforms: campaignData.platforms as any,
        }]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Campaign duplicated successfully',
      });
      fetchCampaigns();
    } catch (error) {
      console.error('Error duplicating campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to duplicate campaign',
        variant: 'destructive',
      });
    }
  }

  const statusColors = {
    draft: 'bg-gray-500',
    active: 'bg-green-500',
    closed: 'bg-red-500',
    archived: 'bg-gray-700',
  };

  if (isLoading) {
    return <div className="flex justify-center py-8">Loading campaigns...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Campanhas</h1>
          <p className="text-muted-foreground">Criar e gerenciar suas campanhas</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const csv = [
                ['Título', 'Código', 'Cliente', 'Status', 'Orçamento', 'Gasto', 'Submissões', 'Visualizações', 'Início', 'Fim', 'Plataformas', 'Tags Obrigatórias'],
                ...campaigns.map(c => [
                  c.title,
                  c.code || '',
                  c.client || '',
                  c.status,
                  c.budget?.toString() || '0',
                  campaignCosts[c.id]?.total_cost.toFixed(2) || '0',
                  campaignCosts[c.id]?.total_submissions || '0',
                  campaignCosts[c.id]?.total_views || '0',
                  new Date(c.start_date).toLocaleDateString('pt-BR'),
                  new Date(c.end_date).toLocaleDateString('pt-BR'),
                  c.platforms?.join('; ') || '',
                  c.required_tags?.join('; ') || '',
                ]),
              ].map(row => row.join(',')).join('\n');
              
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `campanhas-${new Date().toISOString()}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            disabled={campaigns.length === 0}
          >
            Exportar CSV
          </Button>
          <Button onClick={() => navigate('/admin/campaigns/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Campanha
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {campaigns.map((campaign) => (
          <Card key={campaign.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    {campaign.title}
                    {campaign.code && (
                      <Badge variant="outline" className="font-mono">
                        {campaign.code}
                      </Badge>
                    )}
                    <Badge className={statusColors[campaign.status as keyof typeof statusColors]}>
                      {campaign.status}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Client: {campaign.client || 'N/A'} • Budget: R$ {campaign.budget?.toLocaleString() || '0'}
                  </CardDescription>
                  {campaignCosts[campaign.id] && (
                    <div className="mt-2 flex gap-4 text-sm">
                      <span className="text-primary font-medium">
                        Spent: R$ {campaignCosts[campaign.id].total_cost.toFixed(2)}
                      </span>
                      <span className="text-muted-foreground">
                        {campaignCosts[campaign.id].total_submissions} submissions
                      </span>
                      <span className="text-muted-foreground">
                        {campaignCosts[campaign.id].total_views.toLocaleString()} views
                      </span>
                      <span className={campaignCosts[campaign.id].remaining_budget < 0 ? 'text-destructive font-medium' : 'text-green-600 font-medium'}>
                        Remaining: R$ {campaignCosts[campaign.id].remaining_budget.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDuplicate(campaign)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigate(`/admin/campaigns/${campaign.id}/edit`)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setDeleteId(campaign.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Start Date</p>
                  <p className="font-medium">{new Date(campaign.start_date).toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">End Date</p>
                  <p className="font-medium">{new Date(campaign.end_date).toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Platforms</p>
                  <div className="flex gap-1 mt-1">
                    {campaign.platforms?.map((p) => (
                      <Badge key={p} variant="secondary">{p}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Required Tags</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {campaign.required_tags?.map((t) => (
                      <Badge key={t} variant="outline">{t}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
