import { useState } from 'react';
import { Circle, Search, Square, Eye, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { mockRuns, mockPipelines } from '@/data/mock-data';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const lampColor: Record<string, string> = {
  success: 'text-success',
  failed: 'text-destructive',
  running: 'text-warning',
  warning: 'text-warning',
};

const statusLabel: Record<string, string> = {
  success: 'Success',
  failed: 'Failed',
  running: 'Running',
  warning: 'Warning',
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [envFilter, setEnvFilter] = useState<string>('all');

  // Enrich runs with environment from pipeline
  const enrichedRuns = mockRuns.map(r => {
    const pipeline = mockPipelines.find(p => p.id === r.pipelineId);
    return { ...r, environment: pipeline?.environment || 'development' };
  });

  const filtered = enrichedRuns.filter(r => {
    const matchSearch = r.pipelineName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchEnv = envFilter === 'all' || r.environment === envFilter;
    return matchSearch && matchStatus && matchEnv;
  });

  // Summary counts
  const running = mockRuns.filter(r => r.status === 'running').length;
  const succeeded = mockRuns.filter(r => r.status === 'success').length;
  const failed = mockRuns.filter(r => r.status === 'failed').length;
  const warnings = mockRuns.filter(r => r.status === 'warning').length;

  return (
    <div className="space-y-4">
      {/* Quick summary badges */}
      <div className="flex gap-3 flex-wrap">
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
          <Circle className="h-2.5 w-2.5 fill-current text-warning" /> {running} Running
        </Badge>
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
          <Circle className="h-2.5 w-2.5 fill-current text-success" /> {succeeded} Succeeded
        </Badge>
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
          <Circle className="h-2.5 w-2.5 fill-current text-destructive" /> {failed} Failed
        </Badge>
        {warnings > 0 && (
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
            <Circle className="h-2.5 w-2.5 fill-current text-warning" /> {warnings} Warnings
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search pipeline..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
          </SelectContent>
        </Select>
        <Select value={envFilter} onValueChange={setEnvFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Environment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Envs</SelectItem>
            <SelectItem value="development">Development</SelectItem>
            <SelectItem value="production">Production</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Execution History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pipeline History & Status</CardTitle>
          <p className="text-xs text-muted-foreground">Monitor all pipeline executions — click View for details</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">Status</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Rows Read</TableHead>
                <TableHead>Rows Written</TableHead>
                <TableHead>Quarantined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No executions match your filters.
                  </TableCell>
                </TableRow>
              ) : filtered.map((r) => {
                const color = lampColor[r.status] || 'text-muted-foreground';
                const isRunning = r.status === 'running';
                return (
                  <TableRow key={r.id} className="hover:bg-accent/30">
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger>
                          <Circle className={`h-3.5 w-3.5 fill-current ${color} ${isRunning ? 'animate-pulse' : ''}`} />
                        </TooltipTrigger>
                        <TooltipContent>{statusLabel[r.status] || r.status}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="font-medium">{r.pipelineName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{r.environment}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(r.startedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-sm">{r.duration}</TableCell>
                    <TableCell className="text-sm">{r.rowsRead.toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{r.rowsWritten.toLocaleString()}</TableCell>
                    <TableCell className="text-sm">
                      {r.rowsQuarantined > 0 ? (
                        <span className="text-destructive font-medium">{r.rowsQuarantined.toLocaleString()}</span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isRunning && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); toast.info(`Pipeline "${r.pipelineName}" stopped`); }}>
                                <Square className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Stop pipeline</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/pipelines/${r.pipelineId}`)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View details</TooltipContent>
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
    </div>
  );
};

export default Dashboard;
