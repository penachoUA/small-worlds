import * as THREE from 'three';

export default class CameraTransitionEngine {
	constructor({
		cameraRig,
		scene,
		getPlayer,
		getCurrentPlanet,
		modes,
		defaultDuration = 0.35
	}) {
		this.cameraRig = cameraRig;
		this.scene = scene;
		this.getPlayer = getPlayer;
		this.getCurrentPlanet = getCurrentPlanet;
		this.modes = modes;
		this.defaultDuration = defaultDuration;

		this.transition = null;
		this.finished = false;
	}

	get isActive() {
		return this.transition !== null;
	}

	setMode(mode) {
		const parent = this._getModeParent(mode);
		const rigPosition = this._getModeRigPosition(mode);
		const cameraPosition = this._getModeCameraPosition(mode);

		this._attachRig(parent, false);

		this.cameraRig.root.quaternion.identity();

		this.cameraRig.setPosition(
			rigPosition.x,
			rigPosition.y,
			rigPosition.z
		);

		this.cameraRig.setCameraPosition(
			cameraPosition.x,
			cameraPosition.y,
			cameraPosition.z
		);

		this.cameraRig.camera.updateProjectionMatrix();
	}

	transitionToMode(mode, {
		duration = this.defaultDuration
	} = {}) {
		if (this.isActive) return false;

		const parent = this._getModeParent(mode);
		const targetRigPosition = this._getModeRigPosition(mode);
		const targetCameraPosition = this._getModeCameraPosition(mode);

		this._attachRig(parent, true);

		this.start({
			duration,
			targetRigPosition,
			targetRigQuaternion: new THREE.Quaternion(),
			targetCameraPosition,
			targetFov: this.cameraRig.camera.fov
		});

		return true;
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

		this.cameraRig.root.quaternion.slerpQuaternions(
			transition.startRigQuaternion,
			transition.targetRigQuaternion,
			t
		);

		this.cameraRig.camera.position.lerpVectors(
			transition.startCameraPosition,
			transition.targetCameraPosition,
			t
		);

		if (transition.startFov !== transition.targetFov) {
			this.cameraRig.camera.fov = THREE.MathUtils.lerp(
				transition.startFov,
				transition.targetFov,
				t
			);

			this.cameraRig.camera.updateProjectionMatrix();
		}

		if (rawT >= 1) {
			this.finish();
		}
	}

	finish() {
		if (!this.transition) return;

		const transition = this.transition;

		this.cameraRig.root.quaternion.copy(transition.targetRigQuaternion);

		this.cameraRig.setPosition(
			transition.targetRigPosition.x,
			transition.targetRigPosition.y,
			transition.targetRigPosition.z
		);

		this.cameraRig.camera.position.copy(transition.targetCameraPosition);
		if (transition.startFov !== transition.targetFov) {
			this.cameraRig.camera.fov = transition.targetFov;
			this.cameraRig.camera.updateProjectionMatrix();
		}

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

	_attachRig(parent, preserveWorld) {
		if (this.cameraRig.attachTo) {
			this.cameraRig.attachTo(parent, preserveWorld);
			return;
		}

		if (preserveWorld && this.cameraRig.root.parent) {
			parent.attach(this.cameraRig.root);
		} else {
			parent.add(this.cameraRig.root);
		}
	}

	_getModeParent(mode) {
		const player = this.getPlayer?.();
		const currentPlanet = this.getCurrentPlanet?.();

		switch (mode) {
			case this.modes.THIRD_PERSON:
			case this.modes.FIRST_PERSON:
				return player.playerModel;

			case this.modes.PLANET:
				return currentPlanet.mesh;

			case this.modes.SYSTEM:
			default:
				return this.scene;
		}
	}

	_getModeRigPosition(mode, target = new THREE.Vector3()) {
		const player = this.getPlayer?.();

		switch (mode) {
			case this.modes.THIRD_PERSON:
				return target.set(0, player.height * 0.01, 0);

			case this.modes.FIRST_PERSON:
				return target.set(0, player.height * 0.8, 0);

			case this.modes.PLANET:
			case this.modes.SYSTEM:
			default:
				return target.set(0, 0, 0);
		}
	}

	_getModeCameraPosition(mode, target = new THREE.Vector3()) {
		const player = this.getPlayer?.();
		const currentPlanet = this.getCurrentPlanet?.();

		switch (mode) {
			case this.modes.THIRD_PERSON:
				return target.set(
					0,
					player.height * 0.6,
					player.height * 1.3
				);

			case this.modes.FIRST_PERSON:
				return target.set(0, 0, 0);

			case this.modes.PLANET:
				return target.set(0, 0, currentPlanet.radius * 2);

			case this.modes.SYSTEM:
				return target.set(0, 0, 70);

			default:
				return target.set(0, 0, 0);
		}
	}

	static easeInOutCubic(t) {
		return t < 0.5
			? 4 * t * t * t
			: 1 - Math.pow(-2 * t + 2, 3) / 2;
	}
}
