import VinylFile from 'vinyl';
import { WebpackStreamOptions } from './webpack-stream.options';
import { WebpackCompiler } from './webpack-compiler';
import { WebpackConfig } from './webpack-config';


export class CacheEntry {
    options: WebpackStreamOptions;
    compiler: WebpackCompiler;
    files: Map<string, VinylFile>; // key is path

    constructor(options: WebpackStreamOptions, webpackConfig: WebpackConfig, files?: Map<string, VinylFile>) {
        options.webpackInstance = options.webpackInstance || require('webpack');
        this.options = options;
        this.compiler = new WebpackCompiler(webpackConfig);
        this.files = files || new Map();
    }
}


export class Cache {
    private dataByName = new Map<string | symbol, CacheEntry>();

    constructor() { }

    get(name: string | symbol) {
        return this.dataByName.get(name);
    }

    set(name: string | symbol, cacheEntry: CacheEntry) {
        this.dataByName.set(name, cacheEntry);
    }
}
