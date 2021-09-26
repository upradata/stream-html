
import VinylFile from 'vinyl';


export class MergeOptions {
    paths = {
        global: 'global',
        local: 'local',
        js: 'js',
        html: 'html'
    };

    isGlobal: (file: VinylFile) => boolean = file => file.path.includes('global');
}
