import React, { useRef, useEffect } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import * as d3 from 'd3-force-3d';

const types = ['site', 'artifact', 'period', 'person'];

const randomNode = (id) => ({
    id: `node-${id}`,
    val: Math.ceil(Math.random() * 3),
    type: types[Math.floor(Math.random() * types.length)],
    x: (Math.random() - 0.5) * 500,
    y: (Math.random() - 0.5) * 500,
    z: (Math.random() - 0.5) * 500,
});

const NUM_NODES = 80;
const NUM_LINKS = 300;

const nodes = Array.from({ length: NUM_NODES }, (_, i) => randomNode(i + 1));

const links = [];
const existingLinks = new Set();

while (links.length < NUM_LINKS) {
    const sourceIdx = Math.floor(Math.random() * NUM_NODES);
    const targetIdx = Math.floor(Math.random() * NUM_NODES);
    if (sourceIdx !== targetIdx) {
        const source = nodes[sourceIdx].id;
        const target = nodes[targetIdx].id;
        const key = `${source}-${target}`;
        if (!existingLinks.has(key)) {
            existingLinks.add(key);
            links.push({ source, target });
        }
    }
}

const graphData = { nodes, links };

export function GraphDemoSection() {
    const fgRef = useRef();
    const cameraAngle = useRef(0);
    const boxSize = 250;

    useEffect(() => {
        if (!fgRef.current) return;

        fgRef.current.d3Force('charge')?.strength(-120);
        fgRef.current.d3Force('collision', d3.forceCollide(6));

        const bloomPass = new UnrealBloomPass();
        bloomPass.strength = 1.5;
        bloomPass.radius = 0.9;
        bloomPass.threshold = 0.1;
        fgRef.current.postProcessingComposer().addPass(bloomPass);
    }, []);

    const wrap = (value, min, max) => {
        const range = max - min;
        return ((value - min) % range + range) % range + min;
    };

    const onFrame = () => {
        const fg = fgRef.current;
        if (!fg) return;

        fg.graphData().nodes.forEach(node => {
            node.x = wrap(node.x, -boxSize, boxSize);
            node.y = wrap(node.y, -boxSize, boxSize);
            node.z = wrap(node.z, -boxSize, boxSize);

            if (node.__threeObj) {
                const t = Date.now() / 400 + node.id.length * 100;
                const s = 1 + 0.12 * Math.sin(t);
                node.__threeObj.scale.set(s, s, s);
            }
        });

        // Smooth orbiting camera
        cameraAngle.current += 0.002;
        const angle = cameraAngle.current;
        const r = 600;
        fg.cameraPosition(
            { x: r * Math.sin(angle), y: r * 0.1, z: r * Math.cos(angle) },
            { x: 0, y: 0, z: 0 },
            0.02
        );
    };

    const getColorByType = (type) => {
        switch (type) {
            case 'site': return '#ff7f0e';
            case 'artifact': return '#1f77b4';
            case 'period': return '#2ca02c';
            case 'person': return '#d62728';
            default: return '#aaa';
        }
    };

    return (
        <div style={{ height: '100vh', width: '100vw', background: '#111' }}>
            <ForceGraph3D
                ref={fgRef}
                graphData={graphData}
                width={window.innerWidth}
                height={window.innerHeight}
                backgroundColor="#111"
                minZoom={0.2}
                maxZoom={14}
                showNavInfo={false}
                enableNodeDrag={true}
                nodeResolution={12}
                linkResolution={8}
                nodeRelSize={1.5}
                nodeOpacity={0.8}
                linkOpacity={0.25}
                linkDirectionalParticles={4}
                linkDirectionalParticleWidth={1}
                linkDirectionalParticleSpeed={() => 0.01}
                nodeAutoColorBy="type"
                nodeLabel={node => `${node.id} (${node.type})`}
                nodeThreeObject={node => {
                    const geom = new THREE.SphereGeometry(4, 16, 16);
                    const color = getColorByType(node.type);
                    const mat = new THREE.MeshStandardMaterial({
                        color,
                        emissive: new THREE.Color(color),
                        emissiveIntensity: 0.5,
                        roughness: 0.6,
                        metalness: 0.2,
                    });
                    const mesh = new THREE.Mesh(geom, mat);
                    node.__threeObj = mesh;
                    return mesh;
                }}
                onFrame={onFrame}
            />
        </div>
    );
}
