# netlistsvg
draws an SVG schematic from a [yosys](https://github.com/cliffordwolf/yosys) JSON netlist. It uses [klayjs](https://github.com/OpenKieler/klayjs) for layout.

<img src="https://cdn.rawgit.com/nturley/netlistsvg/master/doc/out.svg" width="600" height="600"/>

## Skin File
It pulls the node icons and configuration options from a SVG skin file. Like this one:

<img src="https://cdn.rawgit.com/nturley/netlistsvg/master/lib/test.svg" width="700" height="200">

All of the stuff that isn't part of the SVG spec itself is in it's own XML namespace.

## Split/Join Wires
It does it's best to be smart about how to split and join buses. I spent a lot of time thinking about it and hacked something together using javascript substrings. At some point I will rewrite it with a sane implementation. KlayJS handles all of the wire junctions. Sometimes it does some odd things. I'm still figuring it out.
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


# Status
Still early stages. Barely works and not very well.

# Installation Instructions
Don't. It's not ready yet.
