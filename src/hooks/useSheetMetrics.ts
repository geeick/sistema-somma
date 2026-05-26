import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SheetMetric {
  url: string;
  username: string;
  likes: number;
  plays: number;
}

export function computePayoutFromPlays(plays: number): number {
  if (plays <= 0) return 0;
  if (plays < 1_000) return 5;
  if (plays < 5_000) return 10;
  if (plays < 25_000) return 20;
  if (plays < 50_000) return 50;
  if (plays < 100_000) return 70;
  if (plays < 250_000) return 100;
  if (plays < 500_000) return 150;
  if (plays < 1_000_000) return 200;
  return 250;
}

export function findMetricForUrl(postUrl: string | null, metrics: SheetMetric[]): SheetMetric | null {
  if (!postUrl || metrics.length === 0) return null;
  const normalizedUrl = postUrl.trim().replace(/\/+$/, "");
  return metrics.find((m) => {
    const mUrl = m.url.replace(/\/+$/, "");
    return mUrl === normalizedUrl || normalizedUrl.includes(mUrl) || mUrl.includes(normalizedUrl);
  }) || null;
}

export function useSheetMetrics() {
  const [sheetMetrics, setSheetMetrics] = useState<SheetMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSheetMetrics = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("fetch-sheets-metrics");
      if (error) {
        console.error("Error fetching sheet metrics:", error);
        return;
      }
      if (data?.status === "success" && Array.isArray(data.data)) {
        const metrics: SheetMetric[] = data.data.map((row: any) => ({
          url: String(row.url || row.postLink || row.link || row.URL || "").trim(),
          username: String(row.username || row.userName || row.UserName || row.USERNAME || "").trim(),
          likes: Number(row.likes || row.Likes || row.LIKES || 0),
          plays: Number(row.plays || row.Plays || row.PLAYS || row.views || row.Views || 0),
        }));
        setSheetMetrics(metrics);
      }
    } catch (err) {
      console.error("Failed to fetch sheet metrics:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSheetMetrics();
  }, []);

  return { sheetMetrics, isLoading, refetch: fetchSheetMetrics };
}
