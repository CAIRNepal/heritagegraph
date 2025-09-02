'use client';

import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, ZoomIn, ZoomOut, RefreshCw, Info, Network } from 'lucide-react';

cytoscape.use(coseBilkent);

export default function GraphPage() {
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [searchDepth, setSearchDepth] = useState(1);
  const [darkMode, setDarkMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [activeTab, setActiveTab] = useState('explore');
  const [layoutAlgorithm, setLayoutAlgorithm] = useState('cose-bilkent');

  const elements = [
    {
      data: {
        id: 'Nepal',
        type: 'country',
        description: 'Federal democratic republic in South Asia',
      },
    },
    {
      data: {
        id: 'Kathmandu',
        type: 'capital',
        description: 'Capital and largest city of Nepal',
      },
    },
    {
      data: {
        id: 'Rukum',
        type: 'district',
        description: 'District in Western Nepal, part of Karnali Province',
      },
    },
    {
      data: {
        id: 'Heritage',
        type: 'concept',
        description: 'Cultural heritage and historical sites',
      },
    },
    {
      data: {
        id: 'Culture',
        type: 'concept',
        description: 'Rich cultural traditions and practices',
      },
    },
    {
      data: {
        id: 'Himalayas',
        type: 'mountain',
        description: "Mountain range containing world's highest peaks",
      },
    },
    {
      data: {
        id: 'Lumbini',
        type: 'site',
        description: 'Birthplace of Gautama Buddha',
      },
    },
    {
      data: {
        id: 'Newari',
        type: 'culture',
        description: 'Indigenous culture of Kathmandu Valley',
      },
    },
    {
      data: {
        id: 'Patan',
        type: 'city',
        description: 'City known for its Durbar Square and ancient architecture',
      },
    },
    {
      data: {
        id: 'Bhaktapur',
        type: 'city',
        description: 'Historical city known for its pottery and weaving',
      },
    },
    { data: { source: 'Nepal', target: 'Kathmandu', relation: 'has capital' } },
    { data: { source: 'Nepal', target: 'Rukum', relation: 'contains' } },
    { data: { source: 'Nepal', target: 'Heritage', relation: 'rich in' } },
    { data: { source: 'Heritage', target: 'Culture', relation: 'encompasses' } },
    { data: { source: 'Nepal', target: 'Himalayas', relation: 'home to' } },
    { data: { source: 'Nepal', target: 'Lumbini', relation: 'contains' } },
    { data: { source: 'Kathmandu', target: 'Newari', relation: 'center of' } },
    { data: { source: 'Lumbini', target: 'Heritage', relation: 'UNESCO site' } },
    { data: { source: 'Kathmandu', target: 'Patan', relation: 'connected to' } },
    { data: { source: 'Kathmandu', target: 'Bhaktapur', relation: 'connected to' } },
    { data: { source: 'Patan', target: 'Heritage', relation: 'known for' } },
    { data: { source: 'Bhaktapur', target: 'Heritage', relation: 'known for' } },
  ];

  // Initialize the graph
  useEffect(() => {
    if (!cyRef.current) return;

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(isDark);

    const nodeColor = isDark ? '#4ade80' : '#16a34a';
    const edgeColor = isDark ? '#9ca3af' : '#6b7280';
    const bgColor = isDark ? '#1f2937' : '#ffffff';
    const textColor = isDark ? '#f3f4f6' : '#111827';

    cyInstance.current = cytoscape({
      container: cyRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': nodeColor,
            label: 'data(id)',
            color: textColor,
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '14px',
            'font-weight': '600',
            'text-outline-width': 2,
            'text-outline-color': bgColor,
            width: 'mapData(degree, 0, 5, 40, 100)',
            height: 'mapData(degree, 0, 5, 40, 100)',
          },
        },
        {
          selector: 'node[type="country"]',
          style: {
            shape: 'star',
            'background-color': isDark ? '#f59e0b' : '#d97706',
          },
        },
        {
          selector: 'node[type="capital"]',
          style: {
            shape: 'hexagon',
            'background-color': isDark ? '#3b82f6' : '#2563eb',
          },
        },
        {
          selector: 'node[type="concept"]',
          style: {
            shape: 'ellipse',
            'background-color': isDark ? '#8b5cf6' : '#7c3aed',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 3,
            'line-color': edgeColor,
            'target-arrow-color': edgeColor,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(relation)',
            color: textColor,
            'font-size': '12px',
            'text-outline-width': 2,
            'text-outline-color': bgColor,
            'text-background-color': bgColor,
            'text-background-opacity': 1,
            'text-background-padding': '4px',
          },
        },
        {
          selector: ':selected',
          style: {
            'background-color': '#ef4444',
            'line-color': '#ef4444',
            'target-arrow-color': '#ef4444',
            'source-arrow-color': '#ef4444',
          },
        },
        {
          selector: '.highlighted',
          style: {
            'border-width': 2,
            'border-style': 'dashed',
            'border-color': '#ef4444',
          },
        },
      ],
      layout: {
        name: 'cose-bilkent',
        animate: true,
        animationDuration: 1000,
        randomize: true,
        idealEdgeLength: 100,
        nodeOverlap: 20,
      },
    });

    // Set background color
    cyRef.current.style.backgroundColor = bgColor;

    // Click-to-focus
    cyInstance.current.on('tap', 'node', (evt: any) => {
      const node = evt.target;
      setSelectedNode({
        id: node.id(),
        type: node.data('type'),
        description: node.data('description'),
        connections: node.neighborhood().map((n: any) => n.id()),
      });
    });

    // Hover highlight
    cyInstance.current.on('mouseover', 'node', (evt: any) => {
      const node = evt.target;
      node.neighborhood().addClass('highlighted');
    });
    cyInstance.current.on('mouseout', 'node', (evt: any) => {
      cyInstance.current.elements().removeClass('highlighted');
    });

    // Handle zoom events
    cyInstance.current.on('zoom', (evt: any) => {
      setZoomLevel(Math.round(evt.cy.zoom() * 100));
    });

    const handleResize = () => {
      if (cyInstance.current) {
        cyInstance.current.resize();
        applyLayout();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (cyInstance.current) {
        cyInstance.current.destroy();
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Update graph colors when dark mode changes
  useEffect(() => {
    if (!cyInstance.current || !cyRef.current) return;

    const nodeColor = darkMode ? '#4ade80' : '#16a34a';
    const edgeColor = darkMode ? '#9ca3af' : '#6b7280';
    const bgColor = darkMode ? '#1f2937' : '#ffffff';
    const textColor = darkMode ? '#f3f4f6' : '#111827';

    // Update node styles
    cyInstance.current
      .style()
      .selector('node')
      .style({
        'background-color': nodeColor,
        color: textColor,
        'text-outline-color': bgColor,
      })
      .update();

    cyInstance.current
      .style()
      .selector('node[type="country"]')
      .style({
        'background-color': darkMode ? '#f59e0b' : '#d97706',
      })
      .update();

    cyInstance.current
      .style()
      .selector('node[type="capital"]')
      .style({
        'background-color': darkMode ? '#3b82f6' : '#2563eb',
      })
      .update();

    cyInstance.current
      .style()
      .selector('node[type="concept"]')
      .style({
        'background-color': darkMode ? '#8b5cf6' : '#7c3aed',
      })
      .update();

    // Update edge styles
    cyInstance.current
      .style()
      .selector('edge')
      .style({
        'line-color': edgeColor,
        'target-arrow-color': edgeColor,
        color: textColor,
        'text-outline-color': bgColor,
        'text-background-color': bgColor,
      })
      .update();

    // Update background
    cyRef.current!.style.backgroundColor = bgColor;
  }, [darkMode]);

  const handleSearch = () => {
    if (!cyInstance.current || !searchQuery.trim()) return;

    cyInstance.current.elements().removeClass('highlighted');
    setSearchResults([]);

    let nodes = cyInstance.current
      .nodes()
      .filter((n: any) => n.id().toLowerCase().includes(searchQuery.toLowerCase()));

    // Expand search depth
    if (searchDepth > 1) {
      for (let i = 1; i < searchDepth; i++) {
        nodes = nodes.union(nodes.neighborhood());
      }
    }

    nodes.addClass('highlighted');
    if (nodes.length > 0) {
      cyInstance.current.animate({
        center: { eles: nodes[0] },
        zoom: 2,
        duration: 1000,
      });
    }

    setSearchResults(nodes.map((n: any) => ({ id: n.id(), type: n.data('type') })));
  };

  const resetLayout = () => {
    if (cyInstance.current) {
      cyInstance.current.elements().removeClass('highlighted');
      applyLayout();
      setSearchQuery('');
      setSearchResults([]);
      setSelectedNode(null);
    }
  };

  const applyLayout = () => {
    if (cyInstance.current) {
      cyInstance.current
        .layout({
          name: layoutAlgorithm,
          animate: true,
          animationDuration: 1000,
          randomize: true,
          idealEdgeLength: 100,
          nodeOverlap: 20,
        })
        .run();
    }
  };

  const focusOnNode = (nodeId: string) => {
    if (cyInstance.current) {
      const node = cyInstance.current.$id(nodeId);
      if (node) {
        cyInstance.current.animate({
          center: { eles: node },
          zoom: 2,
          duration: 1000,
        });
        setSelectedNode({
          id: node.id(),
          type: node.data('type'),
          description: node.data('description'),
          connections: node.neighborhood().map((n: any) => n.id()),
        });
      }
    }
  };

  const zoomIn = () => {
    if (cyInstance.current) {
      cyInstance.current.zoom(cyInstance.current.zoom() * 1.2);
    }
  };

  const zoomOut = () => {
    if (cyInstance.current) {
      cyInstance.current.zoom(cyInstance.current.zoom() * 0.8);
    }
  };

  const resetZoom = () => {
    if (cyInstance.current) {
      cyInstance.current.animate({
        zoom: 1,
        duration: 500,
      });
    }
  };

  return (
    <div className="min-h-screen md:p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4 md:space-y-6">
          <Card className=" shadow-lg rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Network className="" /> Nepal Knowledge Graph
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    Explore relationships between entities
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Label
                    htmlFor="dark-mode"
                    className="text-sm text-gray-600 dark:text-gray-400"
                  >
                    Dark
                  </Label>
                  <Switch
                    id="dark-mode"
                    checked={darkMode}
                    onCheckedChange={setDarkMode}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="explore">Explore</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="explore" className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="search"
                      className="text-gray-700 dark:text-gray-300"
                    >
                      Search Nodes
                    </Label>
                    <div className="flex space-x-2">
                      <Input
                        id="search"
                        placeholder="Enter node name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                      />
                      <Button onClick={handleSearch} size="icon" className="">
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label
                        htmlFor="depth"
                        className="text-gray-700 dark:text-gray-300"
                      >
                        Search Depth: {searchDepth}
                      </Label>
                    </div>
                    <Slider
                      id="depth"
                      min={1}
                      max={5}
                      step={1}
                      value={[searchDepth]}
                      onValueChange={(value) => setSearchDepth(value[0])}
                      className="py-2"
                    />
                  </div>

                  <Button onClick={resetLayout} className="w-full ">
                    <RefreshCw className="h-4 w-4 mr-2" /> Reset Layout
                  </Button>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="layout"
                      className="text-gray-700 dark:text-gray-300"
                    >
                      Layout Algorithm
                    </Label>
                    <Select value={layoutAlgorithm} onValueChange={setLayoutAlgorithm}>
                      <SelectTrigger
                        id="layout"
                        className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                      >
                        <SelectValue placeholder="Select layout" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cose-bilkent">Force-Directed</SelectItem>
                        <SelectItem value="grid">Grid</SelectItem>
                        <SelectItem value="circle">Circle</SelectItem>
                        <SelectItem value="concentric">Concentric</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-700 dark:text-gray-300">
                      Zoom: {zoomLevel}%
                    </Label>
                    <div className="flex space-x-2">
                      <Button onClick={zoomOut} variant="outline" className="flex-1">
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <Button onClick={resetZoom} variant="outline" className="flex-1">
                        Reset
                      </Button>
                      <Button onClick={zoomIn} variant="outline" className="flex-1">
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="pt-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Legend
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <div className="w-4 h-4 rounded-full bg-amber-500 mr-2"></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Country
                        </span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Capital
                        </span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-4 rounded-full bg-purple-500 mr-2"></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Concept
                        </span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Other
                        </span>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <Card className=" shadow-lg rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  Search Results ({searchResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors"
                      onClick={() => focusOnNode(result.id)}
                    >
                      <span className="">{result.id}</span>
                      <Badge
                        variant="outline"
                        className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                      >
                        {result.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Node Details */}
          {selectedNode && (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg rounded-xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-gray-800 dark:text-gray-100">
                    Node Details
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                  >
                    {selectedNode.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ID
                  </h4>
                  <p className="text-gray-900 dark:text-gray-100">{selectedNode.id}</p>
                </div>

                {selectedNode.description && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </h4>
                    <p className="text-gray-900 dark:text-gray-100">
                      {selectedNode.description}
                    </p>
                  </div>
                )}

                {selectedNode.connections && selectedNode.connections.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Connections
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedNode.connections.map((conn: string, i: number) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                          onClick={() => focusOnNode(conn)}
                        >
                          {conn}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Graph Visualization */}
        <div className="lg:col-span-3">
          <Card className="h-[70vh] shadow-lg rounded-xl overflow-hidden border-gray-200 dark:border-gray-700">
            <CardContent className="h-full p-0 bg-white dark:bg-gray-800">
              <div ref={cyRef} className="w-full h-full" />
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="p-4 flex items-center">
                <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-3 mr-4">
                  <Network className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total Nodes
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    8
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="p-4 flex items-center">
                <div className="rounded-full bg-green-100 dark:bg-green-900 p-3 mr-4">
                  <Info className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Relationships
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    12
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="p-4 flex items-center">
                <div className="rounded-full bg-purple-100 dark:bg-purple-900 p-3 mr-4">
                  <Search className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Node Types</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    5
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
