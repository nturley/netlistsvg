import { ElkModel } from './elkGraph';
import { FlatModule, removeDups } from './FlatModule';
import Cell from './Cell';
import Skin from './Skin';

import _ = require('lodash');
import onml = require('onml');
import assert = require('assert');

enum WireDirection {
    Up, Down, Left, Right,
}

export default function drawModule(g: ElkModel.Graph, module: FlatModule) {
    const nodes: onml.Element[] = module.nodes.map((n: Cell) => {
        const kchild: ElkModel.Cell = _.find(g.children, (c) => c.id === n.Key);
        return n.render(kchild);
    });
    removeDummyEdges(g);
    let lines: onml.Element[] = _.flatMap(g.edges, (e: ElkModel.Edge) => {
        const netId = ElkModel.wireNameLookup[e.id];
        const numWires = netId.split(',').length - 2;
        const lineStyle = 'stroke-width: ' + (numWires > 1 ? 2 : 1);
        const netName = 'net_' + netId.slice(1, netId.length - 1) + ' width_' + numWires;
        return _.flatMap(e.sections, (s: ElkModel.Section) => {
            let startPoint = s.startPoint;
            s.bendPoints = s.bendPoints || [];
            let bends: any[] = s.bendPoints.map((b) => {
                const l = ['line', {
                    x1: startPoint.x,
                    x2: b.x,
                    y1: startPoint.y,
                    y2: b.y,
                    class: netName,
                    style: lineStyle,
                }];
                startPoint = b;
                return l;
            });
            if (e.junctionPoints) {
                const circles: any[] = e.junctionPoints.map((j: ElkModel.WirePoint) =>
                    ['circle', {
                        cx: j.x,
                        cy: j.y,
                        r: (numWires > 1 ? 3 : 2),
                        style: 'fill:#000',
                        class: netName,
                    }]);
                bends = bends.concat(circles);
            }
            const line = [['line', {
                x1: startPoint.x,
                x2: s.endPoint.x,
                y1: startPoint.y,
                y2: s.endPoint.y,
                class: netName,
                style: lineStyle,
            }]];
            return bends.concat(line);
        });
    });
    let labels: any[];
    for (const index in g.edges) {
        if (g.edges.hasOwnProperty(index)) {
            const e = g.edges[index];
            const netId = ElkModel.wireNameLookup[e.id];
            const numWires = netId.split(',').length - 2;
            const netName = 'net_' + netId.slice(1, netId.length - 1) +
                ' width_' + numWires +
                ' busLabel_' + numWires;
            if ((e as ElkModel.ExtendedEdge).labels !== undefined &&
                (e as ElkModel.ExtendedEdge).labels[0] !== undefined &&
                (e as ElkModel.ExtendedEdge).labels[0].text !== undefined) {
                const label = [
                        ['rect',
                            {
                                x: e.labels[0].x + 1,
                                y: e.labels[0].y - 1,
                                width: (e.labels[0].text.length + 2) * 6 - 2,
                                height: 9,
                                class: netName,
                                style: 'fill: white; stroke: none',
                            },
                        ], ['text',
                            {
                                x: e.labels[0].x,
                                y: e.labels[0].y + 7,
                                class: netName,
                            },
                            '/' + e.labels[0].text + '/',
                        ],
                    ];
                if (labels !== undefined) {
                    labels = labels.concat(label);
                } else {
                    labels = label;
                }
            }
        }
    }
    if (labels !== undefined && labels.length > 0) {
        lines = lines.concat(labels);
    }
    const svgAttrs: onml.Attributes = Skin.skin[1];
    svgAttrs.width = g.width.toString();
    svgAttrs.height = g.height.toString();

    const styles: onml.Element = ['style', {}, ''];
    onml.t(Skin.skin, {
        enter: (node) => {
            if (node.name === 'style') {
                styles[2] += node.full[2];
            }
        },
    });
    const elements: onml.Element[] = [styles, ...nodes, ...lines];
    const ret: onml.Element = ['svg', svgAttrs, ...elements];
    return onml.s(ret);
}

