const lib = require('../built');
const fs = require('fs');
const json5 = require('json5');
const Ajv = require('ajv');
var ajv = new Ajv({allErrors: true});
require('ajv-errors')(ajv);

const digital = fs.readFileSync(__dirname + '/../lib/default.svg', 'utf8');
const analog = fs.readFileSync(__dirname + '/../lib/analog.svg', 'utf8');
const exampleDigital = fs.readFileSync(__dirname + '/../test/digital/up3down5.json');
const exampleAnalog = fs.readFileSync(__dirname + '/../test/analog/and.json');
const schema = fs.readFileSync(__dirname + '/../lib/yosys.schema.json5');
const exampleDigitalJson = json5.parse(exampleDigital);
const exampleAnalogJson = json5.parse(exampleAnalog);

function render(skinData, netlistData, cb) {
    var valid = ajv.validate(json5.parse(schema), netlistData);
    if (!valid) {
        throw Error(JSON.stringify(ajv.errors, null, 2));
    }
    return lib.render(skinData, netlistData, cb);
}

module.exports = {
    render: render,
    digitalSkin: digital,
    analogSkin: analog,
    exampleDigital: exampleDigitalJson,
    exampleAnalog: exampleAnalogJson
};
