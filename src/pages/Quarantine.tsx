import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockQuarantine, mockPipelines } from '@/data/mock-data';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Download, Eye, AlertTriangle, Search, Filter, Calendar, FileWarning, ArrowUpDown, ShieldAlert, FileX } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ruleChartData = [
  { rule: 'NOT NULL (amount)', count: 5200, color: 'hsl(var(--destructive))' },
  { rule: 'Range (amount)', count: 3800, color: 'hsl(var(--warning))' },
  { rule: 'Regex (email)', count: 1200, color: 'hsl(var(--warning))' },
  { rule: 'Unique (id)', count: 800, color: 'hsl(var(--info))' },
  { rule: 'Values in set (status)', count: 400, color: 'hsl(var(--info))' },
];

const rescuedRowsData = [
  { id: 1, timestamp: '2025-02-26T06:12:01Z', pipeline: 'Client Transactions ETL', runId: 'run-48291', sourceFile: 'transactions_2025_02.csv', violatedRule: 'expect_not_null(amount)', reason: 'Column "amount" is NULL — violates NOT NULL constraint', rescuedData: { transaction_id: 'TXN-ERR-001', client_id: 'CLT-100', amount: null, status: 'completed' } },
  { id: 2, timestamp: '2025-02-26T06:12:02Z', pipeline: 'Client Transactions ETL', runId: 'run-48291', sourceFile: 'transactions_2025_02.csv', violatedRule: 'expect_range(amount, 0, 1000000)', reason: 'amount = -500 is out of allowed range [0, 1,000,000]', rescuedData: { transaction_id: 'TXN-ERR-002', client_id: 'CLT-200', amount: -500, status: 'pending' } },
  { id: 3, timestamp: '2025-02-24T06:15:03Z', pipeline: 'Client Transactions ETL', runId: 'run-47830', sourceFile: 'transactions_2024_12.csv', violatedRule: 'expect_values_in_set(status)', reason: 'Value "unknown" not in allowed set {completed, pending, cancelled}', rescuedData: { transaction_id: 'TXN-ERR-003', client_id: 'CLT-300', amount: 150, status: 'unknown' } },
  { id: 4, timestamp: '2025-02-24T06:15:04Z', pipeline: 'Client Transactions ETL', runId: 'run-47830', sourceFile: 'transactions_2024_12.csv', violatedRule: 'expect_not_null(client_id)', reason: 'client_id is empty string — treated as NULL by constraint', rescuedData: { transaction_id: 'TXN-ERR-004', client_id: '', amount: 200, status: 'completed' } },
  { id: 5, timestamp: '2025-02-26T06:12:05Z', pipeline: 'Client Transactions ETL', runId: 'run-48291', sourceFile: 'transactions_2025_02.csv', violatedRule: 'expect_range(amount, 0, 1000000)', reason: 'amount = 99,999,999 exceeds maximum allowed value of 1,000,000', rescuedData: { transaction_id: 'TXN-ERR-005', client_id: 'CLT-100', amount: 99999999, status: 'completed' } },
  { id: 6, timestamp: '2025-02-25T09:08:01Z', pipeline: 'Customer Master Data', runId: 'run-48100', sourceFile: 'customers_2025.csv', violatedRule: 'expect_regex(email)', reason: 'Email "not-an-email" does not match expected pattern', rescuedData: { transaction_id: 'CUST-ERR-001', client_id: 'CLT-500', amount: 0, status: 'active' } },
  { id: 7, timestamp: '2025-02-25T09:08:02Z', pipeline: 'Customer Master Data', runId: 'run-48100', sourceFile: 'customers_2025.csv', violatedRule: 'expect_unique(customer_id)', reason: 'Duplicate customer_id "CLT-500" — violates uniqueness constraint', rescuedData: { transaction_id: 'CUST-ERR-002', client_id: 'CLT-500', amount: 0, status: 'active' } },
];

