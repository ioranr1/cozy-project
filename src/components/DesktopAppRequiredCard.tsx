import { Monitor, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface DesktopAppRequiredCardProps {
  title?: string;
  description?: string;
  ctaText?: string;
  ctaAction?: () => void;
  className?: string;
}

/**
 * Reusable locked-state card shown when a feature requires the desktop app.
 * Used by FeatureGate in "lock" mode.
 */
export function DesktopAppRequiredCard({
  title = 'Desktop App Required',
  description = 'This feature is only available in the AIGuard desktop application.',
  ctaText,
  ctaAction,
  className = '',
}: DesktopAppRequiredCardProps) {
  return (
    <Card className={`border-dashed border-2 border-muted-foreground/30 bg-muted/50 ${className}`}>
      <CardContent className="flex flex-col items-center justify-center py-8 px-6 text-center">
        <div className="rounded-full bg-primary/10 p-4 mb-4">
          <Monitor className="h-8 w-8 text-primary" />
        </div>
        
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {title}
        </h3>
        
        <p className="text-sm text-muted-foreground max-w-xs mb-4">
          {description}
        </p>

        {ctaText && ctaAction && (
          <Button 
            onClick={ctaAction}
            variant="outline"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {ctaText}
          </Button>
        )}

        {!ctaAction && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Available on Windows & Mac</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
