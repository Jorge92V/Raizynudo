import { rm, mkdir, copyFile, cp } from 'node:fs/promises';
await rm('public',{recursive:true,force:true});
await mkdir('public');
await copyFile('index.html','public/index.html');
await cp('assets','public/assets',{recursive:true});
await cp('admin','public/admin',{recursive:true});
console.log('Static assets built; secrets and server files excluded');
