import { UseGraphSelection } from './useGraphSelection';
import { UseGraphMutations } from './useGraphMutations';
export interface UseMapInteraction {
    onClick: (e: any) => void;
    onDblClick: (e: any) => void;
    onHover: (e: any) => void;
    tooltip: {
        x: number;
        y: number;
        text: string;
    } | null;
    cursor: {
        x: number;
        y: number;
    } | null;
    edgeSource: string | null;
    setEdgeSource: (id: string | null) => void;
    interactiveLayerIds: string[];
}
export declare function useMapInteraction(mapRef: React.RefObject<any>, sel: UseGraphSelection, mut: UseGraphMutations, opts?: {
    /** Extra layer IDs to include in interactiveLayerIds. */
    extraInteractiveLayers?: string[];
}): UseMapInteraction;
