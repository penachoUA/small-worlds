import * as THREE from 'three';
import gradientMap from '../shading.js';

const MATERIALS = new Map();

export default class Igloo {
	constructor({
		gltf,

		size = 1.0,

		snowColor = 0xffffff,
		snowSoftColor = 0xf8fdff,
		snowShadowColor = 0xeefaff
	} = {}) {
		this.root = new THREE.Object3D();

		this.size = size;

		this.materials = {
			snow: this._toon(snowColor),
			snowSoft: this._toon(snowSoftColor),
			snowShadow: this._toon(snowShadowColor)
		};

		this.obstacle = {
			radius: size * 0.26,
			cameraRadius: size * 0.48,
			height: size * 0.5
		};

		this._setupModel(gltf);
	}

	addTo(parent) {
		parent.add(this.root);
		return this;
	}

	_toon(color) {
		if (!MATERIALS.has(color)) {
			MATERIALS.set(color, new THREE.MeshToonMaterial({
				color,
				gradientMap
			}));
		}

		return MATERIALS.get(color);
	}

	_setupModel(gltf) {
		if (!gltf?.scene) {
			console.warn('Igloo expected a GLTF scene.');
			return;
		}

		this.model = gltf.scene.clone(true);
		this.root.add(this.model);

		this._paintModel();
		this._fitModelToSize();
		this._updateObstacleFromBounds();
	}

	_fitModelToSize() {
		this.model.position.set(0, 0, 0);
		this.model.scale.setScalar(1);
		this.model.updateWorldMatrix(true, true);

		const originalBox = new THREE.Box3().setFromObject(this.model);
		const originalSize = new THREE.Vector3();

		originalBox.getSize(originalSize);

		const footprint = Math.max(
			originalSize.x,
			originalSize.z
		) || 1;

		const scale = this.size / footprint;
		this.model.scale.setScalar(scale);

		this.model.updateWorldMatrix(true, true);

		const fittedBox = new THREE.Box3().setFromObject(this.model);
		const fittedCenter = new THREE.Vector3();

		fittedBox.getCenter(fittedCenter);

		this.model.position.x -= fittedCenter.x;
		this.model.position.z -= fittedCenter.z;
		this.model.position.y -= fittedBox.min.y;
	}

	_paintModel() {
		const palette = [
			this.materials.snow,
			this.materials.snow,
			this.materials.snow,
			this.materials.snowSoft,
			this.materials.snowShadow
		];

		let meshIndex = 0;

		this.model.traverse((child) => {
			if (!child.isMesh) return;

			child.castShadow = true;
			child.receiveShadow = true;

			child.material = palette[meshIndex % palette.length];

			meshIndex += 1;
		});
	}

	_updateObstacleFromBounds() {
		this.root.updateWorldMatrix(true, true);

		const box = new THREE.Box3().setFromObject(this.root);
		const size = new THREE.Vector3();

		box.getSize(size);

		const footprint = Math.max(size.x, size.z);

		this.obstacle.radius = footprint * 0.24;
		this.obstacle.cameraRadius = footprint * 0.45;
		this.obstacle.height = size.y;
	}
}
