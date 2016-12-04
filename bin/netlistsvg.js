#!/usr/bin/env node
'use strict';

var lib = require('../lib'),
    yargs = require('yargs');

var argv = yargs.argv;
var fileName;

if (argv.input){
    var fileName = argv.input;
    var skinPath = argv.skin;
    lib.render(skinPath, fileName);
} else {
    console.log(argv);
}