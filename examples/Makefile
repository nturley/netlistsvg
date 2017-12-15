
YOSYS    ?= yosys
NODE     ?= node
INKSCAPE ?= inkscape

NETLISTSVG = ../bin/netlistsvg
NETLISTSVG_SKIN ?= ../skin.svg
NETLISTSVG_DPI  ?= 300

YOSYS_SCRIPT ?= generate_json.ys

%.json: %.v $(YOSYS_SCRIPT)
	$(YOSYS) -s $(YOSYS_SCRIPT) -p "write_json $@" $<

%.svg: %.json $(NETLISTSVG_SKIN)
	$(NODE) $(NETLISTSVG) $< -o $@ --skin $(NETLISTSVG_SKIN)

%.png: %.svg
	$(INKSCAPE) --export-png $@ --export-dpi $(NETLISTSVG_DPI) $<

%.view: %.png
	eog $<

view: carry4-bits.png carry4-whole.png muxcy.png xorg.png
	eog $<

clean:
	rm -f *.json *.svg *.png

.PHONY: view clean
