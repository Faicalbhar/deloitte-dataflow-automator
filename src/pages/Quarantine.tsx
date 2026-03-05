import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockQuarantine, mockPipelines } from '@/data/mock-data';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Download, Eye, AlertTriangle, Search, Filter, Calendar, FileWarning, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ruleChartData = [
  { rule: 'expect_not_null(amount)', count: 5200, color: 'hsl(var(--destructive))' },
  { rule: 'expect_range(amount)', count: 3800, color: 'hsl(var(--warning))' },
  { rule: 'expect_regex(email)', count: 1200, color: 'hsl(var(--warning))' },
  { rule: 'expect_unique(id)', count: 800, color: 'hsl(var(--info))' },
  { rule: 'expect_values_in_set(status)', count: 400, color: 'hsl(var(--info))' },
];

const mockQuarantineRows = [
  { id: 1, _quarantine_timestamp: '2025-02-26T06:12:01Z', _pipeline_run_id: 'run-48291', _pipeline_name: 'Client Transactions ETL', _violated_rule: 'expect_not_null(amount)', _rejected_reason: 'Column amount is NULL — violates NOT NULL constraint', transaction_id: 'TXN-ERR-001', client_id: 'CLT-100', amount: null, status: 'completed' },
  { id: 2, _quarantine_timestamp: '2025-02-26T06:12:02Z', _pipeline_run_id: 'run-48291', _pipeline_name: 'Client Transactions ETL', _violated_rule: 'expect_range(amount, 0, 1000000)', _rejected_reason: 'amount = -500 is out of allowed range [0, 1000000]', transaction_id: 'TXN-ERR-002', client_id: 'CLT-200', amount: -500, status: 'pending' },
  { id: 3, _quarantine_timestamp: '2025-02-24T06:15:03Z', _pipeline_run_id: 'run-47830', _pipeline_name: 'Client Transactions ETL', _violated_rule: 'expect_values_in_set(status)', _rejected_reason: 'Value "invalid" not in allowed set {completed, pending, cancelled}', transaction_id: 'TXN-ERR-003', client_id: 'CLT-300', amount: 150, status: 'invalid' },
  { id: 4, _quarantine_timestamp: '2025-02-24T06:15:04Z', _pipeline_run_id: 'run-47830', _pipeline_name: 'Client Transactions ETL', _violated_rule: 'expect_not_null(client_id)', _rejected_reason: 'client_id is empty string — treated as NULL by constraint', transaction_id: 'TXN-ERR-004', client_id: '', amount: 200, status: 'completed' },
  { id: 5, _quarantine_timestamp: '2025-02-26T06:12:05Z', _pipeline_run_id: 'run-48291', _pipeline_name: 'Client Transactions ETL', _violated_rule: 'expect_range(amount, 0, 1000000)', _rejected_reason: 'amount = 99,999,999 exceeds maximum allowed value of 1,000,000', transaction_id: 'TXN-ERR-005', client_id: 'CLT-100', amount: 99999999, status: 'completed' },
  { id: 6, _quarantine_timestamp: '2025-02-25T09:08:01Z', _pipeline_run_id: 'run-48100', _pipeline_name: 'Customer Master Data', _violated_rule: 'expect_regex(email)', _rejected_reason: 'Email "not-an-email" does not match pattern ^[\\w.-]+@[\\w.-]+\\.\\w+$', transaction_id: 'CUST-ERR-001', client_id: 'CLT-500', amount: 0, status: 'active' },
  { id: 7, _quarantine_timestamp: '2025-02-25T09:08:02Z', _pipeline_run_id: 'run-48100', _pipeline_name: 'Customer Master Data', _violated_rule: 'expect_unique(id)', _rejected_reason: 'Duplicate customer_id "CLT-500" found — violates uniqueness constraint', transaction_id: 'CUST-ERR-002', client_id: 'CLT-500', amount: 0, status: 'active' },
];

