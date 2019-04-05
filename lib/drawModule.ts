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
    const nodes = module.getNodes().map((n: Cell) => {
        const kchild: ElkModel.Cell = _.find(g.children, (c) => c.id === n.Key);
        return n.render(kchild);
    });
    removeDummyEdges(g);
    const lines = _.flatMap(g.edges, (e: ElkModel.Edge) => {
        return _.flatMap(e.sections, (s: ElkModel.Segment) => {
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
                const circles: any[] = e.junctionPoints.map((j: ElkModel.WirePoint) =>
                    ['circle', {
                        cx: j.x,
                        cy: j.y,
                        r: 2,
                        style: 'fill:#000',
                    }]);
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
    const svg = Skin.skin.slice(0, 2);
    svg[1].width = g.width;
    svg[1].height = g.height;

    const styles = _.filter(Skin.skin, (el) => {
        return el[0] === 'style';
    });
    const ret = svg.concat(styles).concat(nodes).concat(lines);
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

function removeDummyEdges(g: ElkModel.Graph) {
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
        const dirs: WireDirection[] = edgeGroup.map((edge: ElkModel.Edge) => {
            const s = edge.sections[0];
            if (s.bendPoints === undefined || edge.junctionPoints === undefined) {
                s.bendPoints = [];
                s.startPoint = s.endPoint;
                return null;
            }
            if (edge.source === dummyId) {
                const newSourceIndex = s.bendPoints.findIndex( (bend) => {
                    return junctEdge.junctionPoints.find( (junct) => {
                        return _.isEqual(bend, junct);
                    }) !== undefined;
                });
                assert.notStrictEqual(newSourceIndex, -1);
                s.startPoint = s.bendPoints[newSourceIndex];
                s.bendPoints = s.bendPoints.slice(newSourceIndex + 1);
                if (s.bendPoints.length > 0) {
                    return which_dir(s.startPoint, s.bendPoints[0]);
                }
                return which_dir(s.startPoint, s.endPoint);
            } else {
                const newTargetIndex = _.findLastIndex(s.bendPoints, (bend) => {
                    return junctEdge.junctionPoints.find( (junct) => {
                        return _.isEqual(junct, bend);
                    }) !== undefined;
                });
                assert.notStrictEqual(newTargetIndex, -1);
                s.endPoint = s.bendPoints[newTargetIndex];
                s.bendPoints = s.bendPoints.slice(0, newTargetIndex);
                if (s.bendPoints.length > 0) {
                    return which_dir(s.endPoint, s.bendPoints[s.bendPoints.length - 1]);
                }
                return which_dir(s.endPoint, s.startPoint);
            }
        });
        const dirSet = removeDups(dirs.filter((wd) => wd !== null).map((wd) => WireDirection[wd]));
        if (dirSet.length === 2) {
            junctEdge.junctionPoints = junctEdge.junctionPoints.slice(1);
        }
        dummyNum += 1;
    }
}
