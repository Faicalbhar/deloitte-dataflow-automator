import { useState } from 'react';
import { Upload, FileSpreadsheet, Check, X, HelpCircle, ArrowLeft, ArrowRight, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate } from 'react-router-dom';
import { mockSchemaColumns } from '@/data/mock-data';
import type { SchemaColumn, ColumnType, QualityRule, QualityRuleType, OnFailureAction } from '@/types';
import { toast } from 'sonner';

const STEPS = ['Contract Upload', 'Schema Validation', 'Quality Configuration', 'Review & Deploy'];

const typeColors: Record<ColumnType, string> = {
  STRING: 'bg-info text-info-foreground',
  INTEGER: 'bg-success text-success-foreground',
  DECIMAL: 'bg-warning text-warning-foreground',
  DATE: 'bg-accent text-accent-foreground',
  BOOLEAN: 'bg-muted text-muted-foreground',
  TIMESTAMP: 'bg-accent text-accent-foreground',
};

const ruleCards: { type: QualityRuleType; label: string; icon: string; color: string }[] = [
  { type: 'not_null', label: 'Expect Not Null', icon: '!', color: 'border-destructive/50 bg-destructive/5' },
  { type: 'unique', label: 'Expect Unique', icon: '⊕', color: 'border-info/50 bg-info/5' },
  { type: 'range', label: 'Expect Range', icon: '↔', color: 'border-success/50 bg-success/5' },
  { type: 'regex', label: 'Expect Regex', icon: '.*', color: 'border-warning/50 bg-warning/5' },
  { type: 'values_in_set', label: 'Values In Set', icon: '≡', color: 'border-accent/50 bg-accent/5' },
  { type: 'referential_integrity', label: 'Ref. Integrity', icon: '⇔', color: 'border-primary/50 bg-primary/5' },
];

