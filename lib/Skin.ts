import onml = require('onml');
import _ = require('lodash');

export namespace Skin {
    export let skin = null;

    export function getPortsWithPrefix(template: any[], prefix: string) {
        const ports = _.filter(template, (e) => {
            if (e instanceof Array && e[0] === 'g') {
                return e[1]['s:pid'].startsWith(prefix);
            }
        });
        return ports;
    }

    function filterPortPids(template, filter): string[] {
        const ports = _.filter(template, (element: any[]) => {
            const tag: string = element[0];
            if (element instanceof Array && tag === 'g') {
                const attrs: any = element[1];
                return filter(attrs);
            }
            return false;
        });
        return ports.map((port) => {
            return port[1]['s:pid'];
        });
    }

    export function getInputPids(template): string[] {
        return filterPortPids(template, (attrs) => {
            if (attrs['s:position']) {
                return attrs['s:position'] === 'top';
            }
            return false;
        });
    }

    export function getOutputPids(template): string[] {
        return filterPortPids(template, (attrs) => {
            if (attrs['s:position']) {
                return attrs['s:position'] === 'bottom';
            }
            return false;
        });
    }

    export function getLateralPortPids(template): string[] {
        return filterPortPids(template, (attrs) => {
            if (attrs['s:dir']) {
                return attrs['s:dir'] === 'lateral';
            }
            if (attrs['s:position']) {
                return attrs['s:position'] === 'left' ||
                    attrs['s:position'] === 'right';
            }
            return false;
        });
    }

    export function findSkinType(type: string) {
        let ret = null;
        onml.traverse(skin, {
            enter: (node, parent) => {
                if (node.name === 's:alias' && node.attr.val === type) {
                    ret = parent;
                }
            },
        });
        if (ret == null) {
            onml.traverse(skin, {
                enter: (node) => {
                    if (node.attr['s:type'] === 'generic') {
                        ret = node;
                    }
                },
            });
        }
        return ret.full;
    }

    export function getProperties() {
        const properties: any[] = _.find(skin, (el) => {
            return el[0] === 's:properties';
        });
        const vals = _.mapValues(properties[1], (val) => {
            if (!isNaN(val)) {
                return Number(val);
            }
            if (val === 'true') {
                return true;
            }
            if (val === 'false') {
                return false;
            }
            return val;
        });
        const layoutEngine = _.find(properties, (el) => {
            return el[0] === 's:layoutEngine';
        }) || {};
        vals.layoutEngine = layoutEngine[1];
        return vals;
    }
}
export default Skin;
