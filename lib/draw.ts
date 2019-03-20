import { ElkGraph, IElkCell, ElkEdge, ElkSegment, WirePoint } from './elkGraph';
import { FlatModule, removeDups } from './FlatModule';
import { getPortsWithPrefix } from './skin';
import { Cell } from './Cell';

import _ = require('lodash');
import clone = require('clone');
import onml = require('onml');

enum WireDirection {
    Up, Down, Left, Right,
}

export function drawModule(g: ElkGraph, module: FlatModule) {
    const nodes = module.getNodes().map((n: Cell) => {
        const kchild: IElkCell = _.find(g.children, (c) => c.id === n.Key);
        return n.render(kchild);
    });
    removeDummyEdges(g);
    const lines = _.flatMap(g.edges, (e: ElkEdge) => {
        return _.flatMap(e.sections, (s: ElkSegment) => {
            let startPoint = s.startPoint;
            s.bendPoints = s.bendPoints || [];
            let bends: any[] = s.bendPoints.map((b) => {
                const l = ['line', {
                    x1: startPoint.x,
                    x2: b.x,
                    y1: startPoint.y,
                    y2: b.y,
                }];
                startPoint = b;
                return l;
            });
            if (e.junctionPoints) {
                const circles: any[] = e.junctionPoints.map((j: WirePoint) =>
                    ['circle', { cx: j.x, cy: j.y, r: 2, style: 'fill:#000' }]);
                bends = bends.concat(circles);
            }
            const line = [['line', {
                x1: startPoint.x,
                x2: s.endPoint.x,
                y1: startPoint.y,
                y2: s.endPoint.y,
            }]];
            return bends.concat(line);
        });
    });
    const svg = module.getSkin().slice(0, 2);
    svg[1].width = g.width;
    svg[1].height = g.height;

    const styles = _.filter(module.getSkin(), (el) => {
        return el[0] === 'style';
    });
    const ret = svg.concat(styles).concat(nodes).concat(lines);
    return onml.s(ret);
}

export function setGenericSize(tempclone, height) {
    onml.traverse(tempclone, {
        enter: (node) => {
            if (node.name === 'rect' && node.attr['s:generic'] === 'body') {
                node.attr.height = height;
            }
        },
    });
}

export function setTextAttribute(tempclone, attribute, value) {
    onml.traverse(tempclone, {
        enter: (node) => {
            if (node.name === 'text' && node.attr['s:attribute'] === attribute) {
                node.full[2] = value;
            }
        },
    });
}

function which_dir(start: WirePoint, end: WirePoint): WireDirection {
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

function removeDummyEdges(g: ElkGraph) {
    // go through each edge group for each dummy
    let dummyNum: number = 0;
    // loop until we can't find an edge group or we hit 10,000
    while (dummyNum < 10000) {
        const dummyId: string = '$d_' + String(dummyNum);
        // find all edges connected to this dummy
        const edgeGroup = _.filter(g.edges, (e) => {
            return e.source === dummyId || e.target === dummyId;
        });
        if (edgeGroup.length === 0) {
            break;
        }

        const junctEdge = _.minBy(edgeGroup, (e) => {
            if (e.source === dummyId) {
                if (e.junctionPoints) {
                    const firstJunction = e.junctionPoints[0];
                    return _.findIndex(e.bendPoints, (bend) => {
                        return bend.x === firstJunction.x && bend.y === firstJunction.y;
                    });
                }
                // a number bigger than any bendpoint index
                return 10000;
            } else {
                if (e.junctionPoints) {
                    const lastJunction = e.junctionPoints[e.junctionPoints.length - 1];
                    // flip the sign of the index so we find the max instead of the min
                    return 0 - _.findIndex(e.bendPoints, (bend) => {
                        return bend.x === lastJunction.x && bend.y === lastJunction.y;
                    });
                }
                // a number bigger than any bendpoint index
                return 1000;
            }
        });
        const junct = junctEdge.junctionPoints[0];

        const dirs: WireDirection[] = edgeGroup.map((e: ElkEdge) => {
            const s = e.sections[0];
            if (e.source === dummyId) {
                s.startPoint = junct;
                if (s.bendPoints) {
                    if (s.bendPoints[0].x === junct.x && s.bendPoints[0].y === junct.y) {
                        s.bendPoints = s.bendPoints.slice(1);
                    }

                    if (s.bendPoints.length > 0) {
                        return which_dir(junct, s.bendPoints[0]);
                    }
                }
                return which_dir(junct, s.endPoint);
            } else {
                s.endPoint = junct;
                if (s.bendPoints) {
                    const lastBend = s.bendPoints[s.bendPoints.length - 1];
                    if (lastBend.x === junct.x && lastBend.y === junct.y) {
                        s.bendPoints.pop();
                    }
                    if (s.bendPoints.length > 0) {
                        return which_dir(junct, s.bendPoints[s.bendPoints.length - 1]);
                    }
                }
                return which_dir(junct, s.startPoint);
            }
        });
        const dirSet = removeDups(dirs.map((wd) => WireDirection[wd]));
        if (dirSet.length === 2) {
            junctEdge.junctionPoints = junctEdge.junctionPoints.slice(1);
        }
        dummyNum += 1;
    }
}
