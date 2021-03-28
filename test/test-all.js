var path = require('path'),
    bin = require('../bin/netlistsvg');

var digital_tests = ['generics', 'ports_splitjoin', 'up3down5', 'mux4', 'hyperedges'];
var analog_tests = ['and', 'common_emitter_full', 'mcu', 'resistor_divider', 'vcc_and_gnd']

for (var test of digital_tests) {
    bin.main(
        path.join('test', 'digital', test + '.json'),
        path.join('test', 'digital', test + '.svg'),
        path.join('lib', 'default.svg')
    );
}
for (var test of analog_tests) {
    bin.main(
        path.join('test', 'analog', test + '.json'),
        path.join('test', 'analog', test + '.svg'),
        path.join('lib', 'analog.svg')
    );
}
