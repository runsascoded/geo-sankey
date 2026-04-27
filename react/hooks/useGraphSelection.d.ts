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
export declare function selRefEq(a: SelectionRef, b: SelectionRef): boolean;
export interface UseGraphSelection {
    selections: SelectionRef[];
    setSelections: (next: SelectionRef[] | ((prev: SelectionRef[]) => SelectionRef[])) => void;
    selection: SelectionRef | null;
    toggleOrReplace: (ref: SelectionRef, shift: boolean) => void;
    selectedNodes: GFlowNode[];
    selectedEdges: GFlowEdge[];
    selectedNodeIds: string[];
    selectedEdgeIds: string[];
    resolvedWeights: Map<string, number>;
    nodeRoleOf: (id: string) => NodeRole;
    aggEdge: (k: string, fromStyle?: boolean) => unknown;
}
export declare function useGraphSelection(graph: FlowGraph, opts?: {
    persist?: 'sessionStorage' | 'none';
}): UseGraphSelection;
