'use strict';

var onml = require('onml'),
    _ = require('lodash'),
    ELK = require('elkjs'),
//    fs = require('fs-extra'),
    clone = require('clone');

var elk = new ELK();


function render(skin_data, yosys_netlist, done) {
    var skin = onml.p(skin_data);
    var layoutProps = getProperties(skin);

    // Find top module
    var module_name = null;
    _.forEach(yosys_netlist.modules,function(p, i) {
        if (p.attributes && p.attributes.top == 1) {
            module_name = i;
        }
    });
    // Otherwise default the first one in the file...
    if (module_name == null) {
        module_name = Object.keys(yosys_netlist.modules)[0];
    }

    var module = getReformattedModule(yosys_netlist.modules[module_name], skin);
    // this can be skipped if there are no 0's or 1's
    if (layoutProps.constants !== false) {
        addConstants(module);
    }
    // this can be skipped if there are no splits or joins
    if (layoutProps.splitsAndJoins !== false) {
        addSplitsJoins(module);
    }
    createWires(module, skin);
    var kgraph = buildKGraph(module, module_name, skin);
    //fs.writeJsonSync('kgraph_in.json', kgraph);
    //kgraph = fs.readJsonSync('kgraph_in.json');

    elk.layout(kgraph, {layoutOptions: layoutProps.layoutEngine})
        .then(function(g) {
            //fs.writeJsonSync('kgraph_out.json', g);
            done(null, klayed_out(g, module, skin));
        })
        .catch(function(error) {
            done(error);
        });
}

function getProperties(skin)
{
    var properties = _.find(skin, function (el) {
        return el[0] == 's:properties';
    });
    var vals =  _.mapValues(properties[1], function (val) {
        if (!isNaN(val)) {
            return Number(val);
        }
        if (val === 'true') {
            return true;
        }
        if (val === 'false') {
            return false;
        }
        return val;
    });
    var layoutEngine = _.find(properties, function(el) {
        return el[0] == 's:layoutEngine';
    }) || {};
    vals.layoutEngine = layoutEngine[1];
    return vals;
}

function which_dir(start, end) {
    if (end.x == start.x && end.y == start.y) throw 'start and end are the same';
    if (end.x != start.x && end.y != start.y) throw 'start and end arent orthogonal';

    if (end.x > start.x) return 'RIGHT';
    if (end.x < start.x) return 'LEFT';
    if (end.y > start.y) return 'DOWN';
    if (end.y < start.y) return 'UP';
    throw 'unexpected direction';
}

function removeDummyEdges(g) {
    // go through each edge group for each dummy
    var dummyNum = 0;
    // loop until we can't find an edge group or we hit 10,000
    while (dummyNum < 10000) {
        var dummyId = '$d_' + dummyNum;
        // find all edges connected to this dummy
        var edgeGroup = _.filter(g.edges, function (e) {
            return e.source == dummyId || e.target == dummyId;
        });
        if (edgeGroup.length == 0) break;

        var junctEdge = _.minBy(edgeGroup, function(e) {
            if (e.source == dummyId) {
                if (e.junctionPoints) {
                    var j = e.junctionPoints[0];
                    return _.findIndex(e.bendPoints, function(bend) {
                        return bend.x == j.x && bend.y == j.y;
                    });
                }
                // a number bigger than any bendpoint index
                return 1000;
            } else {
                if (e.junctionPoints) {
                    var j = e.junctionPoints[e.junctionPoints.length-1];
                    // flip the sign of the index so we find the max instead of the min
                    return 0 - _.findIndex(e.bendPoints, function(bend) {
                        return bend.x == j.x && bend.y == j.y;
                    });
                }
                // a number bigger than any bendpoint index
                return 1000;
            }
        });
        var junct = junctEdge.junctionPoints[0];
        
        var dirs = _.map(edgeGroup,function(e) {
            var s = e.sections[0];
            if (e.source == dummyId) {
                s.startPoint = junct;
                if (s.bendPoints) {
                    if (s.bendPoints[0].x == junct.x && s.bendPoints[0].y == junct.y) {
                        s.bendPoints = s.bendPoints.slice(1);
                    }

                    if (s.bendPoints.length>0) {
                        return which_dir(junct, s.bendPoints[0]);
                    }
                }
                return which_dir(junct, s.endPoint);
            } else {
                s.endPoint = junct;
                if (s.bendPoints) {
                    if (s.bendPoints[s.bendPoints.length - 1].x == junct.x && s.bendPoints[s.bendPoints.length - 1].y == junct.y) {
                        s.bendPoints.pop();
                    }
                    if (s.bendPoints.length > 0) {
                        return which_dir(junct, s.bendPoints[s.bendPoints.length-1]);
                    }
                }
                return which_dir(junct, s.startPoint);
            }
        });
        var setDirs = new Set(dirs);
        if (setDirs.size == 2) {
            junctEdge.junctionPoints = junctEdge.junctionPoints.slice(1);
        }
        dummyNum += 1;
    }
}

