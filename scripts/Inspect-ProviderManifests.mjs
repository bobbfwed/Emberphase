import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { inflateRawSync } from 'node:zlib';

// Read only APK ZIP metadata and AndroidManifest.xml over ADB. No APK code or
// health records are copied, and no inspector application is installed.
const serial = process.argv[2];
if (!serial) throw new Error('Usage: node scripts/Inspect-ProviderManifests.mjs SERIAL [OUTPUT_DIRECTORY]');
const sdk = process.env.ANDROID_HOME ?? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
const adb = path.join(sdk, 'platform-tools', 'adb.exe');
const aapt = path.join(sdk, 'build-tools', '36.0.0', 'aapt2.exe');
const output = path.resolve(process.argv[3] ?? 'artifacts/provider-manifests');
fs.mkdirSync(output, { recursive: true });
function command(args, encoding = 'utf8') {
  return execFileSync(adb, ['-s', serial, ...args], { encoding, timeout: 60000, maxBuffer: 8*1024*1024, windowsHide: true });
}
function readRange(apk, offset, length) {
  const block = 4096, first = Math.floor(offset/block), remainder = offset%block;
  const count = Math.ceil((remainder+length)/block);
  const bytes = command(['exec-out','dd',`if=${apk}`,`bs=${block}`,`skip=${first}`,`count=${count}`], null);
  const result = bytes.subarray(remainder,remainder+length);
  if (result.length !== length) throw new Error('Incomplete APK metadata read');
  return result;
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit=0;bit<8;bit++) crc = (crc>>>1) ^ ((crc&1) ? 0xedb88320 : 0);
  }
  return (crc^0xffffffff)>>>0;
}
function manifestBytes(apk) {
  if (!/^\/[A-Za-z0-9_./=+~\-]+\.apk$/.test(apk)) throw new Error('Unexpected APK path');
  const size = Number(command(['shell','stat','-c','%s',apk]).trim());
  if (!Number.isSafeInteger(size) || size<22) throw new Error('Invalid APK size');
  const tailLength=Math.min(size,65557), tail=readRange(apk,size-tailLength,tailLength);
  let end=-1;
  for (let i=tail.length-22;i>=0;i--) {
    if (tail.readUInt32LE(i)===0x06054b50 && i+22+tail.readUInt16LE(i+20)===tail.length) { end=i; break; }
  }
  if (end<0) throw new Error('ZIP end record missing');
  const cdLength=tail.readUInt32LE(end+12), cdOffset=tail.readUInt32LE(end+16);
  if (cdLength>8*1024*1024 || cdOffset+cdLength>size) throw new Error('Unexpected ZIP directory size');
  const directory=readRange(apk,cdOffset,cdLength);
  for (let at=0;at+46<=directory.length;) {
    if (directory.readUInt32LE(at)!==0x02014b50) throw new Error('Invalid ZIP directory record');
    const nameLength=directory.readUInt16LE(at+28), extraLength=directory.readUInt16LE(at+30), commentLength=directory.readUInt16LE(at+32);
    const name=directory.toString('utf8',at+46,at+46+nameLength);
    if (name==='AndroidManifest.xml') {
      const method=directory.readUInt16LE(at+10), crc=directory.readUInt32LE(at+16);
      const compressedLength=directory.readUInt32LE(at+20), length=directory.readUInt32LE(at+24), offset=directory.readUInt32LE(at+42);
      if (compressedLength>2*1024*1024 || length>4*1024*1024) throw new Error('Unexpected manifest size');
      const header=readRange(apk,offset,30);
      if (header.readUInt32LE(0)!==0x04034b50) throw new Error('Invalid local ZIP record');
      const dataOffset=offset+30+header.readUInt16LE(26)+header.readUInt16LE(28);
      const compressed=readRange(apk,dataOffset,compressedLength);
      const data=method===0 ? compressed : method===8 ? inflateRawSync(compressed) : null;
      if (!data || data.length!==length || crc32(data)!==crc) throw new Error('Manifest ZIP integrity check failed');
      return data;
    }
    at+=46+nameLength+extraLength+commentLength;
  }
  throw new Error('AndroidManifest.xml missing');
}
function manifestZip(data) {
  const name=Buffer.from('AndroidManifest.xml'), crc=crc32(data);
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20,4);
  local.writeUInt32LE(crc,14); local.writeUInt32LE(data.length,18); local.writeUInt32LE(data.length,22); local.writeUInt16LE(name.length,26);
  const directory=Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20,4); directory.writeUInt16LE(20,6);
  directory.writeUInt32LE(crc,16); directory.writeUInt32LE(data.length,20); directory.writeUInt32LE(data.length,24); directory.writeUInt16LE(name.length,28);
  const end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1,8); end.writeUInt16LE(1,10);
  end.writeUInt32LE(directory.length+name.length,12); end.writeUInt32LE(local.length+name.length+data.length,16);
  return Buffer.concat([local,name,data,directory,name,end]);
}
function servicesFromTree(tree, packageName) {
  const lines=tree.split(/\r?\n/), services=[];
  for (let i=0;i<lines.length;i++) {
    const start=lines[i].match(/^(\s*)E: service\b/);
    if (!start) continue;
    let end=i+1;
    while (end<lines.length) {
      const node=lines[end].match(/^(\s*)E:/);
      if (node && node[1].length<=start[1].length) break;
      end++;
    }
    const block=lines.slice(i+1,end).join('\n');
    const name=block.match(/A: (?:http:\/\/schemas\.android\.com\/apk\/res\/)?android:name[^\n]*?="([^"]+)"/)?.[1];
    if (!name || !block.includes('android.support.wearable.complications.ACTION_COMPLICATION_UPDATE_REQUEST')) continue;
    const metadata={};
    for (const entry of block.split(/E: meta-data[^\n]*\n/).slice(1)) {
      const key=entry.match(/A: (?:http:\/\/schemas\.android\.com\/apk\/res\/)?android:name[^\n]*?="([^"]+)"/)?.[1];
      const value=entry.match(/A: (?:http:\/\/schemas\.android\.com\/apk\/res\/)?android:value[^\n]*/)?.[0];
      if (key && value) metadata[key]=value.match(/="([^"]*)"/)?.[1] ?? value.slice(value.indexOf('=')+1);
    }
    services.push({ component:`${packageName}/${name.startsWith('.') ? packageName+name : name}`, metadata });
  }
  return services;
}

