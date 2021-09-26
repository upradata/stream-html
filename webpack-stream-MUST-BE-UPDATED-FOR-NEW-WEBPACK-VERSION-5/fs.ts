// import webpack from 'webpack';
import * as webpack from './webpack';
import { Stats } from 'fs';
import path from 'path';
import VinylFile from 'vinyl';
import { ObjectOf, isUndefined, CodifiedError } from '@upradata/util';

export class FileSystemMetadata {
    static symbol = Symbol('FileSystem Metadata');
    data = new Map<string | symbol, any>();

    constructor() { }

    add(key: string | symbol, value: any) {
        this.data.set(key, value);
    }

    get(key: string | symbol) {
        return this.data.get(key);
    }
}

export interface InputFileSystem {
    readFile(path: string, options: ObjectOf<any> | string, callback: (err: Error, contents?: Buffer) => void);
    readFile(path: string, callback: (err: Error, contents: Buffer) => void);

    readFileSync(path: string, options?: ObjectOf<any> | string): Buffer;

    stat(path: string, options: ObjectOf<any>, callback: (err: Error, stats: Stats) => void);
    stat(path: string, callback: (err: Error, stats: Stats) => void);

    statSync(path: string, options?: ObjectOf<any>): Stats;

    readlink(path: string, options: ObjectOf<any>, callback: (err: Error | undefined | null, linkString: string) => void);
    readlink(path: string, callback: (err: Error | undefined | null, linkString: string) => void);

    readlinkSync(path: string, options?: ObjectOf<any>): string;
}

export type OutputFileSystem = webpack.OutputFileSystem;

export interface FileSystem {
    input?: InputFileSystem;
    output?: OutputFileSystem;
}


type CallBack = (err: Error, value?: any) => void;

export class VinylStreamInputFileSystem implements InputFileSystem {
    originialInputFS: webpack.InputFileSystem;

    constructor(public inputFileSystem: webpack.InputFileSystem, public files: VinylFile[], public compiler: webpack.Compiler) {
        this.originialInputFS = inputFileSystem;
        inputFileSystem[ FileSystemMetadata.symbol ] = new FileSystemMetadata();
    }


    private callAsync<T>(syncFunc: (path: string, options: ObjectOf<any>) => T, path: string, options: ObjectOf<any> | string | CallBack, callback?: CallBack) {
        const opts = typeof options === 'function' ? undefined : options;
        const cb = isUndefined(callback) ? options as CallBack : callback;

        setImmediate(() => {
            try {
                cb(null, syncFunc.call(this, path, opts));
            } catch (e) {
                cb(e);
            }
        });
    }

    findFile(filepath: string) {
        const cleanRelative = p => p.replace(/^\.\//, '');

        const file = this.files.find(file => {
            let filename = filepath;
            let vinylname = cleanRelative(file.path);

            if (file.path.startsWith('..'))
                vinylname = path.resolve(process.cwd(), file.path);

            if (!path.isAbsolute(file.path)) {
                const base = this.compiler.context;
                const rel = path.relative(base, filepath);
                filename = cleanRelative(rel);
            }

            return vinylname === filename;
        });

        return file;
    }

    readFileSync(path: string, options?: any) {
        const file = this.findFile(path);

        if (!file) {
            // console.warn(yellow`File in ${path} not found in viny streams. Try in filesystem`);
            return this.originialInputFS.readFileSync(path);
        }

        if (!file.isBuffer()) {
            // important, webpack will do a dirUp for '.../package.json' only if there is a code
            throw new CodifiedError({ code: 'filesystem/bad-file', message: `Error reading file in ${path}. Vinyl file is not a buffer` });
        }

        return file.contents;
    }


    readFile(path: string, options: ObjectOf<any> | string | CallBack, callback?: CallBack) {
        this.callAsync(this.readFileSync, path, options, callback);
    }

    statSync(path: string, options?: ObjectOf<any>): Stats {
        const file = this.findFile(path);

        if (file) {
            const { stat } = file;

            return stat && stat.isFile && stat.isDirectory && stat.isSymbolicLink ? stat : {
                isFile() { return true; },
                isDirectory() { return false; },
                isSymbolicLink() { return false; },
            } as any;
        }

        return this.originialInputFS.statSync(path, options);
    }

    stat(path: string, options: ObjectOf<any>, callback?: (err: Error, stats: Stats) => void) {
        this.callAsync(this.statSync, path, options, callback);
    }

    readlinkSync(path: string, options?: ObjectOf<any>): string {
        if (this.findFile(path))
            throw new CodifiedError({ code: 'filesystem/symlink', message: `Cannot exec readlink on ${path}. A vinyl file cannot be a symbolic link.` });

        return this.originialInputFS.readlinkSync(path, options);
    }

    readlink(path: string, options: ObjectOf<any>, callback?: (err: Error, linkString: string) => void) {
        this.callAsync(this.readlinkSync, path, options, callback);
    }

    connectWithOutputReadFile(outputFileSystem: OutputFileSystem) {

        if ((outputFileSystem as any).readFile) {
            const outputFS = outputFileSystem as any as InputFileSystem;
            const originalReadFile = this.readFile.bind(this);

            this.readFile = (path: string, options: ObjectOf<any> | string | CallBack, callback?: CallBack) => {
                const opts = typeof options === 'function' ? undefined : options;
                const cb = isUndefined(callback) ? options as CallBack : callback;

                originalReadFile(path, options, (err, contents) => {
                    if (err)
                        outputFS.readFile.length === 2 ? outputFS.readFile(path, cb) : outputFS.readFile(path, opts, cb);
                    else
                        cb(null, contents);
                });
            };
        }

        if ((outputFileSystem as any).readFileSync) {
            const outputFS = outputFileSystem as any as InputFileSystem;
            const originalReadFileSync = this.readFileSync.bind(this);

            this.readFileSync = (path: string, options?: any) => {
                try {
                    return originalReadFileSync(path, options);
                } catch (e) {
                    return outputFS.readFileSync(path, options);
                }
            };
        }

        return this;
    }
}
