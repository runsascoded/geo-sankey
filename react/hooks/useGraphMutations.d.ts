import { UseGraphState } from './useGraphState';
import { UseGraphSelection } from './useGraphSelection';
export interface UseGraphMutations {
    renameNode: (oldId: string, newId: string) => void;
    duplicateNodes: (ids: string[]) => void;
    updateNode: (id: string, patch: Partial<{
        pos: [number, number];
        bearing: number;
        label: string;
        velocity: number;
    }>) => void;
    addNode: (pos: [number, number]) => void;
    deleteNode: (id: string) => void;
    addEdge: (from: string, to: string) => void;
    updateEdge: (from: string, to: string, patch: Partial<{
        weight: number | 'auto';
    }>) => void;
    updateEdgeStyle: (from: string, to: string, patch: Partial<{
        color: string;
        opacity: number;
        widthScale: number;
    }>) => void;
    deleteEdge: (from: string, to: string) => void;
    reverseEdge: (from: string, to: string) => void;
    splitEdgeAt: (from: string, to: string, pos: [number, number]) => void;
    applyEdgeStyle: (patch: Partial<{
        color: string;
        opacity: number;
        widthScale: number;
    }>) => void;
    applyEdgeWeight: (weight: number | 'auto') => void;
}
export declare function useGraphMutations(gs: UseGraphState, sel: UseGraphSelection): UseGraphMutations;
