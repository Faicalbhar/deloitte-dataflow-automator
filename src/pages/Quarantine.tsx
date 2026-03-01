import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockQuarantine, mockPipelines } from '@/data/mock-data';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, Eye, AlertTriangle, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ruleChartData = [
  { rule: 'expect_not_null(amount)', count: 5200 },
  { rule: 'expect_range(amount)', count: 3800 },
  { rule: 'expect_regex(email)', count: 1200 },
  { rule: 'expect_unique(id)', count: 800 },
  { rule: 'expect_values_in_set(status)', count: 400 },
];

// Mock _quarantine table rows (DLT format)
const mockQuarantineRows = [
  { id: 1, _quarantine_timestamp: '2025-02-26T06:12:01Z', _pipeline_run_id: 'r1', _violated_rule: 'expect_not_null(amount)', _rejected_reason: 'Column amount is NULL — violates NOT NULL constraint', transaction_id: 'TXN-ERR-001', client_id: 'CLT-100', amount: null, status: 'completed' },
  { id: 2, _quarantine_timestamp: '2025-02-26T06:12:02Z', _pipeline_run_id: 'r1', _violated_rule: 'expect_range(amount, 0, 1000000)', _rejected_reason: 'amount = -500 out of range [0, 1000000]', transaction_id: 'TXN-ERR-002', client_id: 'CLT-200', amount: -500, status: 'pending' },
  { id: 3, _quarantine_timestamp: '2025-02-24T06:15:03Z', _pipeline_run_id: 'r7', _violated_rule: 'expect_values_in_set(status)', _rejected_reason: '"invalid" not in {completed, pending, cancelled}', transaction_id: 'TXN-ERR-003', client_id: 'CLT-300', amount: 150, status: 'invalid' },
  { id: 4, _quarantine_timestamp: '2025-02-24T06:15:04Z', _pipeline_run_id: 'r7', _violated_rule: 'expect_not_null(client_id)', _rejected_reason: 'client_id is empty string — treated as NULL', transaction_id: 'TXN-ERR-004', client_id: '', amount: 200, status: 'completed' },
  { id: 5, _quarantine_timestamp: '2025-02-26T06:12:05Z', _pipeline_run_id: 'r1', _violated_rule: 'expect_range(amount, 0, 1000000)', _rejected_reason: 'amount = 99999999 exceeds max 1000000', transaction_id: 'TXN-ERR-005', client_id: 'CLT-100', amount: 99999999, status: 'completed' },
];

const Quarantine = () => {
  const total = mockQuarantine.reduce((s, q) => s + q.rowCount, 0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedQ, setSelectedQ] = useState<string | null>(null);
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [ruleFilter, setRuleFilter] = useState('');

  const filteredQuarantine = mockQuarantine.filter(q => {
    const matchPipeline = pipelineFilter === 'all' || q.pipelineId === pipelineFilter;
    return matchPipeline;
  });

  const filteredRows = mockQuarantineRows.filter(r => {
    const matchRule = !ruleFilter || r._violated_rule.toLowerCase().includes(ruleFilter.toLowerCase());
    return matchRule;
  });

  const uniquePipelines = [...new Set(mockQuarantine.map(q => q.pipelineId))].map(id => {
    const p = mockPipelines.find(pp => pp.id === id);
    return { id, name: p?.name || id };
  });

  const handleExportCSV = () => {
    const headers = ['_quarantine_timestamp', '_pipeline_run_id', '_violated_rule', '_rejected_reason', 'transaction_id', 'client_id', 'amount', 'status'];
    const csv = [headers.join(','), ...mockQuarantineRows.map(r => headers.map(h => JSON.stringify((r as any)[h] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quarantine_export.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Quarantine data exported to CSV');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            {total.toLocaleString()} rows rejected by DLT quality expectations across {mockQuarantine.length} quarantine tables.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Rows that failed Databricks Delta Live Tables constraints/expectations are stored in <code className="bg-muted px-1 rounded">_quarantine</code> tables with rejection metadata.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={pipelineFilter} onValueChange={setPipelineFilter}>
          <SelectTrigger className="w-56">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Filter by pipeline" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pipelines</SelectItem>
            {uniquePipelines.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative w-full sm:w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filter by rule..." value={ruleFilter} onChange={(e) => setRuleFilter(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Most Violated DLT Expectations</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Databricks DLT constraints that reject the most rows — helps prioritize data fixes at source.</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ruleChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="rule" tick={{ fontSize: 10 }} width={170} />
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
                  <TableHead>Top Expectation</TableHead>
                  <TableHead className="text-right">Inspect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuarantine.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.pipelineName}</TableCell>
                    <TableCell className="font-mono text-xs">{q.tableName}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{q.rowCount.toLocaleString()}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{q.mostViolatedRule}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedQ(q.id); setDetailOpen(true); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
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
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>_quarantine Table — Row Details</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Each row below was rejected by a DLT expectation. Metadata columns (<code className="bg-muted px-1 rounded">_violated_rule</code>, <code className="bg-muted px-1 rounded">_rejected_reason</code>) come from Databricks.
            To fix: correct the source data and re-run the pipeline manually.
          </p>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">_quarantine_timestamp</TableHead>
                <TableHead className="text-xs">_violated_rule</TableHead>
                <TableHead className="text-xs">_rejected_reason</TableHead>
                <TableHead className="text-xs">transaction_id</TableHead>
                <TableHead className="text-xs">client_id</TableHead>
                <TableHead className="text-xs">amount</TableHead>
                <TableHead className="text-xs">status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-[10px] whitespace-nowrap">{new Date(row._quarantine_timestamp).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] font-mono">{row._violated_rule}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-56">{row._rejected_reason}</TableCell>
                  <TableCell className="font-mono text-xs">{row.transaction_id}</TableCell>
                  <TableCell className="font-mono text-xs">{row.client_id || <span className="text-destructive italic">empty</span>}</TableCell>
                  <TableCell className={`font-mono text-xs ${row.amount === null || (row.amount as number) < 0 || (row.amount as number) > 1000000 ? 'text-destructive font-bold' : ''}`}>
                    {row.amount === null ? <span className="italic">NULL</span> : (row.amount as number).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">{row.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Quarantine;
