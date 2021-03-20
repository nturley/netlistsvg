'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.render = exports.dumpLayout = void 0;
var ELK = require("elkjs");
var onml = require("onml");
var FlatModule_1 = require("./FlatModule");
var Skin_1 = require("./Skin");
var elkGraph_1 = require("./elkGraph");
var drawModule_1 = require("./drawModule");
var elk = new ELK();
function createFlatModule(skinData, yosysNetlist) {
    Skin_1.default.skin = onml.p(skinData);
    var layoutProps = Skin_1.default.getProperties();
    var flatModule = new FlatModule_1.FlatModule(yosysNetlist);
    // this can be skipped if there are no 0's or 1's
    if (layoutProps.constants !== false) {
        flatModule.addConstants();
    }
    // this can be skipped if there are no splits or joins
    if (layoutProps.splitsAndJoins !== false) {
        flatModule.addSplitsJoins();
    }
    flatModule.createWires();
    return flatModule;
}
function dumpLayout(skinData, yosysNetlist, prelayout, done) {
    var flatModule = createFlatModule(skinData, yosysNetlist);
    var kgraph = elkGraph_1.buildElkGraph(flatModule);
    if (prelayout) {
        done(null, JSON.stringify(kgraph, null, 2));
        return;
    }
    var layoutProps = Skin_1.default.getProperties();
    var promise = elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine });
    promise.then(function (graph) {
        done(null, JSON.stringify(graph, null, 2));
    }).catch(function (reason) {
        throw Error(reason);
    });
}
exports.dumpLayout = dumpLayout;
function render(skinData, yosysNetlist, done, elkData) {
    var flatModule = createFlatModule(skinData, yosysNetlist);
    var kgraph = elkGraph_1.buildElkGraph(flatModule);
    var layoutProps = Skin_1.default.getProperties();
    var promise;
    // if we already have a layout then use it
    if (elkData) {
        promise = new Promise(function (resolve) {
            drawModule_1.default(elkData, flatModule);
            resolve();
        });
    }
    else {
        // otherwise use ELK to generate the layout
        promise = elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine })
            .then(function (g) { return drawModule_1.default(g, flatModule); })
            // tslint:disable-next-line:no-console
            .catch(function (e) { console.error(e); });
    }
    // support legacy callback style
    if (typeof done === 'function') {
        promise.then(function (output) {
            done(null, output);
            return output;
        }).catch(function (reason) {
            throw Error(reason);
        });
    }
    return promise;
}
exports.render = render;
