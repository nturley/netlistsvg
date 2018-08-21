import { IFlatPort, SigsByConstName, getBits } from './FlatModule';
import { CellAttributes, IYosysCell, YosysExtPort, Direction, Signals } from './YosysModel';
import { findSkinType, getInputPortPids, getOutputPortPids } from './skin';
import _ = require('lodash');

export class Cell {

    public static fromPort(yPort: YosysExtPort, name: string): Cell {
        const isInput: boolean = yPort.direction === Direction.Input;
        if (isInput) {
            return new Cell(name, '$_inputExt_', [], [{ key: 'Y', value: yPort.bits }], {});
        }
        return new Cell(name, '$_outputExt_', [{ key: 'A', value: yPort.bits }], [], {});
    }

    public static fromYosysCell(yCell: IYosysCell, name: string, skin: any) {
        const template = findSkinType(skin, yCell.type);
        const inputPids: string[] = getInputPortPids(template);
        const outputPids: string[] = getOutputPortPids(template);
        const ports: IFlatPort[] = _.map(yCell.connections, (conn, portName) => {
            return { key: portName, value: conn};
        });
        const inputPorts = ports.filter((port) => {
            return _.includes(inputPids, port.key);
        });
        const outputPorts = ports.filter((port) => {
            return _.includes(outputPids, port.key);
        });
        return new Cell(name, yCell.type, inputPorts, outputPorts, yCell.attributes);
    }

    public static fromConstantInfo(name: string, constants: number[]): Cell {
        return new Cell(name, '$_constant_', [], [{ key: 'Y', value: constants }], {});
    }

    public static fromJoinInfo(target: string, sources: string[]): Cell {
        const signalStrs: string[] = target.slice(1, -1).split(',');
        const signals: Signals = _.map(signalStrs, (ss) =>  Number(ss) );
        const joinOutPorts: IFlatPort[] = [{ key: 'Y', value: signals }];
        const inPorts: IFlatPort[] = [];
        sources.forEach((name) => {
            const sigs: Signals = getBits(signals, name);
            inPorts.push({ key: name, value: sigs });
        });
        return new Cell('$join$' + target, '$_join_', inPorts, joinOutPorts, {});
    }

    public static fromSplitInfo(source: string, targets: string[]): Cell {
        // turn string into array of signal names
        const signals: Signals = source.slice(1, -1).split(',');
        // convert the signals into actual numbers
        // after running constant pass, all signals should be numbers
        for (const i of Object.keys(signals)) {
            signals[i] = Number(signals[i]);
        }
        const inPorts: IFlatPort[] = [{ key: 'A', value: signals }];
        const splitOutPorts: IFlatPort[] = [];
        targets.forEach((name) => {
            const sigs: Signals = getBits(signals, name);
            splitOutPorts.push({ key: name, value: sigs });
        });
        return new Cell('$split$' + source, '$_split_', inPorts, splitOutPorts, {});
    }

    private key: string;
    private type: string;
    private inputPorts: IFlatPort[];
    private outputPorts: IFlatPort[];
    private attributes: CellAttributes;

    constructor(key: string,
                type: string,
                inputPorts: IFlatPort[],
                outputPorts: IFlatPort[],
                attributes: CellAttributes) {
        this.key = key;
        this.type = type;
        this.inputPorts = inputPorts;
        this.outputPorts = outputPorts;
        this.attributes = attributes;
    }

    public maxOutVal(atLeast: number): number {
        let maxNum: number = atLeast;
        this.outputPorts.forEach((p) => {
            const maxVal: number = _.max(_.map(p.value, (v) => {
                return Number(v);
            }));
            maxNum = _.max([maxNum, maxVal]);
        });
        return maxNum;
    }

    public findConstants(sigsByConstantName: SigsByConstName,
                         maxNum: number,
                         constantCollector: Cell[]): number {
        this.inputPorts.forEach((p) => {
            let constNameCollector = '';
            let constNumCollector: number[] = [];
            const portSigs: Signals = p.value;
            portSigs.forEach((portSig, portSigIndex) => {
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
                                sigsByConstantName,
                                portSigs,
                                constantCollector);
                    // reset name and num collectors
                    constNameCollector = '';
                    constNumCollector = [];
                }
            });
            if (constNumCollector.length > 0) {
                this.assignConstant(constNameCollector,
                            constNumCollector,
                            portSigs.length,
                            sigsByConstantName,
                            portSigs,
                            constantCollector);
            }
        });
        return maxNum;
    }

    public inputPortVals(): string[] {
        return this.inputPorts.map((port) => ',' + port.value.join() + ',');
    }

    public outputPortVals(): string[] {
        return this.outputPorts.map((port) => ',' + port.value.join() + ',');
    }

    private assignConstant(nameCollector: string,
                           constants: number[],
                           currIndex: number,
                           signalsByConstantName: SigsByConstName,
                           portSignals: Signals,
                           constantCollector: Cell[]) {
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
            constantCollector.push(Cell.fromConstantInfo(constName, constants));
            signalsByConstantName[constName] = constants;
        }
    }

}
