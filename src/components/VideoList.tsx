import { useEffect, useState } from "react";
import apiClient from "@/integrations/apiClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Instagram, Play, RefreshCw, Youtube, Inbox } from "lucide-react";

interface Video {
  id: string;
  title: string | null;
  platform: "instagram" | "tiktok" | "youtube_shorts" | "twitter" | string;
  status: "pending" | "approved" | "rejected" | "paid" | "deleted" | string;
  payment_amount: number | string | null;
  uploaded_at: string | null;
  created_at?: string | null;
  views_count: number | string | null;
  likes_count?: number | string | null;
  username?: string | null;
  metrics_source?: string | null;
  metrics_synced_at?: string | null;
  post_url: string | null;
}

interface VideoListProps {
  userId?: string;
  refreshKey?: number;
}

const platformIcons: Record<string, any> = { instagram: Instagram, tiktok: Play, youtube_shorts: Youtube };
const platformColors: Record<string, string> = { instagram: "text-pink-700", tiktok: "text-foreground", youtube_shorts: "text-red-700" };
const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-red-100 text-red-900",
  paid: "bg-blue-100 text-blue-900",
  deleted: "bg-gray-200 text-gray-800",
};
const statusLabels: Record<string, string> = { pending: "Em análise", approved: "Aprovado", rejected: "Rejeitado", paid: "Pago", deleted: "Excluído" };

function toNumber(value: number | string | null | undefined) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}
function formatNumber(value: number | string | null | undefined) { return toNumber(value).toLocaleString("pt-BR"); }
function formatMoney(value: number | string | null | undefined) {
  return toNumber(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(value: string | null | undefined) {
  if (!value) return "Não informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Não informado" : date.toLocaleDateString("pt-BR");
}
function normalizeUsername(username: string | null | undefined) {
  if (!username) return "—";
  return username.startsWith("@") ? username : `@${username}`;
}

export const VideoList = ({ userId, refreshKey = 0 }: VideoListProps) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVideos = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const data = await apiClient.tables.list("submissions", { user_id: userId });
      const vids = (data || [])
        .filter((video: Video) => video.status !== "deleted")
        .sort((a: Video, b: Video) => new Date(b.uploaded_at || b.created_at || 0).getTime() - new Date(a.uploaded_at || a.created_at || 0).getTime());
      setVideos(vids);
    } catch (err) {
      console.error("Erro ao carregar vídeos:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
    return undefined;
  }, [userId, refreshKey]);

  if (isLoading) return <div className="ui-caption font-semibold">Carregando envios...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-[1.8rem] font-extrabold tracking-[-0.04em]">Envios recentes</h2>
          <p className="ui-caption mt-1">Acompanhe aprovação, métricas e pagamentos dos seus conteúdos.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchVideos} className="rounded-xl font-bold">
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      {videos.length === 0 ? (
        <div className="empty-state">
          <Inbox className="h-8 w-8 text-primary" />
          <p className="font-extrabold">Nenhum conteúdo enviado ainda</p>
          <p className="ui-caption max-w-md">Seus envios aparecerão aqui com status, métricas e ganhos assim que você participar de uma campanha.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {videos.map((video) => {
            const PlatformIcon = platformIcons[video.platform];
            const uploadedAt = video.uploaded_at || video.created_at;
            const statusClass = statusColors[video.status] || "bg-muted text-muted-foreground";
            return (
              <Card key={video.id} className="somma-panel somma-card-hover rounded-2xl">
                <CardContent className="p-5 md:p-6">
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-background/80 border border-border flex items-center justify-center">
                        {PlatformIcon && <PlatformIcon className={`h-5 w-5 ${platformColors[video.platform] || "text-foreground"}`} />}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-[1.02rem]">{video.title || "Envio"}</h3>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[0.78rem] font-bold ${statusClass}`}>{statusLabels[video.status] || video.status}</span>
                          {video.post_url && <a href={video.post_url} target="_blank" rel="noopener noreferrer" className="text-[0.84rem] font-bold text-primary hover:underline">Ver publicação</a>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-5">
                    <div><p className="ui-caption">Usuário</p><p className="font-bold mt-0.5">{normalizeUsername(video.username)}</p></div>
                    <div><p className="ui-caption">Curtidas</p><p className="font-bold mt-0.5">{formatNumber(video.likes_count)}</p></div>
                    <div><p className="ui-caption">Visualizações</p><p className="font-extrabold text-primary mt-0.5">{formatNumber(video.views_count)}</p></div>
                    <div><p className="ui-caption">Ganhos</p><p className="font-extrabold text-primary mt-0.5">R$ {formatMoney(video.payment_amount)}</p></div>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-border text-sm">
                    <div><p className="ui-caption">Enviado em</p><p className="font-semibold mt-0.5">{formatDate(uploadedAt)}</p></div>
                    <div><p className="ui-caption">Fonte das métricas</p><p className="font-semibold mt-0.5">{video.metrics_source || "Ainda não sincronizado"}</p></div>
                    <div><p className="ui-caption">Última sincronização</p><p className="font-semibold mt-0.5">{formatDate(video.metrics_synced_at)}</p></div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
