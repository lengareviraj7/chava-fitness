import React, { useState } from 'react';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Skeleton, CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import { formatINR } from '../utils/money.js';
import {
  Palette,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Plus
} from 'lucide-react';

export const DesignSystemShowcase = () => {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);

  return (
    <div className="space-y-8 pb-12">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-theme pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/15 border border-accent-primary/30 text-accent-primary text-xs font-bold uppercase tracking-wider mb-1.5">
            Phase 1 Deliverable
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-text-main uppercase tracking-tight">
            Design System & Component Library
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Verification showroom testing responsive breakpoints, buttons, inputs, tables, modals, badges, empty states, and toast alerts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSkeleton(!showSkeleton)}>
            {showSkeleton ? 'Hide Skeletons' : 'Show Skeletons'}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setModalOpen(true)} icon={Plus}>
            Test Modal
          </Button>
        </div>
      </div>

      {/* 1. Color Palette Tokens */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">Color Palette Tokens</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl bg-bg-primary border border-border-theme">
            <div className="h-8 rounded-lg bg-bg-primary border border-border-theme mb-2" />
            <span className="text-xs font-bold block text-text-main">#080B0D</span>
            <span className="text-[10px] text-text-muted">Primary Bg</span>
          </div>
          <div className="p-3 rounded-xl bg-bg-secondary border border-border-theme">
            <div className="h-8 rounded-lg bg-bg-secondary border border-border-theme mb-2" />
            <span className="text-xs font-bold block text-text-main">#101719</span>
            <span className="text-[10px] text-text-muted">Secondary Bg</span>
          </div>
          <div className="p-3 rounded-xl bg-bg-card border border-border-theme">
            <div className="h-8 rounded-lg bg-bg-card border border-border-theme mb-2" />
            <span className="text-xs font-bold block text-text-main">#151D1F</span>
            <span className="text-[10px] text-text-muted">Card Bg</span>
          </div>
          <div className="p-3 rounded-xl bg-bg-secondary border border-accent-primary shadow-neon">
            <div className="h-8 rounded-lg bg-accent-primary mb-2" />
            <span className="text-xs font-bold block text-accent-primary">#B8F36B</span>
            <span className="text-[10px] text-text-muted">Neon Lime (Primary)</span>
          </div>
          <div className="p-3 rounded-xl bg-bg-secondary border border-border-theme">
            <div className="h-8 rounded-lg bg-accent-secondary mb-2" />
            <span className="text-xs font-bold block text-accent-secondary">#8BD63D</span>
            <span className="text-[10px] text-text-muted">Secondary Accent</span>
          </div>
          <div className="p-3 rounded-xl bg-bg-secondary border border-border-theme">
            <div className="h-8 rounded-lg bg-danger mb-2" />
            <span className="text-xs font-bold block text-danger">#FF6262</span>
            <span className="text-[10px] text-text-muted">Danger Alert</span>
          </div>
        </div>
      </section>

      {/* 2. Interactive Buttons */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">Button Variants & Touch Targets (44px+)</h3>
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary Action</Button>
            <Button variant="secondary">Secondary Action</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="danger">Danger Action</Button>
            <Button variant="primary" loading>Loading</Button>
          </div>
        </Card>
      </section>

      {/* 3. Form Inputs & Feedback */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">Form Inputs & Validation</h3>
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Supplement Name" placeholder="e.g. 100% Gold Standard Whey" />
            <Select label="Category" options={[
              { value: 'whey', label: 'Whey Protein' },
              { value: 'creatine', label: 'Creatine Monohydrate' },
              { value: 'preworkout', label: 'Pre-Workout' },
            ]} />
            <Input label="Price with Error State" defaultValue="invalid" error="Price must be a positive integer" />
          </div>
        </Card>
      </section>

      {/* 4. Badges & Toasts */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">Badges & Toast Notifications</h3>
        <Card>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Badge variant="accent">Active Batch</Badge>
            <Badge variant="warning">Low Stock</Badge>
            <Badge variant="danger">Expired</Badge>
            <Badge variant="default">Staff User</Badge>
            <Badge variant="outline">Tax: 18% GST</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border-theme">
            <Button size="sm" variant="outline" onClick={() => toast.success("Batch successfully verified under FEFO rule!")}>
              Trigger Success Toast
            </Button>
            <Button size="sm" variant="outline" onClick={() => toast.error("Stock level depleted. Reorder needed.")}>
              Trigger Error Toast
            </Button>
            <Button size="sm" variant="outline" onClick={() => toast.info("Daily Day-Close sync completed.")}>
              Trigger Info Toast
            </Button>
          </div>
        </Card>
      </section>

      {/* 5. Responsive Data Table */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">Responsive Table View</h3>
        {showSkeleton ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>MRP</TableHead>
                <TableHead>Selling Price</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono text-xs text-accent-primary font-bold">ON-WHEY-2KG-CHOC</TableCell>
                <TableCell className="font-semibold text-text-main">Optimum Nutrition Gold Standard 100%</TableCell>
                <TableCell>Whey Protein</TableCell>
                <TableCell className="line-through text-text-muted">{formatINR(749900)}</TableCell>
                <TableCell className="font-bold text-accent-primary">{formatINR(689900)}</TableCell>
                <TableCell><Badge variant="accent">In Stock</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-xs text-accent-primary font-bold">MB-CREA-250G</TableCell>
                <TableCell className="font-semibold text-text-main">MuscleBlaze Creatine Monohydrate</TableCell>
                <TableCell>Creatine</TableCell>
                <TableCell className="line-through text-text-muted">{formatINR(149900)}</TableCell>
                <TableCell className="font-bold text-accent-primary">{formatINR(119900)}</TableCell>
                <TableCell><Badge variant="warning">3 Left</Badge></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </section>

      {/* 6. Empty & Error States */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">Empty & Error States</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <EmptyState
            title="No Products Found"
            description="Try selecting a different category or adjusting your search filters."
            actionLabel="Reset Filters"
            onAction={() => toast.info("Filters reset.")}
          />
          <ErrorState
            title="Connection Issue"
            message="Could not reach the MongoDB replica set API service."
            onRetry={() => toast.info("Retrying connection...")}
          />
        </div>
      </section>

      {/* Test Modal / Bottom Sheet */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Supplement Variant"
        subtitle="Test dynamic modal on desktop, bottom-sheet on phone"
      >
        <div className="space-y-4">
          <Input label="Flavour" placeholder="e.g. Double Rich Chocolate" />
          <Input label="Size / Packaging" placeholder="e.g. 2 kg / 4.4 lbs" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="MRP (₹)" placeholder="7499" />
            <Input label="Selling Price (₹)" placeholder="6899" />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border-theme">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => {
              setModalOpen(false);
              toast.success("Variant added successfully!");
            }}>Save Variant</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
