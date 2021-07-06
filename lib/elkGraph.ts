import { FlatModule } from './FlatModule';
import _ = require('lodash');

export namespace ElkModel {
    interface WireNameLookup {
        [edgeId: string]: string;
    }
    export let wireNameLookup: WireNameLookup = {};
    export let dummyNum: number = 0;
    export let edgeIndex: number = 0;

    export interface WirePoint {
        x: number;
        y: number;
    }

    export interface Cell {
        id: string;
        width: number;
        height: number;
        ports: Port[];
        layoutOptions?: LayoutOptions;
        labels?: Label[];
        x?: number;
        y?: number;
    }

    export interface Graph {
        id: string;
        children: Cell[];
        edges: (Edge|ExtendedEdge)[];
        width?: number;
        height?: number;
    }

    export interface Port {
        id: string;
        width: number;
        height: number;
        x?: number;
        y?: number;
        labels?: Label[];
    }

    export interface Section {
        id?: string;
        startPoint: WirePoint;
        endPoint: WirePoint;
        bendPoints?: WirePoint[];
    }

    export interface Edge {
        id: string;
        labels?: Label[];
        source: string;
        sourcePort: string;
        target: string;
        targetPort: string;
        layoutOptions?: LayoutOptions;
        junctionPoints?: WirePoint[];
        bendPoints?: WirePoint[];
        sections?: Section[];
    }

    export interface ExtendedEdge {
        id: string;
        labels?: Label[];
        sources: [ string ];
        targets: [ string ];
        layoutOptions?: LayoutOptions;
    }

    export interface LayoutOptions {
        [option: string]: any;
    }

    export interface Label {
        id: string;
        text: string;
        x: number;
        y: number;
        height: number;
        width: number;
        layoutOptions?: LayoutOptions;
    }
}
export function buildElkGraph(module: FlatModule): ElkModel.Graph {
    const children: ElkModel.Cell[] = module.nodes.map((n) => {
        return n.buildElkChild();
    });
    ElkModel.edgeIndex = 0;
    ElkModel.dummyNum = 0;
    const edges: ElkModel.Edge[] = _.flatMap(module.wires, (w) => {
        const numWires = w.netName.split(',').length - 2;
        // at least one driver and at least one rider and no laterals
        if (w.drivers.length > 0 && w.riders.length > 0 && w.laterals.length === 0) {
            const ret: ElkModel.Edge[] = [];
            route(w.drivers, w.riders, ret, numWires);
            return ret;
            // at least one driver or rider and at least one lateral
        } else if (w.drivers.concat(w.riders).length > 0 && w.laterals.length > 0) {
            const ret: ElkModel.Edge[] = [];
            route(w.drivers, w.laterals, ret, numWires);
            route(w.laterals, w.riders, ret, numWires);
            return ret;
            // at least two drivers and no riders
        } else if (w.riders.length === 0 && w.drivers.length > 1) {
            // create a dummy node and add it to children
            const dummyId: string = addDummy(children);
            ElkModel.dummyNum += 1;
            const dummyEdges: ElkModel.Edge[] = w.drivers.map((driver) => {
                const sourceParentKey: string = driver.parentNode.Key;
                const id: string = 'e' + String(ElkModel.edgeIndex);
                ElkModel.edgeIndex += 1;
                const d: ElkModel.Edge = {
                    id,
                    source: sourceParentKey,
                    sourcePort: sourceParentKey + '.' + driver.key,
                    target: dummyId,
                    targetPort: dummyId + '.p',
                };
                ElkModel.wireNameLookup[id] = driver.wire.netName;
                return d;
            });

            return dummyEdges;
            // at least one rider and no drivers
        } else if (w.riders.length > 1 && w.drivers.length === 0) {
            // create a dummy node and add it to children
            const dummyId: string = addDummy(children);
            ElkModel.dummyNum += 1;
            const dummyEdges: ElkModel.Edge[] = w.riders.map((rider) => {
                const sourceParentKey: string = rider.parentNode.Key;
                const id: string = 'e' + String(ElkModel.edgeIndex);
                ElkModel.edgeIndex += 1;
                const edge: ElkModel.Edge = {
                    id,
                    source: dummyId,
                    sourcePort: dummyId + '.p',
                    target: sourceParentKey,
                    targetPort: sourceParentKey + '.' + rider.key,
                };
                ElkModel.wireNameLookup[id] = rider.wire.netName;
                return edge;
            });
            return dummyEdges;
        } else if (w.laterals.length > 1) {
            const source = w.laterals[0];
            const sourceParentKey: string = source.parentNode.Key;
            const lateralEdges: ElkModel.Edge[] = w.laterals.slice(1).map((lateral) => {
                const lateralParentKey: string = lateral.parentNode.Key;
                const id: string = 'e' + String(ElkModel.edgeIndex);
                ElkModel.edgeIndex += 1;
                const edge: ElkModel.Edge = {
                    id,
                    source: sourceParentKey,
                    sourcePort: sourceParentKey + '.' + source.key,
                    target: lateralParentKey,
                    targetPort: lateralParentKey + '.' + lateral.key,
                };
                ElkModel.wireNameLookup[id] = lateral.wire.netName;
                return edge;
            });
            return lateralEdges;
        }
        // for only one driver or only one rider, don't create any edges
        return [];
    });
    return {
        id: module.moduleName,
        children,
        edges,
    };
}

function addDummy(children: ElkModel.Cell[]) {
    const dummyId: string = '$d_' + String(ElkModel.dummyNum);
    const child: ElkModel.Cell = {
        id: dummyId,
        width: 0,
        height: 0,
        ports: [{
            id: dummyId + '.p',
            width: 0,
            height: 0,
        }],
        layoutOptions: { 'org.eclipse.elk.portConstraints': 'FIXED_SIDE' },
    };
    children.push(child);
    return dummyId;
}

function route(sourcePorts, targetPorts, edges: ElkModel.Edge[], numWires) {
    const newEdges: ElkModel.Edge[] = (_.flatMap(sourcePorts, (sourcePort) => {
        const sourceParentKey: string = sourcePort.parentNode.key;
        const sourceKey: string = sourceParentKey + '.' + sourcePort.key;
        let edgeLabel: ElkModel.Label[];
        if (numWires > 1) {
            edgeLabel = [{
                id: '',
                text: String(numWires),
                width: 4,
                height: 6,
                x: 0,
                y: 0,
                layoutOptions: {
                    'org.eclipse.elk.edgeLabels.inline': true,
                },
            }];
        }
        return targetPorts.map((targetPort) => {
            const targetParentKey: string = targetPort.parentNode.key;
            const targetKey: string = targetParentKey + '.' + targetPort.key;
            const id: string = 'e' + ElkModel.edgeIndex;
            const edge: ElkModel.ExtendedEdge = {
                id,
                labels: edgeLabel,
                sources: [sourceKey],
                targets: [targetKey],
            };
            ElkModel.wireNameLookup[id] = targetPort.wire.netName;
            if (sourcePort.parentNode.type !== '$dff') {
                edge.layoutOptions = { 'org.eclipse.elk.layered.priority.direction': 10,
                                       'org.eclipse.elk.edge.thickness': (numWires > 1 ? 2 : 1) };
            } else {
                edge.layoutOptions = { 'org.eclipse.elk.edge.thickness': (numWires > 1 ? 2 : 1) };
            }
            ElkModel.edgeIndex += 1;
            return edge;
        });
    }));
    edges.push.apply(edges, newEdges);
}
