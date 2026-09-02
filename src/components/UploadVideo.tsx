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
  contentId: z.string().min(1, "Selecione um conteúdo da conta conectada"),
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

interface ConnectedContent {
  id: string;
  title: string;
  url: string;
  thumbnail_url?: string | null;
  media_type?: string | null;
  like_count?: number | null;
  comment_count?: number | null;
  view_count?: number | null;
  published_at?: number | string | null;
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

function normalizeCampaignPlatforms(value: unknown) {
  return Array.from(
    new Set(
      normalizeStringList(value)
        .map((item) => {
          const normalized = item.trim().toLowerCase().replace(/[\s-]+/g, "_");

          if (normalized === "tik_tok") return "tiktok";
          if (["youtube", "youtube_short", "youtube_shorts"].includes(normalized)) {
            return "youtube_shorts";
          }

          return normalized;
        })
        .filter(Boolean),
    ),
  );
}

function formatCount(value: number | null | undefined) {
  const count = Number(value || 0);
  return count.toLocaleString("pt-BR");
}

function getContentLabel(content: ConnectedContent) {
  return content.title || content.url || `Conteúdo ${content.id}`;
}

function getContentNoun(platform: Page["platform"] | "") {
  if (platform === "instagram") return "publicação";
  return "vídeo";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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

  const [connectedContent, setConnectedContent] = useState<ConnectedContent[]>([]);
  const [selectedContentId, setSelectedContentId] = useState("");
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  const selectedCampaignData =
    campaigns.find((campaign) => campaign.id === selectedCampaign) ||
    (fixedCampaignId && fixedCampaign?.id === fixedCampaignId ? (fixedCampaign as Campaign) : null);

  const selectedContent = connectedContent.find((content) => content.id === selectedContentId) || null;
  const selectedCampaignRequiredTags = normalizeStringList(selectedCampaignData?.required_tags);
  const selectedCampaignPlatforms = normalizeCampaignPlatforms(selectedCampaignData?.platforms);

  const approvedPages = pages.filter((page) => {
    if (!platform) return false;
    return page.platform === platform && page.verified === true;
  });

  const allowedCampaigns = campaigns.filter((campaign) => {
    if (!platform) return true;

    const allowedPlatforms = normalizeCampaignPlatforms(campaign.platforms);
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

  const fetchConnectedContent = async (pageId = selectedPageId) => {
    if (!userId || !pageId) return;

    setIsLoadingContent(true);

    try {
      const token = await getNeonAccessToken();

      if (!token) {
        throw new Error("Token de login ausente. Saia e entre novamente.");
      }

      const query = new URLSearchParams({ page_id: pageId });
      const response = await fetch(`${API_BASE}/api/connected-content?${query.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.details || json.error || "Não foi possível carregar o conteúdo da conta conectada");
      }

      const content = Array.isArray(json.data) ? json.data : [];
      setConnectedContent(content);

      if (content.length === 0) {
        toast.info("A conta está conectada, mas nenhum conteúdo publicado foi retornado.");
      }
    } catch (err: unknown) {
      console.error("Erro no conteúdo conectado:", err);
      toast.error(getErrorMessage(err) || "Não foi possível carregar o conteúdo da conta conectada");
      setConnectedContent([]);
    } finally {
      setIsLoadingContent(false);
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
    setSelectedContentId("");
    setConnectedContent([]);
  }, [platform]);

  useEffect(() => {
    setPostUrl("");
    setSelectedContentId("");
    setConnectedContent([]);

    if (selectedPageId) {
      fetchConnectedContent(selectedPageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPageId]);

  useEffect(() => {
    if (fixedCampaignId || !platform || !selectedCampaign) return;

    const campaign = campaigns.find((item) => item.id === selectedCampaign);
    const allowedPlatforms = normalizeCampaignPlatforms(campaign?.platforms);

    if (allowedPlatforms.length > 0 && !allowedPlatforms.includes(platform)) {
      setSelectedCampaign("");
    }
  }, [campaigns, fixedCampaignId, platform, selectedCampaign]);

  useEffect(() => {
    if (!selectedPageId) return;

    const stillAllowed = approvedPages.some((page) => page.id === selectedPageId);
    if (!stillAllowed) setSelectedPageId("");
  }, [approvedPages, selectedPageId]);

  const handleContentChange = (contentId: string) => {
    setSelectedContentId(contentId);

    const content = connectedContent.find((item) => item.id === contentId);
    const url = content?.url || "";

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

    if (!selectedContentId) {
      toast.error("Escolha um conteúdo da conta conectada.");
      return;
    }

    try {
      const validated = submissionSchema.parse({
        campaignId: selectedCampaign,
        pageId: selectedPageId,
        postUrl,
        platform,
        audioUrl: audioUrl || undefined,
        contentId: selectedContentId,
      });

      setIsUploading(true);

      const campaign = campaigns.find((item) => item.id === validated.campaignId);

      if (campaign && new Date(campaign.end_date) < new Date()) {
        toast.error("Esta campanha terminou e não aceita mais envios");
        return;
      }

      const allowedPlatforms = normalizeCampaignPlatforms(campaign?.platforms);

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
          audio_url: validated.audioUrl || null,
          platform_content_id: validated.contentId,
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
      setSelectedContentId("");
      setConnectedContent([]);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error("Erro no envio:", error);
        toast.error(getErrorMessage(error) || "Não foi possível enviar");
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
                      Nenhuma página aprovada de {normalizePlatform(platform)} foi encontrada
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
                  Vá para Páginas e conecte/verifique uma conta desta plataforma.
                </p>
              )}
            </div>
          )}

          {platform && selectedPageId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="connectedContent">
                  {getContentNoun(platform) === "publicação" ? "Publicação" : "Vídeo"} da conta conectada *
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fetchConnectedContent()}
                  disabled={isLoadingContent}
                  className="rounded-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>

              <Select
                value={selectedContentId}
                onValueChange={handleContentChange}
                disabled={isLoadingContent || connectedContent.length === 0}
                required
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingContent
                        ? `Carregando conteúdo do ${normalizePlatform(platform)}...`
                        : `Escolha ${getContentNoun(platform) === "publicação" ? "uma publicação" : "um vídeo"} da conta conectada`
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {connectedContent.length === 0 ? (
                    <SelectItem value="_no_connected_content" disabled>
                      Nenhum conteúdo publicado encontrado
                    </SelectItem>
                  ) : (
                    connectedContent.map((content) => (
                      <SelectItem key={content.id} value={content.id}>
                        {getContentLabel(content).slice(0, 80)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {selectedContent && (
                <Card className="bg-muted/40">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {selectedContent.thumbnail_url && (
                        <img
                          src={selectedContent.thumbnail_url}
                          alt={`Capa do conteúdo de ${normalizePlatform(platform)}`}
                          className="h-20 w-20 rounded-md object-cover"
                        />
                      )}

                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="font-medium line-clamp-2">
                          {getContentLabel(selectedContent)}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {selectedContent.view_count !== null && selectedContent.view_count !== undefined && (
                            <Badge variant="secondary">
                              {formatCount(selectedContent.view_count)} visualizações
                            </Badge>
                          )}
                          {selectedContent.like_count !== null && selectedContent.like_count !== undefined && (
                            <Badge variant="secondary">
                              {formatCount(selectedContent.like_count)} curtidas
                            </Badge>
                          )}
                          {selectedContent.comment_count !== null && selectedContent.comment_count !== undefined && (
                            <Badge variant="secondary">
                              {formatCount(selectedContent.comment_count)} comentários
                            </Badge>
                          )}
                        </div>

                        {selectedContent.url && (
                          <a
                            href={selectedContent.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Ver em {normalizePlatform(platform)}
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
              !selectedContentId
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
