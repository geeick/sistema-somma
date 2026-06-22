import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "@/integrations/apiClient";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        console.error("Error fetching campaigns:", err);
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <p className="text-center text-muted-foreground">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">Active Campaigns</h1>
            <p className="text-muted-foreground">Browse and join campaigns that match your pages</p>
          </div>

          <Input
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />

          {filteredCampaigns.length === 0 ? (
            <Card className="bg-gradient-card border-border">
              <CardContent className="pt-6 text-center text-muted-foreground">
                {searchTerm ? "No campaigns found matching your search." : "No active campaigns available at the moment."}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredCampaigns.map((campaign) => (
                <Card key={campaign.id} className="bg-gradient-card border-border hover:border-primary/50 transition-all cursor-pointer" onClick={() => navigate(`/campaigns/${campaign.id}`)}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-xl">{campaign.title}</CardTitle>
                          {campaign.code && (
                            <Badge variant="secondary" className="font-mono text-xs">
                              {campaign.code}
                            </Badge>
                          )}
                        </div>
                        {campaign.client && (
                          <CardDescription className="mt-1">Client: {campaign.client}</CardDescription>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        {campaign.platforms.map((platform) => {
                          const Icon = platformIcons[platform as keyof typeof platformIcons];
                          return Icon ? (
                            <Badge key={platform} variant="outline" className="gap-1">
                              <Icon className="h-3 w-3" />
                              {platform.replace("_", " ")}
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
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(campaign.end_date).toLocaleDateString('pt-BR')}
                      </span>
                      {isAdmin && campaign.budget && (
                        <span className="flex items-center gap-1 text-primary font-semibold">
                          <DollarSign className="h-4 w-4" />
                          R$ {campaign.budget.toLocaleString()}
                        </span>
                      )}
                      {campaign.required_tags.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Target className="h-4 w-4" />
                          {campaign.required_tags.length} tags
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
