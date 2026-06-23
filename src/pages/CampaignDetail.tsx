import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiClient from "@/integrations/apiClient";
import { getNeonSession, type NeonUser } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Instagram, Play, Youtube, Calendar, DollarSign, Target, ExternalLink, Eye, Heart, MessageCircle, Share2, TrendingUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  audio_url: string | null;
  audio_urls: Record<string, string> | null;
  example_urls: Record<string, string> | null;
  rules: any;
  max_posts_per_creator: number;
  status: string;
}

interface Page {
  id: string;
  platform: string;
  handle: string;
  tags: string[];
}

interface Submission {
  id: string;
  user_id: string;
  title: string;
  post_url: string;
  platform: string;
  views_count: number | null;
  profiles: {
    full_name: string | null;
    username: string | null;
  } | null;
}

interface Snapshot {
  submission_id: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

interface AggregatedMetrics {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  engagementRate: number;
  submissionCount: number;
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

const CampaignDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [user, setUser] = useState<NeonUser | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [hasJoined, setHasJoined] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [metrics, setMetrics] = useState<AggregatedMetrics>({
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    engagementRate: 0,
    submissionCount: 0,
  });

  useEffect(() => {
    getNeonSession().then(({ user }) => {
      if (!user) {
        navigate("/auth");
        return;
      }
      setUser(user);
    }).catch(() => navigate("/auth"));
  }, [navigate]);

  useEffect(() => {
    if (!user || !id) return;

    const fetchData = async () => {
      try {
        const [campaignData, pagesData, participantData, submissionsData] = await Promise.all([
          apiClient.tables.list("campaigns", { id, single: true }),
          apiClient.pages.list(),
          apiClient.tables.list("campaign_participants", {
            campaign_id: id,
            user_id: user.id,
            single: true,
          }).catch(() => null),
          apiClient.tables.list("submissions", {
            campaign_id: id,
            status: "approved",
          }).catch(() => []),
        ]);

        if (campaignData) {
          setCampaign(normalizeCampaign(campaignData));
        } else {
          toast({
            title: "Campaign not found",
            description: "This campaign could not be loaded.",
            variant: "destructive",
          });
        }

        setPages(Array.isArray(pagesData) ? pagesData : []);
        setHasJoined(Boolean(participantData));

        const normalizedSubmissions = Array.isArray(submissionsData)
          ? submissionsData.map((submission: any) => ({
              ...submission,
              profiles: submission.profiles ?? null,
            }))
          : [];

        setSubmissions(normalizedSubmissions);

        const submissionIds = normalizedSubmissions.map((submission: Submission) => submission.id);

        if (submissionIds.length === 0) {
          setSnapshots([]);
          setMetrics({
            totalViews: 0,
            totalLikes: 0,
            totalComments: 0,
            totalShares: 0,
            engagementRate: 0,
            submissionCount: 0,
          });
          return;
        }

        // The generic API shim only supports simple equality filters, so fetch snapshots
        // and filter them in the frontend for now.
        const snapshotsData = await apiClient.tables
          .list("snapshots")
          .catch(() => []);

        const latestSnapshotsBySubmission = (Array.isArray(snapshotsData) ? snapshotsData : [])
          .filter((snapshot: Snapshot) => submissionIds.includes(snapshot.submission_id))
          .reduce((acc: Record<string, Snapshot>, snapshot: Snapshot) => {
            if (!acc[snapshot.submission_id]) {
              acc[snapshot.submission_id] = snapshot;
            }
            return acc;
          }, {});

        const latestSnapshots = Object.values(latestSnapshotsBySubmission);
        setSnapshots(latestSnapshots);

        const totalViews = latestSnapshots.reduce((sum, snapshot) => sum + (snapshot.views || 0), 0);
        const totalLikes = latestSnapshots.reduce((sum, snapshot) => sum + (snapshot.likes || 0), 0);
        const totalComments = latestSnapshots.reduce((sum, snapshot) => sum + (snapshot.comments || 0), 0);
        const totalShares = latestSnapshots.reduce((sum, snapshot) => sum + (snapshot.shares || 0), 0);
        const engagementRate =
          totalViews > 0 ? ((totalLikes + totalComments + totalShares) / totalViews) * 100 : 0;

        setMetrics({
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          engagementRate,
          submissionCount: normalizedSubmissions.length,
        });
      } catch (err: any) {
        console.error("Error loading campaign detail:", err);
        toast({
          title: "Error",
          description: err.message || "Failed to load campaign details",
          variant: "destructive",
        });
      }
    };

    fetchData();
  }, [user, id]);

