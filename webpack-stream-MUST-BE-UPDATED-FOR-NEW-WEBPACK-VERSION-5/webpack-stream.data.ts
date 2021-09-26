import fancyLog from 'fancy-log';
import webpack from 'webpack';
import supportsColor from 'supports-color';
import VinylFile from 'vinyl';
import { PartialRecursive, isUndefined } from '@upradata/util';
import { WebpackStreamOptions, ListEmitter } from './webpack-stream.options';
import { WebpackConfig } from './webpack-config';
import { Cache, CacheEntry } from './cache';
import { WebpackCompiler } from './webpack-compiler';
import { CallbackFunction, Compilation } from './webpack';

export type WebpackStreamDataOptions = PartialRecursive<WebpackStreamOptions> & { config: webpack.Configuration; } | webpack.Configuration;

export class WebpackStreamData {
    static cache = new Cache();

    public options: WebpackStreamOptions;
    public webpackDone: CallbackFunction<webpack.Stats>;
    public webpackConfig: WebpackConfig;
    private symbol = Symbol('default entry');

    public files = new Map<string, VinylFile>();
    public compiler: WebpackCompiler;

    constructor(
        options?: WebpackStreamDataOptions,
        webpackDone?: CallbackFunction<webpack.Stats>) {

        const opts = new WebpackStreamOptions(options);
        this.options = opts;
        this.webpackConfig = new WebpackConfig(opts);
        this.compiler = new WebpackCompiler(this.webpackConfig);

        if (opts.streamFiles) {
            console.log(opts.streamFiles.list);

            for (const file of opts.streamFiles.list) {
                this.files.set(file.path, file.clone());
                // this.addFile(file);
            }

            opts.streamFiles.on('push', (...files: VinylFile[]) => {
                for (const file of files)
                    this.files.set(file.path, file.clone());
            });
        }

        this.webpackDone = webpackDone || this.defaultWebpackDone;
    }

    /* constructor(
        options?: WebpackStreamDataOptions,
        webpackDone?: webpack.Compiler.Handler) {

        const opts = new WebpackStreamOptions(options);
        this.options = opts;
        this.webpackConfig = new WebpackConfig(opts);

        const cacheEntry = this.cacheEntry;

        const files: Map<string, VinylFile> = opts.streamFiles ? new Map(opts.streamFiles.list.entries()) : !opts.name ? new Map() : cacheEntry && cacheEntry.files || new Map();

        if (isUndefined(cacheEntry) || cacheEntry.options !== opts || cacheEntry.options.webpackInstance !== opts.webpackInstance || opts.noCache)
            WebpackStreamData.cache.set(opts.name || this.symbol, new CacheEntry(opts, this.webpackConfig));
        else
            cacheEntry.files = new Map();

        if (opts.streamFiles) {
            for (const [ path, file ] of files) {
                this.files.set(path, file.clone());
                // this.addFile(file);
            }

            opts.streamFiles.on('push', (...files: VinylFile[]) => {
                for (const file of files)
                    this.files.set(file.path, file.clone());
            });
        }


        this.webpackDone = webpackDone || this.defaultWebpackDone;
    } */

    /* get cacheEntry() {
        return WebpackStreamData.cache.get(this.options.name || this.symbol);
    }

    get compiler() {
        return this.cacheEntry.compiler;
    } */

    /* get files() {
        return this.cacheEntry.files;
    } */

    get isSilent() {
        // Webpack 4 doesn't support the `quiet` attribute, however supports
        // setting `stats` to a string within an array of configurations
        // (errors-only|minimal|none|normal|verbose) or an object with an absurd
        // amount of config
        return this.options.quiet || (typeof this.options.stats === 'string' && (this.options.stats.match(/^(errors-only|minimal|none)$/)));
    }


    get defaultWebpackDone() {
        let callingDone = false;

        const done = (err: Error, stats: webpack.Stats) => {
            if (err) {
                // The err is here just to match the API but isnt used
                return;
            }

            if (this.isSilent || callingDone) {
                return;
            }

            if (!stats)
                return;

            // Debounce output a little for when in watch mode
            if (this.options.watch) {
                callingDone = true;
                setTimeout(function () {
                    callingDone = false;
                }, 500);
            }

            if (this.options.verbose) {
                fancyLog(stats.toString({
                    colors: supportsColor.stdout.hasBasic
                }));
            } else {

                const statusLog = stats.toString(this.options.stats);
                if (statusLog) {
                    fancyLog(statusLog);
                }
            }
        };

        return done;
    }

    addFile(file: VinylFile) {
        if (!this.files.has(file.path)) {
            if (!this.options.entryFiles)
                this.webpackConfig.addEntry(file);

            this.files.set(file.path, file.clone());
        }
    }
}
