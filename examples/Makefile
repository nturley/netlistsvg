
YOSYS    ?= yosys
NODE     ?= node
INKSCAPE ?= inkscape

NETLISTSVG = ../bin/netlistsvg
NETLISTSVG_SKIN ?= ../skin.svg
NETLISTSVG_DPI  ?= 300

YOSYS_SCRIPT ?= generate_json.ys

%.json: %.v Makefile
	$(YOSYS) -p "proc; write_json $@" $<

%.flat.json: %.v Makefile
	$(YOSYS) -p "flatten; proc; write_json $@" $<

%.synth.json: %.v Makefile
	$(YOSYS) -p "synth -flatten; write_json $@" $<

%.map.json: %.v Makefile
	$(YOSYS) -p "prep; simplemap; write_json $@" $<

%.svg: %.json $(NETLISTSVG_SKIN)
	$(NODE) $(NETLISTSVG) $< -o $@ --skin $(NETLISTSVG_SKIN)

%.png: %.svg
	$(INKSCAPE) --export-png $@ --export-dpi $(NETLISTSVG_DPI) $<

%.all: %.png %.flat.png %.synth.png %.map.png
	eog $^

%.view: %.png
	eog $<

view: carry4-bits.png carry4-whole.png muxcy.png xorg.png
	eog $<

clean:
	rm -f *.json *.svg *.png

.PHONY: view clean update_yosys_extra
