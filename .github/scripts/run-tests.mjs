import {spawnSync} from 'node:child_process';

// Keep failures readable in the check summary as well as the full Actions log.
const result=spawnSync(process.execPath,['--test','--test-reporter=dot'],{encoding:'utf8',maxBuffer:4*1024*1024});
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
if(result.status!==0){
  const detail=(result.error?.message || (result.stdout || '')+'\n'+(result.stderr || '')).slice(-8000);
  const escaped=detail.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
  console.log(`::error title=Node test failure::${escaped}`);
  process.exitCode=result.status || 1;
}
