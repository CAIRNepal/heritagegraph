'use client';

import React, { useEffect, useCallback, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  ReactFlowInstance,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Search,
  Eye,
  Edit,
  MessageSquare,
  CheckCircle,
  Clock,
  User,
  History,
  ChevronDown,
  ChevronRight,
  // Download,
  // Upload,
  // Filter,
  BarChart3,
  Copy,
  // Trash2,
  // Star,
  MoreHorizontal,
  // ExternalLink,
} from 'lucide-react';

type FormVersion = {
  id: string;
  label: string;
  version: number;
  parent?: string;
  contributor?: string;
  moderator?: string;
  comment?: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'needs_revision';
  timestamp: Date;
  changes?: string;
  formId: string;
};

// Dummy data
const initialData: FormVersion[] = [
  {
    id: 'form1-v1',
    label: 'Form 1 - v1',
    version: 1,
    contributor: 'Alice',
    status: 'submitted',
    timestamp: new Date('2023-10-01'),
    changes: 'Initial submission',
    formId: 'form1',
  },
  {
    id: 'form1-v2',
    label: 'Form 1 - v2',
    version: 2,
    parent: 'form1-v1',
    contributor: 'Alice',
    moderator: 'Moderator1',
    comment: 'Added missing field after moderator review',
    status: 'approved',
    timestamp: new Date('2023-10-05'),
    changes: 'Added contact information field',
    formId: 'form1',
  },
  {
    id: 'form1-v3',
    label: 'Form 1 - v3',
    version: 3,
    parent: 'form1-v2',
    contributor: 'Alice',
    comment: 'Corrected typo',
    status: 'submitted',
    timestamp: new Date('2023-10-10'),
    changes: 'Fixed spelling errors in section headers',
    formId: 'form1',
  },
  {
    id: 'form2-v1',
    label: 'Form 2 - v1',
    version: 1,
    contributor: 'Bob',
    status: 'under_review',
    timestamp: new Date('2023-10-02'),
    changes: 'Initial draft with basic fields',
    formId: 'form2',
  },
  {
    id: 'form2-v2',
    label: 'Form 2 - v2',
    version: 2,
    parent: 'form2-v1',
    contributor: 'Bob',
    moderator: 'Moderator2',
    comment: 'Updated with additional info',
    status: 'needs_revision',
    timestamp: new Date('2023-10-07'),
    changes: 'Added validation rules and conditional fields',
    formId: 'form2',
  },
  {
    id: 'form3-v1',
    label: 'Form 3 - v1',
    version: 1,
    contributor: 'Charlie',
    status: 'approved',
    timestamp: new Date('2023-10-03'),
    changes: 'Initial approved version',
    formId: 'form3',
  },
];

// Group data by form
const groupForms = (data: FormVersion[]) => {
  const forms: Record<string, FormVersion[]> = {};
  data.forEach((item) => {
    if (!forms[item.formId]) {
      forms[item.formId] = [];
    }
    forms[item.formId].push(item);
  });
  return forms;
};

