#!/usr/bin/env node
'use strict';

var lib = require('../lib'),
    yargs = require('yargs');

var argv = yargs
            .demand(1)
            .usage('usage: $0 input_json_file [-o output_svg_file] [--skin skin_file]')
            .argv;
lib.render(argv._[0], argv.o, argv.skin);