function which_dir(start: ElkModel.WirePoint, end: ElkModel.WirePoint): WireDirection {
    if (end.x === start.x && end.y === start.y) {
        throw new Error('start and end are the same');
    }
    if (end.x !== start.x && end.y !== start.y) {
        throw new Error('start and end arent orthogonal');
    }
    if (end.x > start.x) {
        return WireDirection.Right;
    }
    if (end.x < start.x) {
        return WireDirection.Left;
    }
    if (end.y > start.y) {
        return WireDirection.Down;
    }
    if (end.y < start.y) {
        return WireDirection.Up;
    }
    throw new Error('unexpected direction');
}

function findBendNearDummy(
        net: ElkModel.Edge[],
        dummyIsSource: boolean,
        dummyLoc: ElkModel.WirePoint): ElkModel.WirePoint {
    const candidates = net.map( (edge) => {
        const bends = edge.sections[0].bendPoints || [null];
        if (dummyIsSource) {
            return _.first(bends);
        } else {
            return _.last(bends);
        }
    }).filter((p) => p !== null);
    return _.minBy(candidates, (pt: ElkModel.WirePoint) => {
        return Math.abs(dummyLoc.x - pt.x) + Math.abs(dummyLoc.y - pt.y);
    });
}

export function removeDummyEdges(g: ElkModel.Graph) {
    // go through each edge group for each dummy
    let dummyNum: number = 0;
    // loop until we can't find an edge group or we hit 10,000
    while (dummyNum < 10000) {
        const dummyId: string = '$d_' + String(dummyNum);
        // find all edges connected to this dummy
        const edgeGroup = _.filter(g.edges, (e: ElkModel.Edge) => {
            return e.source === dummyId || e.target === dummyId;
        });
        if (edgeGroup.length === 0) {
            break;
        }
        let dummyIsSource: boolean;
        let dummyLoc: ElkModel.WirePoint;
        const firstEdge: ElkModel.Edge = edgeGroup[0] as ElkModel.Edge;
        if (firstEdge.source === dummyId) {
            dummyIsSource = true;
            dummyLoc = firstEdge.sections[0].startPoint;
        } else {
            dummyIsSource = false;
            dummyLoc = firstEdge.sections[0].endPoint;
        }
        const newEnd: ElkModel.WirePoint = findBendNearDummy(edgeGroup as ElkModel.Edge[], dummyIsSource, dummyLoc);
        for (const edge of edgeGroup) {
            const e: ElkModel.Edge = edge as ElkModel.Edge;
            const section = e.sections[0];
            if (dummyIsSource) {
                section.startPoint = newEnd;
                if (section.bendPoints) {
                    section.bendPoints.shift();
                }
            } else {
                section.endPoint = newEnd;
                if (section.bendPoints) {
                    section.bendPoints.pop();
                }
            }
        }
        // delete junction point if necessary
        const directions = new Set(_.flatMap(edgeGroup, (edge: ElkModel.Edge) => {
            const section = edge.sections[0];
            if (dummyIsSource) {
                // get first bend or endPoint
                if (section.bendPoints && section.bendPoints.length > 0) {
                    return [section.bendPoints[0]];
                }
                return section.endPoint;
            } else {
                if (section.bendPoints && section.bendPoints.length > 0) {
                    return [_.last(section.bendPoints)];
                }
                return section.startPoint;
            }
        }).map( (pt) => {
            if (pt.x > newEnd.x) {
                return WireDirection.Right;
            }
            if (pt.x < newEnd.x) {
                return WireDirection.Left;
            }
            if (pt.y > newEnd.y) {
                return WireDirection.Down;
            }
            return WireDirection.Up;
        }));
        if (directions.size < 3) {
            // remove junctions at newEnd
            edgeGroup.forEach((edge: ElkModel.Edge) => {
                if (edge.junctionPoints) {
                    edge.junctionPoints = edge.junctionPoints.filter((junct) => {
                        return !_.isEqual(junct, newEnd);
                    });
                }
            });
        }
        dummyNum += 1;
    }
}
