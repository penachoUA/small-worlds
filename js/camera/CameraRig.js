import * as THREE from 'three';

const CONFIG = {
	SMOOTHING: 0.05
};

export default class CameraRig {
	constructor() {
		this.root = new THREE.Object3D();

		this.yaw = new THREE.Object3D();
		this.pitch = new THREE.Object3D();
		this.root.add(this.yaw);
		this.yaw.add(this.pitch);

		this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 10000);
		this.pitch.add(this.camera);

		this.basePosition = new THREE.Vector3();
		this.lockedTargetY = null;
	}

	addTo(parent) {
		parent.add(this.root);
		return this;
	}

	setPosition(x, y, z) {
		this.basePosition.set(x, y, z);
		this.root.position.copy(this.basePosition);
		this.lockedTargetY = null;
	}

	stabilizeVerticalTarget(targetY, deadZone = 0.035) {
		if (this.lockedTargetY === null) {
			this.lockedTargetY = targetY;
		}

		const delta = targetY - this.lockedTargetY;

		if (Math.abs(delta) > deadZone) {
			this.lockedTargetY = targetY - Math.sign(delta) * deadZone;
		}

		this.root.position.y =
			this.basePosition.y + this.lockedTargetY - targetY;
	}

	clearVerticalStabilizer() {
		this.lockedTargetY = null;
		this.root.position.copy(this.basePosition);
	}

	setCameraPosition(x, y, z) {
		this.camera.position.set(x, y, z);
	}

	setRotation(yaw, pitch) {
		this.yaw.rotation.y = THREE.MathUtils.lerp(this.yaw.rotation.y, yaw, CONFIG.SMOOTHING);
		this.pitch.rotation.x = THREE.MathUtils.lerp(this.pitch.rotation.x, pitch, CONFIG.SMOOTHING);
	}

	snapRotation(yaw, pitch) {
		this.yaw.rotation.y = yaw;
		this.pitch.rotation.x = pitch;
	}
}
