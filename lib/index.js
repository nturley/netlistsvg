'use strict';

var fs = require('fs-extra'),
    onml = require('onml'),
    _ = require('lodash');

var entries = require('object.entries');

if (!Object.entries) {
    entries.shim();
}

fs.readFile('test.svg', 'utf-8', skin_read);

function skin_read(err, data) {
	if (err) throw err;
	var skin = onml.p(data);
	fs.readJson('test.json', function (err, yosys_netlist) {
		if (err) throw err;
		var module_name = Object.keys(yosys_netlist.modules)[0];
		console.log(module_name);
		var module = getReformattedModule(yosys_netlist.modules[module_name]);
		addConstants(module);
		addSplitsJoins(module);
		createWires(module);
		var kgraph = buildKGraph(module, module_name);
    });
}

function buildKGraph(module, module_name, skin_data)
{
	module.node.forEach(functions(n)
	{
		buildKGraphChild(skin_data, n.type)
	});
}

//given a module type, build kgraphchild
function buildKGraphChild(skin_data, type){

}

function toArray(assoc)
{
	return _.flatMap(assoc, function(val, key) {
		val.key = key;
		return val;
	});
}

// returns an array of ports that are going a specific direction
// the elements in this array are obects whose members are key and value
// where key is the port name and value is the connection array
function getCellPortList(cell, direction)
{
	var ports = _.filter(_.flatMap(cell.connections, function(val, key) {
		return {key:key, value:val};
	}), function(val) {
		return cell.port_directions[val.key] == direction;
	});
	return ports;
}

// returns a reformatted module
function getReformattedModule(module)
{
    var ports= toArray(module.ports);

    var flatModule =
    {
        'inputPorts' : _.filter(ports, function(p){return p.direction=='input'}),
        'outputPorts': _.filter(ports, function(p){return p.direction=='output'}),
        'cells':toArray(module.cells)
    };
    flatModule.inputPorts.forEach(function(p){p.type="$_inputExt_";});
    flatModule.outputPorts.forEach(function(p){p.type="$_outputExt_";});
    flatModule.cells.forEach(function(c)
    {
        c.inputPorts = getCellPortList(c,"input");
        c.outputPorts = getCellPortList(c,"output");
    });
    flatModule.inputPorts.forEach(function(p)
    {
        p.inputPorts = [];
        p.outputPorts = [{'key':p.key,'value':p.bits}];
    });
    flatModule.outputPorts.forEach(function(p)
    {
        p.inputPorts = [{'key':p.key,'value':p.bits}];
        p.outputPorts = [];
    });
    flatModule.nodes = flatModule.inputPorts
                        .concat(flatModule.outputPorts)
                        .concat(flatModule.cells);
    return flatModule;
}

// converts input ports with constant assignments to constant nodes
function addConstants(module)
{
    // find the maximum signal number
    var maxNum=-1;
    module.nodes.forEach(function(n)
    {
        n.outputPorts.forEach(function(p) {
        	maxNum = _.max([maxNum, _.max(p.value)])
        });
    });


    // add constants to cells
    module.nodes.forEach(function(n)
    {
        n.inputPorts.forEach(function(p)
        {
            var name = "";
            var constants = [];
            var lastNode = null;
            for (var i in p.value) {
                if (p.value[i]<2)
                {
                    maxNum += 1;
                    name+=p.value[i];
                    p.value[i] = maxNum;
                    constants.push(maxNum);
                    lastNode = n;
                }
                else if (constants.length>0)
                {
                    var constant = {
                        "key": name.split('').reverse().join(''),
                        "hide_name": 1,
                        "type": '$_constant_',
                        "inputPorts":[],
                        "outputPorts":[{'key':'Y','value':constants}]
                    }
                    if (n.attributes.src) {
                      constant.attributes ={'src':n.attributes.src};
                    }
                    module.cells.push(constant);
                    name='';
                    constants = [];
                }
            }
            if (constants.length>0)
            {
                var constant = {
                    "key": name.split('').reverse().join(''),
                    "hide_name": 1,
                    "type": '$_constant_',
                    "inputPorts":[],
                    "outputPorts":[{'key':'Y','value':constants}]
                }
                if (lastNode.attributes.src) {
                    constant.attributes ={'src':lastNode.attributes.src};
                }
                module.cells.push(constant);
            }
        });
    });
    module.nodes = module.inputPorts
                        .concat(module.outputPorts)
                        .concat(module.cells);
}

