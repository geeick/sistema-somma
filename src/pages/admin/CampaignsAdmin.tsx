import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Copy, RefreshCw, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { getNeonAccessToken } from '@/lib/auth';
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

const API_BASE = import.meta.env.VITE_API_BASE || '';

interface Campaign {
  id: string;
  title: string;
  code?: string | null;
  client?: string | null;
  brief?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  budget?: number | string | null;
  platforms?: string[] | string | null;
  required_tags?: string[] | string | null;
  audio_url?: string | null;
  audio_urls?: Record<string, unknown> | null;
  example_urls?: Record<string, unknown> | null;
  rules?: Record<string, unknown> | null;
  max_posts_per_creator?: number | string | null;
  submission_count?: number | string | null;
  participant_count?: number | string | null;
  total_views?: number | string | null;
  total_payout?: number | string | null;
  created_at?: string | null;
}

async function adminRequest(path: string, options: RequestInit = {}) {
  const token = await getNeonAccessToken();

  if (!token) {
    throw new Error('Token de autenticação não encontrado. Entre novamente.');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      `O servidor retornou ${res.status}: ${json?.error || json?.message || 'erro desconhecido'}`
    );
  }

  return json?.data ?? json;
}

function normalizeList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (_err) {
      const normalizedValue = value.trim().replace(/^\{(.*)\}$/, '$1');
      return normalizedValue
        .split(',')
        .map((item) => item.trim().replace(/^"|"$/g, ''))
        .filter(Boolean);
    }
  }

  return [];
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  return date.toLocaleDateString('pt-BR');
}

