import { SigsByConstName, NameToPorts, addToDefaultDict } from './FlatModule';
import Yosys from './YosysModel';
import { findSkinType, getLateralPortPids, getPortsWithPrefix } from './skin';
import {Port} from './Port';
import _ = require('lodash');
import { ElkModel } from './elkGraph';
import clone = require('clone');
import onml = require('onml');

export default class Cell {

    public static skin: any;

    /**
     * creates a Cell from a Yosys Port
     * @param yPort the Yosys Port with our port data
     * @param name the name of the port
     */
    public static fromPort(yPort: Yosys.ExtPort, name: string): Cell {
        const isInput: boolean = yPort.direction === Yosys.Direction.Input;
        if (isInput) {
            return new Cell(name, '$_inputExt_', [], [new Port('Y', yPort.bits)], {});
        }
        return new Cell(name, '$_outputExt_', [new Port('A', yPort.bits)], [], {});
    }

    public static fromYosysCell(yCell: Yosys.Cell, name: string) {
        const inputPids: string[] = Yosys.getInputPortPids(yCell);
        const outputPids: string[] = Yosys.getOutputPortPids(yCell);
        const ports: Port[] = _.map(yCell.connections, (conn, portName) => {
            return new Port(portName, conn);
        });
        const inputPorts = ports.filter((port) => port.keyIn(inputPids));
        const outputPorts = ports.filter((port) => port.keyIn(outputPids));
        return new Cell(name, yCell.type, inputPorts, outputPorts, yCell.attributes);
    }

    public static fromConstantInfo(name: string, constants: number[]): Cell {
        return new Cell(name, '$_constant_', [], [new Port('Y', constants)], {});
    }

    /**
     * creates a join cell
     * @param target string name of net (starts and ends with and delimited by commas)
     * @param sources list of index strings (one number, or two numbers separated by a colon)
     */
    public static fromJoinInfo(target: string, sources: string[]): Cell {
        const signalStrs: string[] = target.slice(1, -1).split(',');
        const signals: number[] = signalStrs.map((ss) =>  Number(ss));
        const joinOutPorts: Port[] = [new Port('Y', signals)];
        const inPorts: Port[] = sources.map((name) => {
            return new Port(name, getBits(signals, name));
        });
        return new Cell('$join$' + target, '$_join_', inPorts, joinOutPorts, {});
    }

    /**
     * creates a split cell
     * @param source string name of net (starts and ends with and delimited by commas)
     * @param targets list of index strings (one number, or two numbers separated by a colon)
     */
    public static fromSplitInfo(source: string, targets: string[]): Cell {
        // turn string into array of signal names
        const signals: Yosys.Signals = source.slice(1, -1).split(',');
        // convert the signals into actual numbers
        // after running constant pass, all signals should be numbers
        for (const i of Object.keys(signals)) {
            signals[i] = Number(signals[i]);
        }
        const inPorts: Port[] = [new Port('A', signals)];
        const splitOutPorts: Port[] = targets.map((name) => {
            const sigs: Yosys.Signals = getBits(signals, name);
            return new Port(name, sigs);
        });
        return new Cell('$split$' + source, '$_split_', inPorts, splitOutPorts, {});
    }

    protected key: string;
    protected type: string;
    protected inputPorts: Port[];
    protected outputPorts: Port[];
    protected attributes: Yosys.CellAttributes;

    constructor(key: string,
                type: string,
                inputPorts: Port[],
                outputPorts: Port[],
                attributes: Yosys.CellAttributes) {
        this.key = key;
        this.type = type;
        this.inputPorts = inputPorts;
        this.outputPorts = outputPorts;
        this.attributes = attributes;
        inputPorts.forEach((ip) => {
            ip.ParentNode = this;
        });
        outputPorts.forEach((op) => {
            op.ParentNode = this;
        });
    }

    public get Type(): string {
        return this.type;
    }

    public get Key(): string {
        return this.key;
    }

    public get InputPorts(): Port[] {
        return this.inputPorts;
    }

    public get OutputPorts(): Port[] {
        return this.outputPorts;
    }

    public maxOutVal(atLeast: number): number {
        const maxVal: number = _.max(this.outputPorts.map((op) => op.maxVal()));
        return _.max([maxVal, atLeast]);
    }

