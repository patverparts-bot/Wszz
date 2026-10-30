import {inflateRawSync} from 'node:zlib';
export const MAX_APK_BYTES=50_000_000;
const bad=()=>{throw Object.assign(new Error('Ընտրեք անվնաս ZZWS production APK ֆայլ։'),{status:400});};
const utf8=new TextDecoder('utf-8',{fatal:true}),utf16=new TextDecoder('utf-16le',{fatal:true});
function manifest(data){
 const v=new DataView(data.buffer,data.byteOffset,data.byteLength),n=data.length;
 const bounds=(p,len)=>{if(p<0||len<0||p+len>n)bad();};
 const u16=p=>{bounds(p,2);return v.getUint16(p,true);},u32=p=>{bounds(p,4);return v.getUint32(p,true);};
 if(u16(0)!==3||u16(2)!==8||u32(4)!==n)bad();
 let strings=null,metadata={},application=false;
 for(let p=8;p<n;){const type=u16(p),header=u16(p+2),size=u32(p+4);if(header<8||size<header||p+size>n)bad();
  if(type===1){
   if(strings||header<28)bad();const count=u32(p+8),flags=u32(p+16),start=p+u32(p+20);if(count>30000||p+header+count*4>p+size||start<p+header+count*4||start>p+size)bad();
   strings=[];
   for(let i=0;i<count;i++){let at=start+u32(p+header+i*4);if(at<start||at>=p+size)bad();
    if(flags&256){const length=()=>{bounds(at,1);let x=data[at++];if(x&128){bounds(at,1);x=((x&127)<<8)|data[at++];}return x;};length();const len=length();if(at+len+1>p+size||data[at+len]!==0)bad();strings.push(utf8.decode(data.subarray(at,at+len)));}
    else{let len=u16(at);at+=2;if(len&32768){len=((len&32767)*65536)+u16(at);at+=2;}if(at+len*2+2>p+size||u16(at+len*2)!==0)bad();strings.push(utf16.decode(data.subarray(at,at+len*2)));}
   }
  }else if(type===0x102){
   if(!strings||header!==16||size<36)bad();const string=i=>{if(i===0xffffffff)return null;if(i>=strings.length)bad();return strings[i];};
   const tag=string(u32(p+20)),start=p+16+u16(p+24),stride=u16(p+26),count=u16(p+28);if(stride<20||count>1000||start<p+36||start+stride*count>p+size)bad();
   const attrs={};for(let i=0;i<count;i++){const a=start+i*stride,ns=string(u32(a)),name=string(u32(a+4)),raw=u32(a+8),kind=data[a+15],value=u32(a+16);
    if(ns!==null&&ns!=='http://schemas.android.com/apk/res/android')continue;
    const key=(ns?'android:':'')+name;if(Object.hasOwn(attrs,key))bad();attrs[key]=raw!==0xffffffff?string(raw):kind===3?string(value):[16,17,18].includes(kind)?value:null;
   }
   if(tag==='manifest'){if(metadata.package)bad();metadata={package:attrs.package,version:attrs['android:versionName'],versionCode:attrs['android:versionCode']};if(attrs['android:versionCodeMajor'])bad();}
   if(tag==='application'){application=true;if(attrs['android:debuggable']||attrs['android:testOnly'])bad();}
  }
  p+=size;
 }
 if(!application||metadata.package!=='am.zzws.admin'||typeof metadata.version!=='string'||!/^[0-9][A-Za-z0-9.+_-]{0,79}$/.test(metadata.version)||/staging|offline|debug|test/i.test(metadata.version)||!Number.isInteger(metadata.versionCode)||metadata.versionCode<1||metadata.versionCode>2147483647)bad();
 return metadata;
}
export function inspectApk(input){
 try{
  const data=input instanceof Uint8Array?input:new Uint8Array(input);if(data.length<22||data.length>MAX_APK_BYTES)bad();
  const v=new DataView(data.buffer,data.byteOffset,data.byteLength);let end=-1;
  for(let p=data.length-22;p>=Math.max(0,data.length-65557);p--)if(v.getUint32(p,true)===0x06054b50&&p+22+v.getUint16(p+20,true)===data.length){end=p;break;}
  if(end<0||v.getUint16(end+4,true)||v.getUint16(end+6,true))bad();
  const count=v.getUint16(end+10,true),dir=v.getUint32(end+16,true),size=v.getUint32(end+12,true);if(count<2||count>20000||dir+size!==end)bad();
  let p=dir,xml=null,dex=false;
  for(let i=0;i<count;i++){
   if(p+46>end||v.getUint32(p,true)!==0x02014b50)bad();const nl=v.getUint16(p+28,true),next=p+46+nl+v.getUint16(p+30,true)+v.getUint16(p+32,true);if(next>end)bad();const name=utf8.decode(data.subarray(p+46,p+46+nl));
   if(name==='classes.dex')dex=true;
   if(name==='AndroidManifest.xml'){
    if(xml||v.getUint16(p+8,true)&1)bad();const method=v.getUint16(p+10,true),packed=v.getUint32(p+20,true),unpacked=v.getUint32(p+24,true),local=v.getUint32(p+42,true);
    if(![0,8].includes(method)||unpacked<8||unpacked>1024*1024||packed>1024*1024||local+30>dir||v.getUint32(local,true)!==0x04034b50||v.getUint16(local+8,true)!==method)bad();
    const ln=v.getUint16(local+26,true),start=local+30+ln+v.getUint16(local+28,true);if(start+packed>dir||utf8.decode(data.subarray(local+30,local+30+ln))!==name)bad();
    const compressed=data.subarray(start,start+packed);xml=method===0?compressed:inflateRawSync(compressed,{maxOutputLength:1024*1024});if(xml.length!==unpacked)bad();
   }p=next;
  }
  if(p!==end||!xml||!dex)bad();return manifest(xml);
 }catch(error){if(error.status)throw error;bad();}
}