function setTextAttribute(tempclone, attribute, value) {
    onml.traverse(tempclone, {
        enter: function(node) {
            if (node.name == 'text' && node.attr['s:attribute'] == attribute) {
                node.full[2] = value;
            }
        }
    });
}

function setGenericSize(tempclone, height) {
    onml.traverse(tempclone, {
        enter: function(node) {
            if (node.name == 'rect' && node.attr['s:generic'] == 'body') {
                node.attr.height = height;
            }
        }
    });
}

function klayed_out(g, module, skin_data) {
    var nodes = _.map(module.nodes, function(n){
        var kchild = _.find(g.children,function(c) {
            return c.id == n.key;
        });
        var template = findSkinType(skin_data, n.type);
        var tempclone = clone(template);
        setTextAttribute(tempclone, 'ref', n.key);
        if (n.attributes && n.attributes.value) {
            setTextAttribute(tempclone, 'name', n.attributes.value);
        }
        tempclone[1].transform = 'translate(' + kchild.x+','+kchild.y+')';
        if (n.type == '$_constant_' && n.key.length > 3) {
            var num = parseInt(n.key, 2);
            setTextAttribute(tempclone, 'ref', '0x'+num.toString(16));
        }
        else if (n.type == '$_split_')
        {
            setGenericSize(tempclone, Number(getGenericHeight(template, n)));
            var outPorts = getPortsWithPrefix(template, 'out');
            var gap = Number(outPorts[1][1]['s:y']) - Number(outPorts[0][1]['s:y']);
            var startY = Number(outPorts[0][1]['s:y']);
            tempclone.pop();
            tempclone.pop();
            _.forEach(n.outputPorts,function(p, i)
            {
                var portClone = clone(outPorts[0]);
                portClone[portClone.length-1][2] = p.key;
                portClone[1].transform = 'translate('+outPorts[1][1]['s:x'] + ','
                                                    + (startY + i*gap) + ')';
                tempclone.push(portClone);
            });
        }
        else if (n.type == '$_join_')
        {
            setGenericSize(tempclone, Number(getGenericHeight(template, n)));
            var inPorts = getPortsWithPrefix(template, 'in');
            var gap = Number(inPorts[1][1]['s:y']) - Number(inPorts[0][1]['s:y']);
            var startY = Number(inPorts[0][1]['s:y']);
            tempclone.pop();
            tempclone.pop();
            _.forEach(n.inputPorts,function(p, i)
            {
                var portClone = clone(inPorts[0]);
                portClone[portClone.length-1][2] = p.key;
                portClone[1].transform = 'translate('+inPorts[1][1]['s:x'] + ','
                                                    + (startY + i*gap) + ')';
                tempclone.push(portClone);
            });
        }
        else if (template[1]['s:type'] == 'generic')
        {
            setGenericSize(tempclone, Number(getGenericHeight(template, n)));
            var inPorts = getPortsWithPrefix(template, 'in');
            var ingap = Number(inPorts[1][1]['s:y']) - Number(inPorts[0][1]['s:y']);
            var instartY = Number(inPorts[0][1]['s:y']);
            var outPorts = getPortsWithPrefix(template, 'out');
            var outgap = Number(outPorts[1][1]['s:y']) - Number(outPorts[0][1]['s:y']);
            var outstartY = Number(outPorts[0][1]['s:y']);
            tempclone.pop();
            tempclone.pop();
            tempclone.pop();
            tempclone.pop();
            _.forEach(n.inputPorts,function(p, i)
            {
                var portClone = clone(inPorts[0]);
                portClone[portClone.length-1][2] = p.key;
                portClone[1].transform = 'translate('+inPorts[1][1]['s:x'] + ','
                                                    + (instartY + i*ingap) + ')';
                tempclone.push(portClone);
            });
            _.forEach(n.outputPorts,function(p, i)
            {
                var portClone = clone(outPorts[0]);
                portClone[portClone.length - 1][2] = p.key;
                portClone[1].transform = 'translate(' + outPorts[1][1]['s:x'] + ','
                                                    + (outstartY + i * outgap) + ')';
                tempclone.push(portClone);
            });
            tempclone[2][2] = n.type;
        }
        return tempclone;
    });
    removeDummyEdges(g);
    var lines = _.flatMap(g.edges, function (e) {
        return _.flatMap(e.sections, function (s) {
            var startPoint = s.startPoint;
            s.bendPoints = s.bendPoints || [];
            var bends = _.map(s.bendPoints, function (b)
            {
                var l = ['line', {
                    'x1':startPoint.x,
                    'y1':startPoint.y,
                    'x2':b.x,
                    'y2':b.y}];
                startPoint = b;
                return l;
            });

            bends = bends.concat(_.map(e.junctionPoints, function (j)
            {
                return ['circle', {'cx':j.x, 'cy':j.y, 'r':2, 'style':'fill:#000'}];
            }));
            var line = [['line',{
                'x1':startPoint.x,
                'y1':startPoint.y,
                'x2':s.endPoint.x,
                'y2':s.endPoint.y}]];
            return bends.concat(line);
        });
    });
    var svg = skin_data.slice(0,2);
    svg[1].width = g.width;
    svg[1].height = g.height;

    var styles = _.filter(skin_data, function (el) {
        return el[0] == 'style';
    });
    var ret = svg.concat(styles).concat(nodes).concat(lines);
    return onml.s(ret);
}