const results=[];
for (const packageName of ['com.samsung.android.wear.shealth','com.samsung.android.watch.weather']) {
  const apk=command(['shell','pm','path',packageName]).split(/\r?\n/).find(line=>line.startsWith('package:'))?.slice(8).trim();
  if (!apk) throw new Error(`No installed APK for ${packageName}`);
  const data=manifestBytes(apk), zipPath=path.join(output,`${packageName}.manifest.zip`);
  fs.writeFileSync(zipPath,manifestZip(data));
  const tree=execFileSync(aapt,['dump','xmltree',zipPath,'--file','AndroidManifest.xml'],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});
  fs.writeFileSync(path.join(output,`${packageName}.manifest.txt`),tree);
  const services=servicesFromTree(tree,packageName);
  if (!services.length) throw new Error(`No complication declarations parsed for ${packageName}; inspect the saved manifest tree.`);
  results.push({packageName,services});
  for (const service of services.filter(s=>/\.steps\.|\.dailyactivity\.|\.WeatherComplicationService$/.test(s.component))) console.log(JSON.stringify(service,null,2));
}
fs.writeFileSync(path.join(output,'provider-metadata.json'),JSON.stringify({payloadsVerified:false,packages:results},null,2)+'\n');
console.log(`Provider manifest declarations saved to ${output}; runtime payloads remain unverified.`);
