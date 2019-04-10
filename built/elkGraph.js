"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var ElkModel;
(function (ElkModel) {
    ElkModel.wireNameLookup = {};
})(ElkModel = exports.ElkModel || (exports.ElkModel = {}));
function buildElkGraph(module) {
    var children = module.getNodes().map(function (n) {
        return n.buildElkChild();
    });
    var i = 0;
    var dummies = 0;
    var edges = _.flatMap(module.getWires(), function (w) {
        // at least one driver and at least one rider and no laterals
        if (w.drivers.length > 0 && w.riders.length > 0 && w.laterals.length === 0) {
            var ret = [];
            i = route(w.drivers, w.riders, i, ret);
            return ret;
            // at least one driver or rider and at least one lateral
        }
        else if (w.drivers.concat(w.riders).length > 0 && w.laterals.length > 0) {
            var ret = [];
            i = route(w.drivers, w.laterals, i, ret);
            i = route(w.laterals, w.riders, i, ret);
            return ret;
            // at least two drivers and no riders
        }
        else if (w.riders.length === 0 && w.drivers.length > 1) {
            // create a dummy node and add it to children
            var dummyId_1 = addDummy(children, dummies);
            dummies += 1;
            var dummyEdges = w.drivers.map(function (driver) {
                var sourceParentKey = driver.parentNode.Key;
                var id = 'e' + String(i);
                i += 1;
                var d = {
                    id: id,
                    source: sourceParentKey,
                    sourcePort: sourceParentKey + '.' + driver.key,
                    target: dummyId_1,
                    targetPort: dummyId_1 + '.p',
                };
                ElkModel.wireNameLookup[id] = driver.wire.netName;
                return d;
            });
            return dummyEdges;
            // at least one rider and no drivers
        }
        else if (w.riders.length > 1 && w.drivers.length === 0) {
            // create a dummy node and add it to children
            var dummyId_2 = addDummy(children, dummies);
            dummies += 1;
            var dummyEdges = w.riders.map(function (rider) {
                var sourceParentKey = rider.parentNode.Key;
                var id = 'e' + String(i);
                i += 1;
                var edge = {
                    id: id,
                    source: dummyId_2,
                    sourcePort: dummyId_2 + '.p',
                    target: sourceParentKey,
                    targetPort: sourceParentKey + '.' + rider.key,
                };
                ElkModel.wireNameLookup[id] = rider.wire.netName;
                return edge;
            });
            return dummyEdges;
        }
        else if (w.laterals.length > 1) {
            var source_1 = w.laterals[0];
            var sourceParentKey_1 = source_1.parentNode.Key;
            var lateralEdges = w.laterals.slice(1).map(function (lateral) {
                var lateralParentKey = lateral.parentNode.Key;
                var id = 'e' + String(i);
                i += 1;
                var edge = {
                    id: id,
                    source: sourceParentKey_1,
                    sourcePort: sourceParentKey_1 + '.' + source_1.key,
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
        id: module.getName(),
        children: children,
        edges: edges,
    };
}
exports.buildElkGraph = buildElkGraph;
function addDummy(children, dummyNum) {
    var dummyId = '$d_' + String(dummyNum);
    var child = {
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
function route(sourcePorts, targetPorts, edgeIndex, edges) {
    var newEdges = (_.flatMap(sourcePorts, function (sourcePort) {
        var sourceParentKey = sourcePort.parentNode.key;
        var sourceKey = sourceParentKey + '.' + sourcePort.key;
        return targetPorts.map(function (targetPort) {
            var targetParentKey = targetPort.parentNode.key;
            var targetKey = targetParentKey + '.' + targetPort.key;
            var id = 'e' + edgeIndex;
            var edge = {
                id: id,
                source: sourceParentKey,
                sourcePort: sourceKey,
                target: targetParentKey,
                targetPort: targetKey,
            };
            ElkModel.wireNameLookup[id] = targetPort.wire.netName;
            if (sourcePort.parentNode.type !== '$dff') {
                edge.layoutOptions = { 'org.eclipse.elk.layered.priority.direction': 10 };
            }
            edgeIndex += 1;
            return edge;
        });
    }));
    edges.push.apply(edges, newEdges);
    return edgeIndex;
}
