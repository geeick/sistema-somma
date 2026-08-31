import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "@/integrations/apiClient";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Instagram, Play, Youtube, Calendar, DollarSign, Target } from "lucide-react";
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
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function normalizeCampaign(campaign: any): Campaign {
  return {
    ...campaign,
    required_tags: normalizeList(campaign.required_tags),
    platforms: normalizeList(campaign.platforms),
  };
}

function normalizePlatform(platform: string) {
  const labels: Record<string, string> = {
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube_shorts: "YouTube Shorts",
  };

  return labels[platform] || platform.replace("_", " ");
}

const platformIcons = {
  instagram: Instagram,
  tiktok: Play,
  youtube_shorts: Youtube,
};

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

  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.client?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen somma-shell">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <p className="text-center text-muted-foreground">Carregando campanhas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen somma-shell">
      <Navbar />
      <div className="container mx-auto px-4 pt-28 pb-12">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="somma-dark-panel somma-grain rounded-[2rem] p-8">
            <p className="text-primary font-semibold mb-2">Movimentos ativos</p>
            <h1 className="font-display text-5xl font-black mb-3 text-[#f7ead1]">Campanhas ativas</h1>
            <p className="text-[#f7ead1]/75">Explore campanhas que combinam com suas páginas e participe dos próximos lançamentos.</p>
          </div>

          <Input
            placeholder="Buscar campanhas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />

          {filteredCampaigns.length === 0 ? (
            <Card className="somma-panel rounded-2xl">
              <CardContent className="pt-6 text-center text-muted-foreground">
                {searchTerm ? "Nenhuma campanha corresponde à sua busca." : "Nenhuma campanha ativa disponível no momento."}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredCampaigns.map((campaign) => (
                <Card key={campaign.id} className="somma-panel rounded-2xl hover:border-primary/50 transition-all cursor-pointer" onClick={() => navigate(`/campaigns/${campaign.id}`)}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="font-display text-2xl">{campaign.title}</CardTitle>
                          {campaign.code && (
                            <Badge variant="secondary" className="font-mono text-xs">
                              {campaign.code}
                            </Badge>
                          )}
                        </div>
                        {campaign.client && (
                          <CardDescription className="mt-1">Cliente: {campaign.client}</CardDescription>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4 flex-wrap justify-end">
                        {campaign.platforms.map((platform) => {
                          const Icon = platformIcons[platform as keyof typeof platformIcons];
                          return Icon ? (
                            <Badge key={platform} variant="outline" className="gap-1">
                              <Icon className="h-3 w-3" />
                              {normalizePlatform(platform)}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {campaign.brief && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{campaign.brief}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Termina em {new Date(campaign.end_date).toLocaleDateString('pt-BR')}
                      </span>
                      {isAdmin && campaign.budget && (
                        <span className="flex items-center gap-1 text-primary font-semibold">
                          <DollarSign className="h-4 w-4" />
                          R$ {campaign.budget.toLocaleString("pt-BR")}
                        </span>
                      )}
                      {campaign.required_tags.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Target className="h-4 w-4" />
                          {campaign.required_tags.length} tags obrigatórias
                        </span>
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
