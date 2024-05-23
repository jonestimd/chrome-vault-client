#! /usr/bin/env -S node -r ts-node/register
import * as fs from 'fs';
import {join} from 'path';
import * as childProcess from 'node:child_process';

const buildDir = join(__dirname, '..', 'build');

const srcDir = join(__dirname, '../src/styles');
const files = fs.readdirSync(srcDir);

files.filter((file) => file.endsWith('.scss')).forEach((file) => {
    const outfile = join(buildDir, file.replace(/\.scss$/, '.css'));
    const cmd = `npx sass -I node_modules ${join(srcDir, file)} | npx postcss --no-map --use autoprefixer -o ${outfile}`;
    process.stderr.write(cmd);
    const out = childProcess.execSync(cmd);
    console.error(out.toString());
});
