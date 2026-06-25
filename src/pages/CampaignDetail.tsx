import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiClient from "@/integrations/apiClient";
import { getNeonSession, type NeonUser } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { UploadVideo } from "@/components/UploadVideo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, ExternalLink, Instagram, Play, Target, Users, Youtube } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
  rules: any;
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

const platformIcons = {
  instagram: Instagram,
  tiktok: Play,
  youtube_shorts: Youtube,
};

function normalizeStringList(value: unknown): string[] {
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

function normalizeRecord(value: unknown): Record<string, string> | null {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, string>;
  }

  return null;
}

function normalizeCampaign(data: any): Campaign {
  return {
    ...data,
    required_tags: normalizeStringList(data.required_tags),
    platforms: normalizeStringList(data.platforms),
    audio_urls: normalizeRecord(data.audio_urls),
    example_urls: normalizeRecord(data.example_urls),
  } as Campaign;
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("pt-BR");
}

function formatMoney(value?: number | null) {
  const amount = Number(value || 0);
  return `R$ ${amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function platformLabel(platform: string) {
  return platform.replace("_", " ");
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
    getNeonSession()
      .then(({ user }) => {
        if (!user) {
          navigate("/auth");
          return;
        }
        setUser(user);
      })
      .catch(() => navigate("/auth"));
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
          toast({
            title: "Campaign not found",
            description: "This campaign could not be loaded.",
            variant: "destructive",
          });
          setCampaign(null);
          return;
        }

        setCampaign(normalizeCampaign(campaignData));
        setPages(Array.isArray(pagesData) ? pagesData : []);
      } catch (err: any) {
        console.error("Error loading campaign detail:", err);
        toast({
          title: "Error",
          description: err.message || "Failed to load campaign details",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, id]);

  const requiredTags = useMemo(
    () => normalizeStringList(campaign?.required_tags),
    [campaign]
  );

  const platforms = useMemo(
    () => normalizeStringList(campaign?.platforms),
    [campaign]
  );

  const matchingPages = useMemo(() => {
    return pages.filter((page) => page.verified === true && pageMatchesRequiredTags(page, requiredTags));
  }, [pages, requiredTags]);

  const isEnded = campaign?.end_date ? new Date(campaign.end_date) < new Date() : false;
  const isInactive = campaign?.status && campaign.status !== "active";
  const audioUrls = normalizeRecord(campaign?.audio_urls);
  const exampleUrls = normalizeRecord(campaign?.example_urls);

  if (isLoading || !campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <p className="text-center text-muted-foreground">Loading campaign...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-7xl mx-auto space-y-6">
          <Button variant="ghost" onClick={() => navigate("/campaigns")}>← Back to Campaigns</Button>

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-gradient-card border-border">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <CardTitle className="text-3xl">{campaign.title}</CardTitle>
                        {campaign.code && (
                          <Badge variant="secondary" className="font-mono">
                            {campaign.code}
                          </Badge>
                        )}
                        <Badge variant={campaign.status === "active" && !isEnded ? "default" : "secondary"}>
                          {isEnded ? "ended" : campaign.status || "active"}
                        </Badge>
                      </div>

                      {campaign.client && (
                        <CardDescription className="text-base">
                          Client: {campaign.client}
                        </CardDescription>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {platforms.map((platform) => {
                        const PlatformIcon = platformIcons[platform as keyof typeof platformIcons];
                        return PlatformIcon ? (
                          <PlatformIcon key={platform} className="h-9 w-9 text-primary" />
                        ) : null;
                      })}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {campaign.brief && (
                    <div>
                      <h3 className="font-semibold mb-2">Brief</h3>
                      <p className="text-muted-foreground whitespace-pre-wrap">{campaign.brief}</p>
                    </div>
                  )}

                  {(isEnded || isInactive) && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
                      <p className="font-semibold text-destructive">
                        This campaign is not accepting new submissions.
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Status: {campaign.status || "unknown"}. End date: {formatDate(campaign.end_date)}.
                      </p>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-lg border border-border bg-muted/20 p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        End Date
                      </div>
                      <p className="font-semibold">{formatDate(campaign.end_date)}</p>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/20 p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Users className="h-4 w-4" />
                        Max Posts
                      </div>
                      <p className="font-semibold">{campaign.max_posts_per_creator || 1} per creator</p>
                    </div>

                    {campaign.budget !== null && campaign.budget !== undefined && (
                      <div className="rounded-lg border border-border bg-muted/20 p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <DollarSign className="h-4 w-4" />
                          Budget
                        </div>
                        <p className="font-semibold text-primary">{formatMoney(campaign.budget)}</p>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        Required Tags
                      </h3>
                      {requiredTags.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No required tags. Any approved page can submit.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {requiredTags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Accepted Platforms</h3>
                      {platforms.length === 0 ? (
                        <p className="text-sm text-muted-foreground">All platforms accepted.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {platforms.map((platform) => (
                            <Badge key={platform} variant="outline" className="capitalize">
                              {platformLabel(platform)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {hasAnyUrl(audioUrls) && (
                    <div>
                      <h3 className="font-semibold mb-3">Campaign Audio</h3>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(audioUrls || {}).map(([label, url]) => {
                          if (!String(url || "").trim()) return null;
                          return (
                            <a
                              key={label}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 transition-colors hover:bg-accent"
                            >
                              <Play className="h-4 w-4 text-primary" />
                              <span className="font-medium capitalize">{platformLabel(label)}</span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {hasAnyUrl(exampleUrls) && (
                    <div>
                      <h3 className="font-semibold mb-3">Examples</h3>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(exampleUrls || {}).map(([label, url], index) => {
                          if (!String(url || "").trim()) return null;
                          return (
                            <a
                              key={label}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 transition-colors hover:bg-accent"
                            >
                              <span className="font-medium">Example {index + 1}</span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {campaign.rules && (
                    <div>
                      <h3 className="font-semibold mb-2">Campaign Rules</h3>
                      <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                        {typeof campaign.rules === "string"
                          ? campaign.rules
                          : JSON.stringify(campaign.rules, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-4">
              {requiredTags.length > 0 && matchingPages.length === 0 && (
                <Card className="bg-gradient-card border-border">
                  <CardContent className="pt-6 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      You do not have an approved page with one of this campaign's required tags yet.
                    </p>
                    <Button onClick={() => navigate("/pages")}>Update your pages</Button>
                  </CardContent>
                </Card>
              )}

              {isEnded || isInactive ? (
                <Card className="bg-gradient-card border-border">
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    This campaign is closed, so the submit form is hidden.
                  </CardContent>
                </Card>
              ) : (
                <UploadVideo
                  userId={user?.id}
                  fixedCampaignId={campaign.id}
                  fixedCampaign={campaign}
                  showCampaignDetailsLink={false}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignDetail;

