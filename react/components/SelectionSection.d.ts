import { FlowGraph, GFlowNode, GFlowEdge } from 'geo-sankey';
export type SelectionRef = {
    type: 'node';
    id: string;
} | {
    type: 'edge';
    from: string;
    to: string;
};
export type NodeRole = 'source' | 'sink' | 'split' | 'merge' | 'through' | 'isolated';
interface Props {
    graph: FlowGraph;
    selections: SelectionRef[];
    selectedNodes: GFlowNode[];
    selectedEdges: GFlowEdge[];
    resolvedWeights: Map<string, number>;
    singlePoly: boolean;
    nodeRoleOf: (id: string) => NodeRole;
    aggEdge: (k: 'color' | 'opacity' | 'widthScale', fromStyle: true) => string | number | undefined;
    updateNode: (id: string, patch: Partial<{
        pos: [number, number];
        bearing: number;
        label: string;
        velocity: number;
    }>) => void;
    renameNode: (oldId: string, newId: string) => void;
    deleteNode: (id: string) => void;
    addEdge: (from: string, to: string) => void;
    deleteEdge: (from: string, to: string) => void;
    reverseEdge: (from: string, to: string) => void;
    setEdgeSource: (id: string | null) => void;
    setSelections: (next: SelectionRef[] | ((prev: SelectionRef[]) => SelectionRef[])) => void;
    applyEdgeStyle: (patch: Partial<{
        color: string;
        opacity: number;
        widthScale: number;
    }>) => void;
    applyEdgeWeight: (weight: number | 'auto') => void;
}
export default function SelectionSection({ graph, selectedNodes, selectedEdges, resolvedWeights, singlePoly, nodeRoleOf, aggEdge, updateNode, renameNode, deleteNode, addEdge, deleteEdge, reverseEdge, setEdgeSource, setSelections, applyEdgeStyle, applyEdgeWeight, }: Props): import("react/jsx-runtime").JSX.Element;
export {};
