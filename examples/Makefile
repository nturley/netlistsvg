YOSYS    ?= yosys
INKSCAPE ?= inkscape
VIEWER   ?= eog

YOSYS_FLAGS ?= -q
# YOSYS_FLAGS ?= -Q -T

# Node JS is sometimes installed as node and sometimes as nodejs
ifneq ($(shell which node),)
NODE	 ?= node
else
ifneq ($(shell which nodejs),)
NODE     ?= nodejs
else
$(error "Can not find node(js), please set $$NODE to the node binary")
endif
endif

NETLISTSVG = ../bin/netlistsvg
NETLISTSVG_SKIN ?= ../lib/default.svg
NETLISTSVG_DPI  ?= 300

# Simple files are the same flattened as not
SIMPLE_FILES=dff.v muxcy.v xorcy.v
# Complex files are different when flattened
COMPLEX_FILES=carry4bits.v carry4whole.v

ALL_TARGETS= \
	     $(foreach v,$(SIMPLE_FILES) ,$(basename $(v)).simple.all) \
	     $(foreach v,$(COMPLEX_FILES),$(basename $(v)).complex.all)

GET_TOP ?= export TOP=$$(echo $(basename $<) | tr a-z A-Z);

# Top level diagram
%.json: %.v Makefile
	$(GET_TOP) $(YOSYS) $(YOSYS_FLAGS) -p "prep -top $$TOP; write_json $@" $<

# Split wires, can make it easier for the diagram if nets are split up
%.split.json: %.v Makefile
	$(GET_TOP) $(YOSYS) $(YOSYS_FLAGS) -p "prep -top $$TOP; splitnets; write_json $@" $<

# Flatten the diagram into logic + black boxes
%.flat.json: %.v Makefile
	$(GET_TOP) $(YOSYS) $(YOSYS_FLAGS) -p "prep -top $$TOP -flatten; write_json $@" $<

# Convert logic into AND and NOT logic
%.aig.json: %.v Makefile
	$(GET_TOP) $(YOSYS) $(YOSYS_FLAGS) -p "prep -top $$TOP -flatten; cd $$TOP; aigmap; write_json $@" $<

# Convert logic into NAND, AND and NOT logic
%.naig.json: %.v Makefile
	$(GET_TOP) $(YOSYS) $(YOSYS_FLAGS) -p "prep -top $$TOP -flatten; cd $$TOP; aigmap -nand; write_json $@" $<

# Convert logic into "simple logic" - NOT, AND, XOR, etc
%.simplemap.json: %.v Makefile
	$(GET_TOP) $(YOSYS) $(YOSYS_FLAGS) -p "prep -top $$TOP -flatten; cd $$TOP; simplemap; write_json $@" $<

# Use netlistsvg to generate SVG files
%.svg: %.json $(NETLISTSVG_SKIN)
	$(NODE) $(NETLISTSVG) $< -o $@ --skin $(NETLISTSVG_SKIN)

# Use inkscape to render the SVG files into PNG files.
%.png: %.svg
	$(INKSCAPE) --export-png $@ --export-dpi $(NETLISTSVG_DPI) $< 2>&1 | grep -v "WARNING: unknown type: s:alias"

# Open the rendered PNG in a file viewer
%.view: %.png
	eog $< &

# Generate all PNGs for simple files
%.simple.all: %.png %.aig.png
	@true

# Generate all PNGS for complex files
%.complex.all: %.png %.split.png %.flat.png %.aig.png %.simplemap.png
	@true

# Build everything!
build.all: $(ALL_TARGETS)
	@true

# View everything!
view.all: build.all
	eog *.png &

clean:
	rm -f *.json *.svg *.png

all:
	make clean
	make view.all

.DEFAULT_GOAL := all
.PRECIOUS: %.png
.PHONY: view clean all
