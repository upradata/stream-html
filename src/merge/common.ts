import VinylFile from 'vinyl';


const removeNotAllowedExt = (allExtensions: string[], options: { max?: number; allowedExt: string[]; }) => {
    const { allowedExt, max = allExtensions.length - 1 } = options;

    const reversed = allExtensions.reverse();

    const index = reversed.findIndex(ext => {
        const found = allowedExt.find(allowed => allowed === ext);
        return !found;
    });

    const idx = index === -1 ? max : Math.min(index, max);
    const ext = reversed.slice(idx).reverse();

    return { extensions: ext, extension: mergeExtensions(ext) };
};


const mergeExtensions = (extensions: string[]) => {
    return (extensions.length > 0 ? '.' : '') + extensions.join('.');
};


export function stem(file: VinylFile, options: { full?: boolean; max?: number; allowedExt?: string[]; } = {}) {
    // for files like a/b/file.html.js return file
    const { max, full, allowedExt } = options;
    const splits = file.basename.split('.');

    const base = splits[ 0 ];
    const trail = splits.slice(1);

    if (full) {
        if (allowedExt)
            return base + removeNotAllowedExt(splits.slice(1), { allowedExt }).extension;

        return base;
    }

    if (max) {
        const getExtensions = () => {
            if (allowedExt)
                return removeNotAllowedExt(trail, { allowedExt, max }).extensions;

            const end = Math.min(trail.length, max);
            return trail.slice(0, -end);
        };

        return base + mergeExtensions(getExtensions());
    }

    return file.stem;
}

/* console.log(stem({ basename: 'file.1.2.3.4.txt' } as any, { full: true, allowedExt: [ '2', '1', '4', 'txt' ] }));
console.log(stem({ basename: 'file.1.2.3.4.txt' } as any, { full: true, allowedExt: [ '2', '3', '4', 'txt' ] }));

console.log(stem({ basename: 'file.1.2.3.4.txt' } as any, { max: 2, }));
console.log(stem({ basename: 'file.1.2.3.4.txt' } as any, { max: 2, allowedExt: [ '2', '1', '4', 'txt' ] }));
console.log(stem({ basename: 'file.1.2.3.4.txt' } as any, { max: 2, allowedExt: [ 'txt' ] }));
console.log(stem({ basename: 'local/html/temp.html.html' } as any, { max: 2, allowedExt: [ 'html' ] })); */