// Custom node component
const CustomNode = ({ data }: { data: any }) => {
  const statusColors = {
    draft: 'bg-gray-200 text-gray-800',
    submitted: 'bg-blue-200 text-blue-800',
    under_review: 'bg-yellow-200 text-yellow-800',
    approved: 'bg-green-200 text-green-800',
    needs_revision: 'bg-orange-200 text-orange-800',
  };

  return (
    <div className="px-4 py-3 shadow-md rounded-md bg-white border border-gray-200 min-w-[240px] hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div className="font-bold text-sm">{data.label}</div>
          <Badge className={`text-xs ${statusColors[data.status as keyof typeof statusColors]}`}>
            {data.status.replace('_', ' ')}
          </Badge>
      </div>
      <div className="mt-2 text-xs text-gray-600">
        {data.contributor && (
          <div className="flex items-center mt-1">
            <User className="w-3 h-3 mr-1" />
            <span>By: {data.contributor}</span>
          </div>
        )}
        {data.moderator && (
          <div className="flex items-center mt-1">
            <CheckCircle className="w-3 h-3 mr-1" />
            <span>Reviewed by: {data.moderator}</span>
          </div>
        )}
        {data.changes && (
          <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
            <div className="flex items-center font-medium">
              <History className="w-3 h-3 mr-1" />
              Changes:
            </div>
            <div className="mt-1">{data.changes}</div>
          </div>
        )}
        {data.comment && (
          <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
            <div className="flex items-center font-medium">
              <MessageSquare className="w-3 h-3 mr-1" />
              Comment:
            </div>
            <div className="mt-1">{data.comment}</div>
          </div>
        )}
        <div className="flex items-center mt-2 text-xs">
          <Clock className="w-3 h-3 mr-1" />
          {data.timestamp.toLocaleDateString()}
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

export default function FormVersionViewer() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(
    null,
  );
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedForm, setSelectedForm] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormVersion[]>(initialData);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState('view');
  const [expandedForms, setExpandedForms] = useState<Record<string, boolean>>({});
  const [showStatistics, setShowStatistics] = useState(false);

  const forms = groupForms(formData);

  // Generate nodes and edges from form data
  useEffect(() => {
    const nodesToShow = selectedForm
      ? formData.filter((item) => item.formId === selectedForm)
      : formData;

    const generatedNodes: Node[] = nodesToShow.map((item, idx) => ({
      id: item.id,
      type: 'custom',
      data: {
        ...item,
        label: item.label,
      },
      position: { x: 300 * (item.version - 1), y: 200 * idx },
      style: {
        border: '1px solid #888',
        padding: 10,
        borderRadius: 8,
        background: 'white',
      },
    }));

    const generatedEdges: Edge[] = nodesToShow
      .filter((item) => item.parent)
      .map((item) => ({
        id: `e-${item.parent}-${item.id}`,
        source: item.parent!,
        target: item.id,
        animated: true,
        style: { stroke: '#555' },
      }));

    setNodes(generatedNodes);
    setEdges(generatedEdges);
  }, [formData, setNodes, setEdges, selectedForm]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setSelectedForm(node.data.formId);
  }, []);

  const handleAddVersion = () => {
    if (!selectedNode) return;

    const formVersions = formData.filter(
      (item) => item.formId === selectedNode.data.formId,
    );
    const latestVersion = formVersions.reduce(
      (max, item) => Math.max(max, item.version),
      0,
    );

    const newVersion: FormVersion = {
      id: `${selectedNode.data.formId}-v${latestVersion + 1}`,
      label: `${selectedNode.data.label.split(' - ')[0]} - v${latestVersion + 1}`,
      version: latestVersion + 1,
      parent: selectedNode.id,
      contributor: 'Current User',
      status: 'draft',
      timestamp: new Date(),
      changes: 'New version based on feedback',
      formId: selectedNode.data.formId,
    };

    setFormData([...formData, newVersion]);
  };

  const handleAddComment = () => {
    if (!selectedNode || !newComment) return;

    const updatedData = formData.map((item) =>
      item.id === selectedNode.id
        ? { ...item, comment: newComment, moderator: 'Moderator' }
        : item,
    );

    setFormData(updatedData);
    setNewComment('');
  };

  const handleStatusChange = (status: FormVersion['status']) => {
    if (!selectedNode) return;

    const updatedData = formData.map((item) =>
      item.id === selectedNode.id ? { ...item, status } : item,
    );

    setFormData(updatedData);
  };

  const toggleFormExpansion = (formId: string) => {
    setExpandedForms((prev) => ({
      ...prev,
      [formId]: !prev[formId],
    }));
  };

  const handleFormSelect = (formId: string) => {
    setSelectedForm(formId === selectedForm ? null : formId);
  };

  const filteredData = formData.filter((item) => {
    const matchesSearch =
      item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.contributor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.comment?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.changes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesForm = !selectedForm || item.formId === selectedForm;
    return matchesSearch && matchesStatus && matchesForm;
  });

  // Calculate statistics
  const stats = {
    totalForms: Object.keys(forms).length,
    totalVersions: formData.length,
    byStatus: formData.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    byContributor: formData.reduce(
      (acc, item) => {
        if (item.contributor) {
          acc[item.contributor] = (acc[item.contributor] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    ),
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* <header className="mb-6 flex justify-between items-center">
          <div className="flex gap-2">
            <Button variant="outline" className="flex items-center">
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            <Button className="flex items-center">
              <Upload className="h-4 w-4 mr-2" /> New Form
            </Button>
          </div>
        </header>
 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4 md:space-y-6">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg rounded-xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Filters</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowStatistics(!showStatistics)}
                    className="h-8 w-8"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="search" className="text-gray-700 dark:text-gray-300">
                    Search
                  </Label>
                  <div className="flex space-x-2">
                    <Input
                      id="search"
                      placeholder="Search forms..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    />
                    <Button size="icon" variant="outline">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status" className="text-gray-700 dark:text-gray-300">
                    Status
                  </Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger
                      id="status"
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    >
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="needs_revision">Needs Revision</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {showStatistics && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium mb-2">Statistics</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span>Total Forms:</span>
                        <span className="font-medium">{stats.totalForms}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Versions:</span>
                        <span className="font-medium">{stats.totalVersions}</span>
                      </div>
                      {Object.entries(stats.byStatus).map(([status, count]) => (
                        <div key={status} className="flex justify-between">
                          <span className="capitalize">
                            {status.replace('_', ' ')}:
                          </span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Forms</CardTitle>
                <CardDescription>{filteredData.length} versions found</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
                {Object.entries(forms).map(([formId, versions]) => {
                  const isExpanded = expandedForms[formId];
                  const isSelected = selectedForm === formId;
                  const latestVersion = versions.reduce(
                    (max, v) => (v.version > max.version ? v : max),
                    versions[0],
                  );

                  return (
                    <div key={formId} className="rounded-md overflow-hidden">
                      <div
                        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-100 dark:bg-blue-900'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => {
                          handleFormSelect(formId);
                          if (!isExpanded) toggleFormExpansion(formId);
                        }}
                      >
                        <div className="flex items-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 mr-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFormExpansion(formId);
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {formId}
                          </span>
                        </div>
                        <Badge variant="outline">v{latestVersion.version}</Badge>
                      </div>

                      {isExpanded &&
                        versions.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between p-3 pl-10 cursor-pointer transition-colors ${
                              selectedNode?.id === item.id
                                ? 'bg-blue-100 dark:bg-blue-900'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                            onClick={() => {
                              if (!reactFlowInstance) return;
                              const node = reactFlowInstance.getNode(item.id);
                              if (node) {
                                setSelectedNode(node);
                                reactFlowInstance.fitView({
                                  nodes: [node],
                                  duration: 800,
                                });
                              }
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate text-gray-900 dark:text-gray-100">
                                v{item.version}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-1">
                                <User className="w-3 h-3 mr-1" />
                                {item.contributor}
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={
                                item.status === 'approved'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : item.status === 'submitted'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                    : item.status === 'under_review'
                                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                      : item.status === 'needs_revision'
                                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                              }
                            >
                              {item.status.charAt(0).toUpperCase()}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-4 md:space-y-6">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg rounded-xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">
                    {selectedForm
                      ? `Version Flow - ${selectedForm}`
                      : 'All Form Versions'}
                  </CardTitle>
                  <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="w-auto"
                  >
                    <TabsList>
                      <TabsTrigger value="view" className="flex items-center">
                        <Eye className="h-4 w-4 mr-2" /> View
                      </TabsTrigger>
                      <TabsTrigger value="edit" className="flex items-center">
                        <Edit className="h-4 w-4 mr-2" /> Edit
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent className="h-[50vh] p-0">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={onNodeClick}
                  fitView
                  nodeTypes={nodeTypes}
                  style={{ width: '100%', height: '100%' }}
                  onInit={setReactFlowInstance}
                >
                  <MiniMap
                    nodeColor={(node) => {
                      return node.data.status === 'approved'
                        ? '#10b981'
                        : node.data.status === 'submitted'
                          ? '#3b82f6'
                          : node.data.status === 'under_review'
                            ? '#f59e0b'
                            : node.data.status === 'needs_revision'
                              ? '#f97316'
                              : '#9ca3af';
                    }}
                    zoomable
                    pannable
                  />
                  <Controls />
                  <Background color="#aaa" gap={16} />

                  <Panel
                    position="top-right"
                    className="bg-white dark:bg-gray-800 p-2 rounded shadow-md"
                  >
                    <div className="text-xs font-medium mb-1">Legend</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                        <span>Approved</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                        <span>Submitted</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                        <span>Under Review</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
                        <span>Needs Revision</span>
                      </div>
                    </div>
                  </Panel>
                </ReactFlow>
              </CardContent>
            </Card>

            {/* Node Details Panel */}
            {selectedNode && (
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg rounded-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Version Details</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          selectedNode.data.status === 'approved'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : selectedNode.data.status === 'submitted'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : selectedNode.data.status === 'under_review'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                : selectedNode.data.status === 'needs_revision'
                                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }
                      >
                        {selectedNode.data.status.replace('_', ' ')}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">
                        Form Name
                      </Label>
                      <p className="text-gray-900 dark:text-gray-100 font-medium">
                        {selectedNode.data.label}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">
                        Contributor
                      </Label>
                      <p className="text-gray-900 dark:text-gray-100">
                        {selectedNode.data.contributor || 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">
                        Version
                      </Label>
                      <p className="text-gray-900 dark:text-gray-100">
                        v{selectedNode.data.version}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Date</Label>
                      <p className="text-gray-900 dark:text-gray-100">
                        {selectedNode.data.timestamp.toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {selectedNode.data.changes && (
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">
                        Changes
                      </Label>
                      <div className="mt-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                        <p className="text-gray-900 dark:text-gray-100">
                          {selectedNode.data.changes}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedNode.data.comment && (
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">
                        Moderator Comment
                      </Label>
                      <div className="mt-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                        <p className="text-gray-900 dark:text-gray-100">
                          {selectedNode.data.comment}
                        </p>
                        {selectedNode.data.moderator && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            - By {selectedNode.data.moderator}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'edit' && (
                    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="space-y-2">
                        <Label
                          htmlFor="comment"
                          className="text-gray-700 dark:text-gray-300"
                        >
                          Add Comment
                        </Label>
                        <Textarea
                          id="comment"
                          placeholder="Add your comment here..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={handleAddComment}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" /> Add Comment
                        </Button>

                        <Button onClick={handleAddVersion} variant="outline">
                          <Plus className="h-4 w-4 mr-2" /> Create New Version
                        </Button>

                        <Button variant="outline" className="flex items-center">
                          <Copy className="h-4 w-4 mr-2" /> Duplicate
                        </Button>

                        <Select
                          value={selectedNode.data.status}
                          onValueChange={handleStatusChange}
                        >
                          <SelectTrigger className="w-auto bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                            <SelectValue placeholder="Change Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="submitted">Submitted</SelectItem>
                            <SelectItem value="under_review">Under Review</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="needs_revision">
                              Needs Revision
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
