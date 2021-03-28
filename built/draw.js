"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var FlatModule_1 = require("./FlatModule");
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
    var nodes = module.getNodes().map(function (n) {
        var kchild = _.find(g.children, function (c) { return c.id === n.Key; });
        return n.render(kchild);
    });
    removeDummyEdges(g);
    var lines = _.flatMap(g.edges, function (e) {
        return _.flatMap(e.sections, function (s) {
            var startPoint = s.startPoint;
            s.bendPoints = s.bendPoints || [];
            var bends = s.bendPoints.map(function (b) {
                var l = ['line', {
                        x1: startPoint.x,
                        x2: b.x,
                        y1: startPoint.y,
                        y2: b.y,
                    }];
                startPoint = b;
                return l;
            });
            if (e.junctionPoints) {
                var circles = e.junctionPoints.map(function (j) {
                    return ['circle', {
                            cx: j.x,
                            cy: j.y,
                            r: 2,
                            style: 'fill:#000',
                        }];
                });
                bends = bends.concat(circles);
            }
            var line = [['line', {
                        x1: startPoint.x,
                        x2: s.endPoint.x,
                        y1: startPoint.y,
                        y2: s.endPoint.y,
                    }]];
            return bends.concat(line);
        });
    });
    var svg = module.getSkin().slice(0, 2);
    svg[1].width = g.width;
    svg[1].height = g.height;
    var styles = _.filter(module.getSkin(), function (el) {
        return el[0] === 'style';
    });
    var ret = svg.concat(styles).concat(nodes).concat(lines);
    return onml.s(ret);
}
exports.drawModule = drawModule;
function setGenericSize(tempclone, height) {
    onml.traverse(tempclone, {
        enter: function (node) {
            if (node.name === 'rect' && node.attr['s:generic'] === 'body') {
                node.attr.height = height;
            }
        },
    });
}
exports.setGenericSize = setGenericSize;
function setTextAttribute(tempclone, attribute, value) {
    onml.traverse(tempclone, {
        enter: function (node) {
            if (node.name === 'text' && node.attr['s:attribute'] === attribute) {
                node.full[2] = value;
            }
        },
    });
}
exports.setTextAttribute = setTextAttribute;
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
        var junctEdge = _.minBy(edgeGroup, function (e) {
            if (e.source === dummyId) {
                if (e.junctionPoints) {
                    var firstJunction_1 = e.junctionPoints[0];
                    return _.findIndex(e.bendPoints, function (bend) {
                        return bend.x === firstJunction_1.x && bend.y === firstJunction_1.y;
                    });
                }
                // a number bigger than any bendpoint index
                return 10000;
            }
            else {
                if (e.junctionPoints) {
                    var lastJunction_1 = e.junctionPoints[e.junctionPoints.length - 1];
                    // flip the sign of the index so we find the max instead of the min
                    return 0 - _.findIndex(e.bendPoints, function (bend) {
                        return bend.x === lastJunction_1.x && bend.y === lastJunction_1.y;
                    });
                }
                // a number bigger than any bendpoint index
                return 1000;
            }
        });
        var junct = junctEdge.junctionPoints[0];
        var dirs = edgeGroup.map(function (e) {
            var s = e.sections[0];
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
            }
            else {
                s.endPoint = junct;
                if (s.bendPoints) {
                    var lastBend = s.bendPoints[s.bendPoints.length - 1];
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
        var dirSet = FlatModule_1.removeDups(dirs.map(function (wd) { return WireDirection[wd]; }));
        if (dirSet.length === 2) {
            junctEdge.junctionPoints = junctEdge.junctionPoints.slice(1);
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
