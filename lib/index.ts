'use strict';

import ELK = require('elkjs');
import onml = require('onml');

import { FlatModule } from './FlatModule';
import Yosys from './YosysModel';
import Config from './ConfigModel';
import Skin from './Skin';
import { ElkModel, buildElkGraph } from './elkGraph';
import drawModule from './drawModule';

const elk = new ELK();

type ICallback = (error: Error, result?: string) => void;

export function render(skinData: string, yosysNetlist: Yosys.Netlist,
                       done?: ICallback, elkData?: ElkModel.Graph, configData?: Config) {
    const skin = onml.p(skinData);
    Skin.skin = skin;
    const flatModule = FlatModule.fromNetlist(yosysNetlist, configData);
    const kgraph: ElkModel.Graph = buildElkGraph(flatModule);

    let promise;
    // if we already have a layout then use it
    if (elkData) {
        promise = new Promise((resolve) => {
            drawModule(elkData, flatModule);
            resolve();
        });
    } else {
        // otherwise use ELK to generate the layout
        promise = elk.layout(kgraph, { layoutOptions: FlatModule.layoutProps.layoutEngine })
            .then((g) => drawModule(g, flatModule))
            // tslint:disable-next-line:no-console
            .catch((e) => { console.error(e); });
    }

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
