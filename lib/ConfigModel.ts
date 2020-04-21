interface Config {
    hierarchy: Hierarchy;
    top: Top;
}

interface Hierarchy {
    enable: 'off' | 'level' | 'all' | 'modules';
    expandLevel: number;
    expandModules: ExpandModules;
    colour: string[];
}

interface ExpandModules {
    types: string[];
    ids: string[];
}

interface Top {
    enable: boolean;
    module: string;
}

export default Config;