const CreatePipeline = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [fileValid, setFileValid] = useState(false);
  const [fileMask, setFileMask] = useState('');
  const [columns, setColumns] = useState<SchemaColumn[]>([]);
  const [rules, setRules] = useState<QualityRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<QualityRule | null>(null);
  const [dragType, setDragType] = useState<QualityRuleType | null>(null);
  const [pipelineName, setPipelineName] = useState('');
  const [pipelineDesc, setPipelineDesc] = useState('');
  const [env, setEnv] = useState<'development' | 'production'>('development');
  const [notifications, setNotifications] = useState(true);
  const [deployModal, setDeployModal] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState(0);
  const [confirmName, setConfirmName] = useState('');

  // Step 1 - File Upload simulation
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setTimeout(() => {
        setFileValid(true);
        setColumns(mockSchemaColumns);
        toast.success('Contract parsed successfully');
      }, 1000);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      setFile(f);
      setTimeout(() => {
        setFileValid(true);
        setColumns(mockSchemaColumns);
        toast.success('Contract parsed successfully');
      }, 1000);
    }
  };

  // Step 3 - Drop rule on column
  const handleDropRule = (columnId: string, columnName: string) => {
    if (!dragType) return;
    const newRule: QualityRule = {
      id: `rule-${Date.now()}`,
      type: dragType,
      columnId,
      columnName,
      config: {},
      onFailure: 'quarantine',
    };
    setRules([...rules, newRule]);
    setSelectedRule(newRule);
    setDragType(null);
  };

  // Step 4 - Deploy
  const deploySteps = ['Validating configuration', 'Generating code', 'Creating bundle', 'Deploying to Databricks', 'Running smoke tests', 'Completed'];
  const handleDeploy = async () => {
    setDeploying(true);
    for (let i = 0; i < deploySteps.length; i++) {
      setDeployStep(i);
      await new Promise((r) => setTimeout(r, 800));
    }
    setDeploying(false);
    setDeployModal(false);
    toast.success('Pipeline deployed successfully!');
    navigate('/pipelines');
  };

  const canNext = step === 0 ? fileValid : step === 1 ? columns.length > 0 : step === 2 ? true : !!pipelineName;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          {STEPS.map((s, i) => (
            <span key={s} className={`${i === step ? 'text-primary font-semibold' : i < step ? 'text-success' : 'text-muted-foreground'}`}>
              {i < step ? '✓ ' : ''}{s}
            </span>
          ))}
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />
      </div>

      {/* Step 1: Contract Upload */}
      {step === 0 && (
        <div className="space-y-6">
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${file ? 'border-success bg-success/5' : 'border-border hover:border-primary'}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {!file ? (
              <label className="cursor-pointer block">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">Drag and drop your Excel contract here, or click to browse</p>
                <p className="text-sm text-muted-foreground mt-1">.xlsx, .xls — Max 10MB</p>
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
              </label>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-success" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{columns.length} columns detected · {fileValid ? 'Valid' : 'Validating...'}</p>
                </div>
                {fileValid ? <Check className="h-5 w-5 text-success" /> : <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                <Button variant="ghost" size="icon" onClick={() => { setFile(null); setFileValid(false); setColumns([]); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <Button variant="outline" size="sm" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Download Contract Template
          </Button>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>File Mask</Label>
              <Tooltip>
                <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent>Pattern to match source files, e.g. client_*.csv</TooltipContent>
              </Tooltip>
            </div>
            <Input placeholder="e.g. client_2024_*.csv" value={fileMask} onChange={(e) => setFileMask(e.target.value)} />
          </div>
        </div>
      )}

      {/* Step 2: Schema Validation */}
      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-muted-foreground">Source: </span>
                  <span className="font-mono text-xs">/mnt/data/transactions/</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.success('Connection successful')}>
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Column</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Constraints</TableHead>
                    <TableHead>Sample Values</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>PII</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columns.map((col, i) => (
                    <TableRow key={col.id}>
                      <TableCell className="font-mono text-xs">{col.name}</TableCell>
                      <TableCell>
                        <Select
                          value={col.type}
                          onValueChange={(v) => {
                            const updated = [...columns];
                            updated[i] = { ...col, type: v as ColumnType };
                            setColumns(updated);
                          }}
                        >
                          <SelectTrigger className="w-28 h-7">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(['STRING', 'INTEGER', 'DECIMAL', 'DATE', 'BOOLEAN', 'TIMESTAMP'] as ColumnType[]).map((t) => (
                              <SelectItem key={t} value={t}>
                                <Badge className={`${typeColors[t]} text-xs`}>{t}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!col.nullable && <Badge variant="outline" className="text-[10px]">NOT NULL</Badge>}
                          {col.unique && <Badge variant="outline" className="text-[10px]">UNIQUE</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{col.sampleValues.join(', ')}</TableCell>
                      <TableCell>
                        <Input
                          className="h-7 text-xs"
                          placeholder="Description"
                          value={col.description}
                          onChange={(e) => {
                            const updated = [...columns];
                            updated[i] = { ...col, description: e.target.value };
                            setColumns(updated);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={col.sensitive}
                          onCheckedChange={(v) => {
                            const updated = [...columns];
                            updated[i] = { ...col, sensitive: v };
                            setColumns(updated);
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Quality Checks */}
      {step === 2 && (
        <div className="grid grid-cols-4 gap-4" style={{ minHeight: 400 }}>
          {/* Rule palette */}
          <div className="space-y-2">
            <p className="text-sm font-semibold mb-2">Quality Checks</p>
            {ruleCards.map((rc) => (
              <div
                key={rc.type}
                draggable
                onDragStart={() => setDragType(rc.type)}
                className={`border rounded-md p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-sm ${rc.color}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{rc.icon}</span>
                  <span className="text-xs font-medium">{rc.label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Column canvas */}
          <div className="col-span-2 space-y-2 overflow-auto">
            <p className="text-sm font-semibold mb-2">Columns</p>
            {columns.map((col) => {
              const colRules = rules.filter((r) => r.columnId === col.id);
              return (
                <div
                  key={col.id}
                  className="border rounded-md p-3 bg-card"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropRule(col.id, col.name)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs font-medium">{col.name}</span>
                    <Badge className={`${typeColors[col.type]} text-[10px]`}>{col.type}</Badge>
                  </div>
                  {colRules.length === 0 ? (
                    <div className="border border-dashed rounded p-2 text-center text-xs text-muted-foreground">
                      Drop quality check here
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {colRules.map((r) => (
                        <Badge
                          key={r.id}
                          variant="outline"
                          className="cursor-pointer text-[10px] hover:bg-accent"
                          onClick={() => setSelectedRule(r)}
                        >
                          {ruleCards.find((rc) => rc.type === r.type)?.label}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Configurator */}
          <div className="space-y-3">
            <p className="text-sm font-semibold mb-2">Configuration</p>
            {selectedRule ? (
              <Card>
                <CardContent className="p-3 space-y-3">
                  <p className="text-xs font-semibold">{ruleCards.find((rc) => rc.type === selectedRule.type)?.label}</p>
                  <p className="text-xs text-muted-foreground">Column: {selectedRule.columnName}</p>

                  {selectedRule.type === 'range' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Min</Label>
                        <Input type="number" className="h-7 text-xs" placeholder="0" />
                      </div>
                      <div>
                        <Label className="text-xs">Max</Label>
                        <Input type="number" className="h-7 text-xs" placeholder="1000000" />
                      </div>
                    </div>
                  )}
                  {selectedRule.type === 'regex' && (
                    <div>
                      <Label className="text-xs">Pattern</Label>
                      <Input className="h-7 text-xs font-mono" placeholder="^[A-Z]{3}-\d+" />
                    </div>
                  )}
                  {selectedRule.type === 'values_in_set' && (
                    <div>
                      <Label className="text-xs">Accepted Values</Label>
                      <Textarea className="text-xs" placeholder="value1, value2, value3" rows={3} />
                    </div>
                  )}

                  <div>
                    <Label className="text-xs">On Failure</Label>
                    <Select
                      value={selectedRule.onFailure}
                      onValueChange={(v) =>
                        setSelectedRule({ ...selectedRule, onFailure: v as OnFailureAction })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fail">Fail Pipeline</SelectItem>
                        <SelectItem value="drop">Drop Row</SelectItem>
                        <SelectItem value="quarantine">Quarantine</SelectItem>
                        <SelectItem value="warn">Warn Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <p className="text-[10px] text-muted-foreground italic">
                    ~15% of rows may be affected based on sample
                  </p>
                </CardContent>
              </Card>
            ) : (
              <p className="text-xs text-muted-foreground">Select a rule to configure it.</p>
            )}
          </div>

          {/* Bottom summary */}
          <div className="col-span-4 border-t pt-4 mt-2">
            <div className="flex items-center justify-center gap-4 text-sm">
              <div className="px-4 py-2 rounded bg-warning/10 border border-warning/30 text-center">
                <p className="font-bold">Bronze</p>
                <p className="text-xs text-muted-foreground">Raw Data</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="px-4 py-2 rounded bg-primary/10 border border-primary/30 text-center">
                <p className="font-bold">Silver</p>
                <p className="text-xs text-muted-foreground">{rules.length} rules</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="px-4 py-2 rounded bg-success/10 border border-success/30 text-center">
                <p className="font-bold">Gold</p>
                <p className="text-xs text-muted-foreground">Aggregated</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Review & Deploy */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pipeline Name</Label>
              <Input value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} placeholder="my-pipeline" />
            </div>
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select value={env} onValueChange={(v) => setEnv(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={pipelineDesc} onChange={(e) => setPipelineDesc(e.target.value)} placeholder="Describe your pipeline..." />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={notifications} onCheckedChange={setNotifications} />
            <Label className="text-sm">Enable email notifications</Label>
          </div>

          <Tabs defaultValue="config">
            <TabsList>
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="code">Preview Code</TabsTrigger>
              <TabsTrigger value="plan">Execution Plan</TabsTrigger>
            </TabsList>
            <TabsContent value="config" className="mt-4">
              <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-64">
{JSON.stringify({
  name: pipelineName || 'unnamed',
  environment: env,
  columns: columns.map(c => ({ name: c.name, type: c.type })),
  rules: rules.map(r => ({ type: r.type, column: r.columnName, onFailure: r.onFailure })),
}, null, 2)}
              </pre>
            </TabsContent>
            <TabsContent value="code" className="mt-4">
              <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-64 font-mono">
{`import dlt
from pyspark.sql.functions import *

@dlt.table(name="bronze_${pipelineName || 'data'}")
def bronze():
    return spark.read.format("csv").load("/mnt/data/")

@dlt.table(name="silver_${pipelineName || 'data'}")
@dlt.expect_all_or_drop({
${rules.map(r => `    "${r.type}_${r.columnName}": "${r.columnName} IS NOT NULL"`).join(',\n')}
})
def silver():
    return dlt.read("bronze_${pipelineName || 'data'}")

@dlt.table(name="gold_${pipelineName || 'data'}")
def gold():
    return dlt.read("silver_${pipelineName || 'data'}").groupBy("status").count()`}
              </pre>
            </TabsContent>
            <TabsContent value="plan" className="mt-4">
              <div className="flex items-center justify-center gap-6 py-8">
                <div className="text-center p-4 rounded-lg bg-warning/10 border border-warning/30 w-32">
                  <p className="font-bold">Bronze</p>
                  <p className="text-xs text-muted-foreground mt-1">{columns.length} columns</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="text-center p-4 rounded-lg bg-primary/10 border border-primary/30 w-32">
                  <p className="font-bold">Silver</p>
                  <p className="text-xs text-muted-foreground mt-1">{rules.length} quality rules</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="text-center p-4 rounded-lg bg-success/10 border border-success/30 w-32">
                  <p className="font-bold">Gold</p>
                  <p className="text-xs text-muted-foreground mt-1">Aggregated</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between border-t pt-4">
        <div>
          {step === 0 ? (
            <Button variant="outline" onClick={() => navigate('/pipelines')}>Cancel</Button>
          ) : (
            <Button variant="outline" className="gap-2" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-4 w-4" /> Previous
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" className="gap-2" onClick={() => { toast.success('Draft saved'); navigate('/pipelines'); }}>
              <Save className="h-4 w-4" /> Save as Draft
            </Button>
          )}
          {step < 3 ? (
            <Button className="gap-2" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Next Step <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button className="gap-2" disabled={!pipelineName} onClick={() => setDeployModal(true)}>
              Deploy Pipeline
            </Button>
          )}
        </div>
      </div>

      {/* Deploy Confirmation Modal */}
      <Dialog open={deployModal} onOpenChange={setDeployModal}>
        <DialogContent>
          {!deploying ? (
            <>
              <DialogHeader>
                <DialogTitle>Confirm Deployment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You are about to deploy <strong>{pipelineName}</strong> to <strong>{env}</strong>.
                </p>
                <div className="space-y-2">
                  <Label className="text-sm">Type the pipeline name to confirm:</Label>
                  <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={pipelineName} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeployModal(false)}>Cancel</Button>
                <Button disabled={confirmName !== pipelineName} onClick={handleDeploy}>
                  Deploy
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-4 space-y-3">
              <p className="font-semibold text-center mb-4">Deploying Pipeline...</p>
              {deploySteps.map((ds, i) => (
                <div key={ds} className="flex items-center gap-3 text-sm">
                  {i < deployStep ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : i === deployStep ? (
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-border" />
                  )}
                  <span className={i <= deployStep ? 'text-foreground' : 'text-muted-foreground'}>{ds}</span>
                </div>
              ))}
              <Progress value={(deployStep / (deploySteps.length - 1)) * 100} className="mt-4" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatePipeline;
