import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockQuarantine } from '@/data/mock-data';
import { formatDistanceToNow } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';

const ruleChartData = [
  { rule: 'not_null(amount)', count: 5200 },
  { rule: 'range(amount)', count: 3800 },
  { rule: 'regex(email)', count: 1200 },
  { rule: 'unique(id)', count: 800 },
  { rule: 'values_in_set(status)', count: 400 },
];

const Quarantine = () => {
  const total = mockQuarantine.reduce((s, q) => s + q.rowCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} total quarantined rows across {mockQuarantine.length} tables</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Generate Report
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top Violated Rules</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ruleChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="rule" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(354, 70%, 54%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Quarantine Summary</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Pipeline</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Last Rejection</TableHead>
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
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(q.lastRejectionDate), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Quarantine;
