"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Yosys;
(function (Yosys) {
    var ConstantVal;
    (function (ConstantVal) {
        ConstantVal["Zero"] = "0";
        ConstantVal["One"] = "1";
        ConstantVal["X"] = "x";
    })(ConstantVal || (ConstantVal = {}));
    var Direction;
    (function (Direction) {
        Direction["Input"] = "input";
        Direction["Output"] = "output";
    })(Direction = Yosys.Direction || (Yosys.Direction = {}));
    function getInputPortPids(cell) {
        if (cell.port_directions) {
            return Object.keys(cell.port_directions).filter(function (k) {
                return cell.port_directions[k] === Direction.Input;
            });
        }
        return [];
    }
    Yosys.getInputPortPids = getInputPortPids;
    function getOutputPortPids(cell) {
        if (cell.port_directions) {
            return Object.keys(cell.port_directions).filter(function (k) {
                return cell.port_directions[k] === Direction.Output;
            });
        }
        return [];
    }
    Yosys.getOutputPortPids = getOutputPortPids;
    var HideName;
    (function (HideName) {
        HideName[HideName["Hide"] = 0] = "Hide";
        HideName[HideName["NoHide"] = 1] = "NoHide";
    })(HideName || (HideName = {}));
})(Yosys || (Yosys = {}));
exports.default = Yosys;
