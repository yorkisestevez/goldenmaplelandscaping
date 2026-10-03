/** Photo calibration is presentation state, never a source of construction dimensions. */
export type PhotoPoint={x:number;y:number}; // normalized, uncropped image coordinates
export type PhotoMarker='a'|'b'|'anchor';
export type PhotoCalibration={a:PhotoPoint|null;b:PhotoPoint|null;anchor:PhotoPoint|null;distanceIn:number;yaw:number;pitch:number;roll:number;fov:number};
export type HomePhoto={url:string;width:number;height:number;name:string};
export const DEFAULT_PHOTO_CALIBRATION:PhotoCalibration={a:null,b:null,anchor:null,distanceIn:0,yaw:0,pitch:8,roll:0,fov:50};
export const clampPhotoPoint=(p:PhotoPoint):PhotoPoint=>({x:Math.max(0,Math.min(1,p.x)),y:Math.max(0,Math.min(1,p.y))});
export function photoCalibrationError(c:PhotoCalibration,width:number,height:number):string|null{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return 'Choose a valid home photo first.';
  if(!c.a||!c.b)return 'Mark both ends of a measured feature on the same flat wall.';
  if(!c.anchor)return 'Mark where the centre of the deck’s house-side edge meets the wall, at finished deck height.';
  if(![c.a,c.b,c.anchor].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1))return 'Place every marker inside the photo.';
  if(!Number.isFinite(c.distanceIn)||c.distanceIn<1||c.distanceIn>2400)return 'Enter the measured distance, between 1 and 2,400 inches.';
  if(Math.hypot((c.b.x-c.a.x)*width,(c.b.y-c.a.y)*height)<Math.max(12,Math.min(width,height)*.02))return 'Move the reference markers farther apart for a useful scale reference.';
  if(!Number.isFinite(c.yaw)||Math.abs(c.yaw)>65||!Number.isFinite(c.pitch)||c.pitch < -15||c.pitch>55||!Number.isFinite(c.roll)||Math.abs(c.roll)>20||!Number.isFinite(c.fov)||c.fov<25||c.fov>85)return 'Perspective settings are outside the supported range.';
  return null;
}

export async function loadHomePhoto(file:File):Promise<HomePhoto>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPEG, PNG or WebP photo. Convert HEIC photos to JPEG first.');
  if(file.size>20*1024*1024)throw new Error('Choose a photo smaller than 20 MB.');
  const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
  try{
    if(bitmap.width<100||bitmap.height<100||bitmap.width*bitmap.height>60_000_000)throw new Error('Use a photo at least 100 × 100 pixels and no larger than 60 megapixels.');
    const scale=Math.min(1,2048/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
    canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Photo processing is unavailable in this browser.');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not process this photo.')),'image/jpeg',.9));
    return {url:URL.createObjectURL(blob),width:canvas.width,height:canvas.height,name:file.name};
  }finally{bitmap.close();}
}
