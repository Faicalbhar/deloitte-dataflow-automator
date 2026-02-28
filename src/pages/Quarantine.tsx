import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockQuarantine } from '@/data/mock-data';
import { formatDistanceToNow } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, RefreshCw, Eye, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ruleChartData = [
  { rule: 'not_null(amount)', count: 5200 },
  { rule: 'range(amount)', count: 3800 },
  { rule: 'regex(email)', count: 1200 },
  { rule: 'unique(id)', count: 800 },
  { rule: 'values_in_set(status)', count: 400 },
];

// Mock rejected rows for detail view
const mockRejectedRows = [
  { id: 1, transaction_id: 'TXN-ERR-001', client_id: 'CLT-100', amount: null, status: 'completed', rule_violated: 'not_null(amount)', reason: 'amount is NULL' },
  { id: 2, transaction_id: 'TXN-ERR-002', client_id: 'CLT-200', amount: -500, status: 'pending', rule_violated: 'range(amount, 0, 1000000)', reason: 'amount = -500 is out of range [0, 1000000]' },
  { id: 3, transaction_id: 'TXN-ERR-003', client_id: 'CLT-300', amount: 150, status: 'invalid', rule_violated: 'values_in_set(status)', reason: '"invalid" not in {completed, pending, cancelled}' },
  { id: 4, transaction_id: 'TXN-ERR-004', client_id: '', amount: 200, status: 'completed', rule_violated: 'not_null(client_id)', reason: 'client_id is empty' },
  { id: 5, transaction_id: 'TXN-ERR-005', client_id: 'CLT-100', amount: 99999999, status: 'completed', rule_violated: 'range(amount, 0, 1000000)', reason: 'amount = 99999999 exceeds max 1000000' },
];

const Quarantine = () => {
  const total = mockQuarantine.reduce((s, q) => s + q.rowCount, 0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedQ, setSelectedQ] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            {total.toLocaleString()} rows rejected by quality checks across {mockQuarantine.length} tables.
            These rows failed data contract rules and were isolated for review.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => toast.success('Quarantine report exported')}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Most Violated Rules</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Shows which quality rules reject the most rows — helps prioritize data fixes at source.</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ruleChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="rule" tick={{ fontSize: 10 }} width={130} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Summary Table */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Quarantine Tables</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Pipeline</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Rejected Rows</TableHead>
                  <TableHead>Top Rule</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockQuarantine.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.pipelineName}</TableCell>
                    <TableCell className="font-mono text-xs">{q.tableName}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{q.rowCount.toLocaleString()}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{q.mostViolatedRule}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedQ(q.id); setDetailOpen(true); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info(`Reprocessing ${q.tableName}...`)}>
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Rejected Rows Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rejected Rows — Detail View</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Each row below was rejected because it violated a quality check defined in the pipeline's data contract.
            You can fix the source data and reprocess, or manually approve rows.
          </p>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>#</TableHead>
                <TableHead>transaction_id</TableHead>
                <TableHead>client_id</TableHead>
                <TableHead>amount</TableHead>
                <TableHead>status</TableHead>
                <TableHead>Rule Violated</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockRejectedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">{row.id}</TableCell>
                  <TableCell className="font-mono text-xs">{row.transaction_id}</TableCell>
                  <TableCell className="font-mono text-xs">{row.client_id || <span className="text-destructive italic">empty</span>}</TableCell>
                  <TableCell className={`font-mono text-xs ${row.amount === null || row.amount < 0 || row.amount > 1000000 ? 'text-destructive font-bold' : ''}`}>
                    {row.amount === null ? <span className="italic">NULL</span> : row.amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">{row.status}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs font-mono">{row.rule_violated}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-48">{row.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="gap-2" onClick={() => toast.success('Rejected rows exported to CSV')}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button className="gap-2" onClick={() => { toast.info('Reprocessing rows...'); setDetailOpen(false); }}>
              <RefreshCw className="h-4 w-4" /> Reprocess All
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Quarantine;
