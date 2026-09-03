import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { getNeonAccessToken, getNeonUser } from "@/lib/auth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import Pages from "./pages/PagesPro";
import Wallet from "./pages/Wallet";
import NotFound from "./pages/NotFound";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import CampaignsAdmin from "./pages/admin/CampaignsAdmin";
import CampaignEditor from "./pages/admin/CampaignEditor";
import SubmissionsAdmin from "./pages/admin/SubmissionsAdmin";
import CreatorsAdmin from "./pages/admin/CreatorsAdmin";
import WalletAdmin from "./pages/admin/WalletAdmin";
import TagsAdmin from "./pages/admin/TagsAdmin";
import SettingsAdmin from "./pages/admin/SettingsAdmin";
import ErrorsAdmin from "./pages/admin/ErrorsAdmin";
import { ScrollToTop } from "@/components/ScrollToTop";
import { LoadingState } from "@/components/LoadingState";
import { SiteFooter } from "@/components/SiteFooter";
import { preloadCreatorData } from "@/integrations/apiClient";

const queryClient = new QueryClient();
const API_BASE = import.meta.env.VITE_API_BASE || "";
const ADMIN_CACHE_TTL = 60_000;
let cachedAdminStatus: { userId: string; value: boolean; expiresAt: number } | null = null;

async function currentUserIsAdmin(userId: string) {
  if (
    cachedAdminStatus?.userId === userId &&
    cachedAdminStatus.expiresAt > Date.now()
  ) {
    return cachedAdminStatus.value;
  }

  const token = await getNeonAccessToken();
  if (!token) return false;

  try {
    const response = await fetch(`${API_BASE}/api/admin/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return false;
    const json = await response.json().catch(() => null);
    const value = Boolean(json?.data?.isAdmin);
    cachedAdminStatus = { userId, value, expiresAt: Date.now() + ADMIN_CACHE_TTL };
    return value;
  } catch (error) {
    console.error("Admin redirect check failed", error);
    return false;
  }
}

function AdminRedirect({ children, requireAuth = false }: { children: ReactNode; requireAuth?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkUserRole() {
      setIsChecking(true);
      try {
        const user = await getNeonUser();
        if (!user) {
          if (requireAuth) {
            navigate("/auth", { replace: true });
            return;
          }
          if (isMounted) setIsChecking(false);
          return;
        }

        window.setTimeout(() => void preloadCreatorData(user.id), 250);
        const isAdmin = await currentUserIsAdmin(user.id);
        if (isAdmin && !location.pathname.startsWith("/admin")) {
          navigate("/admin", { replace: true });
          return;
        }
        if (isMounted) setIsChecking(false);
      } catch (error) {
        console.error("Admin redirect failed", error);
        if (isMounted) setIsChecking(false);
      }
    }

    checkUserRole();
    return () => { isMounted = false; };
  }, [location.pathname, navigate, requireAuth]);

  if (isChecking) {
    return (
      <div className="min-h-screen somma-shell flex items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<AdminRedirect><Index /></AdminRedirect>} />
        <Route path="/auth" element={<AdminRedirect><Auth /></AdminRedirect>} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/dashboard" element={<AdminRedirect requireAuth><Dashboard /></AdminRedirect>} />
        <Route path="/campaigns" element={<AdminRedirect requireAuth><Campaigns /></AdminRedirect>} />
        <Route path="/campaigns/:id" element={<AdminRedirect requireAuth><CampaignDetail /></AdminRedirect>} />
        <Route path="/pages" element={<AdminRedirect requireAuth><Pages /></AdminRedirect>} />
        <Route path="/wallet" element={<AdminRedirect requireAuth><Wallet /></AdminRedirect>} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="campaigns" element={<CampaignsAdmin />} />
          <Route path="campaigns/new" element={<CampaignEditor />} />
          <Route path="campaigns/:id/edit" element={<CampaignEditor />} />
          <Route path="submissions" element={<SubmissionsAdmin />} />
          <Route path="creators" element={<CreatorsAdmin />} />
          <Route path="wallet" element={<WalletAdmin />} />
          <Route path="tags" element={<TagsAdmin />} />
          <Route path="errors" element={<ErrorsAdmin />} />
          <Route path="settings" element={<SettingsAdmin />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <SiteFooter />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
