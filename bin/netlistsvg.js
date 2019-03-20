#!/usr/bin/env node
'use strict';

var lib = require('../built'),
    fs = require('fs'),
    path = require('path'),
    json5 = require('json5'),
    yargs = require('yargs');

if (require.main === module) {
    var argv = yargs
        .demand(1)
        .usage('usage: $0 input_json_file [-o output_svg_file] [--skin skin_file]')
        .argv;

    main(argv._[0], argv.o, argv.skin);
}

function render(skinData, netlist, outputPath) {
    lib.render(skinData, netlist, (err, svgData) => {
        if (err) throw err;
        fs.writeFile(outputPath, svgData, 'utf-8', (err) => {
            if (err) throw err;
        });
    });
}

function parseFiles(skinPath, netlistPath, callback) {
    fs.readFile(skinPath, 'utf-8', (err, skinData) => {
        if (err) throw err;
        fs.readFile(netlistPath, (err, netlistData) => {
            if (err) throw err;
            callback(skinData, netlistData);
        });
    });
}

function main(netlistPath, outputPath, skinPath) {
    skinPath = skinPath || path.join(__dirname, '../lib/default.svg');
    outputPath = outputPath || 'out.svg';
    parseFiles(skinPath, netlistPath, (skinData, netlistData) => {
        render(skinData, json5.parse(netlistData), outputPath);
    });
}

module.exports.main = main;
