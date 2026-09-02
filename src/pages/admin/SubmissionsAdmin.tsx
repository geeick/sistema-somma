import { useEffect, useMemo, useState } from "react";
import { getNeonAccessToken } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle,
  DollarSign,
  ExternalLink,
  Eye,
  Instagram,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Video,
  XCircle,
  Youtube,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "";

type Submission = {
  id: string;
  title: string | null;
  description?: string | null;
  platform: string | null;
  status: string | null;
  views_count: number | string | null;
  likes_count?: number | string | null;
  payment_amount?: number | string | null;
  username?: string | null;
  uploaded_at?: string | null;
  created_at?: string | null;
  post_url: string | null;
  thumbnail_url?: string | null;
  user_id: string;
  campaign_id: string | null;
  reason_code?: string | null;
  audio_verified?: boolean | null;
  metrics_synced_at?: string | null;
  metrics_source?: string | null;

  campaign_title?: string | null;
  page_handle?: string | null;
  page_platform?: string | null;
  page_follower_count?: number | string | null;
  page_verified?: boolean | null;
  creator_email?: string | null;
  creator_name?: string | null;
  creator_role?: string | null;
};

async function adminRequest(path: string, options: RequestInit = {}) {
  const token = await getNeonAccessToken();

  if (!token) {
    throw new Error("Token de autenticação não encontrado. Entre novamente.");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      `O servidor retornou ${res.status}: ${
        json?.details || json?.error || json?.message || "erro desconhecido"
      }`
    );
  }

  return json?.data;
}

function toNumber(value: number | string | null | undefined) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function formatNumber(value: number | string | null | undefined) {
  return toNumber(value).toLocaleString("pt-BR");
}

