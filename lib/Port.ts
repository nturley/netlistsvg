import Cell from './Cell';
import {SigsByConstName, FlatModule} from './FlatModule';
import Yosys from './YosysModel';
import _ = require('lodash');
import { ElkModel } from './elkGraph';

export class Port {
    public parentNode?: Cell;
    private key: string;
    private value: number[] | Yosys.Signals;

    constructor(key: string, value: number[] | Yosys.Signals) {
        this.key = key;
        this.value = value;
    }

    public get Key() {
        return this.key;
    }

    public keyIn(pids: string[]): boolean {
        return _.includes(pids, this.key);
    }

    public maxVal() {
        return _.max(_.map(this.value, (v) => Number(v)));
    }

    public valString() {
        return ',' + this.value.join() + ',';
    }

    public findConstants(sigsByConstantName: SigsByConstName,
                         maxNum: number,
                         constantCollector: Cell[],
                         parent: string): number {
        let constNameCollector = '';
        let constNumCollector: number[] = [];
        const portSigs: Yosys.Signals = this.value;
        portSigs.forEach((portSig, portSigIndex) => {
            // is constant?
            if (portSig === '0' || portSig === '1' || portSig === 'x') {
            maxNum += 1;
            constNameCollector += portSig;
            // replace the constant with new signal num
            portSigs[portSigIndex] = maxNum;
            constNumCollector.push(maxNum);
            // string of constants ended before end of p.value
            } else if (constNumCollector.length > 0) {
                this.assignConstant(
                    constNameCollector,
                    constNumCollector,
                    portSigIndex,
                    sigsByConstantName,
                    constantCollector,
                    parent);
                // reset name and num collectors
                constNameCollector = '';
                constNumCollector = [];
            }
        });
        if (constNumCollector.length > 0) {
            this.assignConstant(
                constNameCollector,
                constNumCollector,
                portSigs.length,
                sigsByConstantName,
                constantCollector,
                parent);
        }
        return maxNum;
    }

    public getGenericElkPort(
        index: number,
        templatePorts: any[],
        dir: string,
    ): ElkModel.Port {
        const nkey = this.parentNode.parent + '.' + this.parentNode.Key;
        const type = this.parentNode.getTemplate()[1]['s:type'];
        if (index === 0) {
            const ret: ElkModel.Port = {
                id: nkey + '.' + this.key,
                width: 1,
                height: 1,
                x: Number(templatePorts[0][1]['s:x']),
                y: Number(templatePorts[0][1]['s:y']),
            };

            if ((type === 'generic' || type === 'join') && dir === 'in') {
                ret.labels = [{
                    id: nkey + '.' + this.key + '.label',
                    text: this.key,
                    x: Number(templatePorts[0][2][1].x) - 10,
                    y: Number(templatePorts[0][2][1].y) - 6,
                    width: (6 * this.key.length),
                    height: 11,
                }];
                if (type === 'generic') {
                    ret.layoutOptions = {'org.eclipse.elk.port.side': 'WEST'};
                }
            }

            if ((type === 'generic' || type === 'split') && dir === 'out') {
                ret.labels = [{
                    id: nkey + '.' + this.key + '.label',
                    text: this.key,
                    x: Number(templatePorts[0][2][1].x) - 10,
                    y: Number(templatePorts[0][2][1].y) - 6,
                    width: (6 * this.key.length),
                    height: 11,
                }];
                if (type === 'generic') {
                    ret.layoutOptions = {'org.eclipse.elk.port.side': 'EAST'};
                }
            }

            if (type === 'generic' && this.parentNode.subModule !== null) {
                delete ret.x;
                delete ret.y;
            }
            return ret;
        } else {
            const gap: number = Number(templatePorts[1][1]['s:y']) - Number(templatePorts[0][1]['s:y']);
            const ret: ElkModel.Port = {
                id: nkey + '.' + this.key,
                width: 1,
                height: 1,
                x: Number(templatePorts[0][1]['s:x']),
                y: (index) * gap + Number(templatePorts[0][1]['s:y']),
            };
            if (type === 'generic') {
                ret.labels = [{
                    id: nkey + '.' + this.key + '.label',
                    text: this.key,
                    x: Number(templatePorts[0][2][1].x) - 10,
                    y: Number(templatePorts[0][2][1].y) - 6,
                    width: (6 * this.key.length),
                    height: 11,
                }];
                if (dir === 'in') {
                    ret.layoutOptions = {'org.eclipse.elk.port.side': 'WEST'};
                }
                if (dir === 'out') {
                    ret.layoutOptions = {'org.eclipse.elk.port.side': 'EAST'};
                }
            }

            if (type === 'generic' && this.parentNode.subModule !== null) {
                delete ret.x;
                delete ret.y;
            }
            return ret;
        }
    }

    private assignConstant(nameCollector: string,
                           constants: number[],
                           currIndex: number,
                           signalsByConstantName: SigsByConstName,
                           constantCollector: Cell[],
                           parent: string) {
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
                this.value[i] = constSig;
            });
        } else {
            constantCollector.push(Cell.fromConstantInfo(constName, constants, parent));
            signalsByConstantName[constName] = constants;
        }
    }
}
