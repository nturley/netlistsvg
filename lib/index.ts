'use strict';

import ELK = require('elkjs');
import onml = require('onml');

import { FlatModule } from './FlatModule';
import Yosys from './YosysModel';
import Skin from './Skin';
import { ElkModel, buildElkGraph } from './elkGraph';
import drawModule from './drawModule';

const elk = new ELK();

type ICallback = (error: Error, result?: string) => void;

export function render(skinData: string, yosysNetlist: Yosys.Netlist, done?: ICallback) {
    Skin.skin = onml.p(skinData);
    const layoutProps = Skin.getProperties();

    const flatModule = new FlatModule(yosysNetlist);

    // this can be skipped if there are no 0's or 1's
    if (layoutProps.constants !== false) {
        flatModule.addConstants();
    }
    // this can be skipped if there are no splits or joins
    if (layoutProps.splitsAndJoins !== false) {
        flatModule.addSplitsJoins();
    }
    flatModule.createWires();
    const kgraph: ElkModel.Graph = buildElkGraph(flatModule);

    const promise = elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine })
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
