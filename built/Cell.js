"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var FlatModule_1 = require("./FlatModule");
var YosysModel_1 = require("./YosysModel");
var Skin_1 = require("./Skin");
var Port_1 = require("./Port");
var _ = require("lodash");
var clone = require("clone");
var onml = require("onml");
var Cell = /** @class */ (function () {
    function Cell(key, type, inputPorts, outputPorts, attributes) {
        var _this = this;
        this.key = key;
        this.type = type;
        this.inputPorts = inputPorts;
        this.outputPorts = outputPorts;
        this.attributes = attributes || {};
        inputPorts.forEach(function (ip) {
            ip.parentNode = _this;
        });
        outputPorts.forEach(function (op) {
            op.parentNode = _this;
        });
    }
    /**
     * creates a Cell from a Yosys Port
     * @param yPort the Yosys Port with our port data
     * @param name the name of the port
     */
    Cell.fromPort = function (yPort, name) {
        var isInput = yPort.direction === YosysModel_1.default.Direction.Input;
        if (isInput) {
            return new Cell(name, '$_inputExt_', [], [new Port_1.Port('Y', yPort.bits)], {});
        }
        return new Cell(name, '$_outputExt_', [new Port_1.Port('A', yPort.bits)], [], {});
    };
    Cell.fromYosysCell = function (yCell, name) {
        this.setAlternateCellType(yCell);
        var template = Skin_1.default.findSkinType(yCell.type);
        var templateInputPids = Skin_1.default.getInputPids(template);
        var templateOutputPids = Skin_1.default.getOutputPids(template);
        var ports = _.map(yCell.connections, function (conn, portName) {
            return new Port_1.Port(portName, conn);
        });
        var inputPorts = ports.filter(function (port) { return port.keyIn(templateInputPids); });
        var outputPorts = ports.filter(function (port) { return port.keyIn(templateOutputPids); });
        if (inputPorts.length + outputPorts.length !== ports.length) {
            var inputPids_1 = YosysModel_1.default.getInputPortPids(yCell);
            var outputPids_1 = YosysModel_1.default.getOutputPortPids(yCell);
            inputPorts = ports.filter(function (port) { return port.keyIn(inputPids_1); });
            outputPorts = ports.filter(function (port) { return port.keyIn(outputPids_1); });
        }
        return new Cell(name, yCell.type, inputPorts, outputPorts, yCell.attributes);
    };
    Cell.fromConstantInfo = function (name, constants) {
        return new Cell(name, '$_constant_', [], [new Port_1.Port('Y', constants)], {});
    };
    /**
     * creates a join cell
     * @param target string name of net (starts and ends with and delimited by commas)
     * @param sources list of index strings (one number, or two numbers separated by a colon)
     */
    Cell.fromJoinInfo = function (target, sources) {
        var signalStrs = target.slice(1, -1).split(',');
        var signals = signalStrs.map(function (ss) { return Number(ss); });
        var joinOutPorts = [new Port_1.Port('Y', signals)];
        var inPorts = sources.map(function (name) {
            return new Port_1.Port(name, getBits(signals, name));
        });
        return new Cell('$join$' + target, '$_join_', inPorts, joinOutPorts, {});
    };
    /**
     * creates a split cell
     * @param source string name of net (starts and ends with and delimited by commas)
     * @param targets list of index strings (one number, or two numbers separated by a colon)
     */
    Cell.fromSplitInfo = function (source, targets) {
        // turn string into array of signal names
        var sigStrs = source.slice(1, -1).split(',');
        // convert the signals into actual numbers
        // after running constant pass, all signals should be numbers
        var signals = sigStrs.map(function (s) { return Number(s); });
        var inPorts = [new Port_1.Port('A', signals)];
        var splitOutPorts = targets.map(function (name) {
            var sigs = getBits(signals, name);
            return new Port_1.Port(name, sigs);
        });
        return new Cell('$split$' + source, '$_split_', inPorts, splitOutPorts, {});
    };
    // Set cells to alternate types/tags based on their parameters
    Cell.setAlternateCellType = function (yCell) {
        if ('parameters' in yCell) {
            // if it has a WIDTH parameter greater than one
            // and doesn't have an address parameter (not a memory cell)
            if ('WIDTH' in yCell.parameters &&
                yCell.parameters.WIDTH > 1 &&
                !('ADDR' in yCell.parameters)) {
                // turn into a bus version
                yCell.type = yCell.type + '-bus';
            }
        }
    };
    Object.defineProperty(Cell.prototype, "Type", {
        get: function () {
            return this.type;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Cell.prototype, "Key", {
        get: function () {
            return this.key;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Cell.prototype, "InputPorts", {
        get: function () {
            return this.inputPorts;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Cell.prototype, "OutputPorts", {
        get: function () {
            return this.outputPorts;
        },
        enumerable: false,
        configurable: true
    });
    Cell.prototype.maxOutVal = function (atLeast) {
        var maxVal = _.max(this.outputPorts.map(function (op) { return op.maxVal(); }));
        return _.max([maxVal, atLeast]);
    };
    Cell.prototype.findConstants = function (sigsByConstantName, maxNum, constantCollector) {
        this.inputPorts.forEach(function (ip) {
            maxNum = ip.findConstants(sigsByConstantName, maxNum, constantCollector);
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
        var template = Skin_1.default.findSkinType(this.type);
        var lateralPids = Skin_1.default.getLateralPortPids(template);
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
        return Skin_1.default.findSkinType(this.type);
    };
    Cell.prototype.buildElkChild = function () {
        var _this = this;
        var template = this.getTemplate();
        var type = template[1]['s:type'];
        var layoutAttrs = { 'org.eclipse.elk.portConstraints': 'FIXED_POS' };
        var fixedPosX = null;
        var fixedPosY = null;
        for (var attr in this.attributes) {
            if (attr.startsWith('org.eclipse.elk')) {
                if (attr === 'org.eclipse.elk.x') {
                    fixedPosX = this.attributes[attr];
                    continue;
                }
                if (attr === 'org.eclipse.elk.y') {
                    fixedPosY = this.attributes[attr];
                    continue;
                }
                layoutAttrs[attr] = this.attributes[attr];
            }
        }
        if (type === 'join' ||
            type === 'split' ||
            type === 'generic') {
            var inTemplates_1 = Skin_1.default.getPortsWithPrefix(template, 'in');
            var outTemplates_1 = Skin_1.default.getPortsWithPrefix(template, 'out');
            var inPorts = this.inputPorts.map(function (ip, i) {
                return ip.getGenericElkPort(i, inTemplates_1, 'in');
            });
            var outPorts = this.outputPorts.map(function (op, i) {
                return op.getGenericElkPort(i, outTemplates_1, 'out');
            });
            var cell = {
                id: this.key,
                width: Number(template[1]['s:width']),
                height: Number(this.getGenericHeight()),
                ports: inPorts.concat(outPorts),
                layoutOptions: layoutAttrs,
                labels: [],
            };
            if (fixedPosX) {
                cell.x = fixedPosX;
            }
            if (fixedPosY) {
                cell.y = fixedPosY;
            }
            this.addLabels(template, cell);
            return cell;
        }
        var ports = Skin_1.default.getPortsWithPrefix(template, '').map(function (tp) {
            return {
                id: _this.key + '.' + tp[1]['s:pid'],
                width: 0,
                height: 0,
                x: Number(tp[1]['s:x']),
                y: Number(tp[1]['s:y']),
            };
        });
        var nodeWidth = Number(template[1]['s:width']);
        var ret = {
            id: this.key,
            width: nodeWidth,
            height: Number(template[1]['s:height']),
            ports: ports,
            layoutOptions: layoutAttrs,
            labels: [],
        };
        if (fixedPosX) {
            ret.x = fixedPosX;
        }
        if (fixedPosY) {
            ret.y = fixedPosY;
        }
        this.addLabels(template, ret);
        return ret;
    };
    Cell.prototype.render = function (cell) {
        var template = this.getTemplate();
        var tempclone = clone(template);
        for (var _i = 0, _a = cell.labels; _i < _a.length; _i++) {
            var label = _a[_i];
            var labelIDSplit = label.id.split('.');
            var attrName = labelIDSplit[labelIDSplit.length - 1];
            setTextAttribute(tempclone, attrName, label.text);
        }
        for (var i = 2; i < tempclone.length; i++) {
            var node = tempclone[i];
            if (node[0] === 'text' && node[1]['s:attribute']) {
                var attrib = node[1]['s:attribute'];
                if (!(attrib in this.attributes)) {
                    node[2] = '';
                }
            }
        }
        tempclone[1].id = 'cell_' + this.key;
        tempclone[1].transform = 'translate(' + cell.x + ',' + cell.y + ')';
        if (this.type === '$_split_') {
            setGenericSize(tempclone, Number(this.getGenericHeight()));
            var outPorts_1 = Skin_1.default.getPortsWithPrefix(template, 'out');
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
            var inPorts_1 = Skin_1.default.getPortsWithPrefix(template, 'in');
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
            var inPorts_2 = Skin_1.default.getPortsWithPrefix(template, 'in');
            var ingap_1 = Number(inPorts_2[1][1]['s:y']) - Number(inPorts_2[0][1]['s:y']);
            var instartY_1 = Number(inPorts_2[0][1]['s:y']);
            var outPorts_2 = Skin_1.default.getPortsWithPrefix(template, 'out');
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
                portClone[1].id = 'port_' + port.parentNode.Key + '~' + port.Key;
                tempclone.push(portClone);
            });
            this.outputPorts.forEach(function (port, i) {
                var portClone = clone(outPorts_2[0]);
                portClone[portClone.length - 1][2] = port.Key;
                portClone[1].transform = 'translate(' + outPorts_2[1][1]['s:x'] + ','
                    + (outstartY_1 + i * outgap_1) + ')';
                portClone[1].id = 'port_' + port.parentNode.Key + '~' + port.Key;
                tempclone.push(portClone);
            });
            // first child of generic must be a text node.
            tempclone[2][2] = this.type;
        }
        setClass(tempclone, '$cell_id', 'cell_' + this.key);
        return tempclone;
    };
    Cell.prototype.addLabels = function (template, cell) {
        var _this = this;
        onml.traverse(template, {
            enter: function (node) {
                if (node.name === 'text' && node.attr['s:attribute']) {
                    var attrName = node.attr['s:attribute'];
                    var newString = void 0;
                    if (attrName === 'ref' || attrName === 'id') {
                        if (_this.type === '$_constant_' && _this.key.length > 3) {
                            var num = parseInt(_this.key, 2);
                            newString = '0x' + num.toString(16);
                        }
                        else {
                            newString = _this.key;
                        }
                        _this.attributes[attrName] = _this.key;
                    }
                    else if (attrName in _this.attributes) {
                        newString = _this.attributes[attrName];
                    }
                    else {
                        return;
                    }
                    cell.labels.push({
                        id: _this.key + '.label.' + attrName,
                        text: newString,
                        x: node.attr.x,
                        y: node.attr.y - 6,
                        height: 11,
                        width: (6 * newString.length),
                    });
                }
            },
        });
    };
    Cell.prototype.getGenericHeight = function () {
        var template = this.getTemplate();
        var inPorts = Skin_1.default.getPortsWithPrefix(template, 'in');
        var outPorts = Skin_1.default.getPortsWithPrefix(template, 'out');
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
function setClass(tempclone, searchKey, className) {
    onml.traverse(tempclone, {
        enter: function (node) {
            var currentClass = node.attr.class;
            if (currentClass && currentClass.includes(searchKey)) {
                node.attr.class = currentClass.replace(searchKey, className);
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