const Quarantine = () => {
  const total = mockQuarantine.reduce((s, q) => s + q.rowCount, 0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedQ, setSelectedQ] = useState<string | null>(null);
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [ruleFilter, setRuleFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  const filteredQuarantine = mockQuarantine.filter(q => {
    return pipelineFilter === 'all' || q.pipelineId === pipelineFilter;
  });

  const selectedQuarantine = mockQuarantine.find(q => q.id === selectedQ);

  const filteredRows = mockQuarantineRows.filter(r => {
    const matchRule = !ruleFilter || r._violated_rule.toLowerCase().includes(ruleFilter.toLowerCase());
    const matchPipeline = pipelineFilter === 'all' || r._pipeline_name === mockPipelines.find(p => p.id === pipelineFilter)?.name;
    const matchDate = dateFilter === 'all' ||
      (dateFilter === '24h' && new Date(r._quarantine_timestamp) > new Date(Date.now() - 86400000)) ||
      (dateFilter === '7d' && new Date(r._quarantine_timestamp) > new Date(Date.now() - 7 * 86400000));
    return matchRule && (pipelineFilter === 'all' || matchPipeline) && matchDate;
  });

  const uniquePipelines = [...new Set(mockQuarantine.map(q => q.pipelineId))].map(id => {
    const p = mockPipelines.find(pp => pp.id === id);
    return { id, name: p?.name || id };
  });

  const handleExportCSV = () => {
    const headers = ['_quarantine_timestamp', '_pipeline_run_id', '_pipeline_name', '_violated_rule', '_rejected_reason', 'transaction_id', 'client_id', 'amount', 'status'];
    const csv = [headers.join(','), ...filteredRows.map(r => headers.map(h => JSON.stringify((r as any)[h] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quarantine_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredRows.length} rows to CSV`);
  };

  const errorValue = (val: any, isAmount: boolean) => {
    if (val === null) return true;
    if (isAmount && (typeof val === 'number') && (val < 0 || val > 1000000)) return true;
    if (typeof val === 'string' && val === '') return true;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold">Quarantine — Rejected Rows</h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Rows that failed DLT quality expectations are stored in <code className="bg-muted px-1.5 py-0.5 rounded text-xs">_quarantine</code> tables.
            Fix the source data and re-run the pipeline manually.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1 text-sm py-1 px-3">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            {total.toLocaleString()} total rejected
          </Badge>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={pipelineFilter} onValueChange={setPipelineFilter}>
              <SelectTrigger className="w-56 h-9">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Pipeline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pipelines</SelectItem>
                {uniquePipelines.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-40 h-9">
                <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by rule name..." value={ruleFilter} onChange={(e) => setRuleFilter(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rows">All Rejected Rows ({filteredRows.length})</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  Most Violated Expectations
                </CardTitle>
                <p className="text-xs text-muted-foreground">DLT constraints that reject the most rows — prioritize fixing these at source.</p>
              </CardHeader>
              <CardContent>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ruleChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="rule" tick={{ fontSize: 10 }} width={180} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number) => [value.toLocaleString() + ' rows', 'Rejected']}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {ruleChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Summary Table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Quarantine Tables</CardTitle>
                <p className="text-xs text-muted-foreground">Each pipeline with quality checks creates a _quarantine table for rejected rows.</p>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Pipeline</TableHead>
                      <TableHead className="text-xs">Table</TableHead>
                      <TableHead className="text-xs text-center">Rejected</TableHead>
                      <TableHead className="text-xs">Top Rule</TableHead>
                      <TableHead className="text-xs text-right">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuarantine.map((q) => (
                      <TableRow key={q.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium text-sm">{q.pipelineName}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{q.tableName}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="destructive" className="text-xs">{q.rowCount.toLocaleString()}</Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{q.mostViolatedRule}</code>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setSelectedQ(q.id); setDetailOpen(true); }}>
                            <Eye className="h-3 w-3" /> Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* All Rows Tab */}
        <TabsContent value="rows">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs w-[140px]">Timestamp</TableHead>
                      <TableHead className="text-xs">Pipeline</TableHead>
                      <TableHead className="text-xs">Run ID</TableHead>
                      <TableHead className="text-xs">Violated Rule</TableHead>
                      <TableHead className="text-xs max-w-[250px]">Reason</TableHead>
                      <TableHead className="text-xs">Record ID</TableHead>
                      <TableHead className="text-xs">Amount</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                          {new Date(row._quarantine_timestamp).toLocaleDateString()} {new Date(row._quarantine_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{row._pipeline_name}</TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">{row._pipeline_run_id}</TableCell>
                        <TableCell>
                          <code className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">{row._violated_rule}</code>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate" title={row._rejected_reason}>{row._rejected_reason}</TableCell>
                        <TableCell className="font-mono text-xs">{row.transaction_id}</TableCell>
                        <TableCell className={`font-mono text-xs ${errorValue(row.amount, true) ? 'text-destructive font-semibold' : ''}`}>
                          {row.amount === null ? <span className="italic text-destructive">NULL</span> : (row.amount as number).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.status === 'invalid' ? 'destructive' : 'outline'} className="text-[10px]">{row.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No rows match the current filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-warning" />
              {selectedQuarantine?.tableName || '_quarantine'} — Row Details
            </DialogTitle>
          </DialogHeader>
          <div className="bg-muted/50 border rounded-md p-3 mb-4 text-sm space-y-1">
            <p><span className="text-muted-foreground">Pipeline:</span> <strong>{selectedQuarantine?.pipelineName}</strong></p>
            <p><span className="text-muted-foreground">Rejected rows:</span> <strong className="text-destructive">{selectedQuarantine?.rowCount.toLocaleString()}</strong></p>
            <p><span className="text-muted-foreground">Top violated rule:</span> <code className="text-xs bg-muted px-1 rounded">{selectedQuarantine?.mostViolatedRule}</code></p>
            <p className="text-xs text-muted-foreground pt-1">To fix: correct the source data and re-run the pipeline. Reprocessing is manual.</p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Timestamp</TableHead>
                  <TableHead className="text-xs">Violated Rule</TableHead>
                  <TableHead className="text-xs">Reason</TableHead>
                  <TableHead className="text-xs">Record</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockQuarantineRows.slice(0, 5).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-[11px] whitespace-nowrap">{new Date(row._quarantine_timestamp).toLocaleString()}</TableCell>
                    <TableCell>
                      <code className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">{row._violated_rule}</code>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px]">{row._rejected_reason}</TableCell>
                    <TableCell className="font-mono text-xs">{row.transaction_id}</TableCell>
                    <TableCell className={`font-mono text-xs ${errorValue(row.amount, true) ? 'text-destructive font-semibold' : ''}`}>
                      {row.amount === null ? <span className="italic text-destructive">NULL</span> : (row.amount as number).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Quarantine;
