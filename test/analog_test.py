import json
import os

def terminal(component, direction, offset):
    return {
        component + str(offset): {
            'type': component,
            'port_directions': {
                'A': direction
            },
            'connections': {
                'A': [offset]
            }
        }
    }

def vcc(offset):
    return terminal('vcc', 'output', offset)

def vee(offset):
    return terminal('vee', 'input', offset)

def gnd(offset):
    return terminal('gnd', 'input', offset)

def input(offset):
    return {
        'in' + str(offset): {
            'direction': 'input',
            'bits': [offset]
        }
    }

def output(offset):
    return {
        'out' + str(offset): {
            'direction': 'output',
            'bits': [offset]
        }
    }

def ab(component, offset):
    return {
        component: {
            "type": component,
            "port_directions": {
                "A": "input",
                "B": "output"
            },
            "connections": {
                "A": [offset],
                "B": [offset + 1]
            }
        }
    }

def pn(component, offset):
    return {
        component: {
            "type": component,
            "port_directions": {
                "+": "input",
                "-": "output"
            },
            "connections": {
                "+": [offset],
                "-": [offset + 1]
            }
        }
    }

def transistor(component, offset):
    return {
        component: {
            "type": component,
            "port_directions": {
                "B": "input",
                "C": "input",
                "E": "output"
            },
            "connections": {
                "B": [offset],
                "C": [offset + 1],
                "E": [offset + 2]
            }
        }
    }

def test_vertical(cons, component):
    def test(offset):
        cells = [vcc(offset), cons(component, offset), gnd(offset + 1)]
        return [], cells, offset + 2
    return test

def test_horizontal(cons, component):
    def test(offset):
        ports = [input(offset), output(offset + 1)]
        cells = [cons(component, offset)]
        return ports, cells, offset + 2
    return test

def test_transistor(component):
    def test(offset):
        ports = [input(offset)]
        cells = [vcc(offset + 1), transistor(component, offset), vee(offset + 2)]
        return ports, cells, offset + 3
    return test


def opamp(component, offset):
    return {
        component: {
            "type": component,
            "port_directions": {
                "+": "input",
                "-": "input",
                "OUT": "output",
                "VCC": "input",
                "VEE": "output"
            },
            "connections": {
                "+": [offset],
                "-": [offset + 1],
                "OUT": [offset + 2],
                "VCC": [offset + 3],
                "VEE": [offset + 4]
            }
        }
    }


def test_opamp(component):
    def test(offset):
        ports = [input(offset), input(offset + 1), output(offset + 2)]
        cells = [vcc(offset + 3), opamp(component, offset), vee(offset + 4)]
        return ports, cells, offset + 5
    return test


def transformer(component, offset):
    return {
        component: {
            "type": component,
            "port_directions": {
                "L1.1": "input",
                "L1.2": "input",
                "L2.1": "output",
                "L2.2": "output"
            },
            "connections": {
                "L1.1": [offset],
                "L1.2": [offset + 1],
                "L2.1": [offset + 2],
                "L2.2": [offset + 3]
            }
        }
    }


def test_transformer(component):
    def test(offset):
        ports = [input(offset), input(offset + 1), output(offset + 2), output(offset + 3)]
        cells = [transformer(component, offset)]
        return ports, cells, offset + 4
    return test


def generate_tests(tests):
    ports, cells, offset = {}, {}, 0
    for test in tests:
        tports, tcells, offset = test(offset)
        for port in tports:
            ports.update(port)
        for cell in tcells:
            cells.update(cell)
    return {
        'modules': {
            'tests': {
                'ports': ports,
                'cells': cells
            }
        }
    }

if __name__ == '__main__':
    netlistsvg = 'node ../bin/netlistsvg.js'
    skin = '../lib/analog.svg'
    json_file = 'analog_test.json'
    svg_file = 'analog_test.svg'

    tests = []

    for p in ['r', 'l', 'c']:
        tests.append(test_vertical(ab, p + '_v'))
        tests.append(test_horizontal(ab, p + '_h'))

    for s in ['v', 'i']:
        tests.append(test_vertical(pn, s))

    for d in ['d', 'd_sk', 'd_led']:
        tests.append(test_vertical(pn, d + '_v'))
        tests.append(test_horizontal(pn, d + '_h'))

    for t in ['q_npn', 'q_pnp']:
        tests.append(test_transistor(t))

    tests.append(test_horizontal(ab, 'xtal'))
    tests.append(test_opamp('op'))
    tests.append(test_transformer('transformer_1p_1s'))

    module = generate_tests(tests)
    with open(json_file, 'w+') as f:
        f.write(json.dumps(module, sort_keys=True,
                           indent=2, separators=(',', ': ')))
    os.system('%s --skin %s -o %s %s' % (netlistsvg, skin, svg_file, json_file))
