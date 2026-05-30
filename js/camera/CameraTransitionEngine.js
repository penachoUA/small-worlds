import * as THREE from 'three';

export default class CameraTransitionEngine {
	constructor({ cameraRig }) {
		this.cameraRig = cameraRig;
		this.transition = null;
		this.finished = false;
	}

	get isActive() {
		return this.transition !== null;
	}

	start({
		duration,
		targetRigPosition = null,
		targetRigQuaternion = null,
		targetCameraPosition = null,
		targetFov = null
	}) {
		this.finished = false;

		this.transition = {
			elapsed: 0,
			duration,

			startRigPosition: this.cameraRig.root.position.clone(),
			targetRigPosition: targetRigPosition
				? targetRigPosition.clone()
				: this.cameraRig.root.position.clone(),

			startRigQuaternion: this.cameraRig.root.quaternion.clone(),
			targetRigQuaternion: targetRigQuaternion
				? targetRigQuaternion.clone()
				: this.cameraRig.root.quaternion.clone(),

			startCameraPosition: this.cameraRig.camera.position.clone(),
			targetCameraPosition: targetCameraPosition
				? targetCameraPosition.clone()
				: this.cameraRig.camera.position.clone(),

			startFov: this.cameraRig.camera.fov,
			targetFov: targetFov ?? this.cameraRig.camera.fov
		};
	}

	update(delta) {
		if (!this.transition) return;

		const transition = this.transition;

		transition.elapsed += delta;

		const rawT = THREE.MathUtils.clamp(
			transition.elapsed / transition.duration,
			0,
			1
		);

		const t = CameraTransitionEngine.easeInOutCubic(rawT);

		this.cameraRig.root.position.lerpVectors(
			transition.startRigPosition,
			transition.targetRigPosition,
			t
		);

		this.cameraRig.camera.position.lerpVectors(
			transition.startCameraPosition,
			transition.targetCameraPosition,
			t
		);

		this.cameraRig.root.quaternion.slerpQuaternions(
			transition.startRigQuaternion,
			transition.targetRigQuaternion,
			t
		);

		this.cameraRig.camera.fov = THREE.MathUtils.lerp(
			transition.startFov,
			transition.targetFov,
			t
		);

		this.cameraRig.camera.updateProjectionMatrix();

		if (rawT >= 1) {
			this.finish();
		}
	}

	finish() {
		if (!this.transition) return;

		const transition = this.transition;

		this.cameraRig.root.position.copy(transition.targetRigPosition);
		this.cameraRig.root.quaternion.copy(transition.targetRigQuaternion);
		this.cameraRig.camera.position.copy(transition.targetCameraPosition);
		this.cameraRig.camera.fov = transition.targetFov;
		this.cameraRig.camera.updateProjectionMatrix();

		this.transition = null;
		this.finished = true;
	}

	consumeFinished() {
		if (!this.finished) return false;

		this.finished = false;
		return true;
	}

	cancel() {
		this.transition = null;
		this.finished = false;
	}

	static easeInOutCubic(t) {
		return t < 0.5
			? 4 * t * t * t
			: 1 - Math.pow(-2 * t + 2, 3) / 2;
	}
}
