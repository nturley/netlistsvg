JSON=$(wildcard *.json)
SVGS=$(JSON:.json=.svg)
SKIN=../../lib/analog.svg

all: $(SVGS)

%.svg: %.json $(SKIN)
	node ../../bin/netlistsvg.js --skin $(SKIN) $< -o $@

clean:
	rm -f *.svg

.PHONY: all clean
