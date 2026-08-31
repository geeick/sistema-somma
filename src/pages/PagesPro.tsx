import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "@/integrations/apiClient";
import { getNeonAccessToken, getNeonUser, type NeonUser } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Instagram, Play, Youtube, Plus, Trash2, ExternalLink, ShieldCheck, ShieldAlert, Sparkles, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

const availableTags = ["Funk", "Rap/Trap", "Pop", "Sertanejo", "Forró", "Piseiro", "Arrocha", "Gospel", "Internacional", "Fofoca", "Influencer", "Edição", "Letras"];

const platformIcons: Record<string, LucideIcon> = {
  instagram: Instagram,
  tiktok: Play,
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
      if (Array.isArray(parsed)) return parsed.filter((tag): tag is string => typeof tag === "string");
    } catch {
      return value.split(",").map((tag) => tag.trim()).filter(Boolean);
    }
  }
  return [];
}

function cleanHandle(value: string) {
  const cleaned = value.replace(/@/g, "").trim();
  return cleaned ? `@${cleaned}` : "";
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
  const [handle, setHandle] = useState("");
  const [url, setUrl] = useState("");
  const [followerCount, setFollowerCount] = useState("");
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
      toast({ title: "Erro", description: "Não foi possível carregar suas páginas.", variant: "destructive" });
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
    const message = searchParams.get("message");

    if (instagramStatus === "connected") {
      toast({ title: "Instagram conectado", description: "Sua página foi verificada e adicionada." });
      fetchPages();
      setSearchParams({});
    } else if (instagramStatus === "error" || instagramStatus === "denied") {
      toast({ title: "Não foi possível conectar o Instagram", description: "Tente conectar novamente.", variant: "destructive" });
      setSearchParams({});
    }

    if (tiktokStatus === "connected") {
      toast({ title: "TikTok conectado", description: "Sua página foi verificada e adicionada." });
      fetchPages();
      setSearchParams({});
    } else if (tiktokStatus === "error" || tiktokStatus === "missing_code") {
      toast({ title: "Não foi possível conectar o TikTok", description: message || "Tente conectar novamente.", variant: "destructive" });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const resetForm = () => {
    setPlatform("");
    setHandle("");
    setUrl("");
    setFollowerCount("");
    setSelectedTags([]);
    setIsConnecting(false);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  };

  const requireTags = () => {
    if (selectedTags.length > 0) return true;
    toast({ title: "Selecione pelo menos uma tag", description: "As tags ajudam a encontrar campanhas compatíveis com sua página.", variant: "destructive" });
    return false;
  };

  const connectPlatform = async (provider: "instagram" | "tiktok") => {
    if (!user || !requireTags()) return;
    setIsConnecting(true);

    try {
      const token = await getNeonAccessToken();
      if (!token) throw new Error("Sua sessão expirou. Saia e entre novamente.");

      localStorage.setItem(`pending_${provider}_page_tags`, JSON.stringify(selectedTags));

      const endpoint = provider === "instagram"
        ? `${API_BASE}/api/integrations/instagram/start`
        : `${API_BASE}/api/integrations/tiktok/auth-url`;

      const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      const json = await response.json();
      const oauthUrl = provider === "instagram" ? json.url : json.data?.url;

      if (!response.ok || !oauthUrl) throw new Error(json.error || json.details || "Não foi possível iniciar a conexão.");
      window.location.href = oauthUrl;
    } catch (error: any) {
      setIsConnecting(false);
      toast({ title: "Falha na conexão", description: error.message || String(error), variant: "destructive" });
    }
  };

  const addManualPage = async () => {
    if (!platform || !handle || !url || !followerCount || !requireTags()) {
      if (!platform || !handle || !url || !followerCount) {
        toast({ title: "Preencha os campos obrigatórios", description: "Informe usuário, URL e número de seguidores.", variant: "destructive" });
      }
      return;
    }

    try {
      await apiClient.pages.create({
        platform: platform as "youtube_shorts",
        handle: cleanHandle(handle),
        url,
        follower_count: Number(followerCount),
        tags: selectedTags,
        verified: false,
      });
      toast({ title: "Página adicionada", description: "Sua página foi salva com sucesso." });
      setIsDialogOpen(false);
      resetForm();
      await fetchPages();
    } catch (error: any) {
      toast({ title: "Não foi possível adicionar a página", description: error.message || String(error), variant: "destructive" });
    }
  };

  const deletePage = async (pageId: string) => {
    try {
      await apiClient.pages.remove(pageId);
      setPages((current) => current.filter((page) => page.id !== pageId));
      toast({ title: "Página removida" });
    } catch (error: any) {
      toast({ title: "Não foi possível remover a página", description: error.message || String(error), variant: "destructive" });
    }
  };

  const tagPicker = (
    <div>
      <Label>Tags da página *</Label>
      <p className="ui-caption mt-1 mb-3">Escolha os temas que melhor representam o conteúdo desta página.</p>
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

  if (isLoading) {
    return (
      <div className="min-h-screen somma-shell">
        <Navbar />
        <div className="container mx-auto px-4 pt-28 pb-12">
          <p className="text-center text-muted-foreground font-semibold">Carregando páginas...</p>
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
                <div className="app-eyebrow"><Sparkles className="h-4 w-4" /> Presença digital</div>
                <h1 className="app-title">Suas páginas</h1>
                <p className="app-subtitle">Conecte e organize suas contas sociais para participar de campanhas compatíveis com o seu conteúdo.</p>
              </div>

              <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl h-11 px-5 font-extrabold shrink-0">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar página
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-extrabold">Adicionar página</DialogTitle>
                    <DialogDescription className="text-[0.93rem] leading-relaxed">
                      Instagram e TikTok são verificados pelo login da própria plataforma. Por enquanto, YouTube Shorts pode ser cadastrado manualmente.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-5">
                    <div>
                      <Label>Plataforma *</Label>
                      <Select value={platform} onValueChange={setPlatform}>
                        <SelectTrigger className="mt-2"><SelectValue placeholder="Selecione a plataforma" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="instagram">Instagram</SelectItem>
                          <SelectItem value="tiktok">TikTok</SelectItem>
                          <SelectItem value="youtube_shorts">YouTube Shorts</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {platform === "instagram" && (
                      <div className="space-y-5">
                        <Card className="somma-panel rounded-2xl">
                          <CardContent className="p-5 flex gap-4 items-start">
                            <div className="h-11 w-11 rounded-xl bg-pink-50 text-pink-700 flex items-center justify-center shrink-0"><Instagram className="h-5 w-5" /></div>
                            <div>
                              <p className="font-extrabold">Verifique sua conta do Instagram</p>
                              <p className="ui-caption mt-1">Você será direcionado ao Instagram. Depois da autorização, a Somma salva automaticamente seu usuário, URL e status de verificação.</p>
                            </div>
                          </CardContent>
                        </Card>
                        {tagPicker}
                        <Button className="w-full rounded-xl" disabled={isConnecting} onClick={() => connectPlatform("instagram")}>
                          <Instagram className="h-4 w-4 mr-2" />{isConnecting ? "Conectando..." : "Conectar Instagram"}
                        </Button>
                      </div>
                    )}

                    {platform === "tiktok" && (
                      <div className="space-y-5">
                        <Card className="somma-panel rounded-2xl">
                          <CardContent className="p-5 flex gap-4 items-start">
                            <div className="h-11 w-11 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0"><Play className="h-5 w-5" /></div>
                            <div>
                              <p className="font-extrabold">Verifique sua conta do TikTok</p>
                              <p className="ui-caption mt-1">Você será direcionado ao TikTok para autorizar a Somma. A conta será adicionada como página verificada.</p>
                            </div>
                          </CardContent>
                        </Card>
                        {tagPicker}
                        <Button className="w-full rounded-xl" disabled={isConnecting} onClick={() => connectPlatform("tiktok")}>
                          <Play className="h-4 w-4 mr-2" />{isConnecting ? "Conectando..." : "Conectar TikTok"}
                        </Button>
                      </div>
                    )}

                    {platform === "youtube_shorts" && (
                      <div className="space-y-4">
                        <div><Label>Usuário / canal *</Label><Input className="mt-2" placeholder="@seucanal" value={handle} onChange={(e) => setHandle(cleanHandle(e.target.value))} /></div>
                        <div><Label>URL do perfil *</Label><Input className="mt-2" placeholder="https://youtube.com/@..." value={url} onChange={(e) => setUrl(e.target.value)} /></div>
                        <div><Label>Número de seguidores *</Label><Input className="mt-2" type="number" placeholder="10000" value={followerCount} onChange={(e) => setFollowerCount(e.target.value)} /></div>
                        {tagPicker}
                        <Button className="w-full rounded-xl" onClick={addManualPage}>Adicionar página</Button>
                        <p className="ui-caption">Páginas cadastradas manualmente ficam como não verificadas até a integração de autenticação estar disponível.</p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </section>

          {normalizedPages.length === 0 ? (
            <div className="empty-state page-enter stagger-1 min-h-[300px]">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <UsersRound className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-extrabold">Você ainda não adicionou nenhuma página</h2>
              <p className="ui-caption max-w-lg">Adicione sua primeira conta social para descobrir campanhas compatíveis e enviar conteúdo.</p>
              <Button className="rounded-xl mt-2" onClick={() => setIsDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Adicionar primeira página</Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 page-enter stagger-1">
              {normalizedPages.map((page) => {
                const Icon = platformIcons[page.platform] || UsersRound;
                const verified = Boolean(page.verified);
                return (
                  <Card key={page.id} className="somma-panel somma-card-hover rounded-2xl overflow-hidden">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon className="h-5 w-5" /></div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CardTitle className="text-lg font-extrabold truncate">{page.handle}</CardTitle>
                              <Badge variant={verified ? "default" : "outline"} className="gap-1 rounded-full">
                                {verified ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                                {verified ? "Verificada" : "Não verificada"}
                              </Badge>
                            </div>
                            <CardDescription className="text-[0.9rem]">{platformLabels[page.platform] || page.platform}</CardDescription>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deletePage(page.id)} aria-label={`Excluir ${page.handle}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between gap-3 text-[0.92rem]">
                        <span className="text-muted-foreground">Seguidores</span>
                        <strong>{Number(page.follower_count || 0).toLocaleString("pt-BR")}</strong>
                      </div>
                      {page.url && (
                        <a href={page.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[0.9rem] font-bold text-primary hover:underline">
                          Abrir perfil <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {normalizeTags(page.tags).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {normalizeTags(page.tags).map((tag) => <Badge key={tag} variant="secondary" className="rounded-full">{tag}</Badge>)}
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
