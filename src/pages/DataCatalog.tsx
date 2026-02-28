import { useState } from 'react';
import { Search, Database, Table as TableIcon, Layers, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockCatalogTables, mockSchemaColumns } from '@/data/mock-data';
import type { DataCatalogTable } from '@/types';

const tagColors: Record<string, string> = {
  PII: 'bg-destructive text-destructive-foreground',
  Public: 'bg-success text-success-foreground',
  Internal: 'bg-info text-info-foreground',
};

const layerColors: Record<string, string> = {
  bronze: 'bg-warning/10 text-warning border-warning/30',
  silver: 'bg-muted text-muted-foreground border-border',
  gold: 'bg-success/10 text-success border-success/30',
};

const DataCatalog = () => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DataCatalogTable | null>(null);

  const filtered = mockCatalogTables.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, DataCatalogTable[]>>((acc, t) => {
    (acc[t.database] = acc[t.database] || []).push(t);
    return acc;
  }, {});

  const formatBytes = (b: number) => {
    if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`;
    return `${(b / 1048576).toFixed(1)} MB`;
  };

  // Simulate schema for selected table
  const tableSchema = selected ? mockSchemaColumns.map(c => ({
    ...c,
    // Adjust for gold layer (aggregated)
    ...(selected.layer === 'gold' && c.name === 'amount' ? { name: 'total_amount', type: 'DECIMAL', description: 'Aggregated total amount' } : {}),
  })) : [];

  // Simulate sample data
  const sampleRow: Record<string, string> = {
    transaction_id: 'TXN-001', client_id: 'CLT-100', amount: '1500.00',
    transaction_date: '2025-01-15', client_name: 'Jean Dupont',
    email: 'jean@example.com', status: 'completed', is_verified: 'true',
  };

  return (
    <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
      {/* Left: Table tree */}
      <div className="w-64 shrink-0 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tables..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground px-1">
          Browse Delta tables created by your pipelines across Bronze, Silver, and Gold layers.
        </p>
        <div className="space-y-3">
          {Object.entries(grouped).map(([db, tables]) => (
            <div key={db}>
              <div className="flex items-center gap-2 text-sm font-semibold mb-1">
                <Database className="h-3.5 w-3.5" /> {db}
              </div>
              <div className="ml-4 space-y-0.5">
                {tables.map((t) => (
                  <button
                    key={t.id}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors flex items-center gap-2 ${selected?.id === t.id ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted text-muted-foreground'}`}
                    onClick={() => setSelected(t)}
                  >
                    <TableIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{t.name}</span>
                    <Badge variant="outline" className={`ml-auto text-[9px] px-1 py-0 ${layerColors[t.layer]}`}>{t.layer}</Badge>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Details */}
      <div className="flex-1">
        {selected ? (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold">{selected.name}</h2>
                <Badge variant="outline" className={layerColors[selected.layer]}>
                  <Layers className="h-3 w-3 mr-1" /> {selected.layer}
                </Badge>
                {selected.tags.map((tag) => (
                  <Badge key={tag} className={tagColors[tag]}>
                    <Tag className="h-3 w-3 mr-1" /> {tag}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Owner: {selected.owner} • Created: {selected.createdAt}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Row Count', value: selected.rowCount.toLocaleString() },
                { label: 'Size', value: formatBytes(selected.sizeBytes) },
                { label: 'Environment', value: selected.environment },
                { label: 'Last Modified', value: selected.lastModified },
              ].map((m) => (
                <Card key={m.label}>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="font-bold mt-0.5">{m.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Schema */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Schema — Columns</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Column</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Nullable</TableHead>
                      <TableHead>Sensitive</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableSchema.map((col) => (
                      <TableRow key={col.id}>
                        <TableCell className="font-mono text-xs font-medium">{col.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{col.type}</Badge></TableCell>
                        <TableCell className="text-sm">{col.nullable ? 'Yes' : 'No'}</TableCell>
                        <TableCell>{col.sensitive ? <Badge variant="destructive" className="text-xs">PII</Badge> : '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{col.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Data Preview */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Data Preview (1 row sample)</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {tableSchema.map((col) => (
                        <TableHead key={col.id} className="text-xs whitespace-nowrap">{col.name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      {tableSchema.map((col) => (
                        <TableCell key={col.id} className="font-mono text-xs whitespace-nowrap">
                          {sampleRow[col.name] || '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <Database className="h-8 w-8" />
            <p>Select a table from the catalog to view its schema, data preview, and metadata.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataCatalog;
