"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var FlatModule_1 = require("./FlatModule");
var YosysModel_1 = require("./YosysModel");
var Skin_1 = require("./Skin");
var Port_1 = require("./Port");
var drawModule_1 = require("./drawModule");
var _ = require("lodash");
var elkGraph_1 = require("./elkGraph");
var clone = require("clone");
var onml = require("onml");
var Cell = /** @class */ (function () {
    function Cell(key, type, inputPorts, outputPorts, attributes, parent, subModule, subColour) {
        var _this = this;
        if (subModule === void 0) { subModule = null; }
        if (subColour === void 0) { subColour = null; }
        this.key = key;
        this.type = type;
        this.inputPorts = inputPorts;
        this.outputPorts = outputPorts;
        this.attributes = attributes || {};
        this.parent = parent;
        this.subModule = subModule;
        this.colour = subColour;
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
    Cell.fromPort = function (yPort, name, parent) {
        var isInput = yPort.direction === YosysModel_1.default.Direction.Input;
        if (isInput) {
            return new Cell(name, '$_inputExt_', [], [new Port_1.Port('Y', yPort.bits)], {}, parent);
        }
        return new Cell(name, '$_outputExt_', [new Port_1.Port('A', yPort.bits)], [], {}, parent);
    };
    Cell.fromYosysCell = function (yCell, name, parent) {
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
        var sigStrs = source.slice(1, -1).split(',');
        // convert the signals into actual numbers
        // after running constant pass, all signals should be numbers
        var signals = sigStrs.map(function (s) { return Number(s); });
        var inPorts = [new Port_1.Port('A', signals)];
        var splitOutPorts = targets.map(function (name) {
            var sigs = getBits(signals, name);
            return new Port_1.Port(name, sigs);
        });
        return new Cell('$split$' + source, '$_split_', inPorts, splitOutPorts, {}, parent);
    };
    Cell.createSubModule = function (yCell, name, parent, subModule, depth, colour) {
        var template = Skin_1.default.findSkinType(yCell.type);
        var templateInputPids = Skin_1.default.getInputPids(template);
        var templateOutputPids = Skin_1.default.getOutputPids(template);
        var ports = _.map(yCell.connections, function (conn, portName) {
            return new Port_1.Port(portName, conn);
        });
        var inputPorts = ports.filter(function (port) { return port.keyIn(templateInputPids); });
        var outputPorts = ports.filter(function (port) { return port.keyIn(templateOutputPids); });
        if (inputPorts.length + outputPorts.length !== ports.length) {
            var inputPids_2 = YosysModel_1.default.getInputPortPids(yCell);
            var outputPids_2 = YosysModel_1.default.getOutputPortPids(yCell);
            inputPorts = ports.filter(function (port) { return port.keyIn(inputPids_2); });
            outputPorts = ports.filter(function (port) { return port.keyIn(outputPids_2); });
        }
        var mod = new FlatModule_1.FlatModule(subModule, name, depth + 1, parent);
        return new Cell(name, yCell.type, inputPorts, outputPorts, yCell.attributes, parent, mod, colour);
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
            (type === 'generic' && this.subModule === null)) {
            var inTemplates_1 = Skin_1.default.getPortsWithPrefix(template, 'in');
            var outTemplates_1 = Skin_1.default.getPortsWithPrefix(template, 'out');
            var inPorts = this.inputPorts.map(function (ip, i) {
                return ip.getGenericElkPort(i, inTemplates_1, 'in');
            });
            var outPorts = this.outputPorts.map(function (op, i) {
                return op.getGenericElkPort(i, outTemplates_1, 'out');
            });
            var cell = {
                id: this.parent + '.' + this.key,
                width: Number(template[1]['s:width']),
                height: Number(this.getGenericHeight()),
                ports: inPorts.concat(outPorts),
                layoutOptions: layoutAttrs,
                labels: [],
            };
            if (type === 'split') {
                cell.ports[0].y = cell.height / 2;
            }
            if (type === 'join') {
                cell.ports[cell.ports.length - 1].y = cell.height / 2;
            }
            if (fixedPosX) {
                cell.x = fixedPosX;
            }
            if (fixedPosY) {
                cell.y = fixedPosY;
            }
            this.addLabels(template, cell);
            return cell;
        }
        if (type === 'generic' && this.subModule !== null) {
            var inTemplates_2 = Skin_1.default.getPortsWithPrefix(template, 'in');
            var outTemplates_2 = Skin_1.default.getPortsWithPrefix(template, 'out');
            var inPorts_1 = this.inputPorts.map(function (ip, i) {
                return ip.getGenericElkPort(i, inTemplates_2, 'in');
            });
            var outPorts = this.outputPorts.map(function (op, i) {
                return op.getGenericElkPort(i, outTemplates_2, 'out');
            });
            var elk = elkGraph_1.buildElkGraph(this.subModule);
            var cell_1 = {
                id: this.parent + '.' + this.key,
                layoutOptions: { 'org.eclipse.elk.portConstraints': 'FIXED_SIDE' },
                labels: [],
                ports: inPorts_1.concat(outPorts),
                children: [],
                edges: [],
            };
            _.forEach(elk.children, function (child) {
                var inc = true;
                _.forEach(cell_1.ports, function (port) {
                    if (_this.parent + '.' + child.id === port.id) {
                        inc = false;
                    }
                });
                if (inc) {
                    cell_1.children.push(child);
                }
            });
            _.forEach(elk.edges, function (edge) {
                var edgeAdd = edge;
                _.forEach(cell_1.ports, function (port) {
                    if (_.includes(inPorts_1, port)) {
                        if (edgeAdd.sourcePort === port.id.slice(_this.parent.length + 1) + '.Y') {
                            var source = port.id.split('.');
                            source.pop();
                            edgeAdd.source = source.join('.');
                            edgeAdd.sourcePort = port.id;
                        }
                    }
                    else {
                        if (edgeAdd.targetPort === port.id.slice(_this.parent.length + 1) + '.A') {
                            var target = port.id.split('.');
                            target.pop();
                            edgeAdd.target = target.join('.');
                            edgeAdd.targetPort = port.id;
                        }
                    }
                });
                if (edgeAdd.source === edgeAdd.target) {
                    var dummyId = _this.subModule.moduleName + '.$d_' + edgeAdd.sourcePort + '_' + edgeAdd.targetPort;
                    var dummy = {
                        id: dummyId,
                        width: 0,
                        height: 0,
                        ports: [
                            {
                                id: dummyId + '.pin',
                                width: 0,
                                height: 0,
                            },
                            {
                                id: dummyId + '.pout',
                                width: 0,
                                height: 0,
                            },
                        ],
                        layoutOptions: { 'org.eclipse.elk.portConstraints': 'FIXED_SIDE' },
                    };
                    var edgeId = edgeAdd.id;
                    var edgeAddCopy = __assign({}, edgeAdd);
                    edgeAdd.target = dummyId;
                    edgeAdd.targetPort = dummyId + '.pin';
                    edgeAdd.id = _this.subModule.moduleName + '.e_' + edgeAdd.sourcePort + '_' + edgeAdd.targetPort;
                    elkGraph_1.ElkModel.wireNameLookup[edgeAdd.id] = elkGraph_1.ElkModel.wireNameLookup[edgeId];
                    edgeAddCopy.source = dummyId;
                    edgeAddCopy.sourcePort = dummyId + '.pout';
                    edgeAddCopy.id = _this.subModule.moduleName + '.e_' + edgeAddCopy.sourcePort +
                        '_' + edgeAddCopy.targetPort;
                    elkGraph_1.ElkModel.wireNameLookup[edgeAddCopy.id] = elkGraph_1.ElkModel.wireNameLookup[edgeId];
                    cell_1.edges.push(edgeAdd, edgeAddCopy);
                    cell_1.children.push(dummy);
                }
                else {
                    cell_1.edges.push(edgeAdd);
                }
            });
            if (fixedPosX) {
                cell_1.x = fixedPosX;
            }
            if (fixedPosY) {
                cell_1.y = fixedPosY;
            }
            this.addLabels(template, cell_1);
            return cell_1;
        }
        var ports = Skin_1.default.getPortsWithPrefix(template, '').map(function (tp) {
            return {
                id: _this.parent + '.' + _this.key + '.' + tp[1]['s:pid'],
                width: 0,
                height: 0,
                x: Number(tp[1]['s:x']),
                y: Number(tp[1]['s:y']),
            };
        });
        var nodeWidth = Number(template[1]['s:width']);
        var ret = {
            id: this.parent + '.' + this.key,
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
            var attrName = label.id.split('.')[2];
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
            var inPorts_2 = Skin_1.default.getPortsWithPrefix(template, 'in');
            var gap_2 = Number(inPorts_2[1][1]['s:y']) - Number(inPorts_2[0][1]['s:y']);
            var startY_2 = Number(inPorts_2[0][1]['s:y']);
            tempclone.pop();
            tempclone.pop();
            this.inputPorts.forEach(function (port, i) {
                var portClone = clone(inPorts_2[0]);
                portClone[portClone.length - 1][2] = port.Key;
                portClone[1].transform = 'translate(' + inPorts_2[1][1]['s:x'] + ','
                    + (startY_2 + i * gap_2) + ')';
                tempclone.push(portClone);
            });
        }
        else if (template[1]['s:type'] === 'generic' && this.subModule === null) {
            setGenericSize(tempclone, Number(this.getGenericHeight()));
            var inPorts_3 = Skin_1.default.getPortsWithPrefix(template, 'in');
            var ingap_1 = Number(inPorts_3[1][1]['s:y']) - Number(inPorts_3[0][1]['s:y']);
            var instartY_1 = Number(inPorts_3[0][1]['s:y']);
            var outPorts_2 = Skin_1.default.getPortsWithPrefix(template, 'out');
            var outgap_1 = Number(outPorts_2[1][1]['s:y']) - Number(outPorts_2[0][1]['s:y']);
            var outstartY_1 = Number(outPorts_2[0][1]['s:y']);
            tempclone.pop();
            tempclone.pop();
            tempclone.pop();
            tempclone.pop();
            this.inputPorts.forEach(function (port, i) {
                var portClone = clone(inPorts_3[0]);
                portClone[portClone.length - 1][2] = port.Key;
                portClone[1].transform = 'translate(' + inPorts_3[1][1]['s:x'] + ','
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
        else if (template[1]['s:type'] === 'generic' && this.subModule !== null) {
            var subModule = drawModule_1.drawSubModule(cell, this.subModule);
            tempclone[3][1].width = subModule[1].width;
            tempclone[3][1].height = subModule[1].height;
            tempclone[3][1].fill = this.colour;
            tempclone[3][1].rx = '4';
            tempclone[2][1].x = tempclone[3][1].width / 2;
            tempclone[2][2] = this.type;
            tempclone.pop();
            tempclone.pop();
            tempclone.pop();
            tempclone.pop();
            subModule.shift();
            subModule.shift();
            _.forEach(subModule, function (child) { return tempclone.push(child); });
            var inPorts_4 = Skin_1.default.getPortsWithPrefix(template, 'in');
            var outPorts_3 = Skin_1.default.getPortsWithPrefix(template, 'out');
            this.inputPorts.forEach(function (port, i) {
                var portElk = _.find(cell.ports, function (p) { return p.id === cell.id + '.' + port.Key; });
                var portClone = clone(inPorts_4[0]);
                portClone[portClone.length - 1][2] = port.Key;
                portClone[1].transform = 'translate(' + portElk.x + ','
                    + portElk.y + ')';
                portClone[1].id = 'port_' + port.parentNode.Key + '~' + port.Key;
                tempclone.push(portClone);
            });
            this.outputPorts.forEach(function (port, i) {
                var portElk = _.find(cell.ports, function (p) { return p.id === cell.id + '.' + port.Key; });
                var portClone = clone(outPorts_3[0]);
                portClone[portClone.length - 1][2] = port.Key;
                portClone[1].transform = 'translate(' + portElk.x + ','
                    + portElk.y + ')';
                portClone[1].id = 'port_' + port.parentNode.Key + '~' + port.Key;
                tempclone.push(portClone);
            });
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
