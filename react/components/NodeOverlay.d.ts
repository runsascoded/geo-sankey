interface Props {
    nodeId: string;
    bearing: number;
    pos: [number, number];
    velocity?: number;
    refLat: number;
    mapRef: React.RefObject<any>;
    /** Called once at the start of a drag (capture snapshot for undo). */
    onBeginDrag: () => void;
    /** Transient bearing+velocity update during drag (no history push). */
    onDragTransient: (bearing: number, velocity: number | undefined) => void;
    /** Reset velocity to auto (dbl-click). */
    onResetVelocity: () => void;
}
export default function NodeOverlay({ bearing, pos, velocity, refLat, mapRef, onBeginDrag, onDragTransient, onResetVelocity }: Props): import("react/jsx-runtime").JSX.Element;
export {};
