var lib = require('../lib'),
    fs = require('fs-extra');

var skin_data = fs.readFileSync('lib/default.svg', 'utf-8');

function drawTest(testName) {
    var yosys_netlist = fs.readJsonSync('test/' + tests[i] + '.json');
    lib.netlistSvg(yosys_netlist, skin_data, function(error, result) {
        if (error) throw error;
        fs.writeFileSync('test/' + testName + '.svg', result, 'utf-8');
    }); 
}

var tests = ['generics', 'ports_splitjoin', 'up3down5', 'mux4'];
for (var i in tests) {
    drawTest(tests[i]);
}
