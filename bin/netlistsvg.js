#!/usr/bin/env node
'use strict';

var lib = require('../lib'),
    fs = require('fs'),
    path = require('path'),
    yargs = require('yargs');

if (require.main === module) {
    var argv = yargs
        .demand(1)
        .usage('usage: $0 input_json_file [-o output_svg_file] [--skin skin_file]')
        .argv;

    main(argv._[0], argv.o, argv.skin);
}

function main(netlistpath, outputPath, skinPath) {
    skinPath = skinPath || path.join(__dirname, '../lib/default.svg');
    outputPath = outputPath || 'out.svg';
    fs.readFile(skinPath, 'utf-8', function(err, skin_data) {
        if (err) throw err;
        fs.readFile(netlistpath, function(err, netlist_data) {
            if (err) throw err;
            var netlist = JSON.parse(netlist_data);
            lib.render(skin_data, netlist, function(err, svg_data) {
                fs.writeFile(outputPath, svg_data, 'utf-8', function(e) {
                    if (e) throw e;
                });
            });
        });
    });
}

module.exports.main = main;
