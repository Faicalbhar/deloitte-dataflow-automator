import { Circle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { mockRuns } from '@/data/mock-data';
import { formatDistanceToNow } from 'date-fns';

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

  // Summary counts
  const running = mockRuns.filter(r => r.status === 'running').length;
  const succeeded = mockRuns.filter(r => r.status === 'success').length;
  const failed = mockRuns.filter(r => r.status === 'failed').length;
  const warnings = mockRuns.filter(r => r.status === 'warning').length;

  return (
    <div className="space-y-6">
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

      {/* Execution History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Executions</CardTitle>
          <p className="text-xs text-muted-foreground">Monitor all pipeline runs — click a row for details</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">Status</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Rows Read</TableHead>
                <TableHead>Rows Written</TableHead>
                <TableHead>Quarantined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockRuns.map((r) => {
                const color = lampColor[r.status] || 'text-muted-foreground';
                const isRunning = r.status === 'running';
                return (
                  <TableRow
                    key={r.id}
                    className="hover:bg-accent/30 cursor-pointer"
                    onClick={() => navigate(`/pipelines/${r.pipelineId}`)}
                  >
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger>
                          <Circle className={`h-3.5 w-3.5 fill-current ${color} ${isRunning ? 'animate-pulse' : ''}`} />
                        </TooltipTrigger>
                        <TooltipContent>{statusLabel[r.status] || r.status}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="font-medium">{r.pipelineName}</TableCell>
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
