import { CellAttributes, Signals, YosysModule } from './YosysModel';
import { getProperties, findSkinType, getLateralPortPids } from './skin';
import _ = require('lodash');

export interface FlatPort {
    key: string;
    value?: number[] | Signals;
    parentNode?: Cell;
    wire?: Wire;
}

export interface Wire {
    drivers: FlatPort[];
    riders: FlatPort[];
    laterals: FlatPort[];
}

export interface IFlatModule {
    nodes: Cell[];
    wires: Wire[];
}

export interface Cell {
    key: string;
    type: string;
    inputPorts: FlatPort[];
    outputPorts: FlatPort[];
    attributes?: CellAttributes;
}

export class FlatModule {
    private moduleName: string;
    private nodes: Cell[];
    private wires: Wire[];
    private skin: any;

    constructor(yModule: YosysModule, skin) {
        this.moduleName = yModule.moduleName;
        const cells = yModule.getFlatCells(skin);
        const portCells = yModule.getPortCells();
        this.nodes = cells.concat(portCells);
        this.wires = [];
        this.skin = skin;
    }

    public getNodes(): Cell[] {
        return this.nodes;
    }

    public getWires(): Wire[] {
        return this.wires;
    }

    public getName(): string {
        return this.moduleName;
    }

    public getSkin(): any {
        return this.skin;
    }

    // converts input ports with constant assignments to constant nodes
    public addConstants(): void {
        // find the maximum signal number
        let maxNum: number = -1;
        this.nodes.forEach((n) => {
            n.outputPorts.forEach((p) => {
                const maxVal: number = _.max(_.map(p.value, (v) => {
                    return Number(v);
                }));
                maxNum = _.max([maxNum, maxVal]);
            });
        });

        // add constants to nodes
        const signalsByConstantName: SigsByConstName = {};
        this.nodes.forEach((n) => {
            n.inputPorts.forEach((p) => {
                let constNameCollector = '';
                let constNumCollector: number[] = [];
                const portSigs: Signals = p.value;
                portSigs.forEach((portSig, portSigIndex) => {
                    const portSigNum = Number(portSig);
                    // is constant?
                    if (portSig === '0' || portSig === '1') {
                        maxNum += 1;
                        constNameCollector += portSig;
                        // replace the constant with new signal num
                        portSigs[portSigIndex] = maxNum;
                        constNumCollector.push(maxNum);
                    // string of constants ended before end of p.value
                    } else if (constNumCollector.length > 0) {
                        this.assignConstant(constNameCollector,
                                    constNumCollector,
                                    portSigIndex,
                                    signalsByConstantName,
                                    portSigs);
                        // reset name and num collectors
                        constNameCollector = '';
                        constNumCollector = [];
                    }
                });
                if (constNumCollector.length > 0) {
                    this.assignConstant(constNameCollector,
                                constNumCollector,
                                portSigs.length,
                                signalsByConstantName,
                                portSigs);
                }
            });
        });
    }

    // solves for minimal bus splits and joins and adds them to module
    public addSplitsJoins() {
        const allInputs = [];
        const allOutputs = [];
        this.nodes.forEach((n) => {
            n.inputPorts.forEach((i) => {
                allInputs.push(',' + i.value.join() + ',');
            });
            n.outputPorts.forEach((i) => {
                allOutputs.push(',' + i.value.join() + ',');
            });
        });

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

        for (const target of Object.keys(joins)) {
            // turn string into array of signal names
            const signalStrs: string[] = target.slice(1, -1).split(',');
            const signals: Signals = _.map(signalStrs, (ss) =>  Number(ss) );
            const joinOutPorts: FlatPort[] = [{ key: 'Y', value: signals }];
            const inPorts: FlatPort[] = [];
            joins[target].forEach((name) => {
                const sigs: Signals = getBits(signals, name);
                inPorts.push({ key: name, value: sigs });
            });
            this.nodes.push({
                key: '$join$' + target,
                type: '$_join_',
                inputPorts: inPorts,
                outputPorts: joinOutPorts,
            });
        }

        for (const source of Object.keys(splits)) {
            // turn string into array of signal names
            const signals: Signals = source.slice(1, -1).split(',');
            // convert the signals into actual numbers
            // after running constant pass, all signals should be numbers
            for (const i of Object.keys(signals)) {
                signals[i] = Number(signals[i]);
            }
            const inPorts: FlatPort[] = [{ key: 'A', value: signals }];
            const splitOutPorts: FlatPort[] = [];
            splits[source].forEach((name) => {
                const sigs: Signals = getBits(signals, name);
                splitOutPorts.push({ key: name, value: sigs });
            });
            this.nodes.push({
                key: '$split$' + source,
                type: '$_split_',
                inputPorts: inPorts,
                outputPorts: splitOutPorts,
            });
        }
    }

