'use client';

import { getPublicApiUrl } from '@/lib/api-base';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GitFork, Search, Loader2, ChevronRight, ExternalLink,
  ArrowLeftRight, User, Clock, Plus, Minus, Equal, GitMerge,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { IconSparkles } from '@tabler/icons-react';
import { fadeInUp, staggerContainer, glassCard } from '@/lib/design';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  useForks,
  type ForkLineageNode,
  type CrossEntityDiff,
} from '@/hooks/use-contributions';
import { FORK_STATUS_COLORS, FORK_REASON_COLORS } from '@/components/fork-button';

const API_BASE = getPublicApiUrl();

function LineageTreeNode({
  node,
  selectedId,
  onSelect,
  depth = 0,
}: {
  node: ForkLineageNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 3);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.entity_id;
  const statusColor = node.fork_info
    ? FORK_STATUS_COLORS[node.fork_info.fork_status] || FORK_STATUS_COLORS.active
    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';

  return (
    <div className="relative">
      {depth > 0 && (
        <div className="absolute left-0 top-0 bottom-0 w-px bg-border" style={{ marginLeft: -12 }} />
      )}
      <div
        className={cn(
          'flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm',
          isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50',
        )}
        onClick={() => onSelect(node.entity_id)}
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            <ChevronRight className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')} />
          </Button>
        ) : (
          <div className="w-5 h-5 shrink-0 flex items-center justify-center">
            <GitFork className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{node.name}</span>
            <Badge className={cn('text-[10px] border-0', statusColor)}>
              {node.fork_info ? node.fork_info.fork_status : node.status}
            </Badge>
            {node.fork_info && node.fork_info.fork_reason_tag !== 'other' && (
              <Badge className={cn('text-[10px] border-0', FORK_REASON_COLORS[node.fork_info.fork_reason_tag] || '')}>
                {node.fork_info.fork_reason_tag.replace('_', ' ')}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {node.fork_info?.forked_by || node.contributor_username}
            </span>
            {node.fork_info?.diff_field_count ? (
              <span>{node.fork_info.diff_field_count} field(s) changed</span>
            ) : null}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(node.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
      {hasChildren && expanded && (
        <div className="ml-6 pl-3 border-l border-border space-y-0.5 mt-0.5">
          {node.children.map((child) => (
            <LineageTreeNode
              key={child.entity_id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DiffPanel({ diff }: { diff: CrossEntityDiff }) {
  const entries = Object.entries(diff.diff);
  const addedCount = entries.filter(([, v]) => v.old === null || v.old === '' || v.old === undefined).length;
  const removedCount = entries.filter(([, v]) => v.new === null || v.new === '' || v.new === undefined).length;
  const changedCount = entries.length - addedCount - removedCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-sm">
            Comparing: <span className="text-muted-foreground">{diff.entity_name}</span>
            {' vs '}
            <span className="text-muted-foreground">{diff.fork_entity_name}</span>
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-green-600"><Plus className="h-3 w-3" /> {addedCount} added</span>
          <span className="flex items-center gap-1 text-red-600"><Minus className="h-3 w-3" /> {removedCount} removed</span>
          <span className="flex items-center gap-1 text-amber-600"><Equal className="h-3 w-3" /> {changedCount} changed</span>
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No differences found.</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium w-1/4">Field</th>
                <th className="text-left px-3 py-2 font-medium w-[37.5%]">Original</th>
                <th className="text-left px-3 py-2 font-medium w-[37.5%]">Fork</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([field, { old: oldVal, new: newVal }]) => {
                const isAdded = oldVal === null || oldVal === '' || oldVal === undefined;
                const isRemoved = newVal === null || newVal === '' || newVal === undefined;
                return (
                  <tr key={field} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs align-top">{field.replace(/_/g, ' ')}</td>
                    <td className={cn('px-3 py-2 text-xs align-top break-words', isAdded && 'text-muted-foreground', !isAdded && !isRemoved && 'bg-red-50 dark:bg-red-950/20')}>
                      {isAdded ? <span className="italic">—</span> : typeof oldVal === 'object' ? <pre className="whitespace-pre-wrap font-mono">{JSON.stringify(oldVal, null, 2)}</pre> : String(oldVal)}
                    </td>
                    <td className={cn('px-3 py-2 text-xs align-top break-words', isRemoved && 'text-muted-foreground', (isAdded || (!isAdded && !isRemoved)) && 'bg-green-50 dark:bg-green-950/20')}>
                      {isRemoved ? <span className="italic">—</span> : typeof newVal === 'object' ? <pre className="whitespace-pre-wrap font-mono">{JSON.stringify(newVal, null, 2)}</pre> : String(newVal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ForkViewerPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const initialEntityId = searchParams.get('entity') || '';

  const { getLineage, getForkDiff } = useForks();
  const [entitySearch, setEntitySearch] = useState(initialEntityId);
  const [lineage, setLineage] = useState<ForkLineageNode | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [diff, setDiff] = useState<CrossEntityDiff | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  const loadLineage = useCallback(async (entityId: string) => {
    if (!entityId) return;
    setLoadingTree(true);
    setDiff(null);
    setSelectedNodeId(null);
    try {
      const data = await getLineage(entityId);
      setLineage(data);
    } catch {
      toast.error('Failed to load lineage tree');
      setLineage(null);
    } finally {
      setLoadingTree(false);
    }
  }, [getLineage]);

  useEffect(() => {
    if (initialEntityId) loadLineage(initialEntityId);
  }, [initialEntityId, loadLineage]);

  const handleSelectNode = useCallback(async (nodeId: string) => {
    setSelectedNodeId(nodeId);
    if (!lineage || nodeId === lineage.entity_id) {
      setDiff(null);
      return;
    }
    setLoadingDiff(true);
    try {
      const data = await getForkDiff(lineage.entity_id, nodeId);
      setDiff(data);
    } catch {
      toast.error('Failed to load diff');
      setDiff(null);
    } finally {
      setLoadingDiff(false);
    }
  }, [lineage, getForkDiff]);

  const handleSearch = () => {
    if (entitySearch.trim()) loadLineage(entitySearch.trim());
  };

  const flatCount = (node: ForkLineageNode): number => {
    let count = 1;
    if (node.children) {
      for (const child of node.children) count += flatCount(child);
    }
    return count;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="show" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-8`}>
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-500 to-fuchsia-500 opacity-95 rounded-2xl" />
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <motion.div variants={fadeInUp} className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
            <IconSparkles className="w-4 h-4" /> Fork Viewer
          </div>
          <h1 className="text-3xl font-black text-white">
            Fork <span className="text-white/90">Lineage Tree</span>
          </h1>
          <p className="text-purple-100 max-w-lg">
            Explore how contributions evolve through forks, corrections, translations, and expansions.
            Select a fork node to see its diff against the root.
          </p>
        </motion.div>
      </motion.div>

      {/* Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" /> Look up entity lineage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Paste entity ID (UUID)..."
              value={entitySearch}
              onChange={(e) => setEntitySearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={loadingTree || !entitySearch.trim()}>
              {loadingTree ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load Tree'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tree + Diff panels */}
      {lineage && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Tree panel */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <GitFork className="h-4 w-4" /> Lineage Tree
              </CardTitle>
              <CardDescription>
                {flatCount(lineage)} node(s) in tree. Click a fork to compare.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[600px]">
                <LineageTreeNode
                  node={lineage}
                  selectedId={selectedNodeId}
                  onSelect={handleSelectNode}
                />
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Diff panel */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4" /> Fork Diff
              </CardTitle>
              <CardDescription>
                {selectedNodeId
                  ? 'Field-level comparison between root and selected fork'
                  : 'Select a fork node from the tree to view its diff'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDiff ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : diff ? (
                <ScrollArea className="max-h-[600px]">
                  <DiffPanel diff={diff} />
                </ScrollArea>
              ) : selectedNodeId && selectedNodeId === lineage.entity_id ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  This is the root entity. Select a fork to see differences.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select a fork node from the tree to compare.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
