import { Scene } from '@babylonjs/core/scene';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

/** Dynamic third-person rig (docs/01): M0 ships the EXPLORE framing;
 *  brawl/interior/dialogue framings land with their systems. */
export class CameraRig {
  readonly camera: UniversalCamera;
  private target: TransformNode;
  // M1 framing: lower + tighter than the M0 plaza rig — character reads at
  // splash-page scale, streetwall and skyline stay in frame (docs/01).
  private readonly offset = new Vector3(0, 4.3, -7.0);
  private readonly lookAhead = new Vector3(0, 1.9, 2.6); // slight up-tilt: sky + cornice line in frame

  constructor(scene: Scene, target: TransformNode) {
    this.target = target;
    this.camera = new UniversalCamera('cam', target.position.add(this.offset), scene);
    this.camera.minZ = 0.3;
    this.camera.maxZ = 1000;
    this.camera.fov = 0.95;
  }

  private debugPosed = false;

  /** Art-review free cam (`?cam=x,y,z,tx,ty,tz`): park the camera, stop following. */
  setDebugPose(pos: [number, number, number], target: [number, number, number]): void {
    this.debugPosed = true;
    this.camera.position.set(pos[0], pos[1], pos[2]);
    this.camera.setTarget(new Vector3(target[0], target[1], target[2]));
  }

  /** Smooth follow; call once per frame with dt in seconds. */
  update(dt: number): void {
    if (this.debugPosed) return;
    const stiffness = 1 - Math.exp(-6 * dt);
    const desired = this.target.position.add(this.offset);
    this.camera.position = Vector3.Lerp(this.camera.position, desired, stiffness);
    const look = this.target.position.add(this.lookAhead);
    const current = this.camera.getTarget();
    this.camera.setTarget(
      new Vector3(
        Scalar.Lerp(current.x, look.x, stiffness),
        Scalar.Lerp(current.y, look.y, stiffness),
        Scalar.Lerp(current.z, look.z, stiffness),
      ),
    );
  }
}