function addDummy(children, dummy_num) {
    var dummyId = '$d_' + dummy_num;
    var child = {
        id : dummyId,
        width:0,
        height:0,
        ports: [{
            id: dummyId+'.p',
            width: 0,
            height: 0
        }],
        layoutOptions: {'org.eclipse.elk.portConstraints': 'FIXED_SIDE'}
    };
    children.push(child);
    return dummyId;
}

function route(sourcePorts, targetPorts, i) {
    return _.flatMap(sourcePorts, function(sourcePort) {
        var sourceParentKey = sourcePort.parentNode.key;
        var sourceKey = sourceParentKey + '.' + sourcePort.key;
        return _.map(targetPorts, function (targetPort) {
            var targetParentKey = targetPort.parentNode.key;
            var targetKey = targetParentKey + '.' + targetPort.key;
            var edge = {
                id: 'e' + i,
                source: sourceParentKey,
                sourcePort: sourceKey,
                target: targetParentKey,
                targetPort: targetKey
            };
            if (sourcePort.parentNode.type != '$dff') {
                edge.layoutOptions = {'org.eclipse.elk.layered.priority.direction':10};
            }
            i += 1;
            return edge;
        });
    });
}

function buildKGraph(module, module_name, skin_data)
{
    var children = _.map(module.nodes,function(n)
    {
        return buildKGraphChild(skin_data, n);
    });
    var i =0;
    var dummies = 0;
    var edges = _.flatMap(module.wires,function(w) {
        // at least one driver and at least one rider and no laterals
        if (w.drivers.length > 0 && w.riders.length > 0 && w.laterals.length == 0) {
            var ret = route(w.drivers, w.riders);
            i += ret.length;
            return ret;
        // at least one driver or rider and at least one lateral
        } else if (w.drivers.concat(w.riders).length > 0 && w.laterals.length > 0) {
            var ret = route(w.drivers, w.laterals).concat(route(w.laterals, w.riders));
            i += ret.length;
            return ret;
        // at least two drivers and no riders
        } else if (w.riders.length == 0 && w.drivers.length > 1) {
            // create a dummy node and add it to children
            var dummyId = addDummy(children, dummies);
            dummies += 1;
            var dummyEdges = _.map(w.drivers, function(driver) {
                var sourceParentKey = driver.parentNode.key;
                var id = 'e' + i;
                i += 1;
                return {
                    id: id,
                    source: sourceParentKey,
                    sourcePort: sourceParentKey + '.' + driver.key,
                    target: dummyId,
                    targetPort: dummyId + '.p'
                };
            });
            return dummyEdges;
        // at least one rider and no drivers
        } else if (w.riders.length > 1 && w.drivers.length == 0) {
            // create a dummy node and add it to children
            var dummyId = addDummy(children, dummies);
            dummies += 1;
            var dummyEdges = _.map(w.riders, function(rider) {
                var sourceParentKey = rider.parentNode.key;
                var id = 'e' + i;
                i += 1;
                var edge = {
                    id: id,
                    source: dummyId,
                    sourcePort: dummyId + '.p',
                    target: sourceParentKey,
                    targetPort: sourceParentKey + '.' + rider.key
                };
                return edge;
            });
            return dummyEdges;
        } else if (w.laterals.length > 1) {
            var source = w.laterals[0];
            var sourceParentKey = source.parentNode.key;
            var e = _.map(w.laterals.slice(1), function(lateral) {
                var lateralParentKey = lateral.parentNode.key;
                var id = 'e' + i;
                i += 1;
                var edge = {
                    id: id,
                    source: sourceParentKey,
                    sourcePort: sourceParentKey + '.' + source.key,
                    target: lateralParentKey,
                    targetPort: lateralParentKey + '.' + lateral.key
                };
                return edge;
            });
            return e;
        }
        // for only one driver or only one rider, don't create any edges
        return [];
    });
    return {
        id:module_name,
        children:children,
        edges:edges,
    };
}

