import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import Pages from "./pages/Pages";
import Wallet from "./pages/Wallet";
import NotFound from "./pages/NotFound";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/pages" element={<Pages />} />
        <Route path="/wallet" element={<Wallet />} />
        
        {/* Admin Routes */}
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
        
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
