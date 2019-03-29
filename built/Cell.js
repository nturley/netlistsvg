"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var FlatModule_1 = require("./FlatModule");
var YosysModel_1 = require("./YosysModel");
var skin_1 = require("./skin");
var Port_1 = require("./Port");
var _ = require("lodash");
var clone = require("clone");
var onml = require("onml");
var Cell = /** @class */ (function () {
    function Cell(key, type, inputPorts, outputPorts, attributes, parentModule, subModule) {
        if (subModule === void 0) { subModule = null; }
        var _this = this;
        this.key = key;
        this.type = type;
        this.inputPorts = inputPorts;
        this.outputPorts = outputPorts;
        this.attributes = attributes;
        this.parent = parentModule;
        this.subModule = subModule;
        inputPorts.forEach(function (ip) {
            ip.ParentNode = _this;
        });
        outputPorts.forEach(function (op) {
            op.ParentNode = _this;
        });
    }
    /**
     * creates a Cell from a Yosys Port
     * @param yPort the Yosys Port with our port data
     * @param name the name of the port
     */
    Cell.fromPort = function (yPort, name, parent) {
        var isInput = yPort.direction === YosysModel_1.default.Direction.Input;
        if (isInput) {
            return new Cell(name, '$_inputExt_', [], [new Port_1.Port('Y', yPort.bits)], {}, parent);
        }
        return new Cell(name, '$_outputExt_', [new Port_1.Port('A', yPort.bits)], [], {}, parent);
    };
    Cell.fromYosysCell = function (yCell, name, parent) {
        var inputPids = YosysModel_1.default.getInputPortPids(yCell);
        var outputPids = YosysModel_1.default.getOutputPortPids(yCell);
        var ports = _.map(yCell.connections, function (conn, portName) {
            return new Port_1.Port(portName, conn);
        });
        var inputPorts = ports.filter(function (port) { return port.keyIn(inputPids); });
        var outputPorts = ports.filter(function (port) { return port.keyIn(outputPids); });
        return new Cell(name, yCell.type, inputPorts, outputPorts, yCell.attributes, parent);
    };
    Cell.fromConstantInfo = function (name, constants, parent) {
        return new Cell(name, '$_constant_', [], [new Port_1.Port('Y', constants)], {}, parent);
    };
    /**
     * creates a join cell
     * @param target string name of net (starts and ends with and delimited by commas)
     * @param sources list of index strings (one number, or two numbers separated by a colon)
     */
    Cell.fromJoinInfo = function (target, sources, parent) {
        var signalStrs = target.slice(1, -1).split(',');
        var signals = signalStrs.map(function (ss) { return Number(ss); });
        var joinOutPorts = [new Port_1.Port('Y', signals)];
        var inPorts = sources.map(function (name) {
            return new Port_1.Port(name, getBits(signals, name));
        });
        return new Cell('$join$' + target, '$_join_', inPorts, joinOutPorts, {}, parent);
    };
    /**
     * creates a split cell
     * @param source string name of net (starts and ends with and delimited by commas)
     * @param targets list of index strings (one number, or two numbers separated by a colon)
     */
    Cell.fromSplitInfo = function (source, targets, parent) {
        // turn string into array of signal names
        var signals = source.slice(1, -1).split(',');
        // convert the signals into actual numbers
        // after running constant pass, all signals should be numbers
        for (var _i = 0, _a = Object.keys(signals); _i < _a.length; _i++) {
            var i = _a[_i];
            signals[i] = Number(signals[i]);
        }
        var inPorts = [new Port_1.Port('A', signals)];
        var splitOutPorts = targets.map(function (name) {
            var sigs = getBits(signals, name);
            return new Port_1.Port(name, sigs);
        });
        return new Cell('$split$' + source, '$_split_', inPorts, splitOutPorts, {}, parent);
    };
    Cell.createSubModule = function (yCell, name, parent, subModule) {
        var inputPids = YosysModel_1.default.getInputPortPids(yCell);
        var outputPids = YosysModel_1.default.getOutputPortPids(yCell);
        var ports = _.map(yCell.connections, function (conn, portName) {
            return new Port_1.Port(portName, conn);
        });
        var inputPorts = ports.filter(function (port) { return port.keyIn(inputPids); });
        var outputPorts = ports.filter(function (port) { return port.keyIn(outputPids); });
        var mod = new FlatModule_1.FlatModule(subModule, name, parent);
        return new Cell(name, yCell.type, inputPorts, outputPorts, yCell.attributes, parent, mod);
    };
    Object.defineProperty(Cell.prototype, "Type", {
        get: function () {
            return this.type;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Cell.prototype, "Key", {
        get: function () {
            return this.key;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Cell.prototype, "InputPorts", {
        get: function () {
            return this.inputPorts;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Cell.prototype, "OutputPorts", {
        get: function () {
            return this.outputPorts;
        },
        enumerable: true,
        configurable: true
    });
    Cell.prototype.maxOutVal = function (atLeast) {
        var maxVal = _.max(this.outputPorts.map(function (op) { return op.maxVal(); }));
        return _.max([maxVal, atLeast]);
    };
    Cell.prototype.findConstants = function (sigsByConstantName, maxNum, constantCollector) {
        var _this = this;
        this.inputPorts.forEach(function (ip) {
            maxNum = ip.findConstants(sigsByConstantName, maxNum, constantCollector, _this.parent);
        });
        return maxNum;
    };
    Cell.prototype.inputPortVals = function () {
        return this.inputPorts.map(function (port) { return port.valString(); });
    };
    Cell.prototype.outputPortVals = function () {
        return this.outputPorts.map(function (port) { return port.valString(); });
    };
    Cell.prototype.collectPortsByDirection = function (ridersByNet, driversByNet, lateralsByNet, genericsLaterals) {
        var template = skin_1.findSkinType(FlatModule_1.FlatModule.skin, this.type);
        var lateralPids = skin_1.getLateralPortPids(template);
        // find all ports connected to the same net
        this.inputPorts.forEach(function (port) {
            var isLateral = port.keyIn(lateralPids);
            if (isLateral || (template[1]['s:type'] === 'generic' && genericsLaterals)) {
                FlatModule_1.addToDefaultDict(lateralsByNet, port.valString(), port);
            }
            else {
                FlatModule_1.addToDefaultDict(ridersByNet, port.valString(), port);
            }
        });
        this.outputPorts.forEach(function (port) {
            var isLateral = port.keyIn(lateralPids);
            if (isLateral || (template[1]['s:type'] === 'generic' && genericsLaterals)) {
                FlatModule_1.addToDefaultDict(lateralsByNet, port.valString(), port);
            }
            else {
                FlatModule_1.addToDefaultDict(driversByNet, port.valString(), port);
            }
        });
    };
    Cell.prototype.getValueAttribute = function () {
        if (this.attributes && this.attributes.value) {
            return this.attributes.value;
        }
        return null;
    };
    Cell.prototype.getTemplate = function () {
        return skin_1.findSkinType(FlatModule_1.FlatModule.skin, this.type);
    };
    Cell.prototype.buildElkChild = function () {
        var template = this.getTemplate();
        var type = template[1]['s:type'];
        var key = this.parent.prefix() + this.key;
        if (type === 'join' ||
            type === 'split' ||
            type === 'generic') {
            var inTemplates_1 = skin_1.getPortsWithPrefix(template, 'in');
            var outTemplates_1 = skin_1.getPortsWithPrefix(template, 'out');
            var inPorts = this.inputPorts.map(function (ip, i) {
                return ip.getGenericElkPort(i, inTemplates_1, 'in');
            });
            var outPorts = this.outputPorts.map(function (op, i) {
                return op.getGenericElkPort(i, outTemplates_1, 'out');
            });
            var cell = {
                id: key,
                width: Number(template[1]['s:width']),
                height: Number(this.getGenericHeight()),
                ports: inPorts.concat(outPorts),
                layoutOptions: { 'de.cau.cs.kieler.portConstraints': 'FIXED_POS' },
            };
            if (type === 'generic') {
                cell.labels = [{
                        id: key + '.label',
                        text: this.type,
                        x: Number(template[2][1].x),
                        y: Number(template[2][1].y) - 6,
                        height: 11,
                        width: (6 * this.type.length),
                    }];
            }
            return cell;
        }
        var ports = skin_1.getPortsWithPrefix(template, '').map(function (tp) {
            return {
                id: key + '.' + tp[1]['s:pid'],
                width: 0,
                height: 0,
                x: Number(tp[1]['s:x']),
                y: Number(tp[1]['s:y']),
            };
        });
        var nodeWidth = Number(template[1]['s:width']);
        var ret = {
            id: key,
            width: nodeWidth,
            height: Number(template[1]['s:height']),
            ports: ports,
            layoutOptions: { 'de.cau.cs.kieler.portConstraints': 'FIXED_POS' },
        };
        if (type === 'inputExt' ||
            type === 'outputExt') {
            if (this.parent.parent !== null) {
                return null;
            }
            ret.labels = [{
                    id: key + '.label',
                    text: this.key,
                    x: Number(template[2][1].x) + nodeWidth / 2 - 3 * this.key.length,
                    y: Number(template[2][1].y) - 6,
                    height: 11,
                    width: (6 * this.key.length),
                }];
        }
        return ret;
    };
    Cell.prototype.render = function (kChild) {
        var template = this.getTemplate();
        var tempclone = clone(template);
        setTextAttribute(tempclone, 'ref', this.key);
        setTextAttribute(tempclone, 'id', this.key);
        var attrValue = this.getValueAttribute();
        if (attrValue) {
            setTextAttribute(tempclone, 'name', attrValue);
        }
        tempclone[1].transform = 'translate(' + kChild.x + ',' + kChild.y + ')';
        if (this.type === '$_constant_' && this.key.length > 3) {
            var num = parseInt(this.key, 2);
            setTextAttribute(tempclone, 'ref', '0x' + num.toString(16));
        }
        else if (this.type === '$_split_') {
            setGenericSize(tempclone, Number(this.getGenericHeight()));
            var outPorts_1 = skin_1.getPortsWithPrefix(template, 'out');
            var gap_1 = Number(outPorts_1[1][1]['s:y']) - Number(outPorts_1[0][1]['s:y']);
            var startY_1 = Number(outPorts_1[0][1]['s:y']);
            tempclone.pop();
            tempclone.pop();
            this.outputPorts.forEach(function (op, i) {
                var portClone = clone(outPorts_1[0]);
                portClone[portClone.length - 1][2] = op.Key;
                portClone[1].transform = 'translate(' + outPorts_1[1][1]['s:x'] + ','
                    + (startY_1 + i * gap_1) + ')';
                tempclone.push(portClone);
            });
        }
        else if (this.type === '$_join_') {
            setGenericSize(tempclone, Number(this.getGenericHeight()));
            var inPorts_1 = skin_1.getPortsWithPrefix(template, 'in');
            var gap_2 = Number(inPorts_1[1][1]['s:y']) - Number(inPorts_1[0][1]['s:y']);
            var startY_2 = Number(inPorts_1[0][1]['s:y']);
            tempclone.pop();
            tempclone.pop();
            this.inputPorts.forEach(function (port, i) {
                var portClone = clone(inPorts_1[0]);
                portClone[portClone.length - 1][2] = port.Key;
                portClone[1].transform = 'translate(' + inPorts_1[1][1]['s:x'] + ','
                    + (startY_2 + i * gap_2) + ')';
                tempclone.push(portClone);
            });
        }
        else if (template[1]['s:type'] === 'generic') {
            setGenericSize(tempclone, Number(this.getGenericHeight()));
            var inPorts_2 = skin_1.getPortsWithPrefix(template, 'in');
            var ingap_1 = Number(inPorts_2[1][1]['s:y']) - Number(inPorts_2[0][1]['s:y']);
            var instartY_1 = Number(inPorts_2[0][1]['s:y']);
            var outPorts_2 = skin_1.getPortsWithPrefix(template, 'out');
            var outgap_1 = Number(outPorts_2[1][1]['s:y']) - Number(outPorts_2[0][1]['s:y']);
            var outstartY_1 = Number(outPorts_2[0][1]['s:y']);
            tempclone.pop();
            tempclone.pop();
            tempclone.pop();
            tempclone.pop();
            this.inputPorts.forEach(function (port, i) {
                var portClone = clone(inPorts_2[0]);
                portClone[portClone.length - 1][2] = port.Key;
                portClone[1].transform = 'translate(' + inPorts_2[1][1]['s:x'] + ','
                    + (instartY_1 + i * ingap_1) + ')';
                tempclone.push(portClone);
            });
            this.outputPorts.forEach(function (port, i) {
                var portClone = clone(outPorts_2[0]);
                portClone[portClone.length - 1][2] = port.Key;
                portClone[1].transform = 'translate(' + outPorts_2[1][1]['s:x'] + ','
                    + (outstartY_1 + i * outgap_1) + ')';
                tempclone.push(portClone);
            });
            tempclone[2][2] = this.type;
        }
        return tempclone;
    };
    Cell.prototype.getGenericHeight = function () {
        var template = this.getTemplate();
        var inPorts = skin_1.getPortsWithPrefix(template, 'in');
        var outPorts = skin_1.getPortsWithPrefix(template, 'out');
        if (this.inputPorts.length > this.outputPorts.length) {
            var gap = Number(inPorts[1][1]['s:y']) - Number(inPorts[0][1]['s:y']);
            return Number(template[1]['s:height']) + gap * (this.inputPorts.length - 2);
        }
        if (outPorts.length > 1) {
            var gap = Number(outPorts[1][1]['s:y']) - Number(outPorts[0][1]['s:y']);
            return Number(template[1]['s:height']) + gap * (this.outputPorts.length - 2);
        }
        return Number(template[1]['s:height']);
    };
    return Cell;
}());
exports.default = Cell;
function setGenericSize(tempclone, height) {
    onml.traverse(tempclone, {
        enter: function (node) {
            if (node.name === 'rect' && node.attr['s:generic'] === 'body') {
                node.attr.height = height;
            }
        },
    });
}
function setTextAttribute(tempclone, attribute, value) {
    onml.traverse(tempclone, {
        enter: function (node) {
            if (node.name === 'text' && node.attr['s:attribute'] === attribute) {
                node.full[2] = value;
            }
        },
    });
}
function getBits(signals, indicesString) {
    var index = indicesString.indexOf(':');
    // is it the whole thing?
    if (index === -1) {
        return [signals[Number(indicesString)]];
    }
    else {
        var start = indicesString.slice(0, index);
        var end = indicesString.slice(index + 1);
        var slice = signals.slice(Number(start), Number(end) + 1);
        return slice;
    }
}
