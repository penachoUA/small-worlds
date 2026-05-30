import * as THREE from 'three';
import gradientMap from '../shading.js';

const MATERIALS = new Map();

export default class LampPost {
	constructor({
		gltf,

		height = 0.58,
		width = 0.06,

		metalColor = 0x1f1f1f,
		glassColor = 0xffd66b,

		initiallyLit = true,
		flickerSpeed = 4.2,
		flickerAmount = 0.08,
		phase = Math.random() * Math.PI * 2
	} = {}) {
		this.root = new THREE.Object3D();

		this.height = height;
		this.width = width;
		this.isLit = initiallyLit;

		this.flickerSpeed = flickerSpeed;
		this.flickerAmount = flickerAmount;
		this.phase = phase;

		this.materials = {
			metal: this._toon(metalColor),
			glassOff: this._toon(0x6f5a2a),
			glassOn: new THREE.MeshToonMaterial({
				color: glassColor,
				emissive: new THREE.Color(glassColor),
				emissiveIntensity: initiallyLit ? 0.8 : 0,
				gradientMap
			})
		};

		this.obstacle = {
			radius: width * 0.01,
			cameraRadius: width * 0.25,
			height
		};

		this._setupModel(gltf);
		this._addLight();
		this.setLit(initiallyLit);
	}

	addTo(parent) {
		parent.add(this.root);
		return this;
	}

	update(delta) {
		if (!this.isLit || !this.light) return;

		this.phase += delta * this.flickerSpeed;

		const flicker = 1 + Math.sin(this.phase) * this.flickerAmount;

		this.light.intensity = 0.45 * flicker;

		if (this.glassMaterial) {
			this.glassMaterial.emissiveIntensity = 0.8 * flicker;
		}
	}

	setLit(value) {
		this.isLit = value;

		if (this.light) {
			this.light.visible = value;
		}

		if (this.glassMaterial) {
			this.glassMaterial.emissiveIntensity = value ? 0.8 : 0;
		}
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
			console.warn('LampPost expected a GLTF scene.');
			return;
		}

		this.model = gltf.scene.clone(true);

		const box = new THREE.Box3().setFromObject(this.model);
		const size = new THREE.Vector3();
		const center = new THREE.Vector3();

		box.getSize(size);
		box.getCenter(center);

		// Center model horizontally and place base at local y = 0.
		this.model.position.sub(center);
		this.model.position.y += size.y / 2;

		const modelHeight = size.y || 1;
		const uniformScale = this.height / modelHeight;

		this.model.scale.setScalar(uniformScale);

		this.model.traverse((child) => {
			if (!child.isMesh) return;

			child.castShadow = true;
			child.receiveShadow = true;

			const name = child.name.toLowerCase();
			const materialName = child.material?.name?.toLowerCase?.() ?? '';

			const looksLikeGlass =
				name.includes('glass') ||
				name.includes('lamp') ||
				name.includes('light') ||
				materialName.includes('glass') ||
				materialName.includes('lamp') ||
				materialName.includes('light');

			if (looksLikeGlass) {
				this.glassMaterial = this.materials.glassOn;
				child.material = this.glassMaterial;
			} else {
				child.material = this.materials.metal;
			}
		});

		this.root.add(this.model);
	}

	_addLight() {
		this.light = new THREE.PointLight(0xffd66b, 0.45, this.height * 1.8);
		this.light.position.set(0, this.height * 0.78, 0);
		this.light.castShadow = false;

		this.root.add(this.light);
	}
}
