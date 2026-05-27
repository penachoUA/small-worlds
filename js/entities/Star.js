import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

const CONFIG = {
	SEGMENTS: 64,
	ANIM: {
		CORE_ROT: 0.1,
		CORONA_SPEED: 0.4,
		CORONA_NOISE: 3.0,
	},
	COLORS: {
		CORE_BASE: 0xBF950F,
		CORE_HIGHLIGHT: 0xFFD54F,
		EMISSIVE: 0xffaa00,
		CORONA: 0x782000,
	},
	LIGHT: {
		COLOR: 0xfff0cc,
		INTENSITY: 140,
		DECAY: 1.5
	}
};

export default class Star {
	constructor({ radius, light_intensity }) {
		this.root = new THREE.Object3D();
		this.radius = radius;
		this.noise = new ImprovedNoise();

		// Yellow core
		const coreTex = this._generateCoreTexture();
		const coreGeo = new THREE.IcosahedronGeometry(radius, 6);
		this.coreMat = new THREE.MeshToonMaterial({
			map: coreTex,
			emissive: CONFIG.COLORS.EMISSIVE,
			emissiveIntensity: 2.0,
		});
		this.mesh = new THREE.Mesh(coreGeo, this.coreMat);
		this.root.add(this.mesh);

		// Corona
		this.outerCorona = this._createCorona();
		this.root.add(this.outerCorona);

		// Light
		this.light = new THREE.PointLight(CONFIG.LIGHT.COLOR, light_intensity, 0, CONFIG.LIGHT.DECAY);
		this.root.add(this.light);

		// Shadows
		this.light.castShadow = false;

		// Reusable vectors to save memory
		this.v3 = new THREE.Vector3();
		this.p = new THREE.Vector3();
	}

	_generateCoreTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 512; canvas.height = 512;
		const ctx = canvas.getContext('2d');
		const grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
		grad.addColorStop(0, new THREE.Color(CONFIG.COLORS.CORE_HIGHLIGHT).getStyle());
		grad.addColorStop(1, new THREE.Color(CONFIG.COLORS.CORE_BASE).getStyle());
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, 512, 512);
		return new THREE.CanvasTexture(canvas);
	}

	_createCorona() {
		const geo = new THREE.IcosahedronGeometry(this.radius * 1.05, 6);
		const mat = new THREE.MeshToonMaterial({
			color: CONFIG.COLORS.CORONA,
			side: THREE.BackSide,
			emissive: CONFIG.COLORS.CORONA,
			emissiveIntensity: 2.5
		});
		const mesh = new THREE.Mesh(geo, mat);
		geo.attributes.position.usage = THREE.DynamicDrawUsage;
		return mesh;
	}

	update(t) {
		// Animate Corona Spikes
		this._animateCorona(this.outerCorona, t, this.radius * 1.05, this.radius * 0.25, CONFIG.ANIM.CORONA_NOISE);
		this.mesh.rotation.y = t * CONFIG.ANIM.CORE_ROT;
	}

	_animateCorona(mesh, t, baseRadius, spikeMax, noiseScale) {
		const pos = mesh.geometry.attributes.position;
		const timeOffset = t * CONFIG.ANIM.CORONA_SPEED;

		for (let i = 0; i < pos.count; i++) {
			this.p.fromBufferAttribute(pos, i).normalize();
			this.v3.copy(this.p).multiplyScalar(noiseScale);

			let ns = this.noise.noise(
				this.v3.x + Math.cos(timeOffset),
				this.v3.y + Math.sin(timeOffset),
				this.v3.z + timeOffset
			);

			this.v3.copy(this.p).setLength(baseRadius).addScaledVector(this.p, ns * spikeMax);
			pos.setXYZ(i, this.v3.x, this.v3.y, this.v3.z);
		}
		pos.needsUpdate = true;
	}

	addTo(parent) {
		parent.add(this.root);
		return this;
	}
}
