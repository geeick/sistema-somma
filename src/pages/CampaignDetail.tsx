import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiClient from "@/integrations/apiClient";
import { getNeonSession, type NeonUser } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { UploadVideo } from "@/components/UploadVideo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, ExternalLink, Instagram, Play, Target, Users, Youtube, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { normalizeStringList } from "@/lib/normalizeStringList";

interface Campaign {
  id: string;
  title: string;
  code?: string | null;
  client: string | null;
  brief: string | null;
  budget: number | null;
  start_date: string | null;
  end_date: string;
  required_tags: string[] | string | null;
  platforms: string[] | string | null;
  audio_url: string | null;
  audio_urls: Record<string, string> | string | null;
  example_urls: Record<string, string> | string | null;
  rules: unknown;
  max_posts_per_creator: number | null;
  status: string;
}

interface Page {
  id: string;
  platform: string;
  handle: string;
  tags?: string[] | string | null;
  verified?: boolean | null;
}

const platformIcons = { instagram: Instagram, tiktok: Play, youtube_shorts: Youtube };

function normalizeRecord(value: unknown): Record<string, string> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, string>;
    } catch { return null; }
  }
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, string>;
  return null;
}

function normalizeCampaign(data: any): Campaign {
  return { ...data, required_tags: normalizeStringList(data.required_tags), platforms: normalizeStringList(data.platforms), audio_urls: normalizeRecord(data.audio_urls), example_urls: normalizeRecord(data.example_urls) } as Campaign;
}

function formatDate(value?: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return date.toLocaleDateString("pt-BR");
}

