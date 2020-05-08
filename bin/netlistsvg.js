#!/usr/bin/env node
'use strict';

var lib = require('../built'),
    fs = require('fs'),
    path = require('path'),
    json5 = require('json5'),
    yargs = require('yargs'),
    Ajv = require('ajv');

var ajv = new Ajv({allErrors: true, jsonPointers: true});
require('ajv-errors')(ajv);

if (require.main === module) {
    var argv = yargs
        .demand(1)
        .usage('usage: $0 input_json_file [-o output_svg_file] [--skin skin_file] [--layout elk_json_file] [--config config_json_file]')
        .argv;
    main(argv._[0], argv.o, argv.skin, argv.layout, argv.config);
}

function render(skinData, netlist, outputPath, elkData, configData) {
    lib.render(skinData, netlist, (err, svgData) => {
        if (err) throw err;
        fs.writeFile(outputPath, svgData, 'utf-8', (err) => {
            if (err) throw err;
        });
    }, elkData, configData);
}

function parseFiles(skinPath, netlistPath, elkJsonPath, configPath, callback) {
    var elkData;
    var configData;
    fs.readFile(skinPath, 'utf-8', (err, skinData) => {
        if (err) throw err;
        fs.readFile(netlistPath, (err, netlistData) => {
            if (err) throw err;
            if (elkJsonPath) {
                elkData = json5.parse(fs.readFileSync(elkJsonPath));
            } 
            if (configPath) {
                configData = json5.parse(fs.readFileSync(configPath));
            }
            callback(skinData, netlistData, elkData, configData);
        });
    });
}

function main(netlistPath, outputPath, skinPath, elkJsonPath, configPath) {
    skinPath = skinPath || path.join(__dirname, '../lib/default.svg');
    configPath = configPath || path.join(__dirname, '../lib/config.json');
    outputPath = outputPath || 'out.svg';
    var schemaPath = path.join(__dirname, '../lib/yosys.schema.json5');
    parseFiles(skinPath, netlistPath, elkJsonPath, configPath, (skinData, netlistString, elkData, configData) => {
        var netlistJson = json5.parse(netlistString);
        var valid = ajv.validate(json5.parse(fs.readFileSync(schemaPath)), netlistJson);
        if (!valid) {
            throw Error(JSON.stringify(ajv.errors, null, 2));
        }
        render(skinData, netlistJson, outputPath, elkData, configData);
    });
}

module.exports.main = main;
