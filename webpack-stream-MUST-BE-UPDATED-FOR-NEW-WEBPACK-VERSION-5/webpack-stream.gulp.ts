import PluginError from 'plugin-error';
import through from 'through2-concurrent';
import stream from 'stream';
import VinylFile from 'vinyl';
import webpack from 'webpack';
import fancyLog from 'fancy-log';
import { chain } from '@upradata/util';
import { WebpackStreamData, WebpackStreamDataOptions } from './webpack-stream.data';
import { CallbackFunction, Compilation } from './webpack';

class GulpWebpackStream {
    public pluginName = this.constructor.name;
    private webpackStreamData: WebpackStreamData;

    constructor(options?: WebpackStreamDataOptions, done?: CallbackFunction<webpack.Stats>) {
        this.webpackStreamData = new WebpackStreamData(options, done);
    }

    run(): stream.Transform {
        const throughOptions = { objectMode: true };
        const self = this;

        const stream = through(throughOptions,
            function (file: VinylFile, encoding: string, cb: stream.TransformCallback) {
                return self.transform(this, file, encoding, cb);
            },
            function (cb: stream.TransformCallback) { return self.flush(this, cb); });


        // If entry point manually specified, trigger that
        /* if (this.webpackStreamData.webpackConfig.hasSomeEntry)
            stream.end(); */

        return stream;
    }


    async transform(stream: stream.Transform, file: VinylFile, encoding: string, cb: stream.TransformCallback) {

        if (file.isStream()) {
            return cb(new PluginError(this.pluginName, 'Streaming not supported'));
        }

        if (file.isNull()) {
            return cb(null, file);
        }

        this.webpackStreamData.addFile(file);

        if (this.webpackStreamData.options.compileEndOfStream)
            cb();
        else
            this.compile(stream, cb);
    }


    flush(stream: stream.Transform, cb: stream.TransformCallback) {
        if (this.webpackStreamData.options.compileEndOfStream)
            this.compile(stream, cb);
    }

    private compile(stream: stream.Transform, cb: stream.TransformCallback) {
        const { webpackConfig, compiler, files } = this.webpackStreamData;

        if (files.size === 0)
            return cb();

        if (!webpackConfig.hasValidEntries)
            return cb();

        compiler.run(stream, [ ...files.values() ], this.webpackCallback(stream, cb));
    }

    private webpackCallback(stream: stream.Transform, flushCb: (err?: Error, file?: VinylFile) => void) {

        const cb = (err: any, stats: webpack.Stats) => {
            if (err) {
                flushCb(new PluginError(this.pluginName, typeof err === 'string' || err && err.message ? err : JSON.stringify(err)));
                return;
            }

            const errors = chain(() => stats.toJson().errors, []);
            const { watch } = this.webpackStreamData.options;

            if (errors.length) {
                const errorMessage = errors.join('\n');
                const compilationError = new PluginError('webpack-stream', errorMessage);

                if (!watch) {
                    stream.emit('error', compilationError);
                }
                stream.emit('compilation-error', compilationError);
            }

            if (!watch)
                flushCb();

            const { webpackDone, isSilent } = this.webpackStreamData;

            webpackDone(err, stats);
            if (watch && !isSilent)
                fancyLog('webpack is watching for changes');
        };

        return cb;
    }
}


export function gulpWebpackStream(options?: WebpackStreamDataOptions, done?: CallbackFunction<webpack.Stats>) {
    return new GulpWebpackStream(options, done).run();
}
