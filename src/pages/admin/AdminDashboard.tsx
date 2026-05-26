import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Wallet, Tags, Settings, AlertTriangle } from 'lucide-react';
import { CreatorStats } from '@/components/admin/CreatorStats';

export default function AdminDashboard() {
  const navigate = useNavigate();

  const modules = [
    {
      title: 'Campaigns',
      description: 'Create, edit, and manage campaigns',
      icon: LayoutDashboard,
      path: '/admin/campaigns',
      color: 'text-blue-500',
    },
    {
      title: 'Submissions Queue',
      description: 'Review and moderate content submissions',
      icon: FileText,
      path: '/admin/submissions',
      color: 'text-green-500',
    },
    {
      title: 'Creators & Pages',
      description: 'Manage creators, pages, and verification',
      icon: Users,
      path: '/admin/creators',
      color: 'text-purple-500',
    },
    {
      title: 'Wallet & Payouts',
      description: 'Process withdrawals and manage finances',
      icon: Wallet,
      path: '/admin/wallet',
      color: 'text-yellow-500',
    },
    {
      title: 'Tags Manager',
      description: 'Manage tags, categories, and taxonomy',
      icon: Tags,
      path: '/admin/tags',
      color: 'text-pink-500',
    },
    {
      title: 'Error Tracking',
      description: 'Monitor and resolve application errors',
      icon: AlertTriangle,
      path: '/admin/errors',
      color: 'text-red-500',
    },
    {
      title: 'Settings',
      description: 'System settings and configuration',
      icon: Settings,
      path: '/admin/settings',
      color: 'text-gray-500',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Admin Console</h1>
        <p className="text-muted-foreground">Manage your influencer marketing platform</p>
      </div>

      <div className="mb-8">
        <CreatorStats />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Card key={module.path} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(module.path)}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Icon className={`h-8 w-8 ${module.color}`} />
                  <div>
                    <CardTitle>{module.title}</CardTitle>
                    <CardDescription>{module.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Open Module
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
