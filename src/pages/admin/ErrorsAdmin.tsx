import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Download, Search, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ErrorLog {
  id: string;
  error_code: string;
  error_message: string;
  error_stack: string | null;
  page_url: string | null;
  severity: string;
  resolved: boolean;
  created_at: string;
  user_id: string | null;
  user_email?: string;
  user_name?: string;
}

interface ErrorStats {
  total: number;
  lastWeek: number;
  critical: number;
  resolved: number;
}

export default function ErrorsAdmin() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ErrorStats>({ total: 0, lastWeek: 0, critical: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [resolvedFilter, setResolvedFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchErrors();
    fetchStats();
  }, [searchTerm, severityFilter, resolvedFilter]);

  const fetchErrors = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (severityFilter !== 'all') {
        query = query.eq('severity', severityFilter);
      }

      if (resolvedFilter !== 'all') {
        query = query.eq('resolved', resolvedFilter === 'true');
      }

      if (searchTerm) {
        query = query.or(`error_code.ilike.%${searchTerm}%,error_message.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Enrich with user data
      const enrichedErrors = await Promise.all(
        (data || []).map(async (errorLog) => {
          if (errorLog.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('email, full_name')
              .eq('id', errorLog.user_id)
              .single();
            
            return {
              ...errorLog,
              user_email: profile?.email,
              user_name: profile?.full_name,
            };
          }
          return errorLog;
        })
      );

      setErrors(enrichedErrors);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [totalResult, weekResult, criticalResult, resolvedResult] = await Promise.all([
        supabase.from('error_logs').select('id', { count: 'exact', head: true }),
        supabase.from('error_logs').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
        supabase.from('error_logs').select('id', { count: 'exact', head: true }).eq('severity', 'critical'),
        supabase.from('error_logs').select('id', { count: 'exact', head: true }).eq('resolved', true),
      ]);

      setStats({
        total: totalResult.count || 0,
        lastWeek: weekResult.count || 0,
        critical: criticalResult.count || 0,
        resolved: resolvedResult.count || 0,
      });
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const toggleResolved = async (errorId: string, currentResolved: boolean) => {
    try {
      const { error } = await supabase
        .from('error_logs')
        .update({
          resolved: !currentResolved,
          resolved_at: !currentResolved ? new Date().toISOString() : null,
        })
        .eq('id', errorId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Error marked as ${!currentResolved ? 'resolved' : 'unresolved'}`,
      });

      fetchErrors();
      fetchStats();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const exportCSV = () => {
    const csv = [
      ['Error Code', 'Message', 'Severity', 'Page URL', 'User Email', 'Resolved', 'Created At'],
      ...errors.map(e => [
        e.error_code,
        e.error_message,
        e.severity,
        e.page_url || 'N/A',
        e.user_email || 'Anonymous',
        e.resolved ? 'Yes' : 'No',
        new Date(e.created_at).toLocaleString('pt-BR'),
      ]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `errors-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'error': return 'default';
      case 'warning': return 'secondary';
      case 'info': return 'outline';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Error Tracking</h1>
        <p className="text-muted-foreground">Monitor and manage application errors</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.lastWeek}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.critical}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.resolved}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search errors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>

            <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="false">Unresolved</SelectItem>
                <SelectItem value="true">Resolved</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={exportCSV} disabled={errors.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Error Code</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : errors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No errors found
                    </TableCell>
                  </TableRow>
                ) : (
                  errors.map((error) => (
                    <TableRow key={error.id} className={error.resolved ? 'opacity-50' : ''}>
                      <TableCell className="font-mono text-sm">{error.error_code}</TableCell>
                      <TableCell className="max-w-xs truncate">{error.error_message}</TableCell>
                      <TableCell>
                        <Badge variant={getSeverityColor(error.severity)}>
                          {error.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {error.user_email || 'Anonymous'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {error.page_url || 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(error.created_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        {error.resolved ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleResolved(error.id, error.resolved)}
                        >
                          {error.resolved ? 'Unresolve' : 'Resolve'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