function getGenericHeight(template, node)
{
    var inPorts = getPortsWithPrefix(template, 'in');
    var outPorts = getPortsWithPrefix(template, 'out');
    if (node.inputPorts.length > node.outputPorts.length) {
        var gap = Number(inPorts[1][1]['s:y']) - Number(inPorts[0][1]['s:y']);
        return Number(template[1]['s:height']) + gap * (node.inputPorts.length - 2);
    }
    if (outPorts.length > 1) {
        var gap = Number(outPorts[1][1]['s:y']) - Number(outPorts[0][1]['s:y']);
        return Number(template[1]['s:height']) + gap * (node.outputPorts.length - 2);
    }
    return Number(template[1]['s:height']);
}

function getPortsWithPrefix(template, prefix)
{
    var ports = _.filter(template, function (e) {
        if (e instanceof Array && e[0] == 'g') {
            return e[1]['s:pid'].startsWith(prefix);
        }
    });
    return ports;
}

function filterPortPids(template, filter) {
    var ports = _.filter(template, function(element) {
        var tag = element[0];
        if (element instanceof Array && tag == 'g') {
            var attrs = element[1];
            return filter(attrs);
        }
        return false;
    });
    return _.map(ports, function(port) {
        return port[1]['s:pid'];
    });
}

function getLateralPortPids(template) {
    return filterPortPids(template, (attrs) => {
        if (attrs['s:dir']) {
            return attrs['s:dir'] == 'lateral';
        }
        if (attrs['s:position']) {
            return attrs['s:position'] == 'left' ||
            attrs['s:position'] == 'right';
        }
        return false;
    });
}

function getInputPortPids(template) {
    return filterPortPids(template, (attrs) => {
        if (attrs['s:position']) {
            return attrs['s:position'] == 'left' ||
                   attrs['s:position'] == 'top';
        }
        return false;
    });
}

function getOutputPortPids(template) {
    return filterPortPids(template, (attrs) => {
        if (attrs['s:position']) {
            return attrs['s:position'] == 'right' ||
                   attrs['s:position'] == 'bottom';
        }
        return false;
    });
}

function getGenericPortsFrom(nports, templatePorts, nkey, type, dir)
{
    return _.map(nports, function (p, i)
    {

        if (i == 0) {
            var ret = {
                id : nkey + '.' + p.key,
                width : 1,
                height : 1,
                x : Number(templatePorts[0][1]['s:x']),
                y : Number(templatePorts[0][1]['s:y'])
            };

            if ((type == 'generic' || type == 'join') && dir == 'in') {
                ret.labels = [{
                    text: p.key,
                    x: Number(templatePorts[0][2][1].x),
                    y: Number(templatePorts[0][2][1].y),
                    width: (6*p.key.length),
                    height: 11
                }];
            }

            if ((type == 'generic' || type == 'split') && dir == 'out') {
                ret.labels = [{
                    text: p.key,
                    x: Number(templatePorts[0][2][1].x),
                    y: Number(templatePorts[0][2][1].y),
                    width: (6*p.key.length),
                    height: 11
                }];
            }

            return ret;
        } else {
            var gap = Number(templatePorts[1][1]['s:y']) - Number(templatePorts[0][1]['s:y']);
            var ret = {
                id : nkey + '.' + p.key,
                width : 1,
                height : 1,
                x : Number(templatePorts[0][1]['s:x']),
                y : (i) * gap + Number(templatePorts[0][1]['s:y'])
            };
            if (type == 'generic') {
                ret.labels = [{
                    text: p.key,
                    x: Number(templatePorts[0][2][1].x),
                    y: Number(templatePorts[0][2][1].y),
                    width: (6*p.key.length),
                    height: 11
                }];
            }
            return ret;
        }
    });
}

