export function assertXlsxArchive(raw){
 const fail=message=>{throw Object.assign(new Error(message),{code:400});};
 if(!(raw instanceof ArrayBuffer))fail('Սխալ XLSX ֆայլ');
 if(raw.byteLength>10_000_000)throw Object.assign(new Error('Թույլատրվում է մինչև 10 ՄԲ XLSX'),{code:413});
 const data=new DataView(raw);let end=-1;
 for(let i=raw.byteLength-22;i>=Math.max(0,raw.byteLength-65557);i--)if(data.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)fail('Սխալ XLSX');
 const count=data.getUint16(end+10,true);let offset=data.getUint32(end+16,true),total=0;
 if(count>3000||offset>=end)fail('Չափազանց բարդ XLSX');
 for(let i=0;i<count;i++){
  if(offset+46>end||data.getUint32(offset,true)!==0x02014b50)fail('Վնասված XLSX');
  total+=data.getUint32(offset+24,true);if(total>60_000_000)fail('Ապափաթեթավորված XLSX-ը չափազանց մեծ է');
  const nameLength=data.getUint16(offset+28,true),extraLength=data.getUint16(offset+30,true),commentLength=data.getUint16(offset+32,true);
  const next=offset+46+nameLength+extraLength+commentLength;if(next>end)fail('Վնասված XLSX');
  const name=new TextDecoder().decode(new Uint8Array(raw,offset+46,nameLength));if(/vbaProject|externalLinks/i.test(name))fail('Մակրոներն ու արտաքին հղումներն արգելված են');
  offset=next;
 }
}
