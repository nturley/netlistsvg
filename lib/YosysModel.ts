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

export enum Direction {
    Input = 'input',
    Output = 'output',
}

export interface YosysExtPort {
    direction: Direction;
    bits: Signals;
}

interface YosysExtPortMap {
    [portName: string]: YosysExtPort;
}

export interface YosysPortDirMap {
    [portName: string]: Direction;
}

export interface YosysPortConnectionMap {
    [portName: string]: Signals;
}

export interface IYosysCell {
    type: string;
    port_directions: YosysPortDirMap;
    connections: YosysPortConnectionMap;
    attributes?: CellAttributes;
}

export function getInputPortPids(cell: IYosysCell): string[] {
    return Object.keys(cell.port_directions).filter((k) => cell.port_directions[k] === 'input');
}

export function getOutputPortPids(cell: IYosysCell): string[] {
    return Object.keys(cell.port_directions).filter((k) => cell.port_directions[k] === 'output');
}

interface YosysCellMap {
    [cellName: string]: IYosysCell;
}

export interface IYosysModule {
    ports: YosysExtPortMap;
    cells: YosysCellMap;
    attributes?: YosysModuleAttributes;
}
