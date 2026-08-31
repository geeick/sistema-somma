import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "@/integrations/apiClient";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Instagram, Play, Youtube, Calendar, DollarSign, Target, Search } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

interface Campaign {
  id: string;
  title: string;
  code?: string | null;
  client: string | null;
  brief: string | null;
  budget: number | null;
  start_date: string;
  end_date: string;
  required_tags: string[];
  platforms: string[];
  status: string;
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function normalizeCampaign(campaign: any): Campaign {
  return { ...campaign, required_tags: normalizeList(campaign.required_tags), platforms: normalizeList(campaign.platforms) };
}

function normalizePlatform(platform: string) {
  const labels: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube_shorts: "YouTube Shorts" };
  return labels[platform] || platform.replace("_", " ");
}

const platformIcons = { instagram: Instagram, tiktok: Play, youtube_shorts: Youtube };

const Campaigns = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const data = await apiClient.campaigns.active();
        setCampaigns(Array.isArray(data) ? data.map(normalizeCampaign) : []);
      } catch (err) {
        console.error("Erro ao carregar campanhas:", err);
        setCampaigns([]);
      }
      setIsLoading(false);
    };
    fetchCampaigns();
  }, []);

  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.client?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen somma-shell">
        <Navbar />
        <div className="container mx-auto px-4 pt-28 pb-12">
          <p className="text-center text-muted-foreground font-semibold">Carregando campanhas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen somma-shell">
      <Navbar />
      <div className="container mx-auto px-4 pt-28 pb-14">
        <div className="max-w-6xl mx-auto space-y-6">
          <header className="app-page-header">
            <p className="app-eyebrow">Movimentos ativos</p>
            <h1 className="app-title">Campanhas</h1>
            <p className="app-subtitle">Descubra oportunidades que combinam com suas páginas e participe dos próximos lançamentos.</p>
          </header>

          <div className="relative max-w-lg page-enter stagger-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por campanha ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-12 pl-11 rounded-xl bg-card/80 shadow-sm"
            />
          </div>

          {filteredCampaigns.length === 0 ? (
            <div className="empty-state page-enter stagger-2">
              <Target className="h-9 w-9 text-primary" />
              <h2 className="text-xl font-extrabold">{searchTerm ? "Nenhum resultado encontrado" : "Nenhuma campanha ativa agora"}</h2>
              <p className="ui-caption max-w-lg">
                {searchTerm ? "Tente buscar por outro nome de campanha ou cliente." : "Novas campanhas aparecerão aqui assim que estiverem disponíveis."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 page-enter stagger-2">
              {filteredCampaigns.map((campaign) => (
                <Card
                  key={campaign.id}
                  className="somma-panel somma-card-hover rounded-2xl cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <CardTitle className="text-xl md:text-2xl font-extrabold tracking-[-0.035em]">{campaign.title}</CardTitle>
                          {campaign.code && <Badge variant="secondary" className="font-mono text-xs">{campaign.code}</Badge>}
                        </div>
                        {campaign.client && <CardDescription className="text-[0.93rem]">Cliente: {campaign.client}</CardDescription>}
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        {campaign.platforms.map((platform) => {
                          const Icon = platformIcons[platform as keyof typeof platformIcons];
                          return Icon ? (
                            <Badge key={platform} variant="outline" className="gap-1.5 px-3 py-1.5 rounded-full">
                              <Icon className="h-3.5 w-3.5" />
                              {normalizePlatform(platform)}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {campaign.brief && <p className="text-[0.95rem] leading-relaxed text-muted-foreground mb-5 line-clamp-2">{campaign.brief}</p>}
                    <div className="flex items-center gap-x-5 gap-y-2 text-[0.9rem] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />Termina em {new Date(campaign.end_date).toLocaleDateString("pt-BR")}</span>
                      {isAdmin && campaign.budget && (
                        <span className="flex items-center gap-1.5 text-primary font-extrabold"><DollarSign className="h-4 w-4" />R$ {campaign.budget.toLocaleString("pt-BR")}</span>
                      )}
                      {campaign.required_tags.length > 0 && (
                        <span className="flex items-center gap-1.5"><Target className="h-4 w-4" />{campaign.required_tags.length} {campaign.required_tags.length === 1 ? "tag obrigatória" : "tags obrigatórias"}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Campaigns;
