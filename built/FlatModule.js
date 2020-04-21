"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Skin_1 = require("./Skin");
var Cell_1 = require("./Cell");
var _ = require("lodash");
var FlatModule = /** @class */ (function () {
    function FlatModule(mod, name, depth, parent) {
        var _this = this;
        if (parent === void 0) { parent = null; }
        this.parent = parent;
        this.moduleName = name;
        var colour;
        if (FlatModule.config.hierarchy.colour[depth]) {
            colour = FlatModule.config.hierarchy.colour[depth];
        }
        else {
            colour = FlatModule.config.hierarchy.colour[FlatModule.config.hierarchy.colour.length - 1];
        }
        var ports = _.map(mod.ports, function (port, portName) { return Cell_1.default.fromPort(port, portName, _this.moduleName); });
        var cells = _.map(mod.cells, function (c, key) {
            switch (FlatModule.config.hierarchy.enable) {
                case 'level': {
                    if (FlatModule.config.hierarchy.expandLevel > depth) {
                        if (_.includes(FlatModule.modNames, c.type)) {
                            return Cell_1.default.createSubModule(c, key, _this.moduleName, FlatModule.netlist.modules[c.type], depth, colour);
                        }
                        else {
                            return Cell_1.default.fromYosysCell(c, key, _this.moduleName);
                        }
                    }
                    else {
                        return Cell_1.default.fromYosysCell(c, key, _this.moduleName);
                    }
                }
                case 'all': {
                    if (_.includes(FlatModule.modNames, c.type)) {
                        return Cell_1.default.createSubModule(c, key, _this.moduleName, FlatModule.netlist.modules[c.type], depth, colour);
                    }
                    else {
                        return Cell_1.default.fromYosysCell(c, key, _this.moduleName);
                    }
                }
                case 'modules': {
                    if (_.includes(FlatModule.config.hierarchy.expandModules.types, c.type) ||
                        _.includes(FlatModule.config.hierarchy.expandModules.ids, key)) {
                        if (!_.includes(FlatModule.modNames, c.type)) {
                            throw new Error('Submodule in config file not defined in input json file.');
                        }
                        return Cell_1.default.createSubModule(c, key, _this.moduleName, FlatModule.netlist.modules[c.type], depth, colour);
                    }
                    else {
                        return Cell_1.default.fromYosysCell(c, key, _this.moduleName);
                    }
                }
                default: {
                    return Cell_1.default.fromYosysCell(c, key, _this.moduleName);
                }
            }
        });
        this.nodes = cells.concat(ports);
        // this can be skipped if there are no 0's or 1's
        if (FlatModule.layoutProps.constants !== false) {
            this.addConstants();
        }
        // this can be skipped if there are no splits or joins
        if (FlatModule.layoutProps.splitsAndJoins !== false) {
            this.addSplitsJoins();
        }
        this.createWires();
    }
    FlatModule.fromNetlist = function (netlist, config) {
        this.layoutProps = Skin_1.default.getProperties();
        this.modNames = Object.keys(netlist.modules);
        this.netlist = netlist;
        this.config = config;
        var topName = null;
        if (this.config.top.enable) {
            topName = this.config.top.module;
            if (!_.includes(this.modNames, topName)) {
                throw new Error('Top module in config file not defined in input json file.');
            }
        }
        else {
            _.forEach(netlist.modules, function (mod, name) {
                if (mod.attributes && Number(mod.attributes.top) === 1) {
                    topName = name;
                }
            });
            // Otherwise default the first one in the file...
            if (topName == null) {
                topName = this.modNames[0];
            }
        }
        var top = netlist.modules[topName];
        return new FlatModule(top, topName, 0);
    };
    // converts input ports with constant assignments to constant nodes
    FlatModule.prototype.addConstants = function () {
        // find the maximum signal number
        var maxNum = this.nodes.reduce((function (acc, v) { return v.maxOutVal(acc); }), -1);
        // add constants to nodes
        var signalsByConstantName = {};
        var cells = [];
        this.nodes.forEach(function (n) {
            maxNum = n.findConstants(signalsByConstantName, maxNum, cells);
        });
        this.nodes = this.nodes.concat(cells);
    };
    // solves for minimal bus splits and joins and adds them to module
    FlatModule.prototype.addSplitsJoins = function () {
        var _this = this;
        var allInputs = _.flatMap(this.nodes, function (n) { return n.inputPortVals(); });
        var allOutputs = _.flatMap(this.nodes, function (n) { return n.outputPortVals(); });
        var allInputsCopy = allInputs.slice();
        var splits = {};
        var joins = {};
        allInputs.forEach(function (input) {
            gather(allOutputs, allInputsCopy, input, 0, input.length, splits, joins);
        });
        this.nodes = this.nodes.concat(_.map(joins, function (joinOutput, joinInputs) {
            return Cell_1.default.fromJoinInfo(joinInputs, joinOutput, _this.moduleName);
        })).concat(_.map(splits, function (splitOutputs, splitInput) {
            return Cell_1.default.fromSplitInfo(splitInput, splitOutputs, _this.moduleName);
        }));
    };
    // search through all the ports to find all of the wires
    FlatModule.prototype.createWires = function () {
        var ridersByNet = {};
        var driversByNet = {};
        var lateralsByNet = {};
        this.nodes.forEach(function (n) {
            n.collectPortsByDirection(ridersByNet, driversByNet, lateralsByNet, FlatModule.layoutProps.genericsLaterals);
        });
        // list of unique nets
        var nets = removeDups(_.keys(ridersByNet).concat(_.keys(driversByNet)).concat(_.keys(lateralsByNet)));
        var wires = nets.map(function (net) {
            var drivers = driversByNet[net] || [];
            var riders = ridersByNet[net] || [];
            var laterals = lateralsByNet[net] || [];
            var wire = { netName: net, drivers: drivers, riders: riders, laterals: laterals };
            drivers.concat(riders).concat(laterals).forEach(function (port) {
                port.wire = wire;
            });
            return wire;
        });
        this.wires = wires;
    };
    return FlatModule;
}());
exports.FlatModule = FlatModule;
// returns a string that represents the values of the array of integers
// [1, 2, 3] -> ',1,2,3,'
function arrayToBitstring(bitArray) {
    var ret = '';
    bitArray.forEach(function (bit) {
        var sbit = String(bit);
        if (ret === '') {
            ret = sbit;
        }
        else {
            ret += ',' + sbit;
        }
    });
    return ',' + ret + ',';
}
exports.arrayToBitstring = arrayToBitstring;
// returns whether needle is a substring of haystack
function arrayContains(needle, haystack) {
    return (haystack.indexOf(needle) > -1);
}
// returns the index of the string that contains a substring
// given arrhaystack, an array of strings
function indexOfContains(needle, arrhaystack) {
    return _.findIndex(arrhaystack, function (haystack) {
        return arrayContains(needle, haystack);
    });
}
function addToDefaultDict(dict, key, value) {
    if (dict[key] === undefined) {
        dict[key] = [value];
    }
    else {
        dict[key].push(value);
    }
}
exports.addToDefaultDict = addToDefaultDict;
// string (for labels), that represents an index
// or range of indices.
function getIndicesString(bitstring, query, start) {
    var splitStart = _.max([bitstring.indexOf(query), start]);
    var startIndex = bitstring.substring(0, splitStart).split(',').length - 1;
    var endIndex = startIndex + query.split(',').length - 3;
    if (startIndex === endIndex) {
        return String(startIndex);
    }
    else {
        return String(startIndex) + ':' + String(endIndex);
    }
}
// gather splits and joins
function gather(inputs, // all inputs
outputs, // all outputs
toSolve, // an input array we are trying to solve
start, // index of toSolve to start from
end, // index of toSolve to end at
splits, // container collecting the splits
joins) {
    // remove myself from outputs list if present
    var outputIndex = outputs.indexOf(toSolve);
    if (outputIndex !== -1) {
        outputs.splice(outputIndex, 1);
    }
    // This toSolve is compconste
    if (start >= toSolve.length || end - start < 2) {
        return;
    }
    var query = toSolve.slice(start, end);
    // are there are perfect matches?
    if (arrayContains(query, inputs)) {
        if (query !== toSolve) {
            addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
        }
        gather(inputs, outputs, toSolve, end - 1, toSolve.length, splits, joins);
        return;
    }
    var index = indexOfContains(query, inputs);
    // are there any partial matches?
    if (index !== -1) {
        if (query !== toSolve) {
            addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
        }
        // found a split
        addToDefaultDict(splits, inputs[index], getIndicesString(inputs[index], query, 0));
        // we can match to this now
        inputs.push(query);
        gather(inputs, outputs, toSolve, end - 1, toSolve.length, splits, joins);
        return;
    }
    // are there any output matches?
    if (indexOfContains(query, outputs) !== -1) {
        if (query !== toSolve) {
            // add to join
            addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
        }
        // gather without outputs
        gather(inputs, [], query, 0, query.length, splits, joins);
        inputs.push(query);
        return;
    }
    gather(inputs, outputs, toSolve, start, start + query.slice(0, -1).lastIndexOf(',') + 1, splits, joins);
}
function removeDups(inStrs) {
    var map = {};
    inStrs.forEach(function (str) {
        map[str] = true;
    });
    return _.keys(map);
}
exports.removeDups = removeDups;
