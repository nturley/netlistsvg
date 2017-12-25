JSON=$(wildcard *.json)
SVGS=$(JSON:.json=.svg)

all: $(SVGS)

%.svg: %.json
	node ../../bin/netlistsvg.js --skin ../../lib/analog.svg $< -o $@

clean:
	rm -f *.svg

.PHONY: all clean
