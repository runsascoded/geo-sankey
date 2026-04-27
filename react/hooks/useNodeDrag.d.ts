import { UseGraphState } from './useGraphState';
import { UseGraphSelection } from './useGraphSelection';
export interface UseNodeDrag {
    /** Pass as `onMouseDown` to MapGL. */
    onDragStart: (e: any) => void;
    /** Node id currently being dragged, or null. */
    dragging: string | null;
    /** Props to spread on MapGL: `{ dragPan: !dragging }`. */
    dragPan: boolean;
}
export declare function useNodeDrag(mapRef: React.RefObject<any>, gs: UseGraphState, sel: UseGraphSelection): UseNodeDrag;
