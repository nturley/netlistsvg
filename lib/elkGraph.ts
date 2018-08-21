import {FlatModule, Cell, FlatPort} from './FlatModule';
import {findSkinType, getPortsWithPrefix} from './skin';
import _ = require('lodash');

export interface WirePoint {
    x: number;
    y: number;
}

export interface ElkGraph {
    id: string;
    children: ElkCell[];
    edges: ElkEdge[];
    width?: number;
    height?: number;
}

interface ElkPort {
    id: string;
    width: number;
    height: number;
    x?: number;
    y?: number;
    labels?: ElkLabel[];
}

export interface ElkSegment {
    startPoint: WirePoint;
    endPoint: WirePoint;
    bendPoints: WirePoint[];
}

export interface ElkEdge {
    id: string;
    source: string;
    sourcePort: string;
    target: string;
    targetPort: string;
    layoutOptions?: ElkLayoutOptions;
    junctionPoints?: WirePoint[];
    bendPoints?: WirePoint[];
    sections?: ElkSegment[];
}

interface ElkLayoutOptions {
    [option: string]: any;
}

interface ElkOptions {
    layoutOptions: ElkLayoutOptions;
}

export interface ElkCell {
    id: string;
    width: number;
    height: number;
    ports: ElkPort[];
    layoutOptions?: ElkLayoutOptions;
    labels?: ElkLabel[];
    x?: number;
    y?: number;
}

interface ElkLabel {
    text: string;
    x: number;
    y: number;
    height: number;
    width: number;
}

export function buildElkGraph(module: FlatModule): ElkGraph {
    const children: ElkCell[] = module.getNodes().map((n) => {
        return buildElkGraphChild(module.getSkin(), n);
    });
    let i: number = 0;
    let dummies: number = 0;
    const edges: ElkEdge[] = _.flatMap(module.getWires(), (w) => {
        // at least one driver and at least one rider and no laterals
        if (w.drivers.length > 0 && w.riders.length > 0 && w.laterals.length === 0) {
            const ret: ElkEdge[] = route(w.drivers, w.riders, i);
            return ret;
            // at least one driver or rider and at least one lateral
        } else if (w.drivers.concat(w.riders).length > 0 && w.laterals.length > 0) {
            const ret: ElkEdge[] = route(w.drivers, w.laterals, i).concat(route(w.laterals, w.riders, i));
            return ret;
            // at least two drivers and no riders
        } else if (w.riders.length === 0 && w.drivers.length > 1) {
            // create a dummy node and add it to children
            const dummyId: string = addDummy(children, dummies);
            dummies += 1;
            const dummyEdges: ElkEdge[] = w.drivers.map((driver) => {
                const sourceParentKey: string = driver.parentNode.key;
                const id: string = 'e' + String(i);
                i += 1;
                const d: ElkEdge = {
                    id,
                    source: sourceParentKey,
                    sourcePort: sourceParentKey + '.' + driver.key,
                    target: dummyId,
                    targetPort: dummyId + '.p',
                };
                return d;
            });
            return dummyEdges;
            // at least one rider and no drivers
        } else if (w.riders.length > 1 && w.drivers.length === 0) {
            // create a dummy node and add it to children
            const dummyId: string = addDummy(children, dummies);
            dummies += 1;
            const dummyEdges: ElkEdge[] = w.riders.map((rider) => {
                const sourceParentKey: string = rider.parentNode.key;
                const id: string = 'e' + String(i);
                i += 1;
                const edge: ElkEdge = {
                    id,
                    source: dummyId,
                    sourcePort: dummyId + '.p',
                    target: sourceParentKey,
                    targetPort: sourceParentKey + '.' + rider.key,
                };
                return edge;
            });
            return dummyEdges;
        } else if (w.laterals.length > 1) {
            const source = w.laterals[0];
            const sourceParentKey: string = source.parentNode.key;
            const lateralEdges: ElkEdge[] = w.laterals.slice(1).map((lateral) => {
                const lateralParentKey: string = lateral.parentNode.key;
                const id: string = 'e' + String(i);
                i += 1;
                const edge: ElkEdge = {
                    id,
                    source: sourceParentKey,
                    sourcePort: sourceParentKey + '.' + source.key,
                    target: lateralParentKey,
                    targetPort: lateralParentKey + '.' + lateral.key,
                };
                return edge;
            });
            return lateralEdges;
        }
        // for only one driver or only one rider, don't create any edges
        return [];
    });
    return {
        id: module.getName(),
        children,
        edges,
    };
}