// solves for minimal bus splits and joins and adds them to module
function addSplitsJoins(module)
{
    var allInputs = [];
    var allOutputs = [];
    module.nodes.forEach(function(n)
    {
        n.inputPorts.forEach(function(i)
        {
            allInputs.push(','+i.value.join()+',');
        });
        n.outputPorts.forEach(function(i)
        {
            allOutputs.push(','+i.value.join()+',');
        });
    });

    var allInputsCopy = allInputs.slice();
    var splits = {};
    var joins = {};
    for (var i in allInputs) {
        gather(allOutputs, allInputsCopy, allInputs[i], 0, allInputs[i].length, splits, joins);
    }

    for (var join in joins) {
        var signals = join.slice(1,-1).split(',');
        for (var i in signals) {
          signals[i] = Number(signals[i])
        }
        var outPorts = [{'key':'Y','value':signals}];
        var inPorts = [];
        for (var i in joins[join]) {
            var name = joins[join][i];
            var value = getBits(signals, name);
          inPorts.push({'key':name,'value':value});
        }
        module.cells.push({"key":'$join$'+join,
          "hide_name": 1,
          "type": "$_join_",
          "inputPorts":inPorts,
          "outputPorts":outPorts});
    }

    for (var split in splits) {
        signals = split.slice(1,-1).split(',');
        for (var i in signals) {
          signals[i] = Number(signals[i])
        }
        var inPorts = [{'key':'A','value':signals}];
        var outPorts = [];
        for (var i in splits[split]) {
            var name = splits[split][i];
            var value = getBits(signals, name);
          outPorts.push({'key':name,'value':value});
        }
        module.cells.push({"key":'$split$'+split,
          "hide_name": 1,
          "type": "$_split_",
          "inputPorts":inPorts,
          "outputPorts":outPorts});
    }
    //refresh nodes
    module.nodes = module.inputPorts
                    .concat(module.outputPorts)
                    .concat(module.cells);
}

// returns a string that represents the values of the array of integers
function arrayToBitstring(bitArray) {
  var ret = ""
  for (var i in bitArray) {
    var bit = bitArray[i]
    if (ret=="") {
      ret = bit
    } else {
      ret += ','+bit
    }
  }
  return ','+ret+','
}

// returns whether needle is a substring of arrhaystack
function arrayContains(needle, haystack)
{
    return (haystack.indexOf(needle) > -1);
}

// returns the index of the string that contains a substring
// given arrhaystack, an array of strings
function indexOfContains(needle, arrhaystack)
{
  for (var i in arrhaystack) {
    if (arrayContains(needle, arrhaystack[i])) {
      return i
    }
  }
  return -1
}

function getBits(signals, indicesString) {
  var index = indicesString.indexOf(':')
  if (index==-1) {
    return [signals[indicesString]]
  } else {
    var start = indicesString.slice(0,index)
    var end = indicesString.slice(index+1)
    var slice = signals.slice(Number(start),Number(end)+1)
    return slice
  }
}

function addToDefaultDict(dict, key, value) {
  if (dict[key]==undefined) {
    dict[key]=[value]
  } else {
    dict[key].push(value)
  }
}

function getIndicesString(bitstring, query) {
  var splitStart = bitstring.indexOf(query)
  var splitEnd = splitStart + query.length
  var startIndex = bitstring.substring(0,splitStart).split(',').length-1;
  var endIndex = startIndex + query.split(',').length-3;

  if (startIndex == endIndex) {
    return startIndex+""
  } else {
    return startIndex+":"+endIndex
  }
}

function gather(inputs,
                outputs,
                toSolve, // element of outputs we are trying to solve
                start, // index of toSolve to start from
                end, //index of toSolve to end at
                splits,
                joins) {
  // remove myself from outputs list
  var index = outputs.indexOf(toSolve)
  if (arrayContains(toSolve, outputs)) {
    outputs.splice(index, 1);
  }

  // This toSolve is complete
  if (start >= toSolve.length || end - start < 2) {
    return
  }

  var query = toSolve.slice(start, end);

  // are there are perfect matches?
  if (arrayContains(query, inputs)) {
    if (query != toSolve) {

      addToDefaultDict(joins, toSolve, getIndicesString(toSolve,query))
    }
    gather(inputs, outputs, toSolve, end-1, toSolve.length, splits, joins)
    return
  }
  var index = indexOfContains(query, inputs);
  // are there any partial matches?
  if (index != -1) {
    if (query != toSolve) {
      addToDefaultDict(joins, toSolve, getIndicesString(toSolve,query))
    }
    // found a split
    addToDefaultDict(splits, inputs[index], getIndicesString(inputs[index],query))
    // we can match to this now
    inputs.push(query)
    gather(inputs, outputs, toSolve, end-1, toSolve.length, splits, joins)
    return
  }
  // are there any output matches?
  if (indexOfContains(query, outputs) != -1) {
    if (query != toSolve) {
      //add to join
      addToDefaultDict(joins, toSolve, getIndicesString(toSolve,query))
    }
    // gather without outputs

    gather(inputs, [], query, 0, query.length, splits, joins)
    inputs.push(query)
    return
  }

  gather(inputs, outputs, toSolve, start, start+ query.slice(0,-1).lastIndexOf(',')+1, splits, joins)
}

function createWires(module)
{
    var nets= {}
    module.nodes.forEach(function(n)
    {
        var nodeName = n.key;
        for (var i in n.inputPorts)
        {
            var port = n.inputPorts[i];
            port.parentNode = n;
            addToDefaultDict(nets,arrayToBitstring(port.value),port);
        }
    });
    var wires = [];
    module.nodes.forEach(function(n)
    {
        var nodeName = n.key;
        for (var i in n.outputPorts)
        {
            var port = n.outputPorts[i];
            port.parentNode = n;
            var riders = nets[arrayToBitstring(port.value)];
            var wire = {'drivers': [port], 'riders': riders};
            wires.push(wire);
            port.wire = wire;
            riders.forEach(function(r)
            {
                r.wire = wire;
            });
        }
    });
    module.wires = wires;
}