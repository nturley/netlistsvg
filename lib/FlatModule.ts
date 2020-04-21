import Yosys from './YosysModel';
import Config from './ConfigModel';
import Skin from './Skin';
import Cell from './Cell';
import _ = require('lodash');

export interface FlatPort {
    key: string;
    value?: number[] | Yosys.Signals;
    parentNode?: Cell;
    wire?: Wire;
}

export interface Wire {
    netName: string;
    drivers: FlatPort[];
    riders: FlatPort[];
    laterals: FlatPort[];
}

export class FlatModule {
    public static netlist: Yosys.Netlist;
    public static skin: any;
    public static layoutProps: {[x: string]: any};
    public static modNames: string[];
    public static config: Config;

    public static fromNetlist(netlist: Yosys.Netlist, config: Config): FlatModule {
        this.layoutProps = Skin.getProperties();
        this.modNames = Object.keys(netlist.modules);
        this.netlist = netlist;
        this.config = config;
        let topName = null;
        if (this.config.top.enable) {
            topName = this.config.top.module;
            if (!_.includes(this.modNames, topName)) {
                throw new Error('Top module in config file not defined in input json file.');
            }
        } else {
            _.forEach(netlist.modules, (mod: Yosys.Module, name: string) => {
                if (mod.attributes && Number(mod.attributes.top) === 1) {
                    topName = name;
                }
            });
            // Otherwise default the first one in the file...
            if (topName == null) {
                topName = this.modNames[0];
            }
        }
        const top = netlist.modules[topName];
        return new FlatModule(top, topName, 0);
    }

    public parent: string;
    public moduleName: string;
    public nodes: Cell[];
    public wires: Wire[];

