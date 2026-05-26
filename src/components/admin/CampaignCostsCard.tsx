import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, Video } from "lucide-react";

interface CampaignCost {
  campaign_id: string;
  code: string;
  title: string;
  budget: number;
  total_submissions: number;
  total_cost: number;
  total_views: number;
  remaining_budget: number;
}

export const CampaignCostsCard = () => {
  const [costs, setCosts] = useState<CampaignCost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCosts = async () => {
      const { data, error } = await supabase
        .from("campaign_costs")
        .select("*")
        .order("total_cost", { ascending: false });

      if (error) {
        console.error("Error fetching campaign costs:", error);
      } else {
        setCosts(data || []);
      }
      setIsLoading(false);
    };

    fetchCosts();

    // Subscribe to changes
    const channel = supabase
      .channel("campaign-costs-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "submissions",
        },
        () => {
          fetchCosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaign Costs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Costs Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {costs.length === 0 ? (
            <p className="text-muted-foreground">No campaign data available</p>
          ) : (
            costs.map((cost) => (
              <div
                key={cost.campaign_id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{cost.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Code: {cost.code}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      R$ {cost.total_cost.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      of R$ {cost.budget.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">
                        {cost.total_submissions}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Submissions
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">
                        {cost.total_views.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">Views</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">
                        R$ {cost.remaining_budget.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Remaining
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
