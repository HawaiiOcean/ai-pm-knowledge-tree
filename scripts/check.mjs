import {readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const name of ['index.html','styles.css','app.js','content.js','state.js','tree-layout.js','favicon.svg'])await access(new URL(`../dist/${name}`,import.meta.url));
for(const name of ['app.js','content.js','state.js','tree-layout.js']){
  const result=spawnSync(process.execPath,['--check',`dist/${name}`],{cwd:root,stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
for(const match of html.matchAll(/(?:href|src)="\.\/([^"#?]+)"/g))await access(new URL(`../dist/${match[1]}`,import.meta.url));
console.log('Static build verified. Publish dist/ directly; no dependencies required.');
