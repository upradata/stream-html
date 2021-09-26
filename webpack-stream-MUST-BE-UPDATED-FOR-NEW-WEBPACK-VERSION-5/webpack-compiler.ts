
import webpack from 'webpack';
import stream from 'stream';
import fancyLog from 'fancy-log';
import VinylFile from 'vinyl';
import path from 'path';
import { Function2, Function0, isDefined } from '@upradata/util';
import { WebpackConfig } from './webpack-config';
import { InputFileSystem, VinylStreamInputFileSystem } from './fs';
import { CallbackFunction, Compiler, Compilation, MultiCompiler} from './webpack';

type AfterEmitCallBack = Function2<Compilation, Function0>;

export function isMultiCompiler(compiler: any): compiler is webpack.MultiCompiler {
    return isDefined(compiler.compilers);
}


export class WebpackCompiler {
    public pluginName = this.constructor.name;
    public compiler: /* webpack.Compiler.Watching | */ Compiler | /* webpack.MultiWatching | */ MultiCompiler;  // ReturnType<typeof webpack>; 
    public stream: stream.Transform;
    private files: VinylFile[];

    constructor(public webpackConfig: WebpackConfig) { }

    get compilers() {
        return isMultiCompiler(this.compiler) ? this.compiler.compilers as webpack.Compiler[] : [ this.compiler ];
    }

    private initCompilers(files: VinylFile[]) {
        this.files = files;

        for (const compiler of this.compilers)
            this.initCompiler(compiler);
    }

    private initCompiler(compiler: webpack.Compiler) {
        const { progress } = this.webpackConfig.options;

        if (progress) {
            new webpack.ProgressPlugin((percentage: number, msg: string) => {
                const p = Math.floor(percentage * 100);
                const message = `${p < 10 ? ' ' : ''}${p}% ${msg}`;
                fancyLog('webpack', message);
            }).apply(compiler);
        }

        this.addFileSystem(compiler);

        const afterEmitPlugin = compiler.hooks
            // Webpack 4
            ? (callback: AfterEmitCallBack) => compiler.hooks.afterEmit.tapAsync(this.pluginName, callback)
            // Webpack 2/3
            : (callback: AfterEmitCallBack) => compiler.plugin('after-emit', callback);


        afterEmitPlugin((compilation, callback) => {
            const createFilesPromises: Promise<void>[] = [];

            for (const outname of Object.keys(compilation.assets)) {
                const asset = compilation.assets[ outname ];

                if (asset.emitted)
                    createFilesPromises.push(this.createVinylFile(compiler, outname));
            }

            Promise.all(createFilesPromises).then(() => callback()).catch(e => {
                compilation.errors.push(e);
                fancyLog.error('Error during webpack compilation', e);
                callback();
            });
        });
    }

    private addFileSystem(compiler: Compiler) {
        const { fs, fsMode } = this.webpackConfig.options;

        if (fs.output)
            compiler.outputFileSystem = fs.output;

        if (fsMode === 'fromVinylStream') {
            const inputFs = fs.input ||
                new VinylStreamInputFileSystem(compiler.inputFileSystem, this.files, compiler).connectWithOutputReadFile(compiler.outputFileSystem);

            compiler.inputFileSystem = inputFs;
        }
    }

    private createVinylFile(compiler: webpack.Compiler, outname: string): Promise<void> {
        const { outputPath } = compiler;

        const assetName = outname.split('?')[ 0 ];
        const absolutePath = path.join(outputPath, assetName);

        const inputFS = compiler.inputFileSystem as InputFileSystem;

        return new Promise((res, rej) => {
            inputFS.readFile(absolutePath, (err, contents) => {
                if (err)
                    rej(err);

                const base = this.webpackConfig.outputPath || '';

                const file: VinylFile = new VinylFile({
                    path: path.join(base, outname),
                    contents
                });

                if (base)
                    file.base = base;

                // console.log({ push: file.path });
                this.stream.push(file);
                res();
            });
        });
    }

    run(stream: stream.Transform, files: VinylFile[], webpackDone: CallbackFunction<webpack.Stats>) {
        if (files.length === 0)
            return webpackDone(null, null);

        const config = this.webpackConfig.config as webpack.Configuration;

        this.compiler = this.webpackConfig.options.webpackInstance(config);
        this.stream = stream;

        this.initCompilers(files);

        const { watch, watchOptions } = this.webpackConfig.options;

        if (watch)
            return this.compiler.watch(watchOptions, webpackDone);

        /*  console.log({ entry: ((this.compiler as webpack.Compiler).options.entry), entry2: config.entry });
         console.log('______', this.webpackConfig.options.name, '___________', files.map(f => f.path)); */
        this.compiler.run(webpackDone);
    }
}
