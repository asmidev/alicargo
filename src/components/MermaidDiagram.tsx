import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

// Initialize mermaid once with strict security
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: false, // Disable HTML labels for security
    curve: 'basis',
  },
  er: {
    useMaxWidth: true,
    layoutDirection: 'TB',
  },
  securityLevel: 'strict', // Use strict security level
});

let diagramId = 0;

export const MermaidDiagram = ({ chart, className = '' }: MermaidDiagramProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [id] = useState(() => `mermaid-${++diagramId}`);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current) return;
      
      try {
        // Clear previous content
        setSvg('');
        setError(null);
        setLoading(true);
        
        // Small delay to allow DOM to settle
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Render the diagram
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        // Sanitize SVG output before setting
        const cleanSvg = DOMPurify.sanitize(renderedSvg, { 
          USE_PROFILES: { svg: true, svgFilters: true } 
        });
        setSvg(cleanSvg);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      } finally {
        setLoading(false);
      }
    };

    renderDiagram();
  }, [chart, id]);

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
        <p className="text-destructive text-sm font-medium mb-2">Diagram xatosi:</p>
        <pre className="text-xs text-muted-foreground overflow-x-auto">{error}</pre>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 p-4">
          <LoadingSkeleton count={3} />
        </div>
      )}
      <div 
        className="overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
};

export default MermaidDiagram;