function formatMoney(value: number | string | null | undefined) {
  return `R$ ${toNumber(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Não informado";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";

  return date.toLocaleDateString("pt-BR");
}

function getStatusBadgeVariant(status: string | null | undefined) {
  if (status === "approved") return "default";
  if (status === "paid") return "default";
  if (status === "rejected") return "destructive";
  if (status === "deleted") return "outline";
  return "secondary";
}

function getPlatformIcon(platform: string | null | undefined) {
  switch (platform) {
    case "instagram":
      return <Instagram className="h-4 w-4 text-primary" />;
    case "youtube":
    case "youtube_shorts":
      return <Youtube className="h-4 w-4 text-primary" />;
    default:
      return <Video className="h-4 w-4 text-primary" />;
  }
}

function normalizePlatform(platform: string | null | undefined) {
  if (!platform) return "desconhecida";
  return platform.replace("_", " ");
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  paid: "Pago",
  deleted: "Excluído",
  unknown: "Desconhecido",
};

const metricsSourceLabels: Record<string, string> = {
  scraper: "Coleta automática",
  google_sheets: "Google Sheets",
  instagram_graph_api: "Instagram API",
  instagram_graph_api_basic: "Instagram API",
  tiktok_display_api: "TikTok API",
  youtube_data_api: "YouTube API",
  manual: "Entrada manual",
};

export default function SubmissionsAdmin() {
  const { toast } = useToast();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewDialog, setViewDialog] = useState<Submission | null>(null);
  const [manualMetricsDialog, setManualMetricsDialog] = useState<Submission | null>(null);
  const [manualUsername, setManualUsername] = useState("");
  const [manualLikes, setManualLikes] = useState("");
  const [manualPlays, setManualPlays] = useState("");
  const [error, setError] = useState("");
  const [rawResponse, setRawResponse] = useState<any>(null);

  const loadSubmissions = async () => {
    setIsLoading(true);
    setError("");
    setRawResponse(null);

    try {
      const data = await adminRequest("/api/admin/submissions");
      setRawResponse(data);
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to load submissions:", err);
      setError(err.message || "Não foi possível carregar os envios");
      setSubmissions([]);

      toast({
        title: "Erro",
        description: "Não foi possível carregar os envios",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const platforms = useMemo(() => {
    return Array.from(
      new Set(
        submissions
          .map((submission) => submission.platform)
          .filter((platform): platform is string => Boolean(platform))
      )
    ).sort();
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return submissions.filter((submission) => {
      const statusMatches =
        statusFilter === "all" || submission.status === statusFilter;

      const platformMatches =
        platformFilter === "all" || submission.platform === platformFilter;

      const searchMatches =
        !query ||
        [
          submission.title || "",
          submission.campaign_title || "",
          submission.platform || "",
          submission.status || "",
          submission.username || "",
          submission.creator_email || "",
          submission.creator_name || "",
          submission.page_handle || "",
          submission.user_id || "",
          submission.post_url || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return statusMatches && platformMatches && searchMatches;
    });
  }, [submissions, statusFilter, platformFilter, search]);

  const updateSubmission = async (
    id: string,
    updates: Partial<
      Pick<
        Submission,
        "status" | "views_count" | "likes_count" | "payment_amount" | "audio_verified"
      >
    >
  ) => {
    setIsUpdatingId(id);

    try {
      const updated = await adminRequest(`/api/admin/submissions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });

      setSubmissions((current) =>
        current.map((submission) =>
          submission.id === id ? { ...submission, ...updated } : submission
        )
      );

      toast({
        title: "Sucesso",
        description: "Envio atualizado",
      });
    } catch (err: any) {
      console.error("Failed to update submission:", err);
      toast({
        title: "Erro",
        description: err.message || "Não foi possível atualizar o envio",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingId(null);
    }
  };

  const syncMetrics = async (id: string) => {
    setIsUpdatingId(id);

    try {
      const updated = await adminRequest(
        `/api/admin/submissions/${id}/sync-metrics`,
        {
          method: "POST",
        }
      );

      setSubmissions((current) =>
        current.map((submission) =>
          submission.id === id ? { ...submission, ...updated } : submission
        )
      );

      toast({
        title: "Sucesso",
        description: "Métricas sincronizadas automaticamente",
      });
    } catch (err: any) {
      console.error("Failed to sync metrics:", err);
      toast({
        title: "Erro",
        description:
          err.message ||
          "Não foi possível sincronizar as métricas. Verifique a rota de coleta automática no servidor.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingId(null);
    }
  };

  const openManualMetrics = (submission: Submission) => {
    setManualMetricsDialog(submission);
    setManualUsername(submission.username || "");
    setManualLikes(String(submission.likes_count || ""));
    setManualPlays(String(submission.views_count || ""));
  };

  const saveManualMetrics = async () => {
    if (!manualMetricsDialog) return;

    setIsUpdatingId(manualMetricsDialog.id);

    try {
      const updated = await adminRequest(
        `/api/admin/submissions/${manualMetricsDialog.id}/metrics`,
        {
          method: "PATCH",
          body: JSON.stringify({
            username: manualUsername.trim() || null,
            likes: Number(manualLikes || 0),
            plays: Number(manualPlays || 0),
          }),
        }
      );

      setSubmissions((current) =>
        current.map((submission) =>
          submission.id === manualMetricsDialog.id
            ? { ...submission, ...updated }
            : submission
        )
      );

      toast({
        title: "Sucesso",
        description: "Métricas manuais salvas",
      });

      setManualMetricsDialog(null);
    } catch (err: any) {
      console.error("Failed to save manual metrics:", err);
      toast({
        title: "Erro",
        description:
          err.message ||
          "Não foi possível salvar as métricas manuais. Verifique a rota de métricas no servidor.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingId(null);
    }
  };

  const softDeleteSubmission = async (submission: Submission) => {
    await updateSubmission(submission.id, { status: "deleted" });
  };

  const exportCsv = () => {
    const rows = [
      [
        "Criador",
        "Email",
        "Nome de usuário",
        "Título",
        "Campanha",
        "Plataforma",
        "Curtidas",
        "Visualizações",
        "Pagamento",
        "Status",
        "Enviado em",
        "URL da publicação",
        "Origem das métricas",
      ],
      ...filteredSubmissions.map((submission) => [
        submission.creator_name ||
          submission.creator_email ||
          submission.page_handle ||
          submission.user_id ||
          "",
        submission.creator_email || "",
        submission.username || "",
        submission.title || "",
        submission.campaign_title || "",
        submission.platform || "",
        String(submission.likes_count || 0),
        String(submission.views_count || 0),
        String(submission.payment_amount || 0),
        statusLabels[submission.status || "unknown"] || submission.status || "",
        formatDate(submission.uploaded_at || submission.created_at),
        submission.post_url || "",
        metricsSourceLabels[submission.metrics_source || ""] || submission.metrics_source || "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `envios-${new Date().toISOString()}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-card border-border max-w-3xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <CardTitle>Não foi possível carregar os envios</CardTitle>
                <CardDescription>{error}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <Button onClick={loadSubmissions}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>

            <div className="rounded-lg bg-muted p-4">
              <p className="font-semibold mb-2">Informações técnicas</p>
              <pre className="text-xs whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(rawResponse, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Submissões de Conteúdo</h1>
          <p className="text-muted-foreground">
            Revise envios, sincronize métricas e aprove pagamentos aos criadores.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={filteredSubmissions.length === 0}
        >
          Exportar CSV
        </Button>
      </div>

      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>

          <div className="flex flex-col gap-4 mt-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por criador, usuário, campanha ou URL..."
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="deleted">Excluído</SelectItem>
              </SelectContent>
            </Select>

            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as plataformas</SelectItem>
                {platforms.map((platform) => (
                  <SelectItem key={platform} value={platform}>
                    {normalizePlatform(platform)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Criador</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead className="text-right">Curtidas</TableHead>
                  <TableHead className="text-right">Visualizações</TableHead>
                  <TableHead className="text-right">Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredSubmissions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-center text-muted-foreground py-8"
                    >
                      Nenhum envio encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubmissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell>
                        <div className="font-medium">
                          {submission.creator_name ||
                            submission.creator_email ||
                            submission.page_handle ||
                            "Desconhecido"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {submission.username
                            ? `@${submission.username.replace(/^@/, "")}`
                            : submission.user_id}
                        </div>
                      </TableCell>

                      <TableCell className="max-w-xs">
                        <div className="truncate">
                          {submission.title || "Envio sem título"}
                        </div>
                        {submission.post_url && (
                          <a
                            href={submission.post_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary inline-flex items-center gap-1"
                          >
                            Abrir publicação
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </TableCell>

                      <TableCell>
                        {submission.campaign_title || "Sem campanha"}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2 capitalize">
                          {getPlatformIcon(submission.platform)}
                          {normalizePlatform(submission.platform)}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        {formatNumber(submission.likes_count)}
                      </TableCell>

                      <TableCell className="text-right">
                        {formatNumber(submission.views_count)}
                      </TableCell>

                      <TableCell className="text-right">
                        {formatMoney(submission.payment_amount)}
                      </TableCell>

                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(submission.status)}>
                          {statusLabels[submission.status || "unknown"] || submission.status}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {formatDate(submission.uploaded_at || submission.created_at)}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewDialog(submission)}
                            title="Ver envio"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdatingId === submission.id}
                            onClick={() => syncMetrics(submission.id)}
                            title="Buscar as métricas mais recentes diretamente da API da plataforma"
                          >
                            {isUpdatingId === submission.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Atualizando...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Atualizar agora
                              </>
                            )}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdatingId === submission.id}
                            onClick={() => openManualMetrics(submission)}
                          >
                            Métricas manuais
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdatingId === submission.id}
                            onClick={() =>
                              updateSubmission(submission.id, {
                                status: "approved",
                                audio_verified: true,
                              })
                            }
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdatingId === submission.id}
                            onClick={() =>
                              updateSubmission(submission.id, {
                                status: "rejected",
                              })
                            }
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rejeitar
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdatingId === submission.id}
                            onClick={() =>
                              updateSubmission(submission.id, {
                                status: "paid",
                              })
                            }
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Marcar como pago
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isUpdatingId === submission.id}
                            onClick={() => softDeleteSubmission(submission)}
                            title="Marcar como excluído"
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
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!viewDialog} onOpenChange={() => setViewDialog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewDialog && getPlatformIcon(viewDialog.platform)}
              {viewDialog?.title || "Envio"}
            </DialogTitle>
            <DialogDescription>
              Enviado por{" "}
              {viewDialog?.creator_name ||
                viewDialog?.creator_email ||
                viewDialog?.page_handle ||
                "Desconhecido"}{" "}
              em {formatDate(viewDialog?.uploaded_at || viewDialog?.created_at)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {viewDialog?.post_url && (
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">URL da publicação</span>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={viewDialog.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir publicação
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
                <span className="text-sm font-medium">Campanha</span>
                <p className="text-sm text-muted-foreground">
                  {viewDialog?.campaign_title || "N/A"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium">Plataforma</span>
                <p className="text-sm text-muted-foreground capitalize">
                  {normalizePlatform(viewDialog?.platform)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium">Nome de usuário</span>
                <p className="text-sm text-muted-foreground">
                  {viewDialog?.username || "Ainda não sincronizado"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium">Status</span>
                <div>
                  <Badge variant={getStatusBadgeVariant(viewDialog?.status)}>
                    {statusLabels[viewDialog?.status || "unknown"] || viewDialog?.status}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium">Curtidas</span>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(viewDialog?.likes_count)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium">Visualizações</span>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(viewDialog?.views_count)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium">Pagamento</span>
                <p className="text-sm text-muted-foreground">
                  {formatMoney(viewDialog?.payment_amount)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium">Origem das métricas</span>
                <p className="text-sm text-muted-foreground">
                  {metricsSourceLabels[viewDialog?.metrics_source || ""] || viewDialog?.metrics_source || "Ainda não sincronizado"}
                </p>
              </div>
            </div>

            {viewDialog?.reason_code && (
              <div className="space-y-1">
                <span className="text-sm font-medium text-destructive">
                  Motivo da rejeição
                </span>
                <p className="text-sm text-muted-foreground">
                  {viewDialog.reason_code}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialog(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!manualMetricsDialog}
        onOpenChange={() => setManualMetricsDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Métricas manuais</DialogTitle>
            <DialogDescription>
              Informe as métricas manualmente. O servidor calculará o pagamento com base nas reproduções e visualizações.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome de usuário</Label>
              <Input
                value={manualUsername}
                onChange={(event) => setManualUsername(event.target.value)}
                placeholder="nome_do_criador"
              />
            </div>

            <div>
              <Label>Curtidas</Label>
              <Input
                type="number"
                min="0"
                value={manualLikes}
                onChange={(event) => setManualLikes(event.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <Label>Reproduções / visualizações</Label>
              <Input
                type="number"
                min="0"
                value={manualPlays}
                onChange={(event) => setManualPlays(event.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setManualMetricsDialog(null)}
            >
              Cancelar
            </Button>

            <Button
              onClick={saveManualMetrics}
              disabled={
                !!manualMetricsDialog &&
                isUpdatingId === manualMetricsDialog.id
              }
            >
              Salvar métricas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
