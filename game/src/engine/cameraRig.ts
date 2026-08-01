import { Scene } from '@babylonjs/core/scene';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import { Ray } from '@babylonjs/core/Culling/ray'; // also augments Scene with pickWithRay
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

/** Dynamic third-person rig (docs/01): M0 ships the EXPLORE framing;
 *  brawl/interior/dialogue framings land with their systems. */
export class CameraRig {
  readonly camera: UniversalCamera;
  private scene: Scene;
  private target: TransformNode;
  // M1 framing: lower + tighter than the M0 plaza rig — character reads at
  // splash-page scale, streetwall and skyline stay in frame (docs/01).
  private readonly offset = new Vector3(0, 4.3, -7.0);
  private readonly lookAhead = new Vector3(0, 1.9, 2.6); // slight up-tilt: sky + cornice line in frame
  // Occlusion boom (playtest r2 M4: awning/sign hid Eli near the storefront):
  // one ray head→camera per frame; on hit the camera pulls IN along the offset
  // axis until clear, then eases back out. No transparency hacks (docs/06).
  private readonly headOffset = new Vector3(0, 1.6, 0);
  private readonly ray = new Ray(Vector3.Zero(), Vector3.Zero(), 1);
  private boom = 1; // smoothed fraction of the boom arm currently extended

  constructor(scene: Scene, target: TransformNode) {
    this.scene = scene;
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

    // Occlusion probe: head → desired camera spot. Characters/blobs are
    // isPickable=false and thin instances don't pick by default, so the one
    // ray only ever tests the static street dressing — cheap.
    const from = this.target.position.add(this.headOffset);
    const desired = this.target.position.add(this.offset);
    const arm = desired.subtract(from);
    const armLen = arm.length();
    let boomTarget = 1;
    if (armLen > 1e-3) {
      arm.scaleInPlace(1 / armLen);
      this.ray.origin.copyFrom(from);
      this.ray.direction.copyFrom(arm);
      this.ray.length = armLen;
      const hit = this.scene.pickWithRay(this.ray, (m) => m.isPickable && m.isEnabled());
      if (hit?.hit) {
        // Park just in front of the blocker; never closer than 20% of the arm.
        boomTarget = Math.max((hit.distance - 0.35) / armLen, 0.2);
      }
    }
    // Pull in FAST (the player must never steer blind), ease back out slowly
    // (no pumping when skimming an awning edge).
    const rate = boomTarget < this.boom ? 10 : 1.8;
    this.boom = Scalar.Lerp(this.boom, boomTarget, Math.min(rate * dt, 1));

    const desiredPos = from.add(arm.scale(armLen * this.boom));
    this.camera.position = Vector3.Lerp(this.camera.position, desiredPos, stiffness);
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
