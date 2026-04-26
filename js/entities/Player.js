import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const _vector = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3(1, 0, 0);

const CONFIG = {
	HEIGHT_RATIO: 0.8,
	RADIUS_RATIO: 0.25,
	COLOR: 0x00ff00,
	DEFAULT_HEIGHT: 0.1,
	DEFAULT_SPEED: 0.045
};

// Player is composed of a pivot at the center of the planet and the actual model placed
// at the surface. This facilitates rotation: rotate the pivot and the model follows
export default class Player {
	constructor({ height = CONFIG.DEFAULT_HEIGHT, speed = CONFIG.DEFAULT_SPEED }) {
		this.root = new THREE.Object3D();

		this.height = height;
		this.speed = speed;
		this.turnSpeed = 2 * speed;
		this.radius = height * CONFIG.RADIUS_RATIO;

		this.heading = 0;
		this.isMoving = false;

		this._setupVisuals();

		// Debugging feature
		this._axes = new THREE.AxesHelper(1);
		this.playerModel.add(this._axes);
	}

	addTo(parent) {
		parent.add(this.root);
		return this;
	}

	attachToModel(object) {
		object.addTo(this.playerModel);
	}

	moveToPlanet(planet) {
		this.currentPlanet = planet;

		// The pivot stays at 0,0,0 relative to the planet
		this.root.position.set(0, 0, 0);
		this.root.quaternion.identity();

		// Move the model + camera to the surface
		this.playerModel.position.set(0, planet.radius, 0);

		planet.addToSurface(this);
	}

	update() {
		this.isMoving = false;
	}

	turn(direction = 1) {
		this.heading += this.turnSpeed * direction;

		this.playerModel.quaternion.setFromAxisAngle(_up, this.heading);
	}

	move(direction = 1) {
		this.isMoving = true;
		const moveStep = this.speed * direction;

		// Calculate right axis
		_vector.copy(_right).applyAxisAngle(_up, this.heading);

		// Convert to planet right axis
		_vector.applyQuaternion(this.root.quaternion);

		// Apply rotation to pivot
		_quat.setFromAxisAngle(_vector, -moveStep);
		this.root.quaternion.premultiply(_quat);
	}

	activateDebugMode() {
		this._axes.visible = true;
	}

	deactivateDebugMode() {

		this._axes.visible = false;
	}

	_setupVisuals() {
		this.playerModel = new THREE.Group();
		this.root.add(this.playerModel);

		const loader = new GLTFLoader();
		loader.load('./assets/little-prince.glb', (gltf) => {
			this.modelRoot = gltf.scene;

			// Scale down — 3.5 blender units, we want roughly player.height tall
			this.modelRoot.scale.setScalar(this.height / 3.5);

			// Model root is the feet
			this.modelRoot.position.y = 0;

			// Apply toon material to all meshes in the model
			this.modelRoot.traverse((child) => {
				if (child.isMesh) {
					child.material = new THREE.MeshToonMaterial({ color: 0xf5c97a });
				}
			});

			this.playerModel.add(this.modelRoot);

			// Remove placeholder cylinder if it exists
			if (this.mesh) this.playerModel.remove(this.mesh);
		});
	}
}
