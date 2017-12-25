var path = require('path'),
    bin = require('../bin/netlistsvg');

var tests = ['generics', 'ports_splitjoin', 'up3down5', 'mux4'];
for (var i in tests) {
    bin.main(
        path.join('test', tests[i] + '.json'),
        path.join('test', tests[i] + '.svg')
    );
}
