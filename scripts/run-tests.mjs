import {readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Only run this package's own tests; node --test without paths also discovers
// nested checkouts and outdated drafts placed inside the working directory.
const root=new URL('../',import.meta.url);
const files=(await readdir(new URL('test/',root)))
 .filter(name=>name.endsWith('.test.js'))
 .sort()
 .map(name=>fileURLToPath(new URL(`test/${name}`,root)));
if(!files.length)throw Error('В папке test нет тестов.');
const child=spawn(process.execPath,['--test',...files],{cwd:fileURLToPath(root),stdio:'inherit',env:process.env});
child.once('error',error=>{console.error(error);process.exitCode=1;});
child.once('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
