{
  description = "draws an SVG schematic from a JSON netlist";

  inputs.nixpkgs.url = github:NixOS/nixpkgs/nixos-20.03;
  inputs.flake-utils.url = github:numtide/flake-utils;

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachSystem ["x86_64-linux" "x86_64-darwin"] (system: {

      packages.netlistsvg =
        with import nixpkgs { inherit system; };
          (callPackage ./default.nix {}).package;

      defaultPackage = self.packages.${system}.netlistsvg;
    });
}
