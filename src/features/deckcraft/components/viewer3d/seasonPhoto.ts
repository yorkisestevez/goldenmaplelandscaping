import * as THREE from 'three';
import {leafAtlasLuminance} from './foliageLighting';

/**
 * The path tracer never runs shader patches, so photo mode bakes the season's leaf colour into what it can read: the
 * atlas becomes its own light and dark in grey (relative to its mean, as the raster patch does), so the instance colour
 * (the season's leaf colour, which the tracer bakes into vertex colours) paints it.
 */
const GREY_GAIN=2;
const greyAtlases=new WeakMap<THREE.Texture,THREE.Texture>();
const toLinear=(c:number)=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
const toSrgb=(c:number)=>c<=.0031308?c*12.92:1.055*c**(1/2.4)-.055;
/** The leaf atlas as grey tone, stored at half value; the material colour doubles it back (8-bit cannot hold 2.0). */
export function photoSeasonAtlas(material:THREE.MeshStandardMaterial){
 const map=material.map;if(!map)return null;
 const known=greyAtlases.get(map);if(known)return known;
 const image=map.image as CanvasImageSource&{width:number;height:number}|undefined;if(!image?.width)return null;
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const g=canvas.getContext('2d',{willReadFrequently:true});if(!g)return null;g.drawImage(image,0,0);
 // Relative to the atlas's mean as the raster patch measures it (which includes the material's own colour).
 const base=material.color,plain=.2126*base.r+.7152*base.g+.0722*base.b,lum=leafAtlasLuminance(material),data=g.getImageData(0,0,canvas.width,canvas.height),px=data.data;
 for(let i=0;i<px.length;i+=4){
  const l=plain*(.2126*toLinear(px[i]/255)+.7152*toLinear(px[i+1]/255)+.0722*toLinear(px[i+2]/255));
  const tone=1+(Math.min(2.2,l/lum)-1)*.85,v=Math.round(Math.min(1,toSrgb(tone/GREY_GAIN))*255);
  px[i]=px[i+1]=px[i+2]=v;
 }
 g.putImageData(data,0,0);
 const grey=new THREE.CanvasTexture(canvas);grey.colorSpace=THREE.SRGBColorSpace;grey.flipY=map.flipY;grey.wrapS=map.wrapS;grey.wrapT=map.wrapT;grey.channel=map.channel;grey.needsUpdate=true;
 greyAtlases.set(map,grey);return grey;
}
export const PHOTO_GREY_GAIN=GREY_GAIN;
