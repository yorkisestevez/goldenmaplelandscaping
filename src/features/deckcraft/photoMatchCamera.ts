import {PerspectiveCamera,Vector3,Plane,Ray} from 'three';
import {photoCalibrationError,type PhotoCalibration,type PhotoPoint} from './photoMatch';

/** Fits scale on the assumed wall plane for a USER-chosen camera orientation.
 * This does not solve orientation, lens distortion, hidden geometry or survey accuracy.
 * The attachment anchor is the centre of the primary deck's back edge, at its top.
 */
export function makePhotoCamera(c:PhotoCalibration,width:number,height:number,attachment:Vector3){
  const error=photoCalibrationError(c,width,height);if(error)throw new Error(error);
  const yaw=c.yaw*Math.PI/180,pitch=c.pitch*Math.PI/180;
  const direction=new Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
  const camera=new PerspectiveCamera(c.fov,width/height,.01,10000);
  camera.position.copy(attachment).add(direction);camera.lookAt(attachment);camera.rotateZ(c.roll*Math.PI/180);
  // Off-centre frustum puts the wall attachment exactly at the selected image pixel.
  camera.setViewOffset(width,height,(.5-c.anchor!.x)*width,(.5-c.anchor!.y)*height,width,height);
  camera.updateMatrixWorld(true);
  const wall=new Plane(new Vector3(0,0,1),-attachment.z);
  const hit=(p:PhotoPoint)=>{
    const ray=new Ray(camera.position.clone(),new Vector3(p.x*2-1,1-p.y*2,.5).unproject(camera).sub(camera.position).normalize());
    if(ray.direction.z>=-1e-5)throw new Error('That camera angle cannot see both reference points on this wall. Reduce the side angle or camera tilt.');
    const result=ray.intersectPlane(wall,new Vector3());if(!result)throw new Error('Reference markers do not intersect the assumed wall.');return result;
  };
  const unitDistance=hit(c.a!).distanceTo(hit(c.b!));
  const range=(c.distanceIn/12)/unitDistance;
  if(!Number.isFinite(range)||range<.5||range>2000)throw new Error('This calibration places the camera too close or too far away. Check the measured distance and marker positions.');
  camera.position.copy(attachment).addScaledVector(direction,range);camera.updateMatrixWorld(true);
  return {camera,range,wall};
}
