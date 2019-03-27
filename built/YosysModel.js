"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Yosys;
(function (Yosys) {
    var Direction;
    (function (Direction) {
        Direction["Input"] = "input";
        Direction["Output"] = "output";
    })(Direction = Yosys.Direction || (Yosys.Direction = {}));
    function getInputPortPids(cell) {
        return Object.keys(cell.port_directions).filter(function (k) { return cell.port_directions[k] === 'input'; });
    }
    Yosys.getInputPortPids = getInputPortPids;
    function getOutputPortPids(cell) {
        return Object.keys(cell.port_directions).filter(function (k) { return cell.port_directions[k] === 'output'; });
    }
    Yosys.getOutputPortPids = getOutputPortPids;
})(Yosys || (Yosys = {}));
exports.default = Yosys;
