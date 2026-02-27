import { GitBranch, Play, CheckCircle, Database, TrendingUp, TrendingDown, Plus, AlertTriangle, Square, Pencil, Eye, Circle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { mockPipelines, mockRuns, mockExecutionHistory } from '@/data/mock-data';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const metrics = [
  { title: 'Active Pipelines', value: 4, change: 12, icon: GitBranch },
  { title: 'Executed Today', value: 2, change: -5, icon: Play },
  { title: 'Success Rate', value: '87.5%', change: 3.2, icon: CheckCircle },
  { title: 'Data Processed', value: '1.2 TB', change: 15, icon: Database },
];

const lampColor: Record<string, string> = {
  success: 'text-success',
  deployed: 'text-success',
  failed: 'text-destructive',
  running: 'text-warning',
  warning: 'text-warning',
  draft: 'text-muted-foreground',
  ready: 'text-info',
};

const lampBg: Record<string, string> = {
  success: 'bg-success',
  deployed: 'bg-success',
  failed: 'bg-destructive',
  running: 'bg-warning animate-pulse',
  warning: 'bg-warning',
  draft: 'bg-muted-foreground',
  ready: 'bg-info',
};

const Dashboard = () => {
  const navigate = useNavigate();
  const recentRuns = mockRuns.slice(0, 5);

  const handleStop = (pipelineId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast.success('Pipeline stopped. Note: A data engineer can stop a pipeline only during the "Running" phase — while data is being ingested or transformed. Once completed, the run cannot be interrupted.');
  };

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
                  <RechartsTooltip />
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
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${lampBg[run.status]}`} />
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

      {/* Pipeline History Table with Lamps */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pipeline History & Status</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">Status</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead>Last Execution</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Rows Processed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockPipelines.map((p) => {
                const isRunning = p.status === 'running';
                const color = lampColor[p.status] || 'text-muted-foreground';
                return (
                  <TableRow key={p.id} className="hover:bg-accent/30">
                    {/* Status Lamp */}
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="flex items-center justify-center">
                            <Circle className={`h-4 w-4 fill-current ${color} ${isRunning ? 'animate-pulse' : ''}`} />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {p.status === 'running' ? 'Running — can be stopped' :
                           p.status === 'failed' ? 'Failed' :
                           p.status === 'deployed' ? 'Success / Deployed' :
                           p.status === 'draft' ? 'Draft' :
                           p.status === 'ready' ? 'Ready' : p.status}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.lastExecution
                        ? formatDistanceToNow(new Date(p.lastExecution.startedAt), { addSuffix: true })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.lastExecution?.duration || '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.lastExecution
                        ? `${p.lastExecution.rowsWritten.toLocaleString()} / ${p.lastExecution.rowsRead.toLocaleString()}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Stop — only available when running */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={!isRunning}
                              onClick={(e) => handleStop(p.id, e)}
                            >
                              <Square className={`h-3.5 w-3.5 ${isRunning ? 'text-destructive' : ''}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isRunning
                              ? 'Stop pipeline (available during Running phase only)'
                              : 'Stop is only available while the pipeline is running'}
                          </TooltipContent>
                        </Tooltip>

                        {/* Modify */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/pipelines/${p.id}/edit`);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Modify pipeline transformations</TooltipContent>
                        </Tooltip>

                        {/* View Details */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/pipelines/${p.id}`);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View pipeline details & transformations</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
