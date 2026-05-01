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
		WHITE: 0xffffff
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

				const n = (noise3D(nx * 1.5, ny * 1.5, nz * 1.5) + 1) / 2;

				// Deepest Inky Palette: 
				// Almost black (1) to a very dark navy (10)
				const r = Math.floor(n * 0.5);
				const g = Math.floor(n * 1.0);
				const b = Math.floor(1 + n * 9.0);

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
		const countPerSize = Math.floor(CONFIG.STAR_COUNT / CONFIG.STAR_SIZES.length);

		CONFIG.STAR_SIZES.forEach((size) => {
			const geo = new THREE.BufferGeometry();
			const pos = new Float32Array(countPerSize * 3);
			const col = new Float32Array(countPerSize * 3);
			const tempCol = new THREE.Color();

			for (let i = 0; i < countPerSize; i++) {
				const vec = new THREE.Vector3(
					Math.random() - 0.5,
					Math.random() - 0.5,
					Math.random() - 0.5
				).normalize().multiplyScalar(CONFIG.STAR_RADIUS);

				pos[i * 3] = vec.x;
				pos[i * 3 + 1] = vec.y;
				pos[i * 3 + 2] = vec.z;

				const type = Math.random();
				if (type > 0.96) tempCol.setHex(CONFIG.COLORS.YELLOW);
				else if (type > 0.85) tempCol.setHex(CONFIG.COLORS.BLUE);
				else tempCol.setHex(CONFIG.COLORS.WHITE);

				col[i * 3] = tempCol.r;
				col[i * 3 + 1] = tempCol.g;
				col[i * 3 + 2] = tempCol.b;
			}

			geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
			geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

			const mat = new THREE.PointsMaterial({
				size,
				vertexColors: true,
				transparent: true,
				opacity: Math.random() * 0.3 + 0.4,
				sizeAttenuation: false
			});

			group.add(new THREE.Points(geo, mat));
		});

		return group;
	}
}