  const handleJoinCampaign = async () => {
    if (!user || !id || !campaign) return;

    // Check if campaign is expired
    if (new Date(campaign.end_date) < new Date()) {
      toast({ 
        title: "Campaign ended", 
        description: "This campaign has ended and is no longer accepting new participants",
        variant: "destructive" 
      });
      return;
    }

    // Check if user has a page with matching tags
    const hasRequiredTags = campaign.required_tags && campaign.required_tags.length > 0;

    const hasMatchingTag =
      !hasRequiredTags ||
      pages.some(page =>
        page.tags.some(tag => campaign.required_tags.includes(tag))
      );

    if (!hasMatchingTag) {
      toast({
        title: "Cannot join campaign",
        description: "You cannot join a campaign that your tags don't match with",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiClient.tables.create("campaign_participants", {
        campaign_id: id,
        user_id: user.id,
      });

      setHasJoined(true);
      toast({ title: "Success", description: "You've joined the campaign!" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || String(err),
        variant: "destructive",
      });
    }
  };


  if (!campaign) {
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

          <Tabs defaultValue="details" className="w-full">
            <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <TabsTrigger value="details">Campaign Details</TabsTrigger>
              {isAdmin && <TabsTrigger value="dashboard">Dashboard & Metrics</TabsTrigger>}
            </TabsList>

            <TabsContent value="details" className="space-y-6">
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <CardTitle className="text-3xl">{campaign.title}</CardTitle>
                    {campaign.code && (
                      <Badge variant="secondary" className="font-mono text-base">
                        {campaign.code}
                      </Badge>
                    )}
                  </div>
                  {campaign.client && (
                    <CardDescription className="mt-2 text-base">Client: {campaign.client}</CardDescription>
                  )}
                </div>
                <div className="flex gap-2">
                  {campaign.platforms.map((platform) => {
                    const PlatformIcon = platformIcons[platform as keyof typeof platformIcons];
                    return PlatformIcon ? <PlatformIcon key={platform} className="h-10 w-10 text-primary" /> : null;
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

              {new Date(campaign.end_date) < new Date() && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-destructive font-semibold">
                    ⚠️ This campaign has ended
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    No new submissions or participations are being accepted
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">End Date</h3>
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(campaign.end_date).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                {isAdmin && campaign.budget && (
                  <div>
                    <h3 className="font-semibold mb-2">Budget</h3>
                    <p className="text-primary font-semibold flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      R$ {campaign.budget.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {campaign.required_tags.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Required Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {campaign.required_tags.map((tag) => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {campaign.audio_urls && Object.values(campaign.audio_urls).some(url => url && url.trim()) && (
                <div>
                  <h3 className="font-semibold mb-3">Áudio da Campanha</h3>
                  <div className="flex flex-wrap gap-3">
                    {campaign.audio_urls.tiktok && campaign.audio_urls.tiktok.trim() && (
                      <a
                        href={campaign.audio_urls.tiktok}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
                      >
                        <Play className="h-4 w-4 text-primary" />
                        <span className="font-medium">TikTok</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </a>
                    )}
                    {campaign.audio_urls.instagram && campaign.audio_urls.instagram.trim() && (
                      <a
                        href={campaign.audio_urls.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
                      >
                        <Instagram className="h-4 w-4 text-primary" />
                        <span className="font-medium">Instagram</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </a>
                    )}
                    {campaign.audio_urls.youtube_shorts && campaign.audio_urls.youtube_shorts.trim() && (
                      <a
                        href={campaign.audio_urls.youtube_shorts}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
                      >
                        <Youtube className="h-4 w-4 text-primary" />
                        <span className="font-medium">YouTube Shorts</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {campaign.example_urls && Object.entries(campaign.example_urls).some(([, url]) => url && url.trim()) && (
                <div>
                  <h3 className="font-semibold mb-3">Exemplos</h3>
                  <div className="flex flex-wrap gap-3">
                    {[1, 2, 3, 4].map((num) => {
                      const url = campaign.example_urls?.[`example_${num}`];
                      if (!url || !url.trim()) return null;
                      return (
                        <a
                          key={num}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
                        >
                          <Eye className="h-4 w-4 text-primary" />
                          <span className="font-medium">Exemplo {num}</span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {!hasJoined ? (
                <>
                  {new Date(campaign.end_date) < new Date() ? (
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-muted-foreground">
                        This campaign has ended and is no longer accepting new participants.
                      </p>
                    </div>
                  ) : pages.length === 0 ? (
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-muted-foreground mb-2">
                        You need to add a page first to join campaigns.
                      </p>
                      <Button variant="default" onClick={() => navigate("/pages")}>
                        Add a page
                      </Button>
                    </div>
                  ) : campaign.required_tags.length > 0 &&
                    !pages.some(page => page.tags.some(tag => campaign.required_tags.includes(tag))) ? (
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-muted-foreground mb-2">
                      You need a page with at least one matching tag to join this campaign.
                    </p>
                    <Button variant="default" onClick={() => navigate("/pages")}>
                      Update your pages
                    </Button>
                  </div>
                ) : (
                  <Button onClick={handleJoinCampaign} className="w-full" size="lg">
                    Join Campaign
                  </Button>
                )}
                </>
              ) : (
                <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
                  {new Date(campaign.end_date) < new Date() ? (
                    <>
                      <p className="text-lg font-semibold text-primary mb-2">
                        Campaign Ended
                      </p>
                      <p className="text-muted-foreground">
                        This campaign has concluded. No new submissions are being accepted.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-semibold text-primary mb-2">
                        You've joined this campaign!
                      </p>
                      <p className="text-muted-foreground">
                        Go to the{" "}
                        <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/dashboard")}>
                          dashboard
                        </Button>
                        {" "}to submit your post.
                      </p>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            {isAdmin && (
              <TabsContent value="dashboard" className="space-y-6">
              {/* Aggregated Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="bg-gradient-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Views</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-primary" />
                      <p className="text-2xl font-bold">{metrics.totalViews.toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Likes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-primary" />
                      <p className="text-2xl font-bold">{metrics.totalLikes.toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Comments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-primary" />
                      <p className="text-2xl font-bold">{metrics.totalComments.toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Shares</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Share2 className="h-4 w-4 text-primary" />
                      <p className="text-2xl font-bold">{metrics.totalShares.toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Engagement Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <p className="text-2xl font-bold">{metrics.engagementRate.toFixed(2)}%</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Submissions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <p className="text-2xl font-bold">{metrics.submissionCount}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Submissions Table */}
              <Card className="bg-gradient-card border-border">
                <CardHeader>
                  <CardTitle>Campaign Submissions</CardTitle>
                  <CardDescription>All approved submissions for this campaign</CardDescription>
                </CardHeader>
                <CardContent>
                  {submissions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No submissions yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Creator</TableHead>
                            <TableHead>Platform</TableHead>
                            <TableHead className="text-right">Views</TableHead>
                            <TableHead className="text-right">Likes</TableHead>
                            <TableHead className="text-right">Comments</TableHead>
                            <TableHead className="text-right">Shares</TableHead>
                            <TableHead className="text-right">Engagement</TableHead>
                            <TableHead>Link</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {submissions.map((submission) => {
                            const snapshot = snapshots.find(s => s.submission_id === submission.id);
                            const views = snapshot?.views || submission.views_count || 0;
                            const likes = snapshot?.likes || 0;
                            const comments = snapshot?.comments || 0;
                            const shares = snapshot?.shares || 0;
                            const engagement = views > 0 ? ((likes + comments + shares) / views) * 100 : 0;
                            
                            return (
                              <TableRow key={submission.id}>
                                <TableCell className="font-medium">
                                  {submission.profiles?.full_name || submission.profiles?.username || 'Unknown'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="capitalize">
                                    {submission.platform.replace('_', ' ')}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">{views.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{likes.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{comments.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{shares.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{engagement.toFixed(2)}%</TableCell>
                                <TableCell>
                                  <a 
                                    href={submission.post_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default CampaignDetail;
