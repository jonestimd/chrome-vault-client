#! /usr/bin/env -S node -r ts-node/register
import * as fs from 'fs';
import {join} from 'path';
import JSZip = require('jszip');

const buildDir = join(__dirname, '..', 'build');
const zip = new JSZip();

function addFiles(path: string) {
    const entries = fs.readdirSync(join(buildDir, path), {withFileTypes: true});
    if (entries.length) {
        const folder = zip.folder(path);
        if (!folder) throw new Error(`error adding ${path}`);
        entries.filter((e) => !e.isDirectory()).forEach((e) => {
            console.info(join(path, e.name));
            folder.file(e.name, fs.readFileSync(join(buildDir, path, e.name)));
        });
        entries.filter((e) => e.isDirectory()).forEach((e) => addFiles(join(path, e.name)));
    }
}

addFiles('');
zip.generateAsync({type: 'nodebuffer'}).then((content) => {
    fs.writeFileSync(join(__dirname, '..', 'vault-client.zip'), content);
}).catch((error) => console.error(error));