function formatMoney(value?: number | null) {
  return `R$ ${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function platformLabel(platform: string) {
  const labels: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube_shorts: "YouTube Shorts" };
  const normalized = platform.trim().toLowerCase();
  return labels[normalized] || normalized.replaceAll("_", " ");
}

const ruleLabels: Record<string, string> = {
  artist: "Artista",
  description: "Orientações",
  instructions: "Instruções",
  content: "Conteúdo",
  hashtags: "Hashtags",
  mentions: "Marcações",
};

function campaignRuleEntries(value: unknown): Array<{ label: string; value: string }> {
  if (!value) return [];

  let normalized = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      normalized = JSON.parse(trimmed);
    } catch {
      return [{ label: "Orientações", value: trimmed }];
    }
  }

  if (Array.isArray(normalized)) {
    const text = normalizeStringList(normalized).join(", ");
    return text ? [{ label: "Orientações", value: text }] : [];
  }

  if (typeof normalized !== "object" || normalized === null) {
    return [{ label: "Orientações", value: String(normalized) }];
  }

  return Object.entries(normalized as Record<string, unknown>)
    .map(([key, item]) => {
      const text = Array.isArray(item)
        ? item.map(String).join(", ")
        : typeof item === "object" && item !== null
          ? Object.values(item).map(String).join(", ")
          : String(item ?? "").trim();

      const fallbackLabel = key
        .replaceAll("_", " ")
        .replace(/^./, (letter) => letter.toUpperCase());

      return { label: ruleLabels[key] || fallbackLabel, value: text };
    })
    .filter((entry) => entry.value);
}

function pageMatchesRequiredTags(page: Page, requiredTags: string[]) {
  if (requiredTags.length === 0) return true;
  const pageTags = normalizeStringList(page.tags).map((tag) => tag.toLowerCase());
  return requiredTags.some((tag) => pageTags.includes(tag.toLowerCase()));
}

function hasAnyUrl(record: Record<string, string> | null) {
  return Boolean(record && Object.values(record).some((url) => String(url || "").trim()));
}

const CampaignDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<NeonUser | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getNeonSession().then(({ user }) => {
      if (!user) { navigate("/auth"); return; }
      setUser(user);
    }).catch(() => navigate("/auth"));
  }, [navigate]);

  useEffect(() => {
    if (!user || !id) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [campaignData, pagesData] = await Promise.all([
          apiClient.tables.list("campaigns", { id, single: true }),
          apiClient.pages.list(),
        ]);
        if (!campaignData) {
          toast({ title: "Campanha não encontrada", description: "Não foi possível carregar esta campanha.", variant: "destructive" });
          setCampaign(null);
          return;
        }
        setCampaign(normalizeCampaign(campaignData));
        setPages(Array.isArray(pagesData) ? pagesData : []);
      } catch (err: any) {
        console.error("Erro ao carregar detalhes da campanha:", err);
        toast({ title: "Erro", description: err.message || "Não foi possível carregar os detalhes da campanha.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user, id]);

  const requiredTags = useMemo(() => normalizeStringList(campaign?.required_tags), [campaign]);
  const platforms = useMemo(() => normalizeStringList(campaign?.platforms), [campaign]);
  const matchingPages = useMemo(() => pages.filter((page) => page.verified === true && pageMatchesRequiredTags(page, requiredTags)), [pages, requiredTags]);
  const isEnded = campaign?.end_date ? new Date(campaign.end_date) < new Date() : false;
  const isInactive = campaign?.status && campaign.status !== "active";
  const audioUrls = normalizeRecord(campaign?.audio_urls);
  const exampleUrls = normalizeRecord(campaign?.example_urls);
  const ruleEntries = campaignRuleEntries(campaign?.rules);

  if (isLoading || !campaign) {
    return (
      <div className="min-h-screen somma-shell">
        <Navbar />
        <div className="container mx-auto px-4 pt-28 pb-12">
          <p className="text-center text-muted-foreground font-semibold">Carregando campanha...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen somma-shell">
      <Navbar />
      <div className="container mx-auto px-4 pt-28 pb-14">
        <div className="max-w-7xl mx-auto space-y-6">
          <Button variant="ghost" className="rounded-xl font-bold" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para campanhas
          </Button>

          <section className="app-page-header">
            <div className="app-eyebrow"><Sparkles className="h-4 w-4" /> Detalhes da campanha</div>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 relative z-10">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {campaign.code && <Badge variant="secondary" className="font-mono">{campaign.code}</Badge>}
                  <Badge variant={campaign.status === "active" && !isEnded ? "default" : "secondary"}>{isEnded ? "Encerrada" : campaign.status === "active" ? "Ativa" : campaign.status || "Inativa"}</Badge>
                </div>
                <h1 className="app-title">{campaign.title}</h1>
                <p className="app-subtitle">{campaign.client ? `Cliente: ${campaign.client}` : "Veja regras, plataformas aceitas e materiais da campanha."}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {platforms.map((platform) => {
                  const Icon = platformIcons[platform as keyof typeof platformIcons];
                  return Icon ? <div key={platform} className="h-10 w-10 rounded-xl bg-[#f7ead1]/10 text-[#f7ead1] flex items-center justify-center"><Icon className="h-5 w-5" /></div> : null;
                })}
              </div>
            </div>
          </section>

          <div className="grid gap-7 lg:grid-cols-[1.55fr_0.85fr] items-start">
            <div className="space-y-5 page-enter stagger-1">
              <Card className="somma-panel rounded-2xl">
                <CardHeader><CardTitle className="text-xl font-extrabold">Visão geral</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  {campaign.brief && (
                    <div>
                      <h3 className="font-extrabold mb-2">Resumo criativo</h3>
                      <p className="text-[0.96rem] leading-relaxed text-muted-foreground whitespace-pre-wrap">{campaign.brief}</p>
                    </div>
                  )}

                  {(isEnded || isInactive) && (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/8 p-4">
                      <p className="font-extrabold text-destructive">Esta campanha não está aceitando novos envios.</p>
                      <p className="ui-caption mt-1">Status: {campaign.status || "não informado"}. Encerramento: {formatDate(campaign.end_date)}.</p>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-xl border border-border bg-background/55 p-4"><div className="flex items-center gap-2 ui-caption mb-1"><Calendar className="h-4 w-4" />Encerramento</div><p className="font-extrabold">{formatDate(campaign.end_date)}</p></div>
                    <div className="rounded-xl border border-border bg-background/55 p-4"><div className="flex items-center gap-2 ui-caption mb-1"><Users className="h-4 w-4" />Limite por criador</div><p className="font-extrabold">{campaign.max_posts_per_creator || 1} {campaign.max_posts_per_creator === 1 ? "publicação" : "publicações"}</p></div>
                    {campaign.budget !== null && campaign.budget !== undefined && (
                      <div className="rounded-xl border border-border bg-background/55 p-4"><div className="flex items-center gap-2 ui-caption mb-1"><DollarSign className="h-4 w-4" />Orçamento</div><p className="font-extrabold text-primary">{formatMoney(campaign.budget)}</p></div>
                    )}
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <h3 className="font-extrabold mb-2 flex items-center gap-2"><Target className="h-4 w-4 text-primary" />Tags obrigatórias</h3>
                      {requiredTags.length === 0 ? <p className="ui-caption">Não há tags obrigatórias. Qualquer página aprovada pode participar.</p> : <div className="flex flex-wrap gap-2">{requiredTags.map((tag) => <Badge key={tag} variant="secondary" className="rounded-full">{tag}</Badge>)}</div>}
                    </div>
                    <div>
                      <h3 className="font-extrabold mb-2">Plataformas aceitas</h3>
                      {platforms.length === 0 ? <p className="ui-caption">Todas as plataformas são aceitas.</p> : <div className="flex flex-wrap gap-2">{platforms.map((platform) => <Badge key={platform} variant="outline" className="rounded-full">{platformLabel(platform)}</Badge>)}</div>}
                    </div>
                  </div>

                  {hasAnyUrl(audioUrls) && (
                    <div>
                      <h3 className="font-extrabold mb-3">Áudio da campanha</h3>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(audioUrls || {}).map(([label, url]) => String(url || "").trim() ? (
                          <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 font-bold hover:bg-accent/30 transition-colors">
                            <Play className="h-4 w-4 text-primary" />{platformLabel(label)}<ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </a>
                        ) : null)}
                      </div>
                    </div>
                  )}

                  {hasAnyUrl(exampleUrls) && (
                    <div>
                      <h3 className="font-extrabold mb-3">Exemplos</h3>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(exampleUrls || {}).map(([label, url], index) => String(url || "").trim() ? (
                          <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 font-bold hover:bg-accent/30 transition-colors">Exemplo {index + 1}<ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></a>
                        ) : null)}
                      </div>
                    </div>
                  )}

                  {ruleEntries.length > 0 && (
                    <div>
                      <h3 className="font-extrabold mb-2">Regras da campanha</h3>
                      <dl className="grid gap-3 rounded-xl border border-border bg-background/55 p-4 sm:grid-cols-2">
                        {ruleEntries.map((rule) => (
                          <div key={`${rule.label}-${rule.value}`} className="min-w-0">
                            <dt className="text-sm font-bold text-foreground">{rule.label}</dt>
                            <dd className="mt-1 whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed text-muted-foreground">{rule.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4 page-enter stagger-2">
              {requiredTags.length > 0 && matchingPages.length === 0 && (
                <Card className="somma-panel rounded-2xl">
                  <CardContent className="p-5 text-center space-y-3">
                    <p className="ui-caption">Você ainda não tem uma página aprovada com uma das tags obrigatórias desta campanha.</p>
                    <Button className="rounded-xl" onClick={() => navigate("/pages")}>Atualizar minhas páginas</Button>
                  </CardContent>
                </Card>
              )}

              {isEnded || isInactive ? (
                <div className="empty-state min-h-[220px]">
                  <Target className="h-8 w-8 text-primary" />
                  <h3 className="font-extrabold text-lg">Campanha encerrada</h3>
                  <p className="ui-caption">O formulário de envio fica oculto quando a campanha não aceita mais novos conteúdos.</p>
                </div>
              ) : (
                <UploadVideo userId={user?.id} fixedCampaignId={campaign.id} fixedCampaign={campaign} showCampaignDetailsLink={false} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignDetail;
