import webpack from 'webpack';
import { EventEmitter } from 'events';
import supportsColor from 'supports-color';
import { isDefined } from '@upradata/util';
import MemoryFileSystem from 'memory-fs';
import { FileSystem } from './fs';
import VinylFile from 'vinyl';
import { StatsOptions, StatsValue, WatchOptions } from './webpack';


const defaultStatsOptions: StatsOptions = {
    colors: supportsColor.stdout.hasBasic,
    hash: false,
    timings: false,
    chunks: false,
    chunkModules: false,
    modules: false,
    children: true,
    version: true,
    cached: false,
    cachedAssets: false,
    reasons: false,
    source: false,
    errorDetails: false,
};


export class ListEmitter<T> {
    public readonly event = new EventEmitter();
    public list: T[] = [];

    push(...files: T[]) {
        const idx = this.list.push(...files);
        this.event.emit('push', ...files);

        return idx;
    }

    on<F extends (...args: any) => any>(eventName: string, listener: F) {
        return this.event.on(eventName, listener);
    }
}


export class WebpackStreamOptions {
    config: webpack.Configuration | webpack.Configuration[] = undefined;
    quiet: boolean = true;
    stats: StatsValue = defaultStatsOptions;
    watch: boolean = false;
    watchOptions: WatchOptions = {};
    verbose: boolean = false;
    progress: boolean = false;
    fs: FileSystem = { input: undefined, output: new MemoryFileSystem() };
    fsMode: 'fromVinylStream' | 'fromFS' = 'fromVinylStream';
    webpackInstance: typeof webpack = undefined;
    name: string;
    compileEndOfStream: boolean = true;
    entryFiles: ListEmitter<string>;
    streamFiles: ListEmitter<VinylFile>;
    noCache: boolean = true;

    constructor(options?: WebpackStreamOptions | webpack.Configuration | webpack.Configuration[]) {
        // assignDefaultOption(this as WebpackStreamOptions, isWebpackStreamOptions(options) ? options : { config: options }, { arrayMode: 'merge', assignMode: 'of' });

        Object.assign(this, isWebpackStreamOptions(options) ? options : { config: options });
        this.webpackInstance = this.webpackInstance || require('webpack'); // not requiring if explicitly given
    }
}


export function isWebpackStreamOptions(options: any): options is WebpackStreamOptions {
    return isDefined(options.config);
}
