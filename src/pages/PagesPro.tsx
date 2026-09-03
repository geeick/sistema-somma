import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "@/integrations/apiClient";
import { getNeonAccessToken, getNeonUser, type NeonUser } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { LoadingState } from "@/components/LoadingState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Instagram,
  Youtube,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  UsersRound,
  ChevronRight,
} from "lucide-react";

interface Page {
  id: string;
  platform: string;
  handle: string;
  url: string;
  follower_count: number | null;
  tags: string[] | string | null;
  verified?: boolean | null;
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const availableTags = [
  "Funk",
  "Rap/Trap",
  "Pop",
  "Sertanejo",
  "Forró",
  "Piseiro",
  "Arrocha",
  "Gospel",
  "Internacional",
  "Fofoca",
  "Influencer",
  "Edição",
  "Letras",
];

function TikTokIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 1 1-2.5-2.86v-3.5a6.33 6.33 0 1 0 5.95 6.32V8.71a8.16 8.16 0 0 0 4.77 1.52V6.79c-.33 0-.66-.03-1-.1Z" />
    </svg>
  );
}

const platformIcons: Record<string, ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  tiktok: TikTokIcon,
  youtube_shorts: Youtube,
};

const platformLabels: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
};

function normalizeTags(value: Page["tags"]): string[] {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((tag): tag is string => typeof tag === "string");
      }
    } catch {
      return value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const PagesPro = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<NeonUser | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [platform, setPlatform] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const normalizedPages = useMemo(
    () => pages.map((page) => ({ ...page, tags: normalizeTags(page.tags) })),
    [pages]
  );

  const fetchPages = async () => {
    try {
      const data = await apiClient.pages.list();
      setPages(data || []);
    } catch (error) {
      console.error("Erro ao carregar páginas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar suas páginas.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getNeonUser()
      .then((currentUser) => {
        if (!currentUser) {
          navigate("/auth");
          return;
        }

        setUser(currentUser);
      })
      .catch(() => navigate("/auth"));
  }, [navigate]);

  useEffect(() => {
    if (user) fetchPages();
  }, [user]);

  useEffect(() => {
    const instagramStatus = searchParams.get("instagram");
    const tiktokStatus = searchParams.get("tiktok");
    const youtubeStatus = searchParams.get("youtube");
    const message = searchParams.get("message");

    if (instagramStatus === "connected") {
      toast({
        title: "Instagram conectado",
        description: "Sua página foi verificada e adicionada.",
      });
      fetchPages();
      setSearchParams({});
    } else if (instagramStatus === "error" || instagramStatus === "denied") {
      toast({
        title: "Não foi possível conectar o Instagram",
        description: "Tente conectar novamente.",
        variant: "destructive",
      });
      setSearchParams({});
    }

    if (tiktokStatus === "connected") {
      toast({
        title: "TikTok conectado",
        description: "Sua página foi verificada e adicionada.",
      });
      fetchPages();
      setSearchParams({});
    } else if (tiktokStatus === "error" || tiktokStatus === "missing_code") {
      toast({
        title: "Não foi possível conectar o TikTok",
        description: message || "Tente conectar novamente.",
        variant: "destructive",
      });
      setSearchParams({});
    }

    if (youtubeStatus === "connected") {
      toast({
        title: "YouTube conectado",
        description: "Seu canal foi verificado e adicionado.",
      });
      fetchPages();
      setSearchParams({});
    } else if (
      youtubeStatus === "error" ||
      youtubeStatus === "denied" ||
      youtubeStatus === "missing_code"
    ) {
      toast({
        title: "Não foi possível conectar o YouTube",
        description: message || "Tente conectar novamente.",
        variant: "destructive",
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const resetForm = () => {
    setPlatform("");
    setSelectedTags([]);
    setIsConnecting(false);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    );
  };

  const requireTags = () => {
    if (selectedTags.length > 0) return true;

    toast({
      title: "Selecione pelo menos uma tag",
      description: "Escolha as tags da página antes de conectar sua conta.",
      variant: "destructive",
    });
    return false;
  };

  const connectPlatform = async (
    provider: "instagram" | "tiktok" | "youtube"
  ) => {
    if (!user || !requireTags()) return;

    setIsConnecting(true);

    try {
      const token = await getNeonAccessToken();
      if (!token) {
        throw new Error("Sua sessão expirou. Saia e entre novamente.");
      }

      const endpointPaths = {
        instagram: "/api/integrations/instagram/start",
        tiktok: "/api/integrations/tiktok/auth-url",
        youtube: "/api/integrations/youtube/start",
      };

      const query = new URLSearchParams({
        tags: JSON.stringify(selectedTags),
      });
      const endpoint = `${API_BASE}${endpointPaths[provider]}?${query.toString()}`;

      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      const oauthUrl = provider === "tiktok" ? json.data?.url : json.url;

      if (!response.ok || !oauthUrl) {
        throw new Error(
          json.error || json.details || "Não foi possível iniciar a conexão."
        );
      }

      window.location.href = oauthUrl;
    } catch (error: unknown) {
      setIsConnecting(false);
      toast({
        title: "Falha na conexão",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const deletePage = async (pageId: string) => {
    try {
      await apiClient.pages.remove(pageId);
      setPages((current) => current.filter((page) => page.id !== pageId));
      toast({ title: "Página removida" });
    } catch (error: unknown) {
      toast({
        title: "Não foi possível remover a página",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const tagPicker = (
    <div>
      <Label>Tags da página *</Label>
      <p className="ui-caption mt-1 mb-3">
        Escolha os temas que melhor representam o conteúdo desta página.
      </p>
      <div className="flex flex-wrap gap-2">
        {availableTags.map((tag) => (
          <Badge
            key={tag}
            variant={selectedTags.includes(tag) ? "default" : "outline"}
            className="cursor-pointer rounded-full px-3 py-1.5 text-[0.84rem]"
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );

  const connectionCard = (
    provider: "instagram" | "tiktok" | "youtube",
    title: string,
    description: string,
    ctaLabel: string,
    icon: ReactNode,
    iconClassName: string
  ) => (
    <button
      type="button"
      className="group w-full rounded-2xl text-left outline-none transition-transform disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.995]"
      disabled={isConnecting}
      onClick={() => connectPlatform(provider)}
      aria-label={ctaLabel}
    >
      <Card className="somma-panel rounded-2xl cursor-pointer border-2 border-primary/15 bg-card/95 shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/55 group-hover:bg-primary/[0.025] group-hover:shadow-lg">
        <CardContent className="p-5">
          <div className="flex gap-4 items-start">
            <div
              className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${iconClassName}`}
            >
              {icon}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-foreground">{title}</p>
                  <p className="ui-caption mt-1 leading-relaxed">{description}</p>
                </div>
                <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
              </div>

              <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-extrabold text-primary-foreground shadow-sm transition-transform group-hover:translate-x-0.5">
                {isConnecting ? "Conectando..." : ctaLabel}
                {!isConnecting && <ChevronRight className="h-4 w-4" />}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen somma-shell">
        <Navbar />
        <div className="container mx-auto px-4 pt-28 pb-12">
          <LoadingState label="Carregando páginas..." className="mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen somma-shell">
      <Navbar />
      <div className="container mx-auto px-4 pt-28 pb-16">
        <div className="max-w-6xl mx-auto space-y-6">
          <section className="app-page-header">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 relative z-10">
              <div>
                <div className="app-eyebrow">
                  <Sparkles className="h-4 w-4" /> Presença digital
                </div>
                <h1 className="app-title">Suas páginas</h1>
                <p className="app-subtitle">
                  Conecte e organize suas contas sociais para participar de
                  campanhas compatíveis com o seu conteúdo.
                </p>
              </div>

              <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) resetForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button className="rounded-xl h-11 px-5 font-extrabold shrink-0">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar página
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-extrabold">
                      Adicionar página
                    </DialogTitle>
                    <DialogDescription className="text-[0.93rem] leading-relaxed">
                      Instagram, TikTok e YouTube são verificados pelo login da
                      própria plataforma.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-5">
                    <div>
                      <Label>Plataforma *</Label>
                      <Select value={platform} onValueChange={setPlatform}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Selecione a plataforma" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="instagram">Instagram</SelectItem>
                          <SelectItem value="tiktok">TikTok</SelectItem>
                          <SelectItem value="youtube_shorts">
                            YouTube Shorts
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {platform === "instagram" && (
                      <div className="space-y-5">
                        {connectionCard(
                          "instagram",
                          "Verifique sua conta do Instagram",
                          "Você será direcionado ao Instagram. Depois da autorização, a Somma salva automaticamente seu usuário, URL e status de verificação.",
                          "Conectar Instagram",
                          <Instagram className="h-5 w-5" />,
                          "bg-pink-50 text-pink-700"
                        )}
                        {tagPicker}
                      </div>
                    )}

                    {platform === "tiktok" && (
                      <div className="space-y-5">
                        {connectionCard(
                          "tiktok",
                          "Verifique sua conta do TikTok",
                          "Você será direcionado ao TikTok para autorizar a Somma. Depois da autorização, a conta será adicionada automaticamente como página verificada.",
                          "Conectar TikTok",
                          <TikTokIcon className="h-6 w-6" />,
                          "bg-[#EAFBFD] text-[#14B8C4]"
                        )}
                        {tagPicker}
                      </div>
                    )}

                    {platform === "youtube_shorts" && (
                      <div className="space-y-5">
                        {connectionCard(
                          "youtube",
                          "Verifique seu canal do YouTube",
                          "Você será direcionado ao Google para escolher a conta. A Somma salvará automaticamente o canal, o link, o número público de inscritos e o status de verificação.",
                          "Conectar YouTube",
                          <Youtube className="h-5 w-5" />,
                          "bg-red-50 text-red-700"
                        )}
                        {tagPicker}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </section>

          {normalizedPages.length === 0 ? (
            <div className="empty-state page-enter stagger-1 min-h-[300px]">
              <div className="somma-icon-tile h-14 w-14 rounded-2xl">
                <UsersRound className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-extrabold">
                Você ainda não adicionou nenhuma página
              </h2>
              <p className="ui-caption max-w-lg">
                Adicione sua primeira conta social para descobrir campanhas
                compatíveis e enviar conteúdo.
              </p>
              <Button
                className="rounded-xl mt-2"
                onClick={() => setIsDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeira página
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 page-enter stagger-1">
              {normalizedPages.map((page) => {
                const Icon = platformIcons[page.platform] || UsersRound;
                const verified = Boolean(page.verified);

                return (
                  <Card
                    key={page.id}
                    className="somma-panel somma-card-hover rounded-2xl overflow-hidden"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="somma-icon-tile h-11 w-11 rounded-xl shrink-0">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CardTitle className="text-lg font-extrabold truncate">
                                {page.handle}
                              </CardTitle>
                              <Badge
                                variant={verified ? "default" : "outline"}
                                className="gap-1 rounded-full"
                              >
                                {verified ? (
                                  <ShieldCheck className="h-3 w-3" />
                                ) : (
                                  <ShieldAlert className="h-3 w-3" />
                                )}
                                {verified ? "Verificada" : "Não verificada"}
                              </Badge>
                            </div>
                            <CardDescription className="text-[0.9rem]">
                              {platformLabels[page.platform] || page.platform}
                            </CardDescription>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deletePage(page.id)}
                          aria-label={`Excluir ${page.handle}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between gap-3 text-[0.92rem]">
                        <span className="text-muted-foreground">
                          {page.platform === "youtube_shorts"
                            ? "Inscritos"
                            : "Seguidores"}
                        </span>
                        <strong>
                          {page.follower_count === null ||
                          page.follower_count === undefined
                            ? "Oculto ou indisponível"
                            : Number(page.follower_count).toLocaleString("pt-BR")}
                        </strong>
                      </div>

                      {page.url && (
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[0.9rem] font-bold text-primary hover:underline"
                        >
                          Abrir perfil <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}

                      {normalizeTags(page.tags).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {normalizeTags(page.tags).map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="rounded-full"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PagesPro;
