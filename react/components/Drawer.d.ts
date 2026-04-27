import { ReactNode } from 'react';
export interface DrawerSection {
    id: string;
    title: string;
    children: ReactNode;
    /** Default open state. */
    defaultOpen?: boolean;
}
interface Props {
    sections: DrawerSection[];
    /** Anchor side. */
    side?: 'left' | 'right';
    /** Default collapsed state for the whole drawer. */
    defaultCollapsed?: boolean;
}
export default function Drawer({ sections, side, defaultCollapsed }: Props): import("react/jsx-runtime").JSX.Element;
/** A labeled row inside a drawer section. */
export declare function Row({ label, children, align }: {
    label: string;
    children: ReactNode;
    align?: 'start' | 'center';
}): import("react/jsx-runtime").JSX.Element;
/** A range slider with label + numeric display. */
export declare function Slider({ value, onChange, min, max, step, fmt, }: {
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step: number;
    fmt?: (v: number) => string;
}): import("react/jsx-runtime").JSX.Element;
/** A checkbox. */
export declare function Check({ label, checked, onChange }: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}): import("react/jsx-runtime").JSX.Element;
export {};