const Quarantine = () => {
  const total = mockQuarantine.reduce((s, q) => s + q.rowCount, 0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedQ, setSelectedQ] = useState<string | null>(null);
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [ruleFilter, setRuleFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  const filteredQuarantine = mockQuarantine.filter(q => pipelineFilter === 'all' || q.pipelineId === pipelineFilter);
  const selectedQuarantine = mockQuarantine.find(q => q.id === selectedQ);

  const filteredRows = rescuedRowsData.filter(r => {
    const matchRule = !ruleFilter || r.violatedRule.toLowerCase().includes(ruleFilter.toLowerCase());
    const matchPipeline = pipelineFilter === 'all' || r.pipeline === mockPipelines.find(p => p.id === pipelineFilter)?.name;
    const matchDate = dateFilter === 'all' ||
      (dateFilter === '24h' && new Date(r.timestamp) > new Date(Date.now() - 86400000)) ||
      (dateFilter === '7d' && new Date(r.timestamp) > new Date(Date.now() - 7 * 86400000));
    return matchRule && matchPipeline && matchDate;
  });

  const uniquePipelines = [...new Set(mockQuarantine.map(q => q.pipelineId))].map(id => {
    const p = mockPipelines.find(pp => pp.id === id);
    return { id, name: p?.name || id };
  });

  const handleExportCSV = () => {
    const headers = ['timestamp', 'pipeline', 'run_id', 'source_file', 'violated_rule', 'reason', 'rescued_data'];
    const csv = [headers.join(','), ...filteredRows.map(r => [
      r.timestamp, r.pipeline, r.runId, r.sourceFile, r.violatedRule, `"${r.reason}"`, JSON.stringify(r.rescuedData)
    ].join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quarantine_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredRows.length} rows to CSV`);
  };

  const isErrorValue = (val: any) => val === null || val === '' || (typeof val === 'number' && (val < 0 || val > 1000000));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold">Quarantine — Rescued Data</h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Rows that failed DLT quality expectations (<code className="bg-muted px-1.5 py-0.5 rounded text-xs">@dlt.expect_or_drop</code>) are rescued here with the violated rule and reason.
            Like Databricks' <code className="bg-muted px-1.5 py-0.5 rounded text-xs">_rescued_data</code> column — fix the source data and re-run the pipeline.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1 text-sm py-1 px-3">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            {total.toLocaleString()} total rescued
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
              <Input placeholder="Search by rule..." value={ruleFilter} onChange={(e) => setRuleFilter(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rescued">Rescued Rows ({filteredRows.length})</TabsTrigger>
          <TabsTrigger value="tables">Quarantine Tables</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-warning/20">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-warning">{total.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Rescued Rows</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-foreground">{filteredQuarantine.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Quarantine Tables</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-destructive">5</p>
                <p className="text-xs text-muted-foreground mt-1">Unique Violated Rules</p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                Most Violated Expectations
              </CardTitle>
              <p className="text-xs text-muted-foreground">DLT constraints that rescue the most rows — prioritize fixing these at source.</p>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ruleChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="rule" tick={{ fontSize: 11 }} width={170} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: number) => [value.toLocaleString() + ' rows', 'Rescued']}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {ruleChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rescued Rows */}
        <TabsContent value="rescued">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs w-[130px]">Timestamp</TableHead>
                      <TableHead className="text-xs">Pipeline</TableHead>
                      <TableHead className="text-xs">Source File</TableHead>
                      <TableHead className="text-xs">Violated Rule</TableHead>
                      <TableHead className="text-xs max-w-[250px]">Reason</TableHead>
                      <TableHead className="text-xs">Rescued Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                          {new Date(row.timestamp).toLocaleDateString()} {new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{row.pipeline}</TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">{row.sourceFile}</TableCell>
                        <TableCell>
                          <code className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">{row.violatedRule}</code>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate" title={row.reason}>{row.reason}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(row.rescuedData).map(([key, val]) => (
                              <Badge key={key} variant="outline" className={`text-[9px] font-mono ${isErrorValue(val) ? 'border-destructive/40 text-destructive' : ''}`}>
                                {key}: {val === null ? 'NULL' : String(val)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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

        {/* Quarantine Tables */}
        <TabsContent value="tables">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Pipeline</TableHead>
                    <TableHead className="text-xs">Quarantine Table</TableHead>
                    <TableHead className="text-xs text-center">Rescued Rows</TableHead>
                    <TableHead className="text-xs">Top Violated Rule</TableHead>
                    <TableHead className="text-xs">Last Rejection</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
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
                      <TableCell className="text-xs text-muted-foreground">{new Date(q.lastRejectionDate).toLocaleDateString()}</TableCell>
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
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-warning" />
              {selectedQuarantine?.tableName || '_quarantine'} — Rescued Row Details
            </DialogTitle>
          </DialogHeader>
          <div className="bg-muted/50 border rounded-md p-4 mb-4 space-y-2">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <p><span className="text-muted-foreground">Pipeline:</span> <strong>{selectedQuarantine?.pipelineName}</strong></p>
              <p><span className="text-muted-foreground">Top violated rule:</span> <code className="text-xs bg-muted px-1 rounded">{selectedQuarantine?.mostViolatedRule}</code></p>
              <p><span className="text-muted-foreground">Rescued rows:</span> <strong className="text-destructive">{selectedQuarantine?.rowCount.toLocaleString()}</strong></p>
              <p><span className="text-muted-foreground">Last rejection:</span> {selectedQuarantine?.lastRejectionDate ? new Date(selectedQuarantine.lastRejectionDate).toLocaleDateString() : '—'}</p>
            </div>
            <p className="text-xs text-muted-foreground pt-2 border-t">
              <strong>How to fix:</strong> Correct the source data that violates the constraint, then re-run the pipeline. Rescued rows will be reprocessed.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Timestamp</TableHead>
                <TableHead className="text-xs">Source File</TableHead>
                <TableHead className="text-xs">Violated Rule</TableHead>
                <TableHead className="text-xs">Reason</TableHead>
                <TableHead className="text-xs">Rescued Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rescuedRowsData.slice(0, 5).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-[11px] whitespace-nowrap">{new Date(row.timestamp).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">{row.sourceFile}</TableCell>
                  <TableCell>
                    <code className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">{row.violatedRule}</code>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px]">{row.reason}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(row.rescuedData).map(([key, val]) => (
                        <Badge key={key} variant="outline" className={`text-[9px] font-mono ${isErrorValue(val) ? 'border-destructive/40 text-destructive' : ''}`}>
                          {key}: {val === null ? 'NULL' : String(val)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
