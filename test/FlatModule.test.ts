import path = require('path');
import fs = require('fs');
import json5 = require('json5');
import onml = require('onml');

import Yosys from '../lib/YosysModel';
import Cell from '../lib/Cell';
import { FlatModule } from '../lib/FlatModule';
import Skin from '../lib/Skin';

/**
 * Helper function for tests that use test files
 * @param testFile the name of the test case, don't include path or extension
 */
function createFlatModule(testFile: string): FlatModule {
    const testPath = path.join(__dirname,'digital', testFile + '.json');
    const defaultSkin = path.join(__dirname, '../lib/default.svg');
    const testStr = fs.readFileSync(testPath).toString();
    const netlist: Yosys.Netlist = json5.parse(testStr);
    const skin = onml.parse(fs.readFileSync(defaultSkin).toString());
    Skin.skin = skin;
    return new FlatModule(netlist);
}

/**
 * make sure the correct number of splits and joins is calculated.
 */
test('split join', () => {
    const flatModule = createFlatModule('ports_splitjoin');
    // there are 5 external ports
    const numStartNodes = flatModule.nodes.length;
    flatModule.addSplitsJoins();
    const nodes = flatModule.nodes;
    // should have 3 more nodes, one split, two joins
    expect(nodes.length - numStartNodes).toEqual(3);
    const splits = nodes.filter( (node: Cell) => node.Type === '$_split_');
    expect(splits.length).toEqual(1);
    const split = splits[0];
    // split should have 3 outputs
    expect(split.OutputPorts.length).toEqual(3);
    const joins = nodes.filter( (node: Cell) => node.Type === '$_join_');
    expect(joins.length).toEqual(2);
    // both joins should have two inputs
    joins.forEach( (join: Cell) => expect(join.InputPorts.length).toEqual(2));
});

/**
 * Make sure create wires handles hyper edges correctly
 */
test('create wires', () => {
    const flatModule = createFlatModule('hyperedges');
    flatModule.createWires();
    const wires = flatModule.wires;
    expect(wires.length).toEqual(3);
    expect(wires.find((wire) => wire.drivers.length === 3)).toBeDefined();
    expect(wires.find((wire) => wire.riders.length === 3)).toBeDefined();
    expect(wires.find((wire) => wire.drivers.length === 2 && wire.riders.length === 1)).toBeDefined();
});
