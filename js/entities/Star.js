import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

const CONFIG = {
	SEGMENTS: 24,
	EMISSIVE_INTENSITY: 100.0,
	CORONA_COLOR: 0xff0000,
	LIGHT: {
		COLOR: 0xffffff,
		INTENSITY: 100,
		DISTANCE: 0,
		DECAY: 1.5
	}
};

export default class Star {
	constructor({ radius, color }) {
		this.root = new THREE.Object3D();
		this.radius = radius;

		const geometry = new THREE.SphereGeometry(radius, CONFIG.SEGMENTS, CONFIG.SEGMENTS);
		const material = new THREE.MeshToonMaterial({
			color,
			emissive: color,
			emissiveIntensity: CONFIG.EMISSIVE_INTENSITY,
		});

		this.mesh = new THREE.Mesh(geometry, material);
		this.root.add(this.mesh);

		this.corona = this._createCorona();
		this.root.add(this.corona);

		this.light = new THREE.PointLight(
			CONFIG.LIGHT.COLOR,
			CONFIG.LIGHT.INTENSITY,
			CONFIG.LIGHT.DISTANCE,
			CONFIG.LIGHT.DECAY
		);
		this.root.add(this.light);

		this.noise = new ImprovedNoise();
		this.v3 = new THREE.Vector3();
		this.p = new THREE.Vector3();
	}

	update(t) {
		const pos = this.corona.geometry.attributes.position;
		const len = pos.count;
		const coronaRadius = this.radius * 0.9;

		const displacementMax = this.radius * 0.5;

		for (let i = 0; i < len; i += 1) {
			this.p.fromBufferAttribute(pos, i).normalize();
			this.v3.copy(this.p).multiplyScalar(3.0);

			let ns = this.noise.noise(
				this.v3.x + Math.cos(t * 0.5),
				this.v3.y + Math.sin(t * 0.5),
				this.v3.z + t * 0.3
			);

			this.v3.copy(this.p)
				.setLength(coronaRadius)
				.addScaledVector(this.p, ns * displacementMax);

			pos.setXYZ(i, this.v3.x, this.v3.y, this.v3.z);
		}
		pos.needsUpdate = true;
	}

	_createCorona() {
		const radius = this.radius * 0.9;
		// Increased detail to 12 for a more "liquid" look as seen in the video
		const geo = new THREE.IcosahedronGeometry(radius, 12);
		const mat = new THREE.MeshBasicMaterial({
			color: CONFIG.CORONA_COLOR,
			side: THREE.BackSide,
		});

		const mesh = new THREE.Mesh(geo, mat);
		geo.attributes.position.usage = THREE.DynamicDrawUsage;

		return mesh;
	}

	addTo(parent) {
		parent.add(this.root);
		return this;
	}
}
