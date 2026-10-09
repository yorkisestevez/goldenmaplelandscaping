/** A stored-method ZIP (no second compression; PNG frames are already compressed).
 * File bytes are handed to the sink and then dropped, so a long sequence keeps one
 * frame plus the central directory, not every PNG. */
const CRC_TABLE=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c;}return table;})();
export function crc32(data:Uint8Array){let c=~0;for(let i=0;i<data.length;i++)c=CRC_TABLE[(c^data[i])&255]^(c>>>8);return (~c)>>>0;}
const text=new TextEncoder();
/** 2026-01-01, fixed so two exports of the same frames make the same archive. */
const DOS_DATE=(46<<9)|(1<<5)|1,DOS_TIME=0;

function u16(view:DataView,offset:number,value:number){view.setUint16(offset,value,true);}
function u32(view:DataView,offset:number,value:number){view.setUint32(offset,value,true);}

export class StoredZip{
 private bytes=0;
 private readonly entries:{name:Uint8Array;crc:number;size:number;offset:number}[]=[];
 constructor(private readonly sink:(chunk:Uint8Array)=>void,private readonly cap=Number.POSITIVE_INFINITY){}
 private push(chunk:Uint8Array){
  this.bytes+=chunk.length;
  if(this.bytes>this.cap)throw Error('This PNG sequence is too large to keep in memory. Export an MP4 or a shorter range.');
  this.sink(chunk);
 }
 add(name:string,data:Uint8Array){
  const encoded=text.encode(name),crc=crc32(data),offset=this.bytes;
  const header=new Uint8Array(30+encoded.length),view=new DataView(header.buffer);
  u32(view,0,0x04034b50);u16(view,4,20);u16(view,6,0);u16(view,8,0);u16(view,10,DOS_TIME);u16(view,12,DOS_DATE);
  u32(view,14,crc);u32(view,18,data.length);u32(view,22,data.length);u16(view,26,encoded.length);u16(view,28,0);
  header.set(encoded,30);
  this.push(header);this.push(data);
  this.entries.push({name:encoded,crc,size:data.length,offset});
 }
 finish(){
  const centralAt=this.bytes;
  for(const entry of this.entries){
   const header=new Uint8Array(46+entry.name.length),view=new DataView(header.buffer);
   u32(view,0,0x02014b50);u16(view,4,20);u16(view,6,20);u16(view,8,0);u16(view,10,0);u16(view,12,DOS_TIME);u16(view,14,DOS_DATE);
   u32(view,16,entry.crc);u32(view,20,entry.size);u32(view,24,entry.size);u16(view,28,entry.name.length);u16(view,30,0);u16(view,32,0);
   u16(view,34,0);u16(view,36,0);u32(view,38,0);u32(view,42,entry.offset);
   header.set(entry.name,46);this.push(header);
  }
  const directory=this.bytes-centralAt,end=new Uint8Array(22),view=new DataView(end.buffer);
  u32(view,0,0x06054b50);u16(view,4,0);u16(view,6,0);u16(view,8,this.entries.length);u16(view,10,this.entries.length);
  u32(view,12,directory);u32(view,16,centralAt);u16(view,20,0);
  this.push(end);
 }
}
export function storedZipBytes(files:readonly {name:string;data:Uint8Array}[],cap=Number.POSITIVE_INFINITY){
 const parts:Uint8Array[]=[];
 const zip=new StoredZip(chunk=>parts.push(chunk),cap);
 for(const file of files)zip.add(file.name,file.data);
 zip.finish();
 const length=parts.reduce((n,part)=>n+part.length,0),out=new Uint8Array(length);
 let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}
 return out;
}
