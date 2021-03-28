import Cell from '../lib/Cell';
import Yosys from '../lib/YosysModel';

test('Create Cell from Yosys Input Port', () => {
    const inputPort: Yosys.ExtPort = {direction: Yosys.Direction.Input, bits: [47, 12, 16]};
    const cell: Cell = Cell.fromPort(inputPort, 'testInput');
    expect(cell.Type).toEqual('$_inputExt_');
    expect(cell.outputPortVals()).toEqual([',47,12,16,']);
    expect(cell.inputPortVals()).toEqual([]);
});

test('Create Cell from Yosys Output Port', () => {
    const inputPort: Yosys.ExtPort = {direction: Yosys.Direction.Output, bits: [47, 12, 16]};
    const cell: Cell = Cell.fromPort(inputPort, 'testOutput');
    expect(cell.Type).toEqual('$_outputExt_');
    expect(cell.outputPortVals()).toEqual([]);
    expect(cell.inputPortVals()).toEqual([',47,12,16,']);
});

test('Create Cell from Constant', () => {
    const cell: Cell = Cell.fromConstantInfo('bob', [0, 1, 0, 1, 1]);
    expect(cell.Type).toEqual('$_constant_');
    expect(cell.outputPortVals()).toEqual([',0,1,0,1,1,']);
    expect(cell.inputPortVals()).toEqual([]);
});

test('Create Cell from Join', () => {
    const cell: Cell = Cell.fromJoinInfo(',3,4,5,', ['0', '1:2']);
    expect(cell.Type).toEqual('$_join_');
    expect(cell.inputPortVals()).toEqual([',3,', ',4,5,']);
    expect(cell.outputPortVals()).toEqual([',3,4,5,']);
});

test('Create Cell from Split', () => {
    const cell: Cell = Cell.fromSplitInfo(',3,4,5,', ['0:1', '2']);
    expect(cell.Type).toEqual('$_split_');
    expect(cell.inputPortVals()).toEqual([',3,4,5,']);
    expect(cell.outputPortVals()).toEqual([',3,4,', ',5,']);
});
