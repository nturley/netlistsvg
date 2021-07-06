#!/usr/bin/env node
'use strict';

var lib = require('../built'),
    fs = require('fs'),
    path = require('path'),
    json5 = require('json5'),
    yargs = require('yargs'),
    Ajv = require('ajv');

var ajv = new Ajv({allErrors: true});
require('ajv-errors')(ajv);

if (require.main === module) {
    var argv = yargs
        .demand(1)
        .usage('usage: $0 input_json_file [-o output_svg_file] [--skin skin_file] [--layout elk_json_file]')
        .argv;
    main(argv._[0], argv.o, argv.skin, argv.layout);
}

function render(skinData, netlist, outputPath, elkData) {
    lib.render(skinData, netlist, (err, svgData) => {
        if (err) throw err;
        fs.writeFile(outputPath, svgData, 'utf-8', (err) => {
            if (err) throw err;
        });
    }, elkData);
}

function parseFiles(skinPath, netlistPath, elkJsonPath, callback) {
    fs.readFile(skinPath, 'utf-8', (err, skinData) => {
        if (err) throw err;
        fs.readFile(netlistPath, (err, netlistData) => {
            if (err) throw err;
            if (elkJsonPath) {
                fs.readFile(elkJsonPath, (err, elkString) => {
                    callback(skinData, netlistData, json5.parse(elkString));
                });
            } else {
                callback(skinData, netlistData);
            }
        });
    });
}

function main(netlistPath, outputPath, skinPath, elkJsonPath) {
    skinPath = skinPath || path.join(__dirname, '../lib/default.svg');
    outputPath = outputPath || 'out.svg';
    var schemaPath = path.join(__dirname, '../lib/yosys.schema.json5');
    parseFiles(skinPath, netlistPath, elkJsonPath, (skinData, netlistString, elkData) => {
        var netlistJson = json5.parse(netlistString);
        var valid = ajv.validate(json5.parse(fs.readFileSync(schemaPath)), netlistJson);
        if (!valid) {
            throw Error(JSON.stringify(ajv.errors, null, 2));
        }
        render(skinData, netlistJson, outputPath, elkData);
    });
}

module.exports.main = main;
