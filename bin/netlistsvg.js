#!/usr/bin/env node
'use strict';

var lib = require('../lib'),
    yargs = require('yargs'),
    fs = require('fs-extra');

var argv = yargs
            .demand(1)
            .usage('usage: $0 input_json_file [-o output_svg_file] [--skin skin_file]')
            .argv;

// set default values for optional args
var skinPath = argv.skin || __dirname + '/' + 'default.svg';
var outputPath = argv.o || 'out.svg';

var skin_data = fs.readFileSync(skinPath, 'utf-8');
var yosys_netlist = fs.readJsonSync(argv._[0]);
lib.netlistSvg(yosys_netlist, skin_data, function(error, result) {
    if (error) throw error;
    fs.writeFileSync(outputPath, result, 'utf-8');
});