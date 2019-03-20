declare module 'onml' {
    export function parse(dir: string): object;
    export function p(dir: string): object;
    export function stringify(o: object): string;
    export function s(o: object): string;
    export function traverse(o: object, callbacks: object);
    export function t(o: object, callbacks: object);
}
