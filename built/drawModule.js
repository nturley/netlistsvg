"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeDummyEdges = void 0;
var elkGraph_1 = require("./elkGraph");
var Skin_1 = require("./Skin");
var _ = require("lodash");
var onml = require("onml");
var WireDirection;
(function (WireDirection) {
    WireDirection[WireDirection["Up"] = 0] = "Up";
    WireDirection[WireDirection["Down"] = 1] = "Down";
    WireDirection[WireDirection["Left"] = 2] = "Left";
    WireDirection[WireDirection["Right"] = 3] = "Right";
})(WireDirection || (WireDirection = {}));
function drawModule(g, module) {
    var nodes = module.nodes.map(function (n) {
        var kchild = _.find(g.children, function (c) { return c.id === n.Key; });
        return n.render(kchild);
    });
    removeDummyEdges(g);
    var lines = _.flatMap(g.edges, function (e) {
        var netId = elkGraph_1.ElkModel.wireNameLookup[e.id];
        var numWires = netId.split(',').length - 2;
        var lineStyle = 'stroke-width: ' + (numWires > 1 ? 2 : 1);
        var netName = 'net_' + netId.slice(1, netId.length - 1) + ' width_' + numWires;
        return _.flatMap(e.sections, function (s) {
            var startPoint = s.startPoint;
            s.bendPoints = s.bendPoints || [];
            var bends = s.bendPoints.map(function (b) {
                var l = ['line', {
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
                var circles = e.junctionPoints.map(function (j) {
                    return ['circle', {
                            cx: j.x,
                            cy: j.y,
                            r: (numWires > 1 ? 3 : 2),
                            style: 'fill:#000',
                            class: netName,
                        }];
                });
                bends = bends.concat(circles);
            }
            var line = [['line', {
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
    var labels;
    for (var index in g.edges) {
        if (g.edges.hasOwnProperty(index)) {
            var e = g.edges[index];
            var netId = elkGraph_1.ElkModel.wireNameLookup[e.id];
            var numWires = netId.split(',').length - 2;
            var netName = 'net_' + netId.slice(1, netId.length - 1) +
                ' width_' + numWires +
                ' busLabel_' + numWires;
            if (e.labels !== undefined &&
                e.labels[0] !== undefined &&
                e.labels[0].text !== undefined) {
                var label = [
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
                }
                else {
                    labels = label;
                }
            }
        }
    }
    if (labels !== undefined && labels.length > 0) {
        lines = lines.concat(labels);
    }
    var svgAttrs = Skin_1.default.skin[1];
    svgAttrs.width = g.width.toString();
    svgAttrs.height = g.height.toString();
    var styles = ['style', {}, ''];
    onml.t(Skin_1.default.skin, {
        enter: function (node) {
            if (node.name === 'style') {
                styles[2] += node.full[2];
            }
        },
    });
    var elements = __spreadArrays([styles], nodes, lines);
    var ret = __spreadArrays(['svg', svgAttrs], elements);
    return onml.s(ret);
}
exports.default = drawModule;
function which_dir(start, end) {
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
function findBendNearDummy(net, dummyIsSource, dummyLoc) {
    var candidates = net.map(function (edge) {
        var bends = edge.sections[0].bendPoints || [null];
        if (dummyIsSource) {
            return _.first(bends);
        }
        else {
            return _.last(bends);
        }
    }).filter(function (p) { return p !== null; });
    return _.minBy(candidates, function (pt) {
        return Math.abs(dummyLoc.x - pt.x) + Math.abs(dummyLoc.y - pt.y);
    });
}
function removeDummyEdges(g) {
    // go through each edge group for each dummy
    var dummyNum = 0;
    var _loop_1 = function () {
        var dummyId = '$d_' + String(dummyNum);
        // find all edges connected to this dummy
        var edgeGroup = _.filter(g.edges, function (e) {
            return e.source === dummyId || e.target === dummyId;
        });
        if (edgeGroup.length === 0) {
            return "break";
        }
        var dummyIsSource;
        var dummyLoc = void 0;
        var firstEdge = edgeGroup[0];
        if (firstEdge.source === dummyId) {
            dummyIsSource = true;
            dummyLoc = firstEdge.sections[0].startPoint;
        }
        else {
            dummyIsSource = false;
            dummyLoc = firstEdge.sections[0].endPoint;
        }
        var newEnd = findBendNearDummy(edgeGroup, dummyIsSource, dummyLoc);
        for (var _i = 0, edgeGroup_1 = edgeGroup; _i < edgeGroup_1.length; _i++) {
            var edge = edgeGroup_1[_i];
            var e = edge;
            var section = e.sections[0];
            if (dummyIsSource) {
                section.startPoint = newEnd;
                if (section.bendPoints) {
                    section.bendPoints.shift();
                }
            }
            else {
                section.endPoint = newEnd;
                if (section.bendPoints) {
                    section.bendPoints.pop();
                }
            }
        }
        // delete junction point if necessary
        var directions = new Set(_.flatMap(edgeGroup, function (edge) {
            var section = edge.sections[0];
            if (dummyIsSource) {
                // get first bend or endPoint
                if (section.bendPoints && section.bendPoints.length > 0) {
                    return [section.bendPoints[0]];
                }
                return section.endPoint;
            }
            else {
                if (section.bendPoints && section.bendPoints.length > 0) {
                    return [_.last(section.bendPoints)];
                }
                return section.startPoint;
            }
        }).map(function (pt) {
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
            edgeGroup.forEach(function (edge) {
                if (edge.junctionPoints) {
                    edge.junctionPoints = edge.junctionPoints.filter(function (junct) {
                        return !_.isEqual(junct, newEnd);
                    });
                }
            });
        }
        dummyNum += 1;
    };
    // loop until we can't find an edge group or we hit 10,000
    while (dummyNum < 10000) {
        var state_1 = _loop_1();
        if (state_1 === "break")
            break;
    }
}
exports.removeDummyEdges = removeDummyEdges;
