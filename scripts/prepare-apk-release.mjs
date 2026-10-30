// Creates a reviewable local upload package. Does not publish or change accounts.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {createHash} from 'node:crypto';

const [apk,version,destination,notes]=process.argv.slice(2);
if(!apk||!version||!destination)throw Error('Usage: node scripts/prepare-apk-release.mjs APK VERSION NEW_OUTPUT_DIRECTORY [DESCRIPTION_UTF8_FILE]');
if(!/^[0-9][A-Za-z0-9.+_-]{0,79}$/.test(version))throw Error('Invalid release version');
const filename=basename(apk);
if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}\.apk$/.test(filename))throw Error('Use a simple versioned APK filename');
const bytes=await readFile(apk);
if(bytes.length<4||bytes.length>150*1024*1024||!bytes.subarray(0,4).equals(Buffer.from([80,75,3,4])))throw Error('Expected an APK ZIP archive, up to 150 MiB');
const description=notes?(await readFile(notes,'utf8')).replace(/^\uFEFF/,'').trim():'ZZWS Android հավելված՝ կատալոգի և պատվերների հետ աշխատանքի համար։';
if(description.length>4000)throw Error('Description must be at most 4000 characters');
const release={schemaVersion:1,version,filename,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),description};
const output=resolve(destination);await mkdir(output); // Never overwrite an existing package.
await writeFile(resolve(output,filename),bytes,{flag:'wx'});
await writeFile(resolve(output,'apk-release.json'),JSON.stringify(release,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,...release,published:false},null,2));