    public findConstants(sigsByConstantName: SigsByConstName,
                         maxNum: number,
                         constantCollector: Cell[]): number {
        this.inputPorts.forEach((ip) => {
            maxNum = ip.findConstants(sigsByConstantName, maxNum, constantCollector);
        });
        return maxNum;
    }

    public inputPortVals(): string[] {
        return this.inputPorts.map((port) => port.valString());
    }

    public outputPortVals(): string[] {
        return this.outputPorts.map((port) => port.valString());
    }

    public collectPortsByDirection(ridersByNet: NameToPorts,
                                   driversByNet: NameToPorts,
                                   lateralsByNet: NameToPorts,
                                   genericsLaterals: boolean): void {
        const template = findSkinType(Cell.skin, this.type);
        const lateralPids = getLateralPortPids(template);
        // find all ports connected to the same net
        this.inputPorts.forEach((port) => {
            const isLateral = port.keyIn(lateralPids);
            if (isLateral || (template[1]['s:type'] === 'generic' && genericsLaterals)) {
                addToDefaultDict(lateralsByNet, port.valString(), port);
            } else {
                addToDefaultDict(ridersByNet, port.valString(), port);
            }
        });
        this.outputPorts.forEach((port) => {
            const isLateral = port.keyIn(lateralPids);
            if (isLateral || (template[1]['s:type'] === 'generic' && genericsLaterals)) {
                addToDefaultDict(lateralsByNet, port.valString(), port);
            } else {
                addToDefaultDict(driversByNet, port.valString(), port);
            }
        });
    }

    public getValueAttribute(): string {
        if (this.attributes && this.attributes.value) {
            return this.attributes.value;
        }
        return null;
    }

    public getTemplate(): any {
        return findSkinType(Cell.skin, this.type);
    }

    public buildElkChild(): ElkModel.Cell {
        const template = this.getTemplate();
        const type: string = template[1]['s:type'];
        if (type === 'join' ||
            type === 'split' ||
            type === 'generic') {
            const inTemplates: any[] = getPortsWithPrefix(template, 'in');
            const outTemplates: any[] = getPortsWithPrefix(template, 'out');
            const inPorts = this.inputPorts.map((ip, i) =>
                ip.getGenericElkPort(i, inTemplates, 'in'));
            const outPorts = this.outputPorts.map((op, i) =>
                op.getGenericElkPort(i, outTemplates, 'out'));
            const cell: ElkModel.Cell = {
                id: this.key,
                width: Number(template[1]['s:width']),
                height: Number(this.getGenericHeight()),
                ports: inPorts.concat(outPorts),
                layoutOptions: { 'de.cau.cs.kieler.portConstraints': 'FIXED_POS' },
            };
            if (type === 'generic') {
                cell.labels = [{
                    id: this.key + '.label',
                    text: this.type,
                    x: Number(template[2][1].x),
                    y: Number(template[2][1].y) - 6,
                    height: 11,
                    width: (6 * this.type.length),
                }];
            }
            return cell;
        }
        const ports: ElkModel.Port[] = getPortsWithPrefix(template, '').map((tp) => {
            return {
                id: this.key + '.' + tp[1]['s:pid'],
                width: 0,
                height: 0,
                x: Number(tp[1]['s:x']),
                y: Number(tp[1]['s:y']),
            };
        });
        const nodeWidth: number = Number(template[1]['s:width']);
        const ret: ElkModel.Cell = {
            id: this.key,
            width: nodeWidth,
            height: Number(template[1]['s:height']),
            ports,
            layoutOptions: { 'de.cau.cs.kieler.portConstraints': 'FIXED_POS' },
        };
        if (type === 'inputExt' ||
            type === 'outputExt') {
            ret.labels = [{
                id: this.key + '.label',
                text: this.key,
                x: Number(template[2][1].x) + nodeWidth / 2 - 3 * this.key.length,
                y: Number(template[2][1].y) - 6,
                height: 11,
                width: (6 * this.key.length),
            }];
        }
        return ret;
    }

