import { Cell } from './FlatModule';
import { findSkinType, getInputPortPids, getOutputPortPids } from './skin';
import _ = require('lodash');

export type Signals = Array<number | string>;

interface ModuleMap {
    [moduleName: string]: IYosysModule;
}

export interface YosysNetlist {
    modules: ModuleMap;
}

interface YosysModuleAttributes {
    top?: number;
    [attrName: string]: any;
}

export interface CellAttributes {
    value?: string;
    [attrName: string]: any;
}

enum Direction {
    Input = 'input',
    Output = 'output',
}

interface YosysExtPort {
    direction: Direction;
    bits: Signals;
}

interface YosysExtPortMap {
    [portName: string]: YosysExtPort;
}

interface YosysPortDirMap {
    [portName: string]: Direction;
}

interface YosysPortConnectionMap {
    [portName: string]: Signals;
}

interface YosysCell {
    type: string;
    port_directions: YosysPortDirMap;
    connections: YosysPortConnectionMap;
    attributes?: CellAttributes;
}

interface YosysCellMap {
    [cellName: string]: YosysCell;
}

interface IYosysModule {
    ports: YosysExtPortMap;
    cells: YosysCellMap;
    attributes?: YosysModuleAttributes;
}

export class YosysModule {
    public moduleName: string;
    private ports: YosysExtPortMap;
    private cells: YosysCellMap;
    private attributes?: YosysModuleAttributes;

    constructor(netlist: YosysNetlist) {
        this.moduleName = null;
        _.forEach(netlist.modules, (mod: IYosysModule, name: string) => {
            if (mod.attributes && mod.attributes.top === 1) {
                this.moduleName = name;
            }
        });
        // Otherwise default the first one in the file...
        if (this.moduleName == null) {
            this.moduleName = Object.keys(netlist.modules)[0];
        }
        const top = netlist.modules[this.moduleName];
        this.ports = top.ports;
        this.cells = top.cells;
        this.attributes = top.attributes;
    }

    public getFlatCells(skin): Cell[] {
        const mcells = this.toCellArray(this.cells);
        mcells.forEach((c: Cell, i: number) => {
            const yosysCell: YosysCell = this.cells[c.key];
            const template = findSkinType(skin, c.type);
            if (!yosysCell.port_directions) {
                yosysCell.port_directions = {};
            }
            getInputPortPids(template).forEach((pid) => {
                yosysCell.port_directions[pid] = Direction.Input;
            });
            getOutputPortPids(template).forEach((pid) => {
                yosysCell.port_directions[pid] = Direction.Output;
            });
            c.inputPorts = getCellPortList(yosysCell, Direction.Input);
            c.outputPorts = getCellPortList(yosysCell, Direction.Output);
        });
        return mcells;
    }

    public getPortCells(): Cell[] {
        const allPorts: Cell[] = this.toCellArray(this.ports);
        allPorts.forEach((p: Cell, i: number) => {
            const yosysPort: YosysExtPort = this.ports[p.key];
            const isInput: boolean = yosysPort.direction === Direction.Input;
            if (isInput) {
                p.type = '$_inputExt_';
                p.inputPorts = [];
                p.outputPorts = [{ key: 'Y', value: yosysPort.bits }];
            } else {
                p.type = '$_outputExt_';
                p.inputPorts = [{ key: 'A', value: yosysPort.bits }];
                p.outputPorts = [];
            }
        });
        return allPorts;
    }

    private toCellArray(assoc: YosysCellMap | YosysExtPortMap): Cell[] {
        return _.flatMap(assoc, (val: YosysCell, key: string) => {
            const c: Cell = {
                key,
                type: val.type,
                inputPorts: [],
                outputPorts: [],
            };
            if (val.attributes) {
                c.attributes = val.attributes;
            }
            return c;
        });
    }
}

// returns an array of ports that are going a specific direction
// the elements in this array are obects whose members are key and value
// where key is the port name and value is the connection array
function getCellPortList(cell: YosysCell, direction: Direction) {
    const ports = _.filter(_.flatMap(cell.connections, (val, key) => {
        return { key, value: val };
    }), (val) => {
        return cell.port_directions[val.key] === direction;
    });
    return ports;
}
