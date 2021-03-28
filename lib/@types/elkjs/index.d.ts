declare module 'elkjs' {
    interface Graph {
        id: string;
        children: Cell[];
        edges: Edge[];
        width?: number;
        height?: number;
    }

    interface Port {
        id: string;
        width: number;
        height: number;
        x?: number;
        y?: number;
        labels?: Label[];
    }

    interface Segment {
        startPoint: WirePoint;
        endPoint: WirePoint;
        bendPoints: WirePoint[];
    }

    interface Edge {
        id: string;
        source: string;
        sourcePort: string;
        target: string;
        targetPort: string;
        layoutOptions?: ElkLayoutOptions;
        junctionPoints?: WirePoint[];
        bendPoints?: WirePoint[];
        sections?: Segment[];
    }

    interface ElkLayoutOptions {
        [option: string]: any;
    }

    interface Cell {
        id: string;
        width: number;
        height: number;
        ports: Port[];
        layoutOptions?: ElkLayoutOptions;
        labels?: Label[];
        x?: number;
        y?: number;
    }

    interface Label {
        id: string;
        text: string;
        x: number;
        y: number;
        height: number;
        width: number;
    }

    interface WirePoint {
        x: number;
        y: number;
    }

    interface ElkOptions {
        layoutOptions: ElkLayoutOptions;
    }

    class ELK {
        public layout(Graph, ElkOptions): Promise<Graph>;
    }
    export = ELK;
}
