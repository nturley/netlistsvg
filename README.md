[![Linux Build Status](https://travis-ci.org/nturley/netlistsvg.svg?branch=master)](https://travis-ci.org/nturley/netlistsvg)
[![Windows Build status](https://ci.appveyor.com/api/projects/status/heijuq5nhw9m7rib/branch/master?svg=true)](https://ci.appveyor.com/project/nturley/netlistsvg/branch/master)
[![Gitter chat](https://badges.gitter.im/nturley/netlistsvg.png)](https://gitter.im/netlistsvg)
[![npm version](https://badge.fury.io/js/netlistsvg.svg)](https://badge.fury.io/js/netlistsvg)
![npm](https://img.shields.io/npm/dm/netlistsvg.svg)

# netlistsvg
draws an SVG schematic from a [yosys](https://github.com/cliffordwolf/yosys) JSON netlist. This can be generated [the `write_json` command](http://www.clifford.at/yosys/cmd_json.html). It uses [elkjs](https://github.com/OpenKieler/elkjs) for layout.

You can see an online demo [here](https://nturley.github.io/netlistsvg)

# Installation/Usage Instructions

## Command Line Interface
Install nodejs if isn't already installed.

To install the latest version from npm:
```sh
npm install -g netlistsvg
```

To install the latest version from source:
```sh
git clone https://github.com/nturley/netlistsvg
cd netlistsvg
npm install # install dependencies
sudo npm install -g . # install netlistsvg to system

sudo npm uninstall -g netlistsvg # uninstall from system
```

You can execute netlistsvg like this.
```
netlistsvg input_json_file [-o output_svg_file] [--skin skin_file]
```
The default value for the output file is out.svg.

Should work on Linux, OSX, and Windows. Running the build scripts (makefiles and the web demo) is easiest on Linux and OSX.

## Web bundle

I have a web bundle hosted on github pages here: https://nturley.github.io/netlistsvg/built/netlistsvg.bundle.js
It doesn't wrap ELKjs, so you'll need to include it separately. ELK creates a global variable, so you'll need to include ELKjs before netlistsvg.

In HTML it would look something like this
```html
<script type="text/javascript" src="https://nturley.github.io/netlistsvg/elk.bundled.js"></script>
<script type="text/javascript" src="https://nturley.github.io/netlistsvg/built/netlistsvg.bundle.js"></script>
```

On ObservableHQ, you can require it like this.

```javascript
netlistsvg = {
  var ELK = await require('https://nturley.github.io/netlistsvg/elk.bundled.js')
  window.ELK = ELK
  return require('https://nturley.github.io/netlistsvg/built/netlistsvg.bundle.js')
}
```

You may want to download and host your own copy.

The web bundle includes both the analog and digital skin and an example netlist for each. Using a promise would look like this.
```javascript
await netlistsvg.render(netlistsvg.digitalSkin, netlistsvg.exampleDigital);
```
Or to log the result to console using the callback API:
```javascript
netlistsvg.render(netlistsvg.digitalSkin, netlistsvg.exampleDigital, (err, result) => console.log(result));
```

To turn Verilog into YosysJSON in the browser, you can use [YosysJS](http://www.clifford.at/yosys/yosysjs.html)

## Development

The `lib/` folder contains the main source code for netlistsvg in Typescript. The `built/` folder contains said source code compiled to Javascript. When wanting to make changes to netlistsvg, one should modify the Typescript source, compile to Javascript, then test their modifications.

To compile, lint, and do self-tests, run
```sh
npm test
```

To build the web bundle, run
```sh
npm run build-module
```

# Examples

Here's an digital netlist produced by Yosys along with the diagram that netlistsvg created from it.
<details>
  <summary>JSON Source</summary>

```json
{
  "modules": {
    "up3down5": {
      "ports": {
        "clock": {
          "direction": "input",
          "bits": [ 2 ]
        },
        "data_in": {
          "direction": "input",
          "bits": [ 3, 4, 5, 6, 7, 8, 9, 10, 11 ]
        },
        "up": {
          "direction": "input",
          "bits": [ 12 ]
        },
        "down": {
          "direction": "input",
          "bits": [ 13 ]
        },
        "carry_out": {
          "direction": "output",
          "bits": [ 14 ]
        },
        "borrow_out": {
          "direction": "output",
          "bits": [ 15 ]
        },
        "count_out": {
          "direction": "output",
          "bits": [ 16, 17, 18, 19, 20, 21, 22, 23, 24 ]
        },
        "parity_out": {
          "direction": "output",
          "bits": [ 25 ]
        }
      },
      "cells": {
        "$add$input.v:17$3": {
          "type": "$add",
          "port_directions": {
            "A": "input",
            "B": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 16, 17, 18, 19, 20, 21, 22, 23, 24 ],
            "B": [ "1", "1" ],
            "Y": [ 26, 27, 28, 29, 30, 31, 32, 33, 34, 35 ]
          }
        },
        "$and$input.v:28$5": {
          "type": "$and",
          "port_directions": {
            "A": "input",
            "B": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 12 ],
            "B": [ 35 ],
            "Y": [ 36 ]
          }
        },
        "$and$input.v:29$6": {
          "type": "$and",
          "port_directions": {
            "A": "input",
            "B": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 13 ],
            "B": [ 37 ],
            "Y": [ 38 ]
          }
        },
        "$procdff$40": {
          "type": "$dff",
          "port_directions": {
            "CLK": "input",
            "D": "input",
            "Q": "output"
          },
          "connections": {
            "CLK": [ 2 ],
            "D": [ 39, 40, 41, 42, 43, 44, 45, 46, 47 ],
            "Q": [ 16, 17, 18, 19, 20, 21, 22, 23, 24 ]
          }
        },
        "$procdff$41": {
          "type": "$dff",
          "port_directions": {
            "CLK": "input",
            "D": "input",
            "Q": "output"
          },
          "connections": {
            "CLK": [ 2 ],
            "D": [ 36 ],
            "Q": [ 14 ]
          }
        },
        "$procdff$42": {
          "type": "$dff",
          "port_directions": {
            "CLK": "input",
            "D": "input",
            "Q": "output"
          },
          "connections": {
            "CLK": [ 2 ],
            "D": [ 38 ],
            "Q": [ 15 ]
          }
        },
        "$procdff$43": {
          "type": "$dff",
          "port_directions": {
            "CLK": "input",
            "D": "input",
            "Q": "output"
          },
          "connections": {
            "CLK": [ 2 ],
            "D": [ 48 ],
            "Q": [ 25 ]
          }
        },
        "$procmux$36": {
          "type": "$pmux",
          "port_directions": {
            "A": "input",
            "B": "input",
            "S": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 16, 17, 18, 19, 20, 21, 22, 23, 24 ],
            "B": [ 26, 27, 28, 29, 30, 31, 32, 33, 34, 49, 50, 51, 52, 53, 54, 55, 56, 57, 3, 4, 5, 6, 7, 8, 9, 10, 11 ],
            "S": [ 58, 59, 60 ],
            "Y": [ 39, 40, 41, 42, 43, 44, 45, 46, 47 ]
          }
        },
        "$procmux$37_CMP0": {
          "type": "$eq",
          "port_directions": {
            "A": "input",
            "B": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 13, 12 ],
            "B": [ "0", "1" ],
            "Y": [ 58 ]
          }
        },
        "$procmux$38_CMP0": {
          "type": "$eq",
          "port_directions": {
            "A": "input",
            "B": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 13, 12 ],
            "B": [ "1", "0" ],
            "Y": [ 59 ]
          }
        },
        "$procmux$39_CMP0": {
          "type": "$eq",
          "port_directions": {
            "A": "input",
            "B": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 13, 12 ],
            "B": [ "0", "0" ],
            "Y": [ 60 ]
          }
        },
        "$reduce_xor$input.v:27$4": {
          "type": "$reduce_xor",
          "port_directions": {
            "A": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 39, 40, 41, 42, 43, 44, 45, 46, 47 ],
            "Y": [ 48 ]
          }
        },
        "$sub$input.v:16$2": {
          "type": "$sub",
          "port_directions": {
            "A": "input",
            "B": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 16, 17, 18, 19, 20, 21, 22, 23, 24 ],
            "B": [ "1", "0", "1" ],
            "Y": [ 49, 50, 51, 52, 53, 54, 55, 56, 57, 37 ]
          }
        }
      }
    }
  }
}
```
</details>

![example](https://raw.githubusercontent.com/nturley/netlistsvg/master/doc/up3down5.svg?sanitize=true)

You can also write out the JSON by hand, of course. We support [JSON5](https://json5.org) syntax.

Here's an analog example.

<details>
  <summary>JSON Source</summary>

```json
{
  "modules": {
    "resistor_divider": {
      "ports": {
        "A": {
          "direction": "input",
          "bits": [2]
        },
        "B": {
          "direction": "input",
          "bits": [3]
        },
        "A AND B": {
          "direction": "output",
          "bits": [4]
        }
      },
      "cells": {
        "R1": {
          "type": "r_v",
          "connections": {
            "A": [2],
            "B": [5]
          },
          "attributes": {
            "value":"10k"
          }
        },
        "R2": {
          "type": "r_v",
          "connections": {
            "A": [3],
            "B": [5]
          },
          "attributes": {
            "value":"10k"
          }
        },
        "Q1": {
          "type": "q_pnp",
          "port_directions": {
            "C": "input",
            "B": "input",
            "E": "output"
          },
          "connections": {
            "C": [6],
            "B": [5],
            "E": [7]
          }
        },
        "R3": {
          "type": "r_v",
          "connections": {
            "A": [7],
            "B": [8]
          },
          "attributes": {
            "value":"10k"
          }
        },
        "R4": {
          "type": "r_v",
          "connections": {
            "A": [7],
            "B": [9]
          },
          "attributes": {
            "value":"10k"
          }
        },
        "R5": {
          "type": "r_v",
          "connections": {
            "A": [4],
            "B": [12]
          },
          "attributes": {
            "value":"10k"
          }
        },
        "Q2": {
          "type": "q_pnp",
          "port_directions": {
            "C": "input",
            "B": "input",
            "E": "output"
          },
          "connections": {
            "C": [10],
            "B": [9],
            "E": [4]
          }
        },
        "vcc": {
          "type": "vcc",
          "connections": {
            "A": [6]
          },
          "attributes": {
            "name":"VCC"
          }
        },
        "vcc2": {
          "type": "vcc",
          "connections": {
            "A": [10]
          },
          "attributes": {
            "name":"VCC"
          }
        },
        "gnd": {
          "type": "gnd",
          "port_directions": {
            "A": "input"
          },
          "connections": {
            "A": [8]
          },
          "attributes": {
            "name":"DGND"
          }
        },
        "gnd2": {
          "type": "gnd",
          "port_directions": {
            "A": "input"
          },
          "connections": {
            "A": [12]
          },
          "attributes": {
            "name":"DGND"
          }
        }
      }
    }
  }
}
```
</details>

![example](https://raw.githubusercontent.com/nturley/netlistsvg/master/doc/and.svg?sanitize=true)

## Skin File
It pulls the node icons and configuration options from a SVG skin file. This our default digital skin file.

<img src="https://raw.githubusercontent.com/nturley/netlistsvg/master/lib/default.svg?sanitize=true">

This is our analog skin file.

<img src="https://raw.githubusercontent.com/nturley/netlistsvg/master/lib/analog.svg?sanitize=true">

A skin file can use style tags or inline CSS to style the elements. That will be copied onto the output file. A skin file also defines a library of components to use. Each component has an alias list. It will use that component as a template for any cell with that type that it encounters. Each component defines the position and id of each of its ports so we know where to attach the wires to.

For example, here is a mux definition. It has two aliases: "$pmux" and "$mux". It defines a type name, and a width and height, as well as the position and id of each of it's ports. In general you can rearrange them however you like, and add whatever SVG elements you like inside the template.

```XML
<g s:type="mux" transform="translate(50, 50)" s:width="20" s:height="40">
  <s:alias val="$pmux"/>
  <s:alias val="$mux"/>

  <path d="M0,0 L20,10 L20,30 L0,40 Z"/>

  <g s:x="0" s:y="10" s:pid="A"/>
  <g s:x="0" s:y="30" s:pid="B"/>
  <g s:x="10" s:y="35" s:pid="S"/>
  <g s:x="20" s:y="20" s:pid="Y"/>
</g>
```

In addition to the library of components that are matched to cells, a skin file defines some special nodes. Input/Output ports, constants, Splits/Joins, and the generic node. Splits/Joins and the generic nodes are resized and ports are added or removed to adjust to the cell.

The elkjs layout properties are also defined in the skin file.

```XML
<s:layoutEngine
      org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers="5"
      org.eclipse.elk.spacing.nodeNode= "35"
      org.eclipse.elk.direction="DOWN"
    />
```
Any properties specified here will get passed along to the layout engine. Node and edge properties aren't configurable (yet).

Using the classes `.busLabel_*` and `.width_*` (where * indicates the bus width) in the `<style>` tag at the top of the skin file (or the resulting svg), styling based on bus width can be added to lines and labels.

For instance, to turn off bus width labels for buses of two wires, simply add:
```svg
.busLabel_2 {
    fill-opacity: 0;
}
```
To change the color of all lines of width 4 to red, simply add:
```svg
line.width_4 {
    stroke: red;
}
```
## Input JSON
Yosys JSON includes more information than we need. We only render one module (either the first or the module with an attribute "top"). If the cell name matches one of the aliases of a template from the skin, then it will use it as a template for the SVG file. Port directions are optional for cells that are defined in the skin (not generic cells).

So it should look something like this.
```json
{
  "modules": {
    "<dont care>": {
      "ports": {
        "<port name>": {
          "direction": "<input|output>",
          "bits": [ 2, "1", ... ]
        },
        ...
      },
      "cells": {
        "<cell name>": {
          "type": "<type name>",
          "parameters": {
            "WIDTH": 3,
            ...
          },
          "port_directions": {
            "<port name>": "<input|output>",
            ...
          },
          "connections": {
            "<port name>": [ 3, "0", ... ],
            ...
          }
      },
      ...
    }
  }
}
```

If the cell has a WIDTH parameter greater than 1, `-bus` will be appended to the end of the cell type. This is useful for changing the skin of a cell for single and multibit variants, but is currently only used for `$mux` (and its variants). The appended `-bus` will show up in the generic name above the cell for any cells that have a `WIDTH` parameter that aren't in the skin file provided.

## ElkJS
ELK is using a layered approach (Sugiyama, Ganser), similar to dot in the Graphviz package. You can read about their algorithm here: https://rtsys.informatik.uni-kiel.de/%7Ebiblio/downloads/papers/jvlc13.pdf

# Status
We are getting close to the 1.0 release. At that point, the skin file format will be considered specified and breaking changes will only happen on major version bumps.

## Generating `input_json_file` with Yosys

[Yosys from Clifford Wolf](https://github.com/cliffordwolf/yosys) can be used to generate the `input_json_file` using [the `write_json` command](http://www.clifford.at/yosys/cmd_json.html).

Unless you are doing something special you will want to use [the `prep` command](http://www.clifford.at/yosys/cmd_prep.html). Some examples are provided below and you can find some runnable examples which go from Verilog to diagrams in the [examples directory](./examples) (with example Makefile).

#### Generate top level diagram

This command will generate a diagram of the top module with all the inner modules shown as boxes.

```
yosys -p "prep -top my_top_module; write_json output.json" input.v
```

#### Generate logic diagram

You can give it the `-flatten` argument to  [the `prep` command](http://www.clifford.at/yosys/cmd_prep.html) if you want Yosys to convert everything into low level logic. Only basic logic cells and black boxes will exist after flattening.

```
yosys -p "prep -top my_top_module -flatten; write_json output.json" input.v
```

### Generate AND (or not) and inverter (NOT) diagram

It is also frequently common that you want to create a diagram only using AND and NOT (or NAND and NOT) cells. ([This is called an AIG](https://en.wikipedia.org/wiki/And-inverter_graph).) This can be done with Yosys' [`aigmap` command](http://www.clifford.at/yosys/cmd_proc.html).

```
yosys -p "prep -top my_top_module; aigmap; write_json output.json" input.v
```
