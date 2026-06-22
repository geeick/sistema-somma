import { useEffect, useState } from "react";
import apiClient from "@/integrations/apiClient";
import { Card, CardContent } from "@/components/ui/card";
import { Instagram, Play, Youtube } from "lucide-react";
import { SheetMetric, findMetricForUrl, computePayoutFromPlays } from "@/hooks/useSheetMetrics";

interface Video {
  id: string;
  title: string;
  platform: "instagram" | "tiktok" | "youtube_shorts" | "twitter";
  status: "pending" | "approved" | "rejected" | "paid" | "deleted";
  payment_amount: number | null;
  uploaded_at: string;
  views_count: number | null;
  post_url: string | null;
}

interface VideoListProps {
  userId?: string;
  sheetMetrics?: SheetMetric[];
  onMetricsRefresh?: () => void;
}

const platformIcons = {
  instagram: Instagram,
  tiktok: Play,
  youtube_shorts: Youtube,
};

const platformColors = {
  instagram: "text-pink-500",
  tiktok: "text-foreground",
  youtube_shorts: "text-red-500",
};

const statusColors = {
  pending: "bg-yellow-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
  paid: "bg-blue-500",
  deleted: "bg-gray-500",
};

export const VideoList = ({ userId, sheetMetrics = [], onMetricsRefresh }: VideoListProps) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVideos = async () => {
    try {
      const data = await apiClient.tables.list('submissions', { user_id: userId });
      const vids = (data || []).filter((v: any) => v.status !== 'deleted').sort((a: any, b: any) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
      setVideos(vids);
    } catch (err) {
      console.error('Error fetching videos:', err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!userId) return;

    fetchVideos();

    // realtime not available in API shim — consider polling or SSE
    return undefined;
  }, [userId]);

  if (isLoading) {
    return <div>Loading videos...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Your Videos</h2>
      {videos.length === 0 ? (
        <Card className="bg-gradient-card border-border">
          <CardContent className="pt-6 text-center text-muted-foreground">
            No videos uploaded yet. Start uploading to earn!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {videos.map((video) => {
            const PlatformIcon = platformIcons[video.platform];
            const metric = findMetricForUrl(video.post_url, sheetMetrics);
            const plays = metric?.plays || 0;
            const earning = computePayoutFromPlays(plays);

            return (
              <Card key={video.id} className="bg-gradient-card border-border">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {PlatformIcon && (
                        <PlatformIcon className={`h-5 w-5 ${platformColors[video.platform] || "text-foreground"}`} />
                      )}
                      <div>
                        <h3 className="font-semibold">{video.title}</h3>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${statusColors[video.status]}`}>
                          {video.status}
                        </span>
                        {video.post_url && (
                          <a
                            href={video.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline block mt-1"
                          >
                            View Post
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sheet Metrics */}
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-muted-foreground">URL</p>
                      <p className="font-medium truncate max-w-[200px]" title={metric?.url || video.post_url || ""}>
                        {metric?.url || video.post_url || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">UserName</p>
                      <p className="font-medium">{metric?.username || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Likes</p>
                      <p className="font-medium">{metric ? metric.likes.toLocaleString() : "0"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Plays</p>
                      <p className="font-medium text-primary">{metric ? metric.plays.toLocaleString() : "0"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t border-border">
                    <div>
                      <p className="text-muted-foreground">Earnings</p>
                      <p className="font-medium text-primary">
                        R$ {earning.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Uploaded</p>
                      <p className="font-medium">{new Date(video.uploaded_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
