var lib = require('../lib');

var tests = ['generics', 'ports_splitjoin', 'up3down5', 'mux4'];
for (var i in tests) {
    lib.render('test/' + tests[i] + '.json', 'test/' + tests[i] + '.svg');
}
