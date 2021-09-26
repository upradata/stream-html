import path from 'path';
import VinylFile from 'vinyl';
import { yellow } from '@upradata/node-util';
import { MergeOptions } from './merge.options';


export class MergeFile {
    files: VinylFile[] = []; // list of files from same html => file.html, file.js, file.css (it can be 1 or 2 or 3)
    name: string;

    constructor(public options: MergeOptions & { name: string; }) {
        this.name = options.name;
    }

    /* isHtmlSplit() {
        return this.files.find(f => f.basename.endsWith('.html.html'));
        // this.files.length > 1; // there is file.html and alos file.css or/and file.js 
    }

    stem() {
        const file = this.files[ 0 ];
        return stem(file, { max: this.isHtmlSplit() ? 2 : 1 });
    }

    get htmlFile() {
        return this.files.find(f => f.extname === '.html');
    } */

    output() {
        const { name } = this;
        const { paths, isGlobal } = this.options;
        const file = this.files[ 0 ];

        return path.join(isGlobal(file) ? paths.global : paths.local, paths.html, name + '.html');
        /*
        const base = (file: VinylFile) => isGlobal(file) ? paths.global : paths.local;

        const file = this.files[ 0 ];
        const isJs = file.extname === '.js';

        if (this.isHtmlSplit())
            return path.join(base(file), paths.html, name + '.html');

        const ext = isJs ? '.js' : file.extname + '.html';
        return path.join(base(file), isJs ? paths.js : paths.html, name + ext); */
    }


    merge() {
        let js: string = '';
        let css: string = '';
        let html: string = '';

        for (const file of this.files) {
            const fileContent = (file.contents || '').toString('utf8');

            if (file.extname === '.css')
                css += `<style>${fileContent}</style>`;
            else if (file.extname === '.html')
                html += fileContent;
            else if (file.extname === '.js') {
                // if fileContent has a comment at the end of the file, the end of the script will be in a comment section
                // so we test if the last line has a // in the code
                const lastLine = fileContent.match(/\n.*$/); // lastLine[ 0 ] is the result match
                js += `<script>(function exec(){${fileContent}${lastLine && /\/\/.*/.test(lastLine[ 0 ]) ? '\n' : ''}})();</script>`;
            }
            else {
                console.warn(yellow`${file.path} will not be added to the merged file ${this.output()} because the extension "${file.extname}" is not handled`);
            }
        }

        return css + html + js;
    }
}
