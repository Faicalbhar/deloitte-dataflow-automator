import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Plus, Trash2, GripVertical, Bot, Send, Code
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { mockPipelines, mockSchemaColumns, mockFirstRow, availableTransformationTypes } from '@/data/mock-data';
import type { Transformation, TransformationType, ColumnType } from '@/types';
import { toast } from 'sonner';

const typeColors: Record<ColumnType, string> = {
  STRING: 'bg-info text-info-foreground',
  INTEGER: 'bg-success text-success-foreground',
  DECIMAL: 'bg-warning text-warning-foreground',
  DATE: 'bg-accent text-accent-foreground',
  BOOLEAN: 'bg-muted text-muted-foreground',
  TIMESTAMP: 'bg-accent text-accent-foreground',
};

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

const EditPipeline = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const pipeline = mockPipelines.find((p) => p.id === id);
  const columns = mockSchemaColumns;

  const [transformations, setTransformations] = useState<Transformation[]>(
    pipeline?.transformations || []
  );
  const [aiOpen, setAiOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hi! I can help you modify transformations for this pipeline. Ask me anything!" }
  ]);
  const [chatInput, setChatInput] = useState('');

  if (!pipeline) {
    return (
      <div className="text-center py-16">
        <p>Pipeline not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/pipelines')}>Back</Button>
      </div>
    );
  }

  const addTransformation = (type: TransformationType) => {
    const newT: Transformation = {
      id: `t-${Date.now()}`,
      order: transformations.length + 1,
      type,
      config: {},
      sourceColumns: [],
      description: availableTransformationTypes.find(t => t.type === type)?.label || type,
    };
    setTransformations([...transformations, newT]);
  };

  const removeTransformation = (tid: string) => {
    setTransformations(transformations.filter(t => t.id !== tid).map((t, i) => ({ ...t, order: i + 1 })));
  };

  const updateTransformation = (tid: string, updates: Partial<Transformation>) => {
    setTransformations(transformations.map(t => t.id === tid ? { ...t, ...updates } : t));
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setTimeout(() => {
      let response = '';
      let newT: Transformation | null = null;
      if (userMsg.toLowerCase().includes('filter')) {
        newT = { id: `t-${Date.now()}`, order: transformations.length + 1, type: 'filter', config: { condition: "status != 'cancelled'" }, sourceColumns: ['status'], description: "Filter cancelled rows" };
        response = "✅ Added a Filter transformation.";
      } else if (userMsg.toLowerCase().includes('rename')) {
        newT = { id: `t-${Date.now()}`, order: transformations.length + 1, type: 'rename', config: { newName: 'txn_date' }, sourceColumns: ['transaction_date'], targetColumn: 'txn_date', description: "Rename transaction_date" };
        response = "✅ Added a Rename transformation.";
      } else {
        response = "Could you be more specific? Try: \"Filter rows where...\", \"Rename column X to Y\", etc.";
      }
      if (newT) setTransformations(prev => [...prev, newT!]);
      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
    }, 600);
  };

  const generateJson = () => ({
    pipeline: pipeline.name,
    transformations: transformations.map(t => ({
      order: t.order, type: t.type, config: t.config,
      sourceColumns: t.sourceColumns, targetColumn: t.targetColumn, description: t.description,
    })),
  });

  const handleSave = () => {
    toast.success('Pipeline transformations saved successfully!');
    navigate(`/pipelines/${id}`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/pipelines/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Edit: {pipeline.name}</h1>
            <p className="text-sm text-muted-foreground">Modify transformations and data contract</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/pipelines/${id}`)}>Cancel</Button>
          <Button className="gap-2" onClick={handleSave}>
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Left: columns */}
        <div className="w-1/3 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Data Contract — Columns</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Column</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Sample</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columns.map((col) => (
                    <TableRow key={col.id} className="text-xs">
                      <TableCell className="font-mono py-2">{col.name}</TableCell>
                      <TableCell className="py-2">
                        <Badge className={`${typeColors[col.type]} text-[10px]`}>{col.type}</Badge>
                      </TableCell>
                      <TableCell className="py-2 text-muted-foreground truncate max-w-[100px]">
                        {mockFirstRow[col.name] || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right: transformations */}
        <div className="flex-1 space-y-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Transformations</CardTitle>
              <div className="flex gap-2">
                <Select onValueChange={(v) => addTransformation(v as TransformationType)}>
                  <SelectTrigger className="h-8 w-48 text-xs">
                    <SelectValue placeholder="+ Add transformation" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTransformationTypes.map((t) => (
                      <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setAiOpen(true)}>
                  <Bot className="h-3.5 w-3.5" /> AI Assistant
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {transformations.length === 0 ? (
                <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                  <p className="text-sm">No transformations. Add one above or use the AI assistant.</p>
                </div>
              ) : (
                transformations.map((t) => (
                  <Card key={t.id} className="border bg-muted/30">
                    <CardContent className="p-3 flex items-start gap-3">
                      <div className="flex items-center gap-2 shrink-0 pt-0.5">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        <Badge variant="outline" className="text-xs font-mono w-7 justify-center">{t.order}</Badge>
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-primary/10 text-primary text-[10px]">{t.type.replace('_', ' ').toUpperCase()}</Badge>
                          <span className="text-xs font-medium">{t.description}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">Source Column(s)</Label>
                            <Select value={t.sourceColumns[0] || ''} onValueChange={(v) => updateTransformation(t.id, { sourceColumns: [v] })}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                {columns.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          {t.type === 'rename' && (
                            <div>
                              <Label className="text-[10px]">New Name</Label>
                              <Input className="h-7 text-xs" value={(t.config.newName as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, newName: e.target.value } })} />
                            </div>
                          )}
                          {t.type === 'filter' && (
                            <div>
                              <Label className="text-[10px]">Condition</Label>
                              <Input className="h-7 text-xs font-mono" value={(t.config.condition as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, condition: e.target.value } })} />
                            </div>
                          )}
                          {t.type === 'cast' && (
                            <div>
                              <Label className="text-[10px]">Target Type</Label>
                              <Select value={(t.config.targetType as string) || ''} onValueChange={(v) => updateTransformation(t.id, { config: { ...t.config, targetType: v } })}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {['STRING', 'INTEGER', 'DECIMAL', 'DATE', 'BOOLEAN'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {t.type === 'add_column' && (
                            <div>
                              <Label className="text-[10px]">Expression</Label>
                              <Input className="h-7 text-xs font-mono" value={(t.config.expression as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, expression: e.target.value } })} />
                            </div>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeTransformation(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
              <Button variant="outline" size="sm" className="w-full gap-2 border-dashed text-xs" onClick={() => addTransformation('filter')}>
                <Plus className="h-3.5 w-3.5" /> Add Transformation
              </Button>
            </CardContent>
          </Card>

          {/* JSON Preview */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center gap-2">
              <Code className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Updated JSON (for backend)</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted rounded-md p-3 text-[10px] font-mono overflow-auto max-h-48">
                {JSON.stringify(generateJson(), null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Assistant */}
      <Sheet open={aiOpen} onOpenChange={setAiOpen}>
        <SheetContent className="sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" /> AI Transformation Assistant
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 mt-4 pr-4">
            <div className="space-y-4">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex gap-2 mt-4 pt-4 border-t">
            <Input placeholder="Describe a transformation..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendChat()} className="text-sm" />
            <Button size="icon" onClick={handleSendChat}><Send className="h-4 w-4" /></Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default EditPipeline;
