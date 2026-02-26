import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, FileText, Code, HelpCircle } from 'lucide-react';

const docs = [
  { title: 'Getting Started', desc: 'Learn the basics of creating and deploying data pipelines.', icon: BookOpen },
  { title: 'Contract Template', desc: 'Download and understand the Excel contract format.', icon: FileText },
  { title: 'Quality Rules Reference', desc: 'All available quality checks and their configuration.', icon: Code },
  { title: 'FAQ', desc: 'Frequently asked questions about the platform.', icon: HelpCircle },
];

const Documentation = () => (
  <div className="max-w-3xl mx-auto space-y-4">
    <p className="text-muted-foreground">Platform documentation and guides.</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {docs.map((d) => (
        <Card key={d.title} className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-accent flex items-center justify-center">
                <d.icon className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-base">{d.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{d.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

export default Documentation;
