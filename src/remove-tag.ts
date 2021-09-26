import { JSDOM } from 'jsdom';
import PluginError from 'plugin-error';
import stream from 'stream';
import through from 'through2';
import VinylFile from 'vinyl';


export interface RemoveTagOutputPathOptions {
    content: string;
}


export class RemoveTagOptions {
    selectors: string[] = [ 'script' ]; // Element selector
    outputPath: (file: VinylFile, options: RemoveTagOutputPathOptions) => string = (file, _options) => file.basename;
}


class RemoveTag {
    public pluginName = this.constructor.name;
    public options: RemoveTagOptions;

    constructor(options?: Partial<RemoveTagOptions>) {
        this.options = Object.assign(new RemoveTagOptions(), options);
    }


    run(options?: Partial<RemoveTagOptions>): stream.Transform {
        const opts = Object.assign(this.options, options);

        const throughOptions = { objectMode: true };
        const self = this;

        return through(throughOptions, function (file: VinylFile, encoding: string, cb: stream.TransformCallback) {
            return self.transform(opts, this, file, encoding, cb);
        });
    }


    private async transform(options: RemoveTagOptions, stream: stream.Transform, file: VinylFile, encoding: string, cb: stream.TransformCallback) {
        if (file.isStream()) {
            return cb(new PluginError(this.pluginName, 'Streaming not supported'));
        }

        if (file.isNull()) {
            return cb(null, file);
        }


        // Deleted files may have no content.
        const fileContent = (file.contents || '').toString('utf8');

        const { document } = new JSDOM(fileContent).window;

        for (const sel of options.selectors) {
            const elements = document.querySelectorAll(sel);

            for (const el of elements)
                el.parentNode.removeChild(el);
        }

        const content = Buffer.from(document.head.innerHTML + document.body.innerHTML);

        const vinylFile = new VinylFile({
            path: options.outputPath(file, { content: content.toString() }),
            contents: content
        });

        cb(null, vinylFile);
    }

}


export function removeTag(options?: Partial<RemoveTagOptions>) {
    return new RemoveTag(options).run();
}
