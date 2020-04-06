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
        width?: number;
        height?: number;
        ports: Port[];
        layoutOptions?: LayoutOptions;
        labels?: Label[];
        x?: number;
        y?: number;
        children?: Cell[];
        edges?: Edge[];
    }

    export interface Graph {
        id: string;
        children: Cell[];
        edges: Edge[];
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
        layoutOptions?: LayoutOptions;
    }

    export interface Section {
        id?: string;
        startPoint: WirePoint;
        endPoint: WirePoint;
        bendPoints?: WirePoint[];
    }

    export interface Edge {
        id: string;
        source: string;
        sourcePort: string;
        target: string;
        targetPort: string;
        layoutOptions?: LayoutOptions;
        junctionPoints?: WirePoint[];
        bendPoints?: WirePoint[];
        sections?: Section[];
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
    }
}
export function buildElkGraph(module: FlatModule): ElkModel.Graph {
    const children: ElkModel.Cell[] = module.nodes.map((n) => {
        return n.buildElkChild();
    });
    ElkModel.edgeIndex = 0;
    ElkModel.dummyNum = 0;
    const edges: ElkModel.Edge[] = _.flatMap(module.wires, (w) => {
        // at least one driver and at least one rider and no laterals
        if (w.drivers.length > 0 && w.riders.length > 0 && w.laterals.length === 0) {
            const ret: ElkModel.Edge[] = [];
            route(w.drivers, w.riders, ret, module.moduleName);
            return ret;
            // at least one driver or rider and at least one lateral
        } else if (w.drivers.concat(w.riders).length > 0 && w.laterals.length > 0) {
            const ret: ElkModel.Edge[] = [];
            route(w.drivers, w.laterals, ret, module.moduleName);
            route(w.laterals, w.riders, ret, module.moduleName);
            return ret;
            // at least two drivers and no riders
        } else if (w.riders.length === 0 && w.drivers.length > 1) {
            // create a dummy node and add it to children
            const dummyId: string = addDummy(children, module.moduleName);
            ElkModel.dummyNum += 1;
            const dummyEdges: ElkModel.Edge[] = w.drivers.map((driver) => {
                const sourceParentKey: string = driver.parentNode.Key;
                const id: string = module.moduleName + '.e' + String(ElkModel.edgeIndex);
                ElkModel.edgeIndex += 1;
                const d: ElkModel.Edge = {
                    id,
                    source: module.moduleName + '.' + sourceParentKey,
                    sourcePort: module.moduleName + '.' + sourceParentKey + '.' + driver.key,
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
            const dummyId: string = addDummy(children, module.moduleName);
            ElkModel.dummyNum += 1;
            const dummyEdges: ElkModel.Edge[] = w.riders.map((rider) => {
                const sourceParentKey: string = rider.parentNode.Key;
                const id: string = module.moduleName + '.e' + String(ElkModel.edgeIndex);
                ElkModel.edgeIndex += 1;
                const edge: ElkModel.Edge = {
                    id,
                    source: dummyId,
                    sourcePort: dummyId + '.p',
                    target: module.moduleName + '.' + sourceParentKey,
                    targetPort: module.moduleName + '.' + sourceParentKey + '.' + rider.key,
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
                const id: string = module.moduleName + '.e' + String(ElkModel.edgeIndex);
                ElkModel.edgeIndex += 1;
                const edge: ElkModel.Edge = {
                    id,
                    source: module.moduleName + '.' + sourceParentKey,
                    sourcePort: module.moduleName + '.' + sourceParentKey + '.' + source.key,
                    target: module.moduleName + '.' + lateralParentKey,
                    targetPort: module.moduleName + '.' + lateralParentKey + '.' + lateral.key,
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

function addDummy(children: ElkModel.Cell[], moduleName: string) {
    const dummyId: string = moduleName + '.$d_' + String(ElkModel.dummyNum);
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

function route(sourcePorts, targetPorts, edges: ElkModel.Edge[], moduleName: string) {
    const newEdges: ElkModel.Edge[] = (_.flatMap(sourcePorts, (sourcePort) => {
        const sourceParentKey: string = sourcePort.parentNode.key;
        const sourceKey: string = moduleName + '.' + sourceParentKey + '.' + sourcePort.key;
        return targetPorts.map((targetPort) => {
            const targetParentKey: string = targetPort.parentNode.key;
            const targetKey: string = moduleName + '.' + targetParentKey + '.' + targetPort.key;
            const id: string = moduleName + '.e' + ElkModel.edgeIndex;
            const edge: ElkModel.Edge = {
                id,
                source: moduleName + '.' + sourceParentKey,
                sourcePort: sourceKey,
                target: moduleName + '.' + targetParentKey,
                targetPort: targetKey,
            };
            ElkModel.wireNameLookup[id] = targetPort.wire.netName;
            if (sourcePort.parentNode.type !== '$dff') {
                edge.layoutOptions = { 'org.eclipse.elk.layered.priority.direction': 10 };
            }
            ElkModel.edgeIndex += 1;
            return edge;
        });
    }));
    edges.push.apply(edges, newEdges);
}
