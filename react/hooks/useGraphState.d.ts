import { FlowGraph } from 'geo-sankey';
export type GraphAction = {
    type: 'set';
    next: FlowGraph | ((g: FlowGraph) => FlowGraph);
    history: boolean;
} | {
    type: 'undo';
} | {
    type: 'redo';
} | {
    type: 'pushHistory';
    snapshot: FlowGraph;
};
export interface UseGraphState {
    graph: FlowGraph;
    setGraph: (next: FlowGraph | ((g: FlowGraph) => FlowGraph)) => void;
    pushGraph: (next: FlowGraph | ((g: FlowGraph) => FlowGraph)) => void;
    pushHistory: (snapshot: FlowGraph) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    pastLen: number;
    futureLen: number;
    dispatch: React.Dispatch<GraphAction>;
}
export declare function useGraphState(initial: FlowGraph | (() => FlowGraph)): UseGraphState;