// given a module type, build kgraphchild
function buildElkGraphChild(skinData, n: Cell): ElkCell {
    //   labels: [ { text: "n2" } ],
    const template = findSkinType(skinData, n.type);
    const type: string = template[1]['s:type'];
    if (type === 'join' ||
        type === 'split' ||
        type === 'generic') {
        const inPorts: string[] = getPortsWithPrefix(template, 'in');
        const outPorts: string[] = getPortsWithPrefix(template, 'out');
        const allPorts: ElkPort[] = getGenericPortsFrom(n.inputPorts,
            inPorts,
            n.key,
            type,
            'in').concat(
                getGenericPortsFrom(n.outputPorts,
                    outPorts,
                    n.key,
                    type,
                    'out'));
        const cell: ElkCell = {
            id: n.key,
            width: Number(template[1]['s:width']),
            height: Number(getGenericHeight(template, n)),
            ports: allPorts,
            layoutOptions: { 'de.cau.cs.kieler.portConstraints': 'FIXED_POS' },
        };
        if (type === 'generic') {
            cell.labels = [{
                text: n.type,
                x: Number(template[2][1].x),
                y: Number(template[2][1].y),
                height: 11,
                width: (6 * n.type.length),
            }];
        }
        return cell;
    }
    const ports: ElkPort[] = getPortsWithPrefix(template, '').map((p) => {
        return {
            id: n.key + '.' + p[1]['s:pid'],
            width: 0,
            height: 0,
            x: Number(p[1]['s:x']),
            y: Number(p[1]['s:y']),
        };
    });
    const nodeWidth: number = Number(template[1]['s:width']);
    const ret: ElkCell = {
        id: n.key,
        width: nodeWidth,
        height: Number(template[1]['s:height']),
        ports,
        layoutOptions: { 'de.cau.cs.kieler.portConstraints': 'FIXED_POS' },
    };
    if (type === 'inputExt' ||
        type === 'outputExt') {
        ret.labels = [{
            text: n.key,
            x: Number(template[2][1].x) + nodeWidth / 2 - 3 * n.key.length,
            y: Number(template[2][1].y),
            height: 11,
            width: (6 * n.key.length),
        }];
    }
    return ret;
}

function addDummy(children: ElkCell[], dummyNum: number) {
    const dummyId: string = '$d_' + String(dummyNum);
    const child: ElkCell = {
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

function route(sourcePorts, targetPorts, i: number): ElkEdge[] {
    return _.flatMap(sourcePorts, (sourcePort) => {
        const sourceParentKey: string = sourcePort.parentNode.key;
        const sourceKey: string = sourceParentKey + '.' + sourcePort.key;
        return targetPorts.map((targetPort) => {
            const targetParentKey: string = targetPort.parentNode.key;
            const targetKey: string = targetParentKey + '.' + targetPort.key;
            const edge: ElkEdge = {
                id: 'e' + i,
                source: sourceParentKey,
                sourcePort: sourceKey,
                target: targetParentKey,
                targetPort: targetKey,
            };
            if (sourcePort.parentNode.type !== '$dff') {
                edge.layoutOptions = { 'org.eclipse.elk.layered.priority.direction': 10 };
            }
            i += 1;
            return edge;
        });
    });
}

function getGenericPortsFrom(nports: FlatPort[], templatePorts, nkey: string, type: string, dir: string): ElkPort[] {
    return nports.map((p: FlatPort, i: number) => {

        if (i === 0) {
            const ret: ElkPort = {
                id: nkey + '.' + p.key,
                width: 1,
                height: 1,
                x: Number(templatePorts[0][1]['s:x']),
                y: Number(templatePorts[0][1]['s:y']),
            };

            if ((type === 'generic' || type === 'join') && dir === 'in') {
                ret.labels = [{
                    text: p.key,
                    x: Number(templatePorts[0][2][1].x),
                    y: Number(templatePorts[0][2][1].y),
                    width: (6 * p.key.length),
                    height: 11,
                }];
            }

            if ((type === 'generic' || type === 'split') && dir === 'out') {
                ret.labels = [{
                    text: p.key,
                    x: Number(templatePorts[0][2][1].x),
                    y: Number(templatePorts[0][2][1].y),
                    width: (6 * p.key.length),
                    height: 11,
                }];
            }
            return ret;
        } else {
            const gap: number = Number(templatePorts[1][1]['s:y']) - Number(templatePorts[0][1]['s:y']);
            const ret: ElkPort = {
                id: nkey + '.' + p.key,
                width: 1,
                height: 1,
                x: Number(templatePorts[0][1]['s:x']),
                y: (i) * gap + Number(templatePorts[0][1]['s:y']),
            };
            if (type === 'generic') {
                ret.labels = [{
                    text: p.key,
                    x: Number(templatePorts[0][2][1].x),
                    y: Number(templatePorts[0][2][1].y),
                    width: (6 * p.key.length),
                    height: 11,
                }];
            }
            return ret;
        }
    });
}

export function getGenericHeight(template, node) {
    const inPorts = getPortsWithPrefix(template, 'in');
    const outPorts = getPortsWithPrefix(template, 'out');
    if (node.inputPorts.length > node.outputPorts.length) {
        const gap = Number(inPorts[1][1]['s:y']) - Number(inPorts[0][1]['s:y']);
        return Number(template[1]['s:height']) + gap * (node.inputPorts.length - 2);
    }
    if (outPorts.length > 1) {
        const gap = Number(outPorts[1][1]['s:y']) - Number(outPorts[0][1]['s:y']);
        return Number(template[1]['s:height']) + gap * (node.outputPorts.length - 2);
    }
    return Number(template[1]['s:height']);
}