//given a module type, build kgraphchild
function buildKGraphChild(skin_data, n)
{
    //   labels: [ { text: "n2" } ],
    var template = findSkinType(skin_data, n.type);
    var type = template[1]['s:type'];
    if (type == 'join' ||
        type == 'split' ||
        type == 'generic')
    {
        var inPorts = getPortsWithPrefix(template, 'in');
        var outPorts = getPortsWithPrefix(template, 'out');
        var ports = getGenericPortsFrom(n.inputPorts,
            inPorts,
            n.key,
            type,
            'in').concat(
            getGenericPortsFrom(n.outputPorts,
                outPorts,
                n.key,
                type,
                'out'));
        var ret = {
            id: n.key,
            width: Number(template[1]['s:width']),
            height: Number(getGenericHeight(template, n)),
            ports: ports,
            layoutOptions: {'de.cau.cs.kieler.portConstraints': 'FIXED_POS'}
        };
        if ( type == 'generic') {
            ret.labels = [{
                text : n.type,
                x : Number(template[2][1].x),
                y : Number(template[2][1].y),
                height : 11,
                width : (6*n.type.length)
            }];
        }
        return ret;
    }
    var ports = _.map(getPortsWithPrefix(template, ''), function(p)
    {
        return {
            id : n.key + '.' + p[1]['s:pid'],
            width : 0,
            height : 0,
            x : Number(p[1]['s:x']),
            y : Number(p[1]['s:y'])
        };
    });
    var nodeWidth = Number(template[1]['s:width']);
    var ret = {
        id: n.key,
        width: nodeWidth,
        height: Number(template[1]['s:height']),
        ports: ports,
        layoutOptions: {'de.cau.cs.kieler.portConstraints': 'FIXED_POS'}
    };
    if (type == 'inputExt' ||
        type == 'outputExt') {
        ret.labels = [{
            text : n.key,
            x : Number(template[2][1].x)+nodeWidth/2-3*n.key.length,
            y : Number(template[2][1].y),
            height : 11,
            width : (6*n.key.length)
        }];
    }
    return ret;
}

