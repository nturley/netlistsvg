interface Config {
    hierarchy: Hierarchy;
}

interface Hierarchy {
    enable: 'off' | 'level' | 'all' | 'modules';
    expandLevel: number;
    expandModules: ExpandModules;
}

interface ExpandModules {
    types: string[];
    ids: string[];
}

export default Config;
