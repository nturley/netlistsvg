# netlistsvg
draws an SVG schematic from a [yosys](https://github.com/cliffordwolf/yosys) JSON netlist. It uses [klayjs](https://github.com/OpenKieler/klayjs) for layout.

<img src="https://cdn.rawgit.com/nturley/netlistsvg/master/doc/out.svg" width="600" height="600"/>

## Skin File
It pulls the node icons and configuration options from a SVG skin file. Like this one:

<img src="https://cdn.rawgit.com/nturley/netlistsvg/master/lib/test.svg" width="700" height="200">

A skin file can define global CSS styling options onto the style attribute of the svg tag. That will be copied onto the output file. A skin file also defines a library of components to use. Each component has an alias list. It will use that component as a template for any cell with that type that it encounters. Each component defines the position and id of each of its ports so we know where to attach the wires to.

In addition to the library of components that are matched to cells, a skin file defines some special nodes. Input/Output ports, Splits/Joins, and the generic node. Splits/Joins and the generic node are particularly tricky because the height and number of ports need to be adjusted depending on the cell.

I'm also planning on pulling the global layout properties from here, but right now they are hard coded.

## Split/Join Wires
It does it's best to be smart about how to split and join buses. I spent a lot of time thinking about it and hacked something together using javascript strings (because I was too lazy to write my own library for processing sequences). At some point I will rewrite it with a sane implementation that doesn't use strings. I think I'm happy with the core algorithm, just the implementation is wonky.

<details>
  <summary>JSON Source</summary>
```json
{
  "modules": {
    "simple": {
      "ports": {
        "inthing": {
          "direction": "input",
          "bits": [ 2, 3, 4, 5 ]
        },
        "outthing": {
          "direction": "output",
          "bits": [ 2, 3 ]
        },
        "outthing2": {
          "direction": "output",
          "bits": [ 2, 3, 5 ]
        },
        "outthing3": {
          "direction": "output",
          "bits": [ 2, 3, 5 ]
        },
        "outthing4": {
          "direction": "output",
          "bits": [ 2 ]
        }
      },
      "cells": {}
    }
  }
}
```
</details>
<img src="https://cdn.rawgit.com/nturley/netlistsvg/master/doc/splitjoin.svg" width="300" height="250">

I'll read through my code some time and add more detailed notes of the algorithm, but as I recall, the basic principles are as follows:

* There should only exist one wire for each unique sequence of signals
* Always prefer using an existing signal over adding a new split or join

As I recall, I iterate over each input port and determine whether I need additional splits or joins to satisfy the port. Then I add the new signals as available signals for the rest of the ports to use.

KlayJS handles all of the wire junctions. Sometimes it does some odd things. I'm still figuring it out.
## Input JSON
This is designed to handle Yosys netlist format but we ignore most of it. This is what we are looking at.
```json
{
  "modules": {
    "<dont care>": {
      "ports": {
        "<port name>": {
          "direction": "<input|output",
          "bits": [ 2, "1", ... ]
        },
        ...
      },
      "cells": {
        "<cell name>": {
          "type": "<type name",
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
## KlayJS
I'm super impressed with this. Layout is a non-trivial problem and this tool is amazing. Naturally, I could've used the original Klay library written in Java instead of the JS transpiled version and I fiddled with that for a while but crossing language boundaries is irritating. Which means I'd be writing this in Java or Scala and I wasn't in the mood to do that. Also, I'd already written some of this code in Javascript, so it was easier to start from here.

This tool is really powerful and not very well documented so I'm still learning the ins and outs of how to use it. For instance, Klay should be in charge of positioning labels, (which I think might prevent the wires from being routed through text). Klay is also capable of port positioning. This means that potentially I could flag certain ports as being able to be swapped or repositioned and Klay could reorder them to reduce crossings. That's obviously a win for labeled ports on the generic, and split/join, but also a win for cells whose operation is commutative.

Klay is using a layered approach (Sugiyama, Ganser), similar to dot in the Graphviz package. I was doing a lot of experiments with it and I became convinced that longest path rank assignment produced better schematics than Network Simplex. This is obviously subjective, but I think that Network Simplex attempts to make the graph uniformly distributed on the page in an effort to make it less wide (or tall in our case). In schematics, I would rather a taller graph that grouped together related logic than a compact one with node that are more uniformly distributed. Also when the flow goes from left to right, with vertically scrolling webpages, using up additional vertical space isn't as big of a cost.

# TODO
* Improve packaging and usability
 * commandline arguments, usage statement
 * make the default skin actually default
 * browserify
* Move hard-coded values into skin file
 * spacing
 * rank assignment
 *
 
 
# Status
Still early stages. Barely works and not very well.

# Installation/Usage Instructions
It's not really ready yet, but if you like using half-built tools, I believe you can install node, clone this repo, and npm install the dependencies.

At the moment, the invocation looks something like this.
```
node bin/netlistsvg --input=test/simple.json --skin=lib/default.svg
```
but you can expect that to change.
