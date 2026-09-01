import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "@/integrations/apiClient";
import { getNeonAccessToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { normalizeStringList } from "@/lib/normalizeStringList";

interface UploadVideoProps {
  userId?: string;
  fixedCampaignId?: string;
  fixedCampaign?: Partial<Campaign> | null;
  showCampaignDetailsLink?: boolean;
  onSubmissionCreated?: () => void;
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const submissionSchema = z.object({
  campaignId: z.string().uuid("Selecione uma campanha"),
  pageId: z.string().min(1, "Selecione uma das suas páginas aprovadas"),
  postUrl: z.string().trim().url("URL da publicação inválida").max(500, "A URL precisa ter menos de 500 caracteres"),
  platform: z.enum(["instagram", "tiktok", "youtube_shorts"]),
  audioUrl: z.string().trim().url("URL do áudio inválida").optional().or(z.literal("")),
  tiktokVideoId: z.string().optional(),
});

interface Campaign {
  id: string;
  title: string;
  status: string;
  end_date: string;
  platforms?: string[] | string | null;
  required_tags?: string[] | string | null;
  audio_url?: string | null;
}

interface Page {
  id: string;
  platform: "instagram" | "tiktok" | "youtube_shorts";
  handle: string;
  url: string | null;
  verified?: boolean | null;
  tags?: string[] | string | null;
}

interface TikTokVideo {
  id: string;
  title?: string | null;
  video_description?: string | null;
  share_url?: string | null;
  cover_image_url?: string | null;
  like_count?: number | null;
  comment_count?: number | null;
  share_count?: number | null;
  view_count?: number | null;
  create_time?: number | string | null;
}

function normalizePlatform(platform?: string | null) {
  const labels: Record<string, string> = {
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube_shorts: "YouTube Shorts",
  };

  if (!platform) return "plataforma";
  return labels[platform] || platform.replace("_", " ");
}

function formatCount(value: number | null | undefined) {
  const count = Number(value || 0);
  return count.toLocaleString("pt-BR");
}

function getVideoLabel(video: TikTokVideo) {
  return (
    video.title ||
    video.video_description ||
    video.share_url ||
    `Vídeo do TikTok ${video.id}`
  );
}

function pageMatchesRequiredTags(page: Page, requiredTags: string[]) {
  if (requiredTags.length === 0) return true;

  const pageTags = normalizeStringList(page.tags).map((tag) => tag.toLowerCase());
  return requiredTags.some((tag) => pageTags.includes(tag.toLowerCase()));
}

export const UploadVideo = ({
  userId,
  fixedCampaignId,
  fixedCampaign,
  showCampaignDetailsLink = true,
  onSubmissionCreated,
}: UploadVideoProps) => {
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>(fixedCampaignId || "");
  const [platform, setPlatform] = useState<"instagram" | "tiktok" | "youtube_shorts" | "">("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");

  const [tiktokVideos, setTikTokVideos] = useState<TikTokVideo[]>([]);
  const [selectedTikTokVideoId, setSelectedTikTokVideoId] = useState("");
  const [isLoadingTikTokVideos, setIsLoadingTikTokVideos] = useState(false);

  const selectedCampaignData =
    campaigns.find((campaign) => campaign.id === selectedCampaign) ||
    (fixedCampaignId && fixedCampaign?.id === fixedCampaignId ? (fixedCampaign as Campaign) : null);

  const selectedTikTokVideo = tiktokVideos.find((video) => video.id === selectedTikTokVideoId) || null;
  const selectedCampaignRequiredTags = normalizeStringList(selectedCampaignData?.required_tags);
  const selectedCampaignPlatforms = normalizeStringList(selectedCampaignData?.platforms);

  const rawApprovedPages = pages.filter((page) => {
    if (!platform) return false;
    return page.platform === platform && page.verified === true;
  });

  const approvedPages = rawApprovedPages.filter((page) =>
    pageMatchesRequiredTags(page, selectedCampaignRequiredTags)
  );

  const allowedCampaigns = campaigns.filter((campaign) => {
    if (!platform) return true;

    const allowedPlatforms = normalizeStringList(campaign.platforms);
    return allowedPlatforms.length === 0 || allowedPlatforms.includes(platform);
  });

  const fetchCampaigns = async () => {
    try {
      const data = await apiClient.campaigns.active();
      const activeCampaigns = Array.isArray(data) ? data : [];

      if (fixedCampaign && fixedCampaignId && !activeCampaigns.some((item: Campaign) => item.id === fixedCampaignId)) {
        setCampaigns([fixedCampaign as Campaign, ...activeCampaigns]);
      } else {
        setCampaigns(activeCampaigns);
      }
    } catch (err) {
      console.error("Erro ao carregar campanhas:", err);
      if (fixedCampaign && fixedCampaignId) {
        setCampaigns([fixedCampaign as Campaign]);
      } else {
        toast.error("Não foi possível carregar as campanhas");
      }
    }
  };

  const fetchPages = async () => {
    try {
      const data = await apiClient.pages.list();
      setPages(data || []);
    } catch (err) {
      console.error("Erro ao carregar páginas:", err);
      toast.error("Não foi possível carregar suas páginas aprovadas");
    }
  };

  const fetchTikTokVideos = async () => {
    if (!userId) return;

    setIsLoadingTikTokVideos(true);

    try {
      const token = await getNeonAccessToken();

      if (!token) {
        throw new Error("Token de login ausente. Saia e entre novamente.");
      }

      const response = await fetch(`${API_BASE}/api/tiktok/videos`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || json.details || "Não foi possível carregar vídeos do TikTok");
      }

      const videos = Array.isArray(json.data) ? json.data : [];
      setTikTokVideos(videos);

      if (videos.length === 0) {
        toast.info("TikTok conectado, mas nenhum vídeo público foi retornado.");
      }
    } catch (err: any) {
      console.error("Erro nos vídeos do TikTok:", err);
      toast.error(err.message || "Não foi possível carregar vídeos do TikTok");
      setTikTokVideos([]);
    } finally {
      setIsLoadingTikTokVideos(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fixedCampaignId) {
      setSelectedCampaign(fixedCampaignId);
    }
  }, [fixedCampaignId]);

  useEffect(() => {
    if (!fixedCampaignId || !fixedCampaign) return;

    setCampaigns((current) => {
      const existing = current.filter((campaign) => campaign.id !== fixedCampaignId);
      return [fixedCampaign as Campaign, ...existing];
    });
  }, [fixedCampaignId, fixedCampaign]);

  useEffect(() => {
    setSelectedPageId("");
    setPostUrl("");
    setSelectedTikTokVideoId("");
    setTikTokVideos([]);

    if (platform === "tiktok") {
      fetchTikTokVideos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  useEffect(() => {
    if (fixedCampaignId || !platform || !selectedCampaign) return;

    const campaign = campaigns.find((item) => item.id === selectedCampaign);
    const allowedPlatforms = normalizeStringList(campaign?.platforms);

    if (allowedPlatforms.length > 0 && !allowedPlatforms.includes(platform)) {
      setSelectedCampaign("");
    }
  }, [campaigns, fixedCampaignId, platform, selectedCampaign]);

  useEffect(() => {
    if (!selectedPageId) return;

    const stillAllowed = approvedPages.some((page) => page.id === selectedPageId);
    if (!stillAllowed) setSelectedPageId("");
  }, [approvedPages, selectedPageId]);

  const handleTikTokVideoChange = (videoId: string) => {
    setSelectedTikTokVideoId(videoId);

    const video = tiktokVideos.find((item) => item.id === videoId);
    const url = video?.share_url || "";

    if (url) {
      setPostUrl(url);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!userId) {
      toast.error("Você precisa estar logado para enviar conteúdo");
      return;
    }

    const selectedPage = pages.find((page) => page.id === selectedPageId);

    if (!selectedPage || selectedPage.verified !== true) {
      toast.error("Selecione uma das suas páginas aprovadas antes de enviar.");
      return;
    }

    if (!pageMatchesRequiredTags(selectedPage, selectedCampaignRequiredTags)) {
      toast.error("A página selecionada não atende às tags obrigatórias desta campanha.");
      return;
    }

    if (platform === "tiktok" && !selectedTikTokVideoId) {
      toast.error("Escolha um dos seus vídeos autorizados do TikTok.");
      return;
    }

    try {
      const validated = submissionSchema.parse({
        campaignId: selectedCampaign,
        pageId: selectedPageId,
        postUrl,
        platform,
        audioUrl: audioUrl || undefined,
        tiktokVideoId: selectedTikTokVideoId || undefined,
      });

      setIsUploading(true);

      const campaign = campaigns.find((item) => item.id === validated.campaignId);

      if (campaign && new Date(campaign.end_date) < new Date()) {
        toast.error("Esta campanha terminou e não aceita mais envios");
        return;
      }

      const allowedPlatforms = normalizeStringList(campaign?.platforms);

      if (
        allowedPlatforms.length > 0 &&
        !allowedPlatforms.includes(selectedPage.platform)
      ) {
        toast.error(`Esta campanha não aceita envios de ${normalizePlatform(selectedPage.platform)}`);
        return;
      }

      const response = await fetch(`${API_BASE}/api/submissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getNeonAccessToken()}`,
        },
        body: JSON.stringify({
          campaign_id: validated.campaignId,
          page_id: validated.pageId,
          post_url: validated.postUrl,
          audio_url: validated.audioUrl || null,
          tiktok_video_id: validated.tiktokVideoId || null,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || json.details || "Não foi possível criar o envio");
      }

      toast.success("Conteúdo enviado para análise.");
      onSubmissionCreated?.();

      if (!fixedCampaignId) {
        setSelectedCampaign("");
      }
      setPlatform("");
      setSelectedPageId("");
      setPostUrl("");
      setAudioUrl("");
      setSelectedTikTokVideoId("");
      setTikTokVideos([]);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error("Erro no envio:", error);
        toast.error(error.message || "Não foi possível enviar");
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="somma-panel rounded-2xl">
      <CardHeader>
        <CardTitle className="font-display text-3xl">Enviar conteúdo</CardTitle>
        <CardDescription>
          Envie conteúdo usando uma das suas páginas aprovadas.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fixedCampaignId ? (
            <div className="space-y-2">
              <Label>Campanha</Label>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-3">
                <p className="font-medium">{selectedCampaignData?.title || "Campanha selecionada"}</p>
                {selectedCampaignData?.end_date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Termina em {new Date(selectedCampaignData.end_date).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="campaign">Campanha *</Label>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma campanha" />
                </SelectTrigger>
                <SelectContent>
                  {allowedCampaigns.length === 0 ? (
                    <SelectItem value="_no_campaigns" disabled>
                      Nenhuma campanha ativa disponível para esta plataforma
                    </SelectItem>
                  ) : (
                    allowedCampaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {showCampaignDetailsLink && selectedCampaign && (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => navigate(`/campaigns/${selectedCampaign}`)}
                >
                  Ver detalhes da campanha
                </Button>
              )}
            </div>
          )}

          {selectedCampaignData && selectedCampaignRequiredTags.length > 0 && (
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Tags obrigatórias</p>
              <div className="flex flex-wrap gap-2">
                {selectedCampaignRequiredTags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="platform">Plataforma *</Label>
            <Select
              value={platform}
              onValueChange={(value) =>
                setPlatform(value as "instagram" | "tiktok" | "youtube_shorts")
              }
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a plataforma" />
              </SelectTrigger>
              <SelectContent>
                {(selectedCampaignPlatforms.length === 0 || selectedCampaignPlatforms.includes("instagram")) && (
                  <SelectItem value="instagram">Instagram</SelectItem>
                )}
                {(selectedCampaignPlatforms.length === 0 || selectedCampaignPlatforms.includes("tiktok")) && (
                  <SelectItem value="tiktok">TikTok</SelectItem>
                )}
                {(selectedCampaignPlatforms.length === 0 || selectedCampaignPlatforms.includes("youtube_shorts")) && (
                  <SelectItem value="youtube_shorts">YouTube Shorts</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {platform && (
            <div className="space-y-2">
              <Label htmlFor="page">Página aprovada *</Label>
              <Select value={selectedPageId} onValueChange={setSelectedPageId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma das suas páginas aprovadas" />
                </SelectTrigger>
                <SelectContent>
                  {approvedPages.length === 0 ? (
                    <SelectItem value="_no_pages" disabled>
                      Nenhuma página aprovada elegível de {normalizePlatform(platform)} foi encontrada
                    </SelectItem>
                  ) : (
                    approvedPages.map((page) => (
                      <SelectItem key={page.id} value={page.id}>
                        {page.handle} · {normalizePlatform(page.platform)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {approvedPages.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Vá para Páginas e conecte/verifique esta plataforma. Se a campanha exige tags, sua página precisa ter pelo menos uma tag correspondente.
                </p>
              )}
            </div>
          )}

          {platform === "tiktok" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="tiktokVideo">Vídeo autorizado do TikTok *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchTikTokVideos}
                  disabled={isLoadingTikTokVideos}
                  className="rounded-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>

              <Select
                value={selectedTikTokVideoId}
                onValueChange={handleTikTokVideoChange}
                disabled={isLoadingTikTokVideos || tiktokVideos.length === 0}
                required
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingTikTokVideos
                        ? "Carregando vídeos do TikTok..."
                        : "Escolha um vídeo do TikTok conectado"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {tiktokVideos.length === 0 ? (
                    <SelectItem value="_no_tiktok_videos" disabled>
                      Nenhum vídeo do TikTok encontrado
                    </SelectItem>
                  ) : (
                    tiktokVideos.map((video) => (
                      <SelectItem key={video.id} value={video.id}>
                        {getVideoLabel(video).slice(0, 80)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {selectedTikTokVideo && (
                <Card className="bg-muted/40">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {selectedTikTokVideo.cover_image_url && (
                        <img
                          src={selectedTikTokVideo.cover_image_url}
                          alt="Capa do vídeo do TikTok"
                          className="h-20 w-20 rounded-md object-cover"
                        />
                      )}

                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="font-medium line-clamp-2">
                          {getVideoLabel(selectedTikTokVideo)}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">
                            {formatCount(selectedTikTokVideo.view_count)} visualizações
                          </Badge>
                          <Badge variant="secondary">
                            {formatCount(selectedTikTokVideo.like_count)} curtidas
                          </Badge>
                          <Badge variant="secondary">
                            {formatCount(selectedTikTokVideo.comment_count)} comentários
                          </Badge>
                        </div>

                        {selectedTikTokVideo.share_url && (
                          <a
                            href={selectedTikTokVideo.share_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Ver no TikTok
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Input type="hidden" value={postUrl} readOnly />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="postUrl">URL da publicação *</Label>
              <Input
                id="postUrl"
                type="url"
                placeholder="https://instagram.com/p/..."
                value={postUrl}
                onChange={(event) => setPostUrl(event.target.value)}
                required
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                Esta URL precisa pertencer à página aprovada selecionada acima.
              </p>
            </div>
          )}

          {selectedCampaignData?.audio_url && (
            <div className="space-y-2">
              <Label htmlFor="audioUrl">URL do áudio (opcional)</Label>
              <Input
                id="audioUrl"
                type="url"
                placeholder="Link do áudio usado no seu vídeo..."
                value={audioUrl}
                onChange={(event) => setAudioUrl(event.target.value)}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                Envie o link do áudio se você usou o áudio obrigatório da campanha.
              </p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={
              isUploading ||
              !selectedCampaign ||
              !platform ||
              !selectedPageId ||
              !postUrl ||
              (platform === "tiktok" && !selectedTikTokVideoId)
            }
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? "Enviando..." : "Enviar conteúdo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
