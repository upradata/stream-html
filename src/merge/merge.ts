import PluginError from 'plugin-error';
import stream from 'stream';
import through from 'through2';
import VinylFile from 'vinyl';
import { ObjectOf } from '@upradata/util';
import { stem } from './common';
import { MergeFile } from './merge-file';
import { MergeOptions } from './merge.options';


class MergeTransform {
    public pluginName = this.constructor.name;
    public options: MergeOptions;
    private mergeFiles: ObjectOf<MergeFile> = {};

    constructor(options?: Partial<MergeOptions>) {
        this.options = Object.assign(new MergeOptions(), options);
    }


    create(): stream.Transform {
        const throughOptions = { objectMode: true };
        const self = this;

        return through(throughOptions,
            function (file: VinylFile, encoding: string, cb: stream.TransformCallback) {
                return self.transform(this, file, encoding, cb);
            },
            function (cb: stream.TransformCallback) { return self.flush(this, cb); });
    }


    private async transform(stream: stream.Transform, file: VinylFile, encoding: string, cb: stream.TransformCallback) {
        if (file.isStream()) {
            return cb(new PluginError(this.pluginName, 'Streaming not supported'));
        }

        if (file.isNull()) {
            return cb(null, file);
        }

        this.initFile(file);
        return cb();
    }


    private initFile(file: VinylFile) {
        const name = stem(file, { max: 2, allowedExt: [ 'html', 'css', 'js' ] });

        this.mergeFiles[ name ] = this.mergeFiles[ name ] || new MergeFile({ ...this.options, name });
        const mergeFile = this.mergeFiles[ name ];

        mergeFile.files.push(file);
    }


    private flush(stream: stream.Transform, cb: stream.TransformCallback) {

        for (const mergeFile of Object.values(this.mergeFiles)) {
            const vinylFile = new VinylFile({
                path: mergeFile.output(),
                contents: Buffer.from(mergeFile.merge())
            });

            stream.push(vinylFile);
        }

        return cb();
    }
}


export function mergeTransform(options?: Partial<MergeOptions>) {
    return new MergeTransform(options).create();
}
