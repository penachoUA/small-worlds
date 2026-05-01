import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';
import alea from 'alea';

const CONFIG = {
	RES_W: 2048,
	RES_H: 1024,
	STAR_COUNT: 4000,
	STAR_SIZES: [0.4, 0.8, 1.8],
	STAR_RADIUS: 900,
	COLORS: {
		YELLOW: 0xf9ea6a,
		BLUE: 0x7fc7e4,
		WHITE: 0xffffff,
		NEBULA_GLOBAL: { r: 12, g: 8, b: 20 },
		CLOUD_RED: { r: 160, g: 15, b: 25 },
		CLOUD_GOLD: { r: 140, g: 90, b: 15 }
	},
	LOCATIONS: {
		RED_NEBULA: new THREE.Vector3(0.7, 0.3, -0.6).normalize(),
		GOLD_POCKET: new THREE.Vector3(-0.8, -0.2, 0.4).normalize()
	}
};

export default class Skybox {
	constructor() {
		this.root = new THREE.Group();
		this.texture = this._generateBackground();
		this.stars = this._generateStars();
		this.root.add(this.stars);
	}

	addTo(scene) {
		scene.background = this.texture;
		scene.add(this.root);
		return this;
	}

	update(t) {
		this.stars.children.forEach((pointBucket, index) => {
			const freq = 0.6 + (index * 0.1);
			const phase = (index % 2) * Math.PI;
			const shimmer = Math.pow(Math.sin(t * freq + phase), 2);

			pointBucket.material.opacity = 0.2 + shimmer * 0.7;
		});
	}

	_generateBackground() {
		const canvas = document.createElement('canvas');
		canvas.width = CONFIG.RES_W;
		canvas.height = CONFIG.RES_H;
		const ctx = canvas.getContext('2d');
		const noise3D = createNoise3D(alea('little-prince-space'));

		for (let y = 0; y < CONFIG.RES_H; y++) {
			for (let x = 0; x < CONFIG.RES_W; x++) {
				const theta = (x / CONFIG.RES_W) * Math.PI * 2;
				const phi = (y / CONFIG.RES_H) * Math.PI;

				const nx = Math.sin(phi) * Math.cos(theta);
				const ny = Math.sin(phi) * Math.sin(theta);
				const nz = Math.cos(phi);

				// Background base, deep blues
				const n1 = (noise3D(nx * 1.5, ny * 1.5, nz * 1.5) + 1) / 2;
				let n2 = (noise3D(nx * 0.6, ny * 0.6, nz * 0.6) + 1) / 2;
				n2 = Math.pow(n2, 3);

				// Gas clouds
				const dotRed = Math.max(0, nx * CONFIG.LOCATIONS.RED_NEBULA.x + ny * CONFIG.LOCATIONS.RED_NEBULA.y + nz * CONFIG.LOCATIONS.RED_NEBULA.z);
				const maskRed = Math.pow(dotRed, 50) * ((noise3D(nx * 5, ny * 5, nz * 5) + 1) / 2);

				const dotGold = Math.max(0, nx * CONFIG.LOCATIONS.GOLD_POCKET.x + ny * CONFIG.LOCATIONS.GOLD_POCKET.y + nz * CONFIG.LOCATIONS.GOLD_POCKET.z);
				const maskGold = Math.pow(dotGold, 70) * ((noise3D(nx * 6, ny * 6, nz * 6) + 1) / 2);

				// Color mixing
				let r = Math.floor(n1 * 0.5 + n2 * CONFIG.COLORS.NEBULA_GLOBAL.r + maskRed * CONFIG.COLORS.CLOUD_RED.r + maskGold * CONFIG.COLORS.CLOUD_GOLD.r);
				let g = Math.floor(n1 * 1.0 + n2 * CONFIG.COLORS.NEBULA_GLOBAL.g + maskRed * CONFIG.COLORS.CLOUD_RED.g + maskGold * CONFIG.COLORS.CLOUD_GOLD.g);
				let b = Math.floor(1 + n1 * 9.0 + n2 * CONFIG.COLORS.NEBULA_GLOBAL.b + maskRed * CONFIG.COLORS.CLOUD_RED.b + maskGold * CONFIG.COLORS.CLOUD_GOLD.b);

				ctx.fillStyle = `rgb(${r},${g},${b})`;
				ctx.fillRect(x, y, 1, 1);
			}
		}

		const tex = new THREE.CanvasTexture(canvas);
		tex.mapping = THREE.EquirectangularReflectionMapping;
		return tex;
	}

	_generateStars() {
		const group = new THREE.Group();

		const numGroups = 8;
		const countPerGroup = Math.floor(CONFIG.STAR_COUNT / numGroups);

		for (let i = 0; i < numGroups; i++) {
			const geo = new THREE.BufferGeometry();
			const pos = new Float32Array(countPerGroup * 3);
			const col = new Float32Array(countPerGroup * 3);
			const tempCol = new THREE.Color();

			for (let j = 0; j < countPerGroup; j++) {
				// Distribute stars on a large sphere
				const vec = new THREE.Vector3(
					Math.random() - 0.5,
					Math.random() - 0.5,
					Math.random() - 0.5
				).normalize().multiplyScalar(CONFIG.STAR_RADIUS);

				pos[j * 3] = vec.x;
				pos[j * 3 + 1] = vec.y;
				pos[j * 3 + 2] = vec.z;

				const type = Math.random();
				if (type > 0.96) tempCol.setHex(CONFIG.COLORS.YELLOW);
				else if (type > 0.85) tempCol.setHex(CONFIG.COLORS.BLUE);
				else tempCol.setHex(CONFIG.COLORS.WHITE);

				col[j * 3] = tempCol.r;
				col[j * 3 + 1] = tempCol.g;
				col[j * 3 + 2] = tempCol.b;
			}

			geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
			geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

			const sizeIndex = i % CONFIG.STAR_SIZES.length;
			const size = CONFIG.STAR_SIZES[sizeIndex];

			const mat = new THREE.PointsMaterial({
				size,
				vertexColors: true,
				transparent: true,
				opacity: 0.7,
				sizeAttenuation: false
			});

			group.add(new THREE.Points(geo, mat));
		}

		return group;
	}
}
