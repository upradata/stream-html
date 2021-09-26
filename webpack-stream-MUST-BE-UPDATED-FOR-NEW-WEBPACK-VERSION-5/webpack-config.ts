import webpack from 'webpack';
import path from 'path';
import VinylFile from 'vinyl';
import fancyLog from 'fancy-log';
import { WebpackStreamOptions } from './webpack-stream.options';
import { isPlainObject } from '../../../Util/util/node_modules/ts-util-is/dist';
import { ensureArray } from '@upradata/util/lib';


export class WebpackConfig {
    public configs: webpack.Configuration[];
    // public entries: { [ name: string ]: string[]; } = {}; // webpack.Entry
    private internalOutputPath = '/____upradata/webpack-config____';
    public outputPath: string;

    constructor(public options: WebpackStreamOptions) {
        const { config } = options;
        this.configs = Array.isArray(config) ? config : [ config ];

        for (const config of this.configs)
            this.initConfig(config);


    }

    private initConfig(config: webpack.Configuration) {
        config.output = config.output || {};
        config.watch = !!this.options.watch;
        config.context = config.context || process.cwd();

        const { output } = config;

        if (!output.filename) {
            // Better output default for multiple chunks
            // '[name].js';
            output.filename = chunkData => {
                const { name } = chunkData.chunk;
                return name.split(/\.js$/)[ 0 ] + (path.extname(name) || '.js');
            };

            this.outputPath = output.path;

            if (!output.path || !path.isAbsolute(output.path))
                output.path = this.internalOutputPath;

            config.watch = config.watch || this.options.watch;
        }

        this.initEntry(config);
    }

    private initEntry(config: webpack.Configuration) {
        config.entry = isPlainObject(config.entry) ? config.entry : {};
        this.addEntries(config.entry as any);

        if (this.options.entryFiles) {
            this.addEntries(this.options.entryFiles.list);
            this.options.entryFiles.on('push', (...files: string[]) => this.addEntries(files));
        }
    }

    private addEntries(entry: string | string[] | webpack.Entry) {
        if (entry) {
            if (typeof entry === 'string')
                this.addEntry(entry);
            else if (Array.isArray(entry)) {
                for (const v of entry)
                    this.addEntry(v);
            } else {
                for (const [ name, value ] of Object.entries(entry)) {
                    const arrValue: string[] = ensureArray(value);

                    for (const v of arrValue)
                        this.addEntry(v, name);
                }
            }
        }
    }

    get hasSomeEntry() {
        return this.configs.some(c => c.entry);
    }

    get config() {
        return this.configs.length === 1 ? this.configs[ 0 ] : this.configs;
    }

    get hasValidEntries() {
        for (const config of this.configs) {
            config.entry = config.entry; // || this.entries;

            if (!config.entry || config.entry.length < 1) {
                fancyLog('webpack-stream - No files given');
                return false;
            }
        }

        return true;
    }

    addEntry(file: VinylFile | string, entryName?: string) {
        const filepath = typeof file === 'string' ? file : file.path;

        for (const config of this.configs) {
            const relPath = path.isAbsolute(filepath) ? path.relative(config.context, filepath) : filepath;
            const name = entryName || typeof file !== 'string' && file.named || relPath.split(/\.js$/)[ 0 ];

            // const entry = this.entries[ name ] = this.entries[ name ] || [];
            const entry: string[] = config.entry[ name ] = config.entry[ name ] || [];

            if (!entry.find(e => e === './' + relPath))
                entry.push('./' + relPath);
        }
    }
}
