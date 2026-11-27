import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Layers } from 'lucide-react';

export const ModulePlaceholder = ({ moduleName, phase, description, icon: Icon = Layers }) => {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <Card className="text-center p-8 sm:p-12 border-border-theme/80 bg-bg-card/70">
        <div className="w-16 h-16 rounded-2xl bg-bg-secondary border border-border-theme mx-auto flex items-center justify-center text-accent-primary mb-6 shadow-neon">
          <Icon className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/30 text-accent-primary text-xs font-bold uppercase tracking-wider mb-3">
          Phase {phase} Module
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-text-main uppercase tracking-tight mb-2">
          {moduleName}
        </h2>

        <p className="text-sm text-text-muted leading-relaxed max-w-md mx-auto mb-6">
          {description}
        </p>

        <div className="p-4 rounded-xl bg-bg-secondary border border-border-theme text-xs text-text-muted max-w-sm mx-auto">
          <span className="font-semibold text-text-main block mb-1">Architecture Locked</span>
          Ready for activation in accordance with the project specification.
        </div>
      </Card>
    </div>
  );
};
