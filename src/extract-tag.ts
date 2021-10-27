import { JSDOM } from 'jsdom';
import PluginError from 'plugin-error';
import stream from 'stream';
import through from 'through2';
import VinylFile from 'vinyl';


export interface ExtractTagOutputPathOptions {
    tagSelector: string;
    elements: Element[];
    content: string;
}

export class ExtractTagOptions {
    selectors: string[] = [ 'script' ]; // Element selector
    outputPath: (file: VinylFile, options: ExtractTagOutputPathOptions) => string = (file, options) => {
        const { tagSelector } = options;

        const concatSelectors = tagSelector.split(' ').map(e => e.trim()).join('-');
        const ext = tagSelector === 'script' ? '.js' : tagSelector === 'style' ? '.css' : `-${concatSelectors}`;

        return `${file.basename}${ext}`;
    };
}

class ExtractTagTransform {

    public pluginName = this.constructor.name;
    public options: ExtractTagOptions;

    constructor(options?: Partial<ExtractTagOptions>) {
        this.options = Object.assign(new ExtractTagOptions(), options);
    }

    create() {
        const throughOptions = { objectMode: true };
        const self = this;

        return through(throughOptions, function (file: VinylFile, encoding: string, cb: stream.TransformCallback) {
            return self.transform(this, file, encoding, cb);
        });
    }

    private transform(stream: stream.Transform, file: VinylFile, encoding: string, cb: stream.TransformCallback) {

        if (file.isStream()) {
            return cb(new PluginError(this.pluginName, 'Streaming not supported'));
        }

        if (file.isNull()) {
            return cb(null, file);
        }

        // Deleted files may have no content.
        // See: https://github.com/FormidableLabs/gulp-html-extract/issues/11
        const fileContent = (file.contents || '').toString('utf8');

        const { document } = new JSDOM(fileContent).window;

        for (const sel of this.options.selectors) {
            const elements = [ ...document.querySelectorAll(sel) ];
            let data = '';

            for (const el of elements)
                data += el.innerHTML;

            if (data === '') continue;

            const vinylFile = new VinylFile({
                path: this.options.outputPath(file, { tagSelector: sel, content: data, elements }),
                contents: Buffer.from(data)
            });

            stream.push(vinylFile);
        }

        cb();
    }
}


export function extractTagTransform(options?: Partial<ExtractTagOptions>) {
    return new ExtractTagTransform(options).create();
}
