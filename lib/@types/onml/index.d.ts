declare module 'onml' {
    // avoid the headache of recursive type
    export type Element = [
        string, 
        Attributes?, 
        string?,
        ...Array<any>[],
    ];

    export interface Attributes {
        [attrName: string]: string;
    }

    export function parse(dir: string): Element;
    export function p(dir: string): Element;
    export function stringify(o: Element): string;
    export function s(o: Element): string;
    export function traverse(o: Element, callbacks: object);
    export function t(o: Element, callbacks: object);
}