function asNumber(value: number | string | null | undefined) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatMoney(value: number | string | null | undefined) {
  return `R$ ${asNumber(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value: number | string | null | undefined) {
  return asNumber(value).toLocaleString('pt-BR');
}

function formatPlatformLabel(platform: string) {
  const labels: Record<string, string> = {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    youtube_shorts: 'YouTube Shorts',
  };

  return labels[platform] || platform.replaceAll('_', ' ');
}

export default function CampaignsAdmin() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchCampaigns();
  }, []);

  async function fetchCampaigns() {
    setIsLoading(true);
    setError('');

    try {
      const data = await adminRequest('/api/admin/campaigns');
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching campaigns:', err);
      setError(err.message || 'Não foi possível carregar as campanhas');
      setCampaigns([]);
      toast({
        title: 'Erro',
        description: err.message || 'Não foi possível carregar as campanhas',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await adminRequest(`/api/admin/campaigns/${id}`, {
        method: 'DELETE',
      });

      toast({
        title: 'Sucesso',
        description: 'Campanha excluída com sucesso',
      });

      await fetchCampaigns();
    } catch (err: any) {
      console.error('Error deleting campaign:', err);
      toast({
        title: 'Erro',
        description: err.message || 'Não foi possível excluir a campanha',
        variant: 'destructive',
      });
    } finally {
      setDeleteId(null);
    }
  }

  async function handleDuplicate(campaign: Campaign) {
    try {
      await adminRequest('/api/admin/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          title: `${campaign.title} (Cópia)`,
          code: campaign.code ? `${campaign.code}-copy` : null,
          client: campaign.client || null,
          brief: campaign.brief || null,
          budget: asNumber(campaign.budget),
          start_date: campaign.start_date || null,
          end_date: campaign.end_date,
          required_tags: normalizeList(campaign.required_tags),
          platforms: normalizeList(campaign.platforms),
          audio_url: campaign.audio_url || null,
          audio_urls: campaign.audio_urls || null,
          example_urls: campaign.example_urls || null,
          rules: campaign.rules || null,
          max_posts_per_creator: campaign.max_posts_per_creator || 1,
          status: 'draft',
        }),
      });

      toast({
        title: 'Sucesso',
        description: 'Campanha duplicada com sucesso',
      });

      await fetchCampaigns();
    } catch (err: any) {
      console.error('Error duplicating campaign:', err);
      toast({
        title: 'Erro',
        description: err.message || 'Não foi possível duplicar a campanha',
        variant: 'destructive',
      });
    }
  }

  function exportCsv() {
    const rows = [
      [
        'Título',
        'Código',
        'Cliente',
        'Status',
        'Orçamento',
        'Gasto',
        'Submissões',
        'Participantes',
        'Visualizações',
        'Início',
        'Fim',
        'Plataformas',
        'Tags Obrigatórias',
      ],
      ...campaigns.map((campaign) => [
        campaign.title,
        campaign.code || '',
        campaign.client || '',
        statusLabels[campaign.status || 'unknown'] || campaign.status || '',
        asNumber(campaign.budget).toString(),
        asNumber(campaign.total_payout).toFixed(2),
        asNumber(campaign.submission_count).toString(),
        asNumber(campaign.participant_count).toString(),
        asNumber(campaign.total_views).toString(),
        formatDate(campaign.start_date),
        formatDate(campaign.end_date),
        normalizeList(campaign.platforms).map(formatPlatformLabel).join('; '),
        normalizeList(campaign.required_tags).join('; '),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campanhas-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-500',
    active: 'bg-green-500',
    closed: 'bg-red-500',
    archived: 'bg-gray-700',
  };

  const statusLabels: Record<string, string> = {
    draft: 'Rascunho',
    active: 'Ativa',
    closed: 'Encerrada',
    archived: 'Arquivada',
    unknown: 'Desconhecido',
  };

  if (isLoading) {
    return <div className="flex justify-center py-8">Carregando campanhas...</div>;
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Não foi possível carregar as campanhas
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchCampaigns}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Campanhas</h1>
          <p className="text-muted-foreground">Crie e gerencie suas campanhas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={campaigns.length === 0}>
            Exportar CSV
          </Button>
          <Button onClick={() => navigate('/admin/campaigns/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Campanha
          </Button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma campanha encontrada.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {campaigns.map((campaign) => {
            const totalPayout = asNumber(campaign.total_payout);
            const budget = asNumber(campaign.budget);
            const remainingBudget = budget - totalPayout;
            const platforms = normalizeList(campaign.platforms);
            const requiredTags = normalizeList(campaign.required_tags);
            const status = campaign.status || 'unknown';

            return (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2 flex-wrap">
                        {campaign.title}
                        {campaign.code && (
                          <Badge variant="outline" className="font-mono">
                            {campaign.code}
                          </Badge>
                        )}
                        <Badge className={statusColors[status] || 'bg-gray-500'}>
                          {statusLabels[status] || status}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Cliente: {campaign.client || 'Não informado'} • Orçamento: {formatMoney(campaign.budget)}
                      </CardDescription>
                      <div className="mt-2 flex gap-4 text-sm flex-wrap">
                        <span className="text-primary font-medium">
                          Gasto: {formatMoney(totalPayout)}
                        </span>
                        <span className="text-muted-foreground">
                          {formatNumber(campaign.submission_count)} envios
                        </span>
                        <span className="text-muted-foreground">
                          {formatNumber(campaign.participant_count)} participantes
                        </span>
                        <span className="text-muted-foreground">
                          {formatNumber(campaign.total_views)} visualizações
                        </span>
                        <span className={remainingBudget < 0 ? 'text-destructive font-medium' : 'text-green-600 font-medium'}>
                          Restante: {formatMoney(remainingBudget)}
                        </span>
                      </div>
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
                      <p className="text-muted-foreground">Data de início</p>
                      <p className="font-medium">{formatDate(campaign.start_date)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Data de término</p>
                      <p className="font-medium">{formatDate(campaign.end_date)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Plataformas</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {platforms.length > 0 ? (
                          platforms.map((platform) => (
                            <Badge key={platform} variant="secondary">
                              {formatPlatformLabel(platform)}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">Nenhuma</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tags obrigatórias</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {requiredTags.length > 0 ? (
                          requiredTags.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">Livre</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja excluir esta campanha? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