    constructor(mod: Yosys.Module, name: string, depth: number, parent: string = null) {
        this.parent = parent;
        this.moduleName = name;
        let colour: string;
        if (FlatModule.config.hierarchy.colour[depth]) {
            colour = FlatModule.config.hierarchy.colour[depth];
        } else {
            colour = FlatModule.config.hierarchy.colour[FlatModule.config.hierarchy.colour.length - 1];
        }
        const ports = _.map(mod.ports, (port, portName) => Cell.fromPort(port, portName, this.moduleName));
        const cells = _.map(mod.cells, (c, key) => {
            switch (FlatModule.config.hierarchy.enable) {
                case 'level': {
                    if (FlatModule.config.hierarchy.expandLevel > depth) {
                        if (_.includes(FlatModule.modNames, c.type)) {
                            return Cell.createSubModule(c, key, this.moduleName, FlatModule.netlist.modules[c.type],
                                                        depth, colour);
                        } else {
                            return Cell.fromYosysCell(c, key, this.moduleName);
                        }
                    } else {
                        return Cell.fromYosysCell(c, key, this.moduleName);
                    }
                }
                case 'all': {
                    if (_.includes(FlatModule.modNames, c.type)) {
                        return Cell.createSubModule(c, key, this.moduleName, FlatModule.netlist.modules[c.type],
                                                    depth, colour);
                    } else {
                        return Cell.fromYosysCell(c, key, this.moduleName);
                    }
                }
                case 'modules': {
                    if (_.includes(FlatModule.config.hierarchy.expandModules.types, c.type) ||
                        _.includes(FlatModule.config.hierarchy.expandModules.ids, key)) {
                        if (!_.includes(FlatModule.modNames, c.type)) {
                            throw new Error('Submodule in config file not defined in input json file.');
                        }
                        return Cell.createSubModule(c, key, this.moduleName, FlatModule.netlist.modules[c.type],
                                                    depth, colour);
                    } else {
                        return Cell.fromYosysCell(c, key, this.moduleName);
                    }
                }
                default: {
                    return Cell.fromYosysCell(c, key, this.moduleName);
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

    // converts input ports with constant assignments to constant nodes
    public addConstants(): void {
        // find the maximum signal number
        let maxNum: number = this.nodes.reduce(((acc, v) => v.maxOutVal(acc)), -1);

        // add constants to nodes
        const signalsByConstantName: SigsByConstName = {};
        const cells: Cell[] = [];
        this.nodes.forEach((n) => {
            maxNum = n.findConstants(signalsByConstantName, maxNum, cells);
        });
        this.nodes = this.nodes.concat(cells);
    }

    // solves for minimal bus splits and joins and adds them to module
    public addSplitsJoins(): void {
        const allInputs = _.flatMap(this.nodes, (n) => n.inputPortVals());
        const allOutputs = _.flatMap(this.nodes, (n) => n.outputPortVals());

        const allInputsCopy = allInputs.slice();
        const splits: SplitJoin = {};
        const joins: SplitJoin = {};
        allInputs.forEach((input) => {
            gather(
                allOutputs,
                allInputsCopy,
                input,
                0,
                input.length,
                splits,
                joins);
        });

        this.nodes = this.nodes.concat(_.map(joins, (joinOutput, joinInputs) => {
            return Cell.fromJoinInfo(joinInputs, joinOutput, this.moduleName);
        })).concat(_.map(splits, (splitOutputs, splitInput) => {
            return Cell.fromSplitInfo(splitInput, splitOutputs, this.moduleName);
        }));
    }

    // search through all the ports to find all of the wires
    public createWires() {
        const ridersByNet: NameToPorts = {};
        const driversByNet: NameToPorts = {};
        const lateralsByNet: NameToPorts = {};
        this.nodes.forEach((n) => {
            n.collectPortsByDirection(
                ridersByNet,
                driversByNet,
                lateralsByNet,
                FlatModule.layoutProps.genericsLaterals as boolean);
        });
        // list of unique nets
        const nets = removeDups(_.keys(ridersByNet).concat(_.keys(driversByNet)).concat(_.keys(lateralsByNet)));
        const wires: Wire[] = nets.map((net) => {
            const drivers: FlatPort[] = driversByNet[net] || [];
            const riders: FlatPort[] = ridersByNet[net] || [];
            const laterals: FlatPort[] = lateralsByNet[net] || [];
            const wire: Wire = { netName: net, drivers, riders, laterals};
            drivers.concat(riders).concat(laterals).forEach((port) => {
                port.wire = wire;
            });
            return wire;
        });
        this.wires = wires;
    }
}

export interface SigsByConstName {
    [constantName: string]: number[];
}

// returns a string that represents the values of the array of integers
// [1, 2, 3] -> ',1,2,3,'
export function arrayToBitstring(bitArray: number[]): string {
    let ret: string = '';
    bitArray.forEach((bit: number) => {
        const sbit = String(bit);
        if (ret === '') {
            ret = sbit;
        } else {
            ret += ',' + sbit;
        }
    });
    return ',' + ret + ',';
}

// returns whether needle is a substring of haystack
function arrayContains(needle: string, haystack: string | string[]): boolean {
    return (haystack.indexOf(needle) > -1);
}

// returns the index of the string that contains a substring
// given arrhaystack, an array of strings
function indexOfContains(needle: string, arrhaystack: string[]): number {
    return _.findIndex(arrhaystack, (haystack: string) => {
        return arrayContains(needle, haystack);
    });
}

interface SplitJoin {
    [portName: string]: string[];
}

export function addToDefaultDict(dict: any, key: string, value: any): void {
    if (dict[key] === undefined) {
        dict[key] = [value];
    } else {
        dict[key].push(value);
    }
}

// string (for labels), that represents an index
// or range of indices.
function getIndicesString(bitstring: string,
                          query: string,
                          start: number): string {
    const splitStart: number = _.max([bitstring.indexOf(query), start]);
    const startIndex: number = bitstring.substring(0, splitStart).split(',').length - 1;
    const endIndex: number = startIndex + query.split(',').length - 3;

    if (startIndex === endIndex) {
        return String(startIndex);
    } else {
        return String(startIndex) + ':' + String(endIndex);
    }
}

// gather splits and joins
function gather(inputs: string[],  // all inputs
                outputs: string[], // all outputs
                toSolve: string, // an input array we are trying to solve
                start: number,   // index of toSolve to start from
                end: number,     // index of toSolve to end at
                splits: SplitJoin,  // container collecting the splits
                joins: SplitJoin): void {  // container collecting the joins
    // remove myself from outputs list if present
    const outputIndex: number = outputs.indexOf(toSolve);
    if (outputIndex !== -1) {
        outputs.splice(outputIndex, 1);
    }

    // This toSolve is compconste
    if (start >= toSolve.length || end - start < 2) {
        return;
    }

    const query: string = toSolve.slice(start, end);

    // are there are perfect matches?
    if (arrayContains(query, inputs)) {
        if (query !== toSolve) {
            addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
        }
        gather(inputs, outputs, toSolve, end - 1, toSolve.length, splits, joins);
        return;
    }
    const index: number = indexOfContains(query, inputs);
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

export interface NameToPorts {
    [netName: string]: FlatPort[];
}

interface StringToBool {
    [s: string]: boolean;
}

export function removeDups(inStrs: string[]): string[] {
    const map: StringToBool = {};
    inStrs.forEach((str) => {
        map[str] = true;
    });
    return _.keys(map);
}