function findSkinType(skin_data, type)
{
    var ret = null;
    onml.traverse(skin_data, {
        enter: function (node, parent) {
            if (node.name == 's:alias' && node.attr.val == type)
            {
                ret = parent;
            }
        }
    });
    if (ret == null) {
        onml.traverse(skin_data, {
            enter: function (node) {
                if (node.attr['s:type'] == 'generic')
                {
                    ret = node;
                }
            }
        });
    }
    return ret.full;
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
// a flat module has a list of nodes that include all input and output ports
function getReformattedModule(module, skin)
{
    var ports= toArray(module.ports);
    var inputPorts = _.filter(ports, function(p) {
        return p.direction=='input';
    });
    var outputPorts = _.filter(ports, function(p){
        return p.direction=='output';
    });
    var cells = toArray(module.cells);
    inputPorts.forEach(function(p){p.type= '$_inputExt_';});
    outputPorts.forEach(function(p){p.type='$_outputExt_';});
    cells.forEach(function(c)
    {
        var template = findSkinType(skin, c.type);
        if (!c.port_directions) {
            c.port_directions = {};
        }
        getInputPortPids(template).forEach((pid) => {
            c.port_directions[pid] = 'input';
        });
        getOutputPortPids(template).forEach((pid) => {
            c.port_directions[pid] = 'output';
        });
        c.inputPorts = getCellPortList(c,'input');
        c.outputPorts = getCellPortList(c,'output');
    });
    inputPorts.forEach(function(p)
    {
        p.inputPorts = [];
        p.outputPorts = [{'key':'Y','value':p.bits}];
    });
    outputPorts.forEach(function(p)
    {
        p.inputPorts = [{'key':'A','value':p.bits}];
        p.outputPorts = [];
    });
    var flatModule = {
        nodes :
            inputPorts
                .concat(outputPorts)
                .concat(cells)
    };
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
            maxNum = _.max([maxNum, _.max(p.value)]);
        });
    });


    // add constants to nodes
    var signalsByConstantName = {};
    module.nodes.forEach(function(n)
    {
        n.inputPorts.forEach(function(p)
        {
            var name = '';
            var constants = [];
            for (var i in p.value) {
                if (p.value[i]<2)
                {
                    maxNum += 1;
                    name += p.value[i];
                    p.value[i] = maxNum;
                    constants.push(maxNum);
                }
                else if (constants.length > 0)
                {
                    var key = name.split('').reverse().join('');
                    if (signalsByConstantName.hasOwnProperty(key)) {
                        var val = signalsByConstantName[key];
                        for (var vi in val) {
                            var j = i - val.length + vi;
                            p.value[j] = val[vi];
                        }
                    } else {
                        var constant = {
                            'key': key,
                            'type': '$_constant_',
                            'inputPorts':[],
                            'outputPorts':[{'key':'Y','value':constants}]
                        };
                        module.nodes.push(constant);
                        signalsByConstantName[key] = constants;
                    }
                    name='';
                    constants = [];
                }
            }
            if (constants.length > 0)
            {
                var key = name.split('').reverse().join('');
                if (signalsByConstantName.hasOwnProperty(key)) {
                    var val = signalsByConstantName[key];
                    for (vi in val) {
                        var j = i - (val.length-1) + parseInt(vi);
                        p.value[j] = val[vi];
                    }
                } else {
                    var constant = {
                        'key': key,
                        'type': '$_constant_',
                        'inputPorts':[],
                        'outputPorts':[{'key':'Y','value':constants}]
                    };
                    module.nodes.push(constant);
                    signalsByConstantName[key] = constants;
                }
            }
        });
    });
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
            allInputs.push(',' + i.value.join() + ',');
        });
        n.outputPorts.forEach(function(i)
        {
            allOutputs.push(',' + i.value.join() + ',');
        });
    });

    var allInputsCopy = allInputs.slice();
    var splits = {};
    var joins = {};
    allInputs.forEach(function(input) {
        gather(
            allOutputs,
            allInputsCopy,
            input,
            0,
            input.length,
            splits,
            joins);
    });

    for (var join in joins) {
        // turn string into array of signal names
        var signals = join.slice(1, -1).split(',');
        // convert the signals into actual numbers
        for (var i in signals) {
            signals[i] = Number(signals[i]);
        }

        var outPorts = [{'key': 'Y', 'value': signals}];
        var inPorts = [];
        joins[join].forEach(function(name) {
            var value = getBits(signals, name);
            inPorts.push({'key': name, 'value': value});
        });
        module.nodes.push({'key': '$join$' + join,
            'hide_name': 1,
            'type': '$_join_',
            'inputPorts': inPorts,
            'outputPorts': outPorts});
    }

    for (var split in splits) {
        signals = split.slice(1, -1).split(',');
        for (var i in signals) {
            signals[i] = Number(signals[i]);
        }
        var inPorts = [{'key': 'A', 'value': signals}];
        var outPorts = [];
        splits[split].forEach(function(name) {
            var value = getBits(signals, name);
            outPorts.push({'key': name, 'value': value});
        });
        module.nodes.push({'key': '$split$' + split,
            'hide_name': 1,
            'type': '$_split_',
            'inputPorts': inPorts,
            'outputPorts': outPorts});
    }
}

// returns a string that represents the values of the array of integers
// [1, 2, 3] -> ',1,2,3,'
function arrayToBitstring(bitArray) {
    var ret = '';
    bitArray.forEach(function (bit) {
        if (ret == '') {
            ret = bit;
        } else {
            ret += ',' + bit;
        }
    });
    return ',' + ret + ',';
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
            return i;
        }
    }
    return -1;
}

