'use strict';

import ELK = require('elkjs');
import onml = require('onml');

import { FlatModule } from './FlatModule';
import Yosys from './YosysModel';
import { getProperties } from './skin';
import { ElkModel, buildElkGraph } from './elkGraph';
import drawModule from './drawModule';
import { fstat, writeFileSync } from 'fs';

const elk = new ELK();

type ICallback = (error: Error, result?: string) => void;

export function render(skinData: string, yosysNetlist: Yosys.Netlist, done?: ICallback) {
    const skin = onml.p(skinData);
    const flatModule = FlatModule.fromNetlist(yosysNetlist, skin);

    const kgraph: ElkModel.Graph = buildElkGraph(flatModule);
    const promise = elk.layout(kgraph, { layoutOptions: FlatModule.layoutProps.layoutEngine })
        .then((g) => drawModule(g, flatModule))
        // tslint:disable-next-line:no-console
        .catch((e) => { console.error(e); });

    // support legacy callback style
    if (typeof done === 'function') {
        promise.then((output: string) => {
            done(null, output);
            return output;
        }).catch((reason) => {
            throw Error(reason);
        });
    }
    return promise;
}
