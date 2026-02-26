import { GitBranch, Play, CheckCircle, Database, TrendingUp, TrendingDown, Plus, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import { mockPipelines, mockRuns, mockExecutionHistory } from '@/data/mock-data';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';

const metrics = [
  { title: 'Active Pipelines', value: 4, change: 12, icon: GitBranch },
  { title: 'Executed Today', value: 2, change: -5, icon: Play },
  { title: 'Success Rate', value: '87.5%', change: 3.2, icon: CheckCircle },
  { title: 'Data Processed', value: '1.2 TB', change: 15, icon: Database },
];

const statusColors: Record<string, string> = {
  success: 'bg-success',
  failed: 'bg-destructive',
  warning: 'bg-warning',
  running: 'bg-info animate-pulse-dot',
};

const Dashboard = () => {
  const navigate = useNavigate();
  const recentRuns = mockRuns.slice(0, 5);
  const failedPipelines = mockPipelines.filter((p) => p.status === 'failed');

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.title} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{m.title}</p>
                  <p className="text-2xl font-bold mt-1">{m.value}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                  <m.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs">
                {m.change >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-success" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <span className={m.change >= 0 ? 'text-success' : 'text-destructive'}>
                  {m.change > 0 ? '+' : ''}{m.change}%
                </span>
                <span className="text-muted-foreground">vs last period</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Execution History (7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockExecutionHistory}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => format(new Date(v), 'MMM dd')} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="success" stroke="hsl(86, 66%, 44%)" strokeWidth={2} dot={{ r: 3 }} name="Success" />
                  <Line type="monotone" dataKey="failures" stroke="hsl(354, 70%, 54%)" strokeWidth={2} dot={{ r: 3 }} name="Failures" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent runs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Executions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentRuns.map((run) => (
              <div key={run.id} className="flex items-center gap-3 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusColors[run.status]}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{run.pipelineName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })} · {run.duration}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Attention table */}
      {failedPipelines.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Attention Needed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pipeline</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedPipelines.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="text-xs">Failed</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {p.lastExecution ? formatDistanceToNow(new Date(p.lastExecution.startedAt), { addSuffix: true }) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/pipelines/${p.id}`)}>
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* FAB */}
      <Button
        className="fixed bottom-6 right-6 h-12 rounded-full shadow-lg gap-2 px-5"
        onClick={() => navigate('/create-pipeline')}
      >
        <Plus className="h-5 w-5" />
        New Pipeline
      </Button>
    </div>
  );
};

export default Dashboard;
