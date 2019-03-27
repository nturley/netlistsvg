
namespace Yosys {
    export type Signals = Array<number | string>;

    interface ModuleMap {
        [moduleName: string]: Module;
    }

    export interface Netlist {
        modules: ModuleMap;
    }

    interface ModuleAttributes {
        top?: number;
        [attrName: string]: any;
    }

    export interface CellAttributes {
        value?: string;
        [attrName: string]: any;
    }

    export enum Direction {
        Input = 'input',
        Output = 'output',
    }

    export interface ExtPort {
        direction: Direction;
        bits: Signals;
    }

    interface ExtPortMap {
        [portName: string]: ExtPort;
    }

    export interface PortDirMap {
        [portName: string]: Direction;
    }

    export interface PortConnectionMap {
        [portName: string]: Signals;
    }

    export interface Cell {
        type: string;
        port_directions: PortDirMap;
        connections: PortConnectionMap;
        attributes?: CellAttributes;
    }

    export function getInputPortPids(cell: Cell): string[] {
        return Object.keys(cell.port_directions).filter((k) => cell.port_directions[k] === 'input');
    }

    export function getOutputPortPids(cell: Cell): string[] {
        return Object.keys(cell.port_directions).filter((k) => cell.port_directions[k] === 'output');
    }

    interface CellMap {
        [cellName: string]: Cell;
    }

    export interface Module {
        ports: ExtPortMap;
        cells: CellMap;
        attributes?: ModuleAttributes;
    }
}
export default Yosys;
