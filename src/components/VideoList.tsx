import { useEffect, useState } from "react";
import apiClient from "@/integrations/apiClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Instagram, Play, RefreshCw, Youtube } from "lucide-react";

interface Video {
  id: string;
  title: string | null;
  platform: "instagram" | "tiktok" | "youtube_shorts" | "twitter" | string;
  status: "pending" | "approved" | "rejected" | "paid" | "deleted" | string;
  payment_amount: number | string | null;
  uploaded_at: string | null;
  created_at?: string | null;
  views_count: number | string | null;
  likes_count?: number | string | null;
  username?: string | null;
  metrics_source?: string | null;
  metrics_synced_at?: string | null;
  post_url: string | null;
}

interface VideoListProps {
  userId?: string;
  refreshKey?: number;
}

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  tiktok: Play,
  youtube_shorts: Youtube,
};

const platformColors: Record<string, string> = {
  instagram: "text-pink-500",
  tiktok: "text-foreground",
  youtube_shorts: "text-red-500",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500 text-white",
  approved: "bg-green-500 text-white",
  rejected: "bg-red-500 text-white",
  paid: "bg-blue-500 text-white",
  deleted: "bg-gray-500 text-white",
};

function toNumber(value: number | string | null | undefined) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function formatNumber(value: number | string | null | undefined) {
  return toNumber(value).toLocaleString("pt-BR");
}

function formatMoney(value: number | string | null | undefined) {
  return toNumber(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleDateString();
}

function normalizeUsername(username: string | null | undefined) {
  if (!username) return "—";
  return username.startsWith("@") ? username : `@${username}`;
}

export const VideoList = ({ userId, refreshKey = 0 }: VideoListProps) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVideos = async () => {
    if (!userId) return;

    setIsLoading(true);

    try {
      const data = await apiClient.tables.list("submissions", {
        user_id: userId,
      });

      const vids = (data || [])
        .filter((video: Video) => video.status !== "deleted")
        .sort((a: Video, b: Video) => {
          const aDate = new Date(a.uploaded_at || a.created_at || 0).getTime();
          const bDate = new Date(b.uploaded_at || b.created_at || 0).getTime();

          return bDate - aDate;
        });

      setVideos(vids);
    } catch (err) {
      console.error("Error fetching videos:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
    return undefined;
  }, [userId, refreshKey]);

  if (isLoading) {
    return <div>Loading videos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Your Videos</h2>

        <Button variant="outline" size="sm" onClick={fetchVideos}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

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
            const uploadedAt = video.uploaded_at || video.created_at;
            const statusClass =
              statusColors[video.status] || "bg-muted text-muted-foreground";

            return (
              <Card key={video.id} className="bg-gradient-card border-border">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {PlatformIcon && (
                        <PlatformIcon
                          className={`h-5 w-5 ${
                            platformColors[video.platform] || "text-foreground"
                          }`}
                        />
                      )}

                      <div>
                        <h3 className="font-semibold">
                          {video.title || "Submission"}
                        </h3>

                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${statusClass}`}
                        >
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

                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-muted-foreground">URL</p>
                      <p
                        className="font-medium truncate max-w-[240px]"
                        title={video.post_url || ""}
                      >
                        {video.post_url || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">UserName</p>
                      <p className="font-medium">
                        {normalizeUsername(video.username)}
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Likes</p>
                      <p className="font-medium">
                        {formatNumber(video.likes_count)}
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Plays</p>
                      <p className="font-medium text-primary">
                        {formatNumber(video.views_count)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t border-border">
                    <div>
                      <p className="text-muted-foreground">Earnings</p>
                      <p className="font-medium text-primary">
                        R$ {formatMoney(video.payment_amount)}
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Uploaded</p>
                      <p className="font-medium">{formatDate(uploadedAt)}</p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Metrics Source</p>
                      <p className="font-medium">
                        {video.metrics_source || "Not synced yet"}
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Last Synced</p>
                      <p className="font-medium">
                        {formatDate(video.metrics_synced_at)}
                      </p>
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

