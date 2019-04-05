'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var ELK = require("elkjs");
var onml = require("onml");
var FlatModule_1 = require("./FlatModule");
var Skin_1 = require("./Skin");
var elkGraph_1 = require("./elkGraph");
var drawModule_1 = require("./drawModule");
var elk = new ELK();
function render(skinData, yosysNetlist, done) {
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
    var kgraph = elkGraph_1.buildElkGraph(flatModule);
    var promise = elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine })
        .then(function (g) { return drawModule_1.default(g, flatModule); })
        // tslint:disable-next-line:no-console
        .catch(function (e) { console.error(e); });
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
