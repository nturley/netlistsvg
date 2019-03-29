'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var ELK = require("elkjs");
var onml = require("onml");
var FlatModule_1 = require("./FlatModule");
var elkGraph_1 = require("./elkGraph");
var drawModule_1 = require("./drawModule");
var elk = new ELK();
function render(skinData, yosysNetlist, done) {
    var skin = onml.p(skinData);
    var flatModule = FlatModule_1.FlatModule.fromNetlist(yosysNetlist, skin);
    var kgraph = elkGraph_1.buildElkGraph(flatModule);
    var promise = elk.layout(kgraph, { layoutOptions: FlatModule_1.FlatModule.layoutProps.layoutEngine })
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