    public render(kChild: ElkModel.Cell): any[] {
        const template = this.getTemplate();
        const tempclone = clone(template);
        setTextAttribute(tempclone, 'ref', this.key);
        setTextAttribute(tempclone, 'id', this.key);
        const attrValue = this.getValueAttribute();
        if (attrValue) {
            setTextAttribute(tempclone, 'name', attrValue);
        }
        tempclone[1].transform = 'translate(' + kChild.x + ',' + kChild.y + ')';
        if (this.type === '$_constant_' && this.key.length > 3) {
            const num: number = parseInt(this.key, 2);
            setTextAttribute(tempclone, 'ref', '0x' + num.toString(16));
        } else if (this.type === '$_split_') {
            setGenericSize(tempclone, Number(this.getGenericHeight()));
            const outPorts = getPortsWithPrefix(template, 'out');
            const gap: number = Number(outPorts[1][1]['s:y']) - Number(outPorts[0][1]['s:y']);
            const startY: number = Number(outPorts[0][1]['s:y']);
            tempclone.pop();
            tempclone.pop();
            this.outputPorts.forEach((op, i) => {
                const portClone = clone(outPorts[0]);
                portClone[portClone.length - 1][2] = op.Key;
                portClone[1].transform = 'translate(' + outPorts[1][1]['s:x'] + ','
                    + (startY + i * gap) + ')';
                tempclone.push(portClone);
            });
        } else if (this.type === '$_join_') {
            setGenericSize(tempclone, Number(this.getGenericHeight()));
            const inPorts = getPortsWithPrefix(template, 'in');
            const gap: number = Number(inPorts[1][1]['s:y']) - Number(inPorts[0][1]['s:y']);
            const startY: number = Number(inPorts[0][1]['s:y']);
            tempclone.pop();
            tempclone.pop();
            this.inputPorts.forEach((port, i) => {
                const portClone = clone(inPorts[0]);
                portClone[portClone.length - 1][2] = port.Key;
                portClone[1].transform = 'translate(' + inPorts[1][1]['s:x'] + ','
                    + (startY + i * gap) + ')';
                tempclone.push(portClone);
            });
        } else if (template[1]['s:type'] === 'generic') {
            setGenericSize(tempclone, Number(this.getGenericHeight()));
            const inPorts = getPortsWithPrefix(template, 'in');
            const ingap = Number(inPorts[1][1]['s:y']) - Number(inPorts[0][1]['s:y']);
            const instartY = Number(inPorts[0][1]['s:y']);
            const outPorts = getPortsWithPrefix(template, 'out');
            const outgap = Number(outPorts[1][1]['s:y']) - Number(outPorts[0][1]['s:y']);
            const outstartY = Number(outPorts[0][1]['s:y']);
            tempclone.pop();
            tempclone.pop();
            tempclone.pop();
            tempclone.pop();
            this.inputPorts.forEach((port, i) => {
                const portClone = clone(inPorts[0]);
                portClone[portClone.length - 1][2] = port.Key;
                portClone[1].transform = 'translate(' + inPorts[1][1]['s:x'] + ','
                    + (instartY + i * ingap) + ')';
                tempclone.push(portClone);
            });
            this.outputPorts.forEach((port, i) => {
                const portClone = clone(outPorts[0]);
                portClone[portClone.length - 1][2] = port.Key;
                portClone[1].transform = 'translate(' + outPorts[1][1]['s:x'] + ','
                    + (outstartY + i * outgap) + ')';
                tempclone.push(portClone);
            });
            tempclone[2][2] = this.type;
        }
        return tempclone;
    }

    private getGenericHeight() {
        const template = this.getTemplate();
        const inPorts = getPortsWithPrefix(template, 'in');
        const outPorts = getPortsWithPrefix(template, 'out');
        if (this.inputPorts.length > this.outputPorts.length) {
            const gap = Number(inPorts[1][1]['s:y']) - Number(inPorts[0][1]['s:y']);
            return Number(template[1]['s:height']) + gap * (this.inputPorts.length - 2);
        }
        if (outPorts.length > 1) {
            const gap = Number(outPorts[1][1]['s:y']) - Number(outPorts[0][1]['s:y']);
            return Number(template[1]['s:height']) + gap * (this.outputPorts.length - 2);
        }
        return Number(template[1]['s:height']);
    }

}

function setGenericSize(tempclone, height) {
    onml.traverse(tempclone, {
        enter: (node) => {
            if (node.name === 'rect' && node.attr['s:generic'] === 'body') {
                node.attr.height = height;
            }
        },
    });
}

function setTextAttribute(tempclone, attribute, value) {
    onml.traverse(tempclone, {
        enter: (node) => {
            if (node.name === 'text' && node.attr['s:attribute'] === attribute) {
                node.full[2] = value;
            }
        },
    });
}

function getBits(signals: Yosys.Signals, indicesString: string): Yosys.Signals {
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