function getBits(signals, indicesString) {
    var index = indicesString.indexOf(':');
    if (index == -1) {
        return [signals[indicesString]];
    } else {
        var start = indicesString.slice(0, index);
        var end = indicesString.slice(index + 1);
        var slice = signals.slice(Number(start), Number(end) + 1);
        return slice;
    }
}

function addToDefaultDict(dict, key, value) {
    if (dict[key] == undefined) {
        dict[key] = [value];
    } else {
        dict[key].push(value);
    }
}

// string (for labels), that represents an index
// or range of indices.
function getIndicesString(bitstring, query, start) {
    var splitStart = _.max([bitstring.indexOf(query),start]);
    var startIndex = bitstring.substring(0,splitStart).split(',').length - 1;
    var endIndex = startIndex + query.split(',').length - 3;

    if (startIndex == endIndex) {
        return startIndex + '';
    } else {
        return startIndex + ':' + endIndex;
    }
}

// gather splits and joins
function gather(inputs,  // all inputs
    outputs, // all outputs
    toSolve, // an input array we are trying to solve
    start,   // index of toSolve to start from
    end,     // index of toSolve to end at
    splits,  // container collecting the splits
    joins)   // container collecting the joins
{
    // remove myself from outputs list
    var index = outputs.indexOf(toSolve);
    if (arrayContains(toSolve, outputs)) {
        outputs.splice(index, 1);
    }

    // This toSolve is complete
    if (start >= toSolve.length || end - start < 2) {
        return;
    }

    var query = toSolve.slice(start, end);

    // are there are perfect matches?
    if (arrayContains(query, inputs)) {
        if (query != toSolve) {
            addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
        }
        gather(inputs, outputs, toSolve, end-1, toSolve.length, splits, joins);
        return;
    }
    var index = indexOfContains(query, inputs);
    // are there any partial matches?
    if (index != -1) {
        if (query != toSolve) {
            addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
        }
        // found a split
        addToDefaultDict(splits, inputs[index], getIndicesString(inputs[index], query, 0));
        // we can match to this now
        inputs.push(query);
        gather(inputs, outputs, toSolve, end-1, toSolve.length, splits, joins);
        return;
    }
    // are there any output matches?
    if (indexOfContains(query, outputs) != -1) {
        if (query != toSolve) {
            //add to join
            addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
        }
        // gather without outputs
        gather(inputs, [], query, 0, query.length, splits, joins);
        inputs.push(query);
        return;
    }
    gather(inputs, outputs, toSolve, start, start+ query.slice(0,-1).lastIndexOf(',')+1, splits, joins);
}

// search through all the ports to find all of the wires
function createWires(module, skin)
{
    var layoutProps = getProperties(skin);
    var ridersByNet = {};
    var driversByNet = {};
    var lateralsByNet = {};
    module.nodes.forEach(function(n)
    {
        var template = findSkinType(skin, n.type);
        var lateralPids = getLateralPortPids(template);
        // find all ports connected to the same net
        n.inputPorts.forEach(function(port) {
            port.parentNode = n;
            if (port.key == lateralPids || (template[1]['s:type'] ==  'generic' && layoutProps.genericsLaterals == 'true')) {
                addToDefaultDict(lateralsByNet, arrayToBitstring(port.value), port);
            } else {
                addToDefaultDict(ridersByNet, arrayToBitstring(port.value), port);
            }
        });
        n.outputPorts.forEach(function(port) {
            port.parentNode = n;
            if (port.key == lateralPids || (template[1]['s:type'] ==  'generic'&& layoutProps.genericsLaterals == 'true')) {
                addToDefaultDict(lateralsByNet, arrayToBitstring(port.value), port);
            } else {
                addToDefaultDict(driversByNet, arrayToBitstring(port.value), port);
            }
        });
    });
    // list of unique nets
    var nets = Array.from(new Set(_.keys(ridersByNet).concat(_.keys(driversByNet)).concat(_.keys(lateralsByNet))));
    var wires = _.map(nets, function(net) {
        var drivers = driversByNet[net] || [];
        var riders = ridersByNet[net] || [];
        var laterals = lateralsByNet[net] || [];
        var wire = {'drivers':drivers, 'riders':riders, 'laterals':laterals};
        drivers.concat(riders).concat(laterals).forEach(function (port) {
            port.wire = wire;
        });
        return wire;
    });
    module.wires = wires;
}

exports.render = render;
