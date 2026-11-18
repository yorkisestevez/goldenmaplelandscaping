/** One H.264 MP4 from length-prefixed AVC samples (the bytes WebCodecs emits with
 * avc.format 'avc'). The file is built once, after every frame has been dropped,
 * so the raw RGBA of a 4K frame is never kept beside the bitstream. */
export interface Mp4Sample{data:Uint8Array;key:boolean}
const text=new TextEncoder();
function u32(view:DataView,offset:number,value:number){view.setUint32(offset,value);}
function concat(parts:Uint8Array[]){
 const length=parts.reduce((n,part)=>n+part.length,0),out=new Uint8Array(length);
 let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;
}
function box(type:string,payload:Uint8Array){
 const out=new Uint8Array(8+payload.length),view=new DataView(out.buffer);
 u32(view,0,out.length);out.set(text.encode(type),4);out.set(payload,8);return out;
}
function zeros(length:number){return new Uint8Array(length);}
function fixedMatrix(){
 const out=new Uint8Array(36),view=new DataView(out.buffer);
 u32(view,0,0x00010000);u32(view,16,0x00010000);u32(view,32,0x40000000);return out;
}
export function muxAvcMp4(samples:readonly Mp4Sample[],options:{width:number;height:number;fps:number;avcC:Uint8Array}){
 if(!samples.length)throw Error('The MP4 has no frames.');
 if(!options.avcC?.length)throw Error('The encoder did not describe the H.264 stream.');
 if(90000%options.fps!==0)throw Error('The frame rate has to divide the 90 kHz media clock.');
 const sampleDelta=90000/options.fps,duration=samples.length*sampleDelta;
 const ftyp=box('ftyp',concat([text.encode('isom'),new Uint8Array([0,0,2,0]),text.encode('isomiso2avc1mp41')]));
 const mvhdBody=new Uint8Array(100),mvhd=new DataView(mvhdBody.buffer);
 u32(mvhd,12,90000);u32(mvhd,16,duration);u32(mvhd,20,0x00010000);mvhd.setUint16(24,0x0100);
 mvhdBody.set(fixedMatrix(),36);u32(mvhd,96,2);
 const tkhdBody=new Uint8Array(84),tkhd=new DataView(tkhdBody.buffer);
 u32(tkhd,0,0x00000007);u32(tkhd,12,1);u32(tkhd,20,duration);
 tkhdBody.set(fixedMatrix(),40);u32(tkhd,76,options.width<<16);u32(tkhd,80,options.height<<16);
 const mdhdBody=new Uint8Array(24),mdhd=new DataView(mdhdBody.buffer);
 u32(mdhd,12,90000);u32(mdhd,16,duration);mdhd.setUint16(20,0x55c4);
 const hdlrBody=concat([zeros(8),text.encode('vide'),zeros(12),text.encode('VideoHandler\0')]);
 const vmhd=box('vmhd',new Uint8Array([0,0,0,1,0,0,0,0,0,0,0,0]));
 const url=box('url ',new Uint8Array([0,0,0,1]));
 const dref=box('dref',concat([new Uint8Array([0,0,0,0,0,0,0,1]),url]));
 const dinf=box('dinf',dref);
 const name=new Uint8Array(32);name[0]=9;name.set(text.encode('DeckCraft'),1);
 const visual=new Uint8Array(78),visualView=new DataView(visual.buffer);
 visualView.setUint16(6,1);visualView.setUint16(24,options.width);visualView.setUint16(26,options.height);
 u32(visualView,28,0x00480000);u32(visualView,32,0x00480000);visualView.setUint16(40,1);
 visual.set(name,42);visualView.setUint16(74,0x0018);visualView.setInt16(76,-1);
 const avc1=box('avc1',concat([visual,box('avcC',options.avcC)]));
 const stsdBody=new Uint8Array(8);u32(new DataView(stsdBody.buffer),4,1);
 const stsd=box('stsd',concat([stsdBody,avc1]));
 const sttsBody=new Uint8Array(16),sttsView=new DataView(sttsBody.buffer);
 u32(sttsView,4,1);u32(sttsView,8,samples.length);u32(sttsView,12,sampleDelta);
 const keys=samples.flatMap((sample,index)=>sample.key?[index+1]:[]);
 if(!keys.length||keys[0]!==1)throw Error('The first video frame has to be a keyframe.');
 const stssBody=new Uint8Array(8+keys.length*4),stssView=new DataView(stssBody.buffer);
 u32(stssView,4,keys.length);keys.forEach((sample,index)=>u32(stssView,8+index*4,sample));
 const stscBody=new Uint8Array(20),stscView=new DataView(stscBody.buffer);
 u32(stscView,4,1);u32(stscView,8,1);u32(stscView,12,samples.length);u32(stscView,16,1);
 const stszBody=new Uint8Array(12+samples.length*4),stszView=new DataView(stszBody.buffer);
 u32(stszView,4,0);u32(stszView,8,samples.length);samples.forEach((sample,index)=>u32(stszView,12+index*4,sample.data.length));
 const stbl=box('stbl',concat([stsd,box('stts',sttsBody),box('stss',stssBody),box('stsc',stscBody),box('stsz',stszBody),box('stco',new Uint8Array(12))]));
 const minf=box('minf',concat([vmhd,dinf,stbl]));
 const mdia=box('mdia',concat([box('mdhd',mdhdBody),box('hdlr',hdlrBody),minf]));
 const trak=box('trak',concat([box('tkhd',tkhdBody),mdia]));
 const moovWithoutOffset=box('moov',concat([box('mvhd',mvhdBody),trak]));
 // stco is a FullBox: version/flags, one entry, then the offset. Rebuild it once the
 // moov length is known. The chunk starts after ftyp + moov + the 8-byte mdat header.
 const chunkOffset=ftyp.length+moovWithoutOffset.length+8;
 const stco=box('stco',(()=>{const body=new Uint8Array(12),view=new DataView(body.buffer);u32(view,4,1);u32(view,8,chunkOffset);return body;})());
 const stblFinal=box('stbl',concat([stsd,box('stts',sttsBody),box('stss',stssBody),box('stsc',stscBody),box('stsz',stszBody),stco]));
 const minfFinal=box('minf',concat([vmhd,dinf,stblFinal]));
 const mdiaFinal=box('mdia',concat([box('mdhd',mdhdBody),box('hdlr',hdlrBody),minfFinal]));
 const trakFinal=box('trak',concat([box('tkhd',tkhdBody),mdiaFinal]));
 const moov=box('moov',concat([box('mvhd',mvhdBody),trakFinal]));
 if(moov.length!==moovWithoutOffset.length)throw Error('The MP4 header changed size while it was being finished.');
 let payload=0;for(const sample of samples)payload+=sample.data.length;
 const mdat=new Uint8Array(8+payload),mdatView=new DataView(mdat.buffer);
 u32(mdatView,0,mdat.length);mdat.set(text.encode('mdat'),4);
 let cursor=8;for(const sample of samples){mdat.set(sample.data,cursor);cursor+=sample.data.length;}
 return concat([ftyp,moov,mdat]);
}
