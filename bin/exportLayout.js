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
        .usage('usage: $0 input_json_file [-o output_json_file] [--skin skin_file] [--pre]')
        .argv;
    main(argv._[0], argv.o, argv.skin, argv.pre);
}

function dump(skinData, netlist, outputPath, preLayout) {
    lib.dumpLayout(skinData, netlist, preLayout, (err, jsonData) => {
        if (err) throw err;
        fs.writeFile(outputPath, jsonData, 'utf-8', (err) => {
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

function main(netlistPath, outputPath, skinPath, preLayout) {
    skinPath = skinPath || path.join(__dirname, '../lib/default.svg');
    outputPath = outputPath || 'out.json';
    var schemaPath = path.join(__dirname, '../lib/yosys.schema.json5');
    parseFiles(skinPath, netlistPath, (skinData, netlistString) => {
        var netlistJson = json5.parse(netlistString);
        var valid = ajv.validate(json5.parse(fs.readFileSync(schemaPath)), netlistJson);
        if (!valid) {
            throw Error(JSON.stringify(ajv.errors, null, 2));
        }
        dump(skinData, netlistJson, outputPath, preLayout);
    });
}

module.exports.main = main;