    // search through all the ports to find all of the wires
    public createWires() {
        const layoutProps = getProperties(this.skin);
        const ridersByNet: NameToPorts = {};
        const driversByNet: NameToPorts = {};
        const lateralsByNet: NameToPorts = {};
        this.nodes.forEach((n) => {
            const template = findSkinType(this.skin, n.type);
            const lateralPids = getLateralPortPids(template);
            // find all ports connected to the same net
            n.inputPorts.forEach((port) => {
                port.parentNode = n;
                const portSigs: number[] = port.value as number[];
                const isLateral = lateralPids.indexOf(port.key) !== -1;
                if (isLateral || (template[1]['s:type'] === 'generic' && layoutProps.genericsLaterals)) {
                    addToDefaultDict(lateralsByNet, arrayToBitstring(portSigs), port);
                } else {
                    addToDefaultDict(ridersByNet, arrayToBitstring(portSigs), port);
                }
            });
            n.outputPorts.forEach((port) => {
                port.parentNode = n;
                const portSigs: number[] = port.value as number[];
                const isLateral = lateralPids.indexOf(port.key) !== -1;
                if (isLateral || (template[1]['s:type'] === 'generic' && layoutProps.genericsLaterals)) {
                    addToDefaultDict(lateralsByNet, arrayToBitstring(portSigs), port);
                } else {
                    addToDefaultDict(driversByNet, arrayToBitstring(portSigs), port);
                }
            });
        });
        // list of unique nets
        const nets = removeDups(_.keys(ridersByNet).concat(_.keys(driversByNet)).concat(_.keys(lateralsByNet)));
        const wires: Wire[] = nets.map((net) => {
            const drivers: FlatPort[] = driversByNet[net] || [];
            const riders: FlatPort[] = ridersByNet[net] || [];
            const laterals: FlatPort[] = lateralsByNet[net] || [];
            const wire: Wire = { drivers, riders, laterals};
            drivers.concat(riders).concat(laterals).forEach((port) => {
                port.wire = wire;
            });
            return wire;
        });
        this.wires = wires;
    }

    private assignConstant(nameCollector: string,
                           constants: number[],
                           currIndex: number,
                           signalsByConstantName: SigsByConstName,
                           portSignals: Signals) {
        // we've been appending to nameCollector, so reverse to get const name
        const constName = nameCollector.split('').reverse().join('');
        // if the constant has already been used
        if (signalsByConstantName.hasOwnProperty(constName)) {
            const constSigs: number[] = signalsByConstantName[constName];
            // go back and fix signal values
            const constLength = constSigs.length;
            constSigs.forEach((constSig, constIndex) => {
                // i is where in port_signals we need to update
                const i: number = currIndex - constLength + constIndex;
                portSignals[i] = constSig;
            });
        } else {
            const constant: Cell = {
                key: constName,
                type: '$_constant_',
                inputPorts: [],
                outputPorts: [{ key: 'Y', value: constants }],
            };
            this.nodes.push(constant);
            signalsByConstantName[constName] = constants;
        }
    }
}

interface SigsByConstName {
    [constantName: string]: number[];
}

// returns a string that represents the values of the array of integers
// [1, 2, 3] -> ',1,2,3,'
function arrayToBitstring(bitArray: number[]): string {
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

function getBits(signals: Signals, indicesString: string) {
    const index = indicesString.indexOf(':');
    // is it the whole thing?
    if (index === -1) {
        return [signals[Number(indicesString)]];
    } else {
        const start = indicesString.slice(0, index);
        const end = indicesString.slice(index + 1);
        const slice = signals.slice(Number(start), Number(end) + 1);
        return slice;
    }
}

interface SplitJoin {
    [portName: string]: string[];
}

function addToDefaultDict(dict: any, key: string, value: any) {
    if (dict[key] === undefined) {
        dict[key] = [value];
    } else {
        dict[key].push(value);
    }
}

// string (for labels), that represents an index
// or range of indices.
function getIndicesString(bitstring: string, query: string, start: number): string {
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
                joins: SplitJoin) {  // container collecting the joins
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

interface NameToPorts {
    [netName: string]: FlatPort[];
}

interface StringToBool {
    [s: string]: boolean;
}

export function removeDups(inStrs: string[]) {
    const map: StringToBool = {};
    inStrs.forEach((str) => {
        map[str] = true;
    });
    return _.keys(map);
}
