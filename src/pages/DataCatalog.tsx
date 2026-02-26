import { useState } from 'react';
import { Search, Database, Table as TableIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockCatalogTables } from '@/data/mock-data';
import type { DataCatalogTable } from '@/types';

const tagColors: Record<string, string> = {
  PII: 'bg-destructive text-destructive-foreground',
  Public: 'bg-success text-success-foreground',
  Internal: 'bg-info text-info-foreground',
};

const layerColors: Record<string, string> = {
  bronze: 'bg-warning/10 text-warning',
  silver: 'bg-muted text-muted-foreground',
  gold: 'bg-success/10 text-success',
  quarantine: 'bg-destructive/10 text-destructive',
};

const DataCatalog = () => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DataCatalogTable | null>(null);

  const filtered = mockCatalogTables.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  // Group by database
  const grouped = filtered.reduce<Record<string, DataCatalogTable[]>>((acc, t) => {
    (acc[t.database] = acc[t.database] || []).push(t);
    return acc;
  }, {});

  const formatBytes = (b: number) => {
    if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`;
    return `${(b / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <div className="w-64 shrink-0 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tables..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="space-y-3">
          {Object.entries(grouped).map(([db, tables]) => (
            <div key={db}>
              <div className="flex items-center gap-2 text-sm font-semibold mb-1">
                <Database className="h-3.5 w-3.5" />
                {db}
              </div>
              <div className="ml-4 space-y-0.5">
                {tables.map((t) => (
                  <button
                    key={t.id}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors flex items-center gap-2 ${selected?.id === t.id ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted text-muted-foreground'}`}
                    onClick={() => setSelected(t)}
                  >
                    <TableIcon className="h-3 w-3 shrink-0" />
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1">
        {selected ? (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold">{selected.name}</h2>
                <Badge className={layerColors[selected.layer]}>{selected.layer}</Badge>
                {selected.tags.map((tag) => (
                  <Badge key={tag} className={tagColors[tag]}>{tag}</Badge>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Rows', value: selected.rowCount.toLocaleString() },
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

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Schema</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Schema details would display here with column types and descriptions.</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a table from the catalog to view its details.
          </div>
        )}
      </div>
    </div>
  );
};

export default DataCatalog;
