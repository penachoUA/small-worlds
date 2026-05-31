import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';
import alea from 'alea';

const CONFIG = {
	SPHERE_SEGMENTS: 64,
	ORBIT_LINE_SEGMENTS: 128,
	AXES_SIZE: 3,
	DEBUG_OPACITY: 0.5,

	TERRAIN_DEFAULT_AMPLITUDE: 0.025,

	TERRAIN_LOW_FREQUENCY: 3,
	TERRAIN_MID_FREQUENCY: 8,
	TERRAIN_HIGH_FREQUENCY: 16
};

let nextPlanetId = 0;

// Shading
const SHADE_COLORS = new Uint8Array([0, 255]);
const GRADIENT_MAP = new THREE.DataTexture(
	SHADE_COLORS,
	SHADE_COLORS.length,
	1,
	THREE.RedFormat
);

GRADIENT_MAP.minFilter = THREE.NearestFilter;
GRADIENT_MAP.magFilter = THREE.NearestFilter;
GRADIENT_MAP.generateMipmaps = false;
GRADIENT_MAP.needsUpdate = true;

export default class Planet {
	constructor({
		name = null,
		radius,
		color1,
		color2,
		color3,
		orbitRadius,
		orbitSpeed,
		orbitAngle,
		orbitInclination,
		rotationSpeed,
		rotationAxis,

		terrainAmplitude = CONFIG.TERRAIN_DEFAULT_AMPLITUDE,
		terrainSeed = null
	}) {
		this.id = nextPlanetId++;
		this.name = name ?? `planet-${this.id}`;

		this.radius = radius;
		this.terrainAmplitude = terrainAmplitude;
		this.terrainSeed = terrainSeed ?? orbitRadius;
		this.terrainNoise3D = createNoise3D(alea(this.terrainSeed));
		this._terrainNormal = new THREE.Vector3();

		// Root handles orbital inclination — tilting the entire orbit plane
		this.root = new THREE.Object3D();
		this.root.rotation.z = orbitInclination * (Math.PI / 180);

		// orbitPivot rotates around Y each frame to move the planet around the star
		this.orbitPivot = new THREE.Object3D();
		this.root.add(this.orbitPivot);

		// axisTilt offsets the planet to its orbital radius and applies axial tilt
		this.axisTilt = new THREE.Object3D();
		this.axisTilt.position.x = orbitRadius;
		this.axisTilt.rotation.z = rotationAxis * (Math.PI / 180);
		this.orbitPivot.add(this.axisTilt);

		// Setup visual, mesh is the surface of the planet
		const geometry = Planet._createTerrainGeometry({
			radius,
			segments: CONFIG.SPHERE_SEGMENTS,
			amplitude: radius * terrainAmplitude,
			noise3D: this.terrainNoise3D
		});

		const texture = Planet._generateTexture(color1, color2, color3, this.terrainSeed);
		const material = new THREE.MeshToonMaterial({
			map: texture,
			gradientMap: GRADIENT_MAP
		});

		this.mesh = new THREE.Mesh(geometry, material);
		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;
		this.axisTilt.add(this.mesh);

		this.orbitSpeed = orbitSpeed;
		this.orbitAngle = orbitAngle;
		this.rotationSpeed = rotationSpeed;
		this._orbitRadius = orbitRadius;

		this.orbitPathColor = color2;
		this.orbitPath = null;

		this.props = [];

		this._createDebugFeatures();
	}

	addTo(parent) {
		parent.add(this.root);
		return this;
	}

	addPivotToPlanet(object) {
		object.addTo(this.mesh);
		return object;
	}

	addToSurface(object, direction = new THREE.Vector3(0, 1, 0), sinkFactor = 0) {
		const normal = direction.clone().normalize();
		const distance = this.radius * (1 - sinkFactor);

		object.root.position.copy(
			normal.clone().multiplyScalar(distance)
		);

		object.root.quaternion.setFromUnitVectors(
			new THREE.Vector3(0, 1, 0),
			normal
		);

		object.addTo(this.mesh);

		return object;
	}

	addProp(object, direction = new THREE.Vector3(0, 1, 0), sinkFactor = 0) {
		const normal = direction.clone().normalize();

		this.addToSurface(object, normal, sinkFactor);

		object.planet = this;
		object.surfaceNormal = normal;
		object.sinkFactor = sinkFactor;

		if (!this.props.includes(object)) {
			this.props.push(object);
		}

		return object;
	}

	getBlockingProp(surfaceNormal, extraRadius = 0) {
		const normal = surfaceNormal.clone().normalize();

		return this.props.find((prop) => {
			if (!prop.obstacle || !prop.surfaceNormal) return false;

			const obstacleNormal = prop.surfaceNormal.clone().normalize();

			const angle = normal.angleTo(obstacleNormal);
			const surfaceDistance = angle * this.radius;

			return surfaceDistance < prop.obstacle.radius + extraRadius;
		});
	}

	isSurfaceBlocked(surfaceNormal, extraRadius = 0) {
		return !!this.getBlockingProp(surfaceNormal, extraRadius);
	}

	getTerrainOffset(surfaceNormal) {
		if (!this.terrainAmplitude || this.terrainAmplitude <= 0) {
			return 0;
		}

		this._terrainNormal
			.copy(surfaceNormal)
			.normalize();

		const terrainValue = Planet._sampleTerrainValue(
			this.terrainNoise3D,
			this._terrainNormal.x,
			this._terrainNormal.y,
			this._terrainNormal.z
		);

		return this.radius * this.terrainAmplitude * terrainValue;
	}

	update(delta) {
		this.move();

		this.props.forEach((prop) => {
			prop.update?.(delta);
		});
	}

	move() {
		this._orbit();
		this._rotate();
	}

	activateDebugMode() {
		if (this._spinAxes) this._spinAxes.visible = true;
		if (this._surfaceGrid) this._surfaceGrid.visible = true;
		if (this.orbitPath) this.orbitPath.visible = true;

		this.mesh.material.visible = false;
	}

	deactivateDebugMode() {
		if (this._spinAxes) this._spinAxes.visible = false;
		if (this._surfaceGrid) this._surfaceGrid.visible = false;
		if (this.orbitPath) this.orbitPath.visible = false;

		this.mesh.material.visible = true;
	}

	_orbit() {
		this.orbitAngle += this.orbitSpeed;
		this.orbitPivot.rotation.y = this.orbitAngle;
	}

	_rotate() {
		this.mesh.rotation.y += this.rotationSpeed;
	}

	_createDebugFeatures() {
		this._spinAxes = new THREE.AxesHelper(this.radius + CONFIG.AXES_SIZE);
		this.mesh.add(this._spinAxes);

		this._createSurfaceGrid();

		this._createOrbitPath();
		this.root.add(this.orbitPath);
	}

	_createSurfaceGrid() {
		const gridGeometry = new THREE.SphereGeometry(this.radius, 32, 16);
		const edges = new THREE.EdgesGeometry(gridGeometry);

		const count = edges.attributes.position.count;
		const colors = new Float32Array(count * 3);
		const positions = edges.attributes.position.array;

		const tempColor = new THREE.Color();

		for (let vertex = 0; vertex < count; vertex++) {
			const vertexY = positions[vertex * 3 + 1];
			const t = (vertexY + this.radius) / (2 * this.radius);

			tempColor.setHSL(t, 1, CONFIG.DEBUG_OPACITY);

			colors[vertex * 3] = tempColor.r;
			colors[vertex * 3 + 1] = tempColor.g;
			colors[vertex * 3 + 2] = tempColor.b;
		}

		edges.setAttribute('color', new THREE.BufferAttribute(colors, 3));

		const lineMaterial = new THREE.LineBasicMaterial({
			vertexColors: true
		});

		const line = new THREE.LineSegments(edges, lineMaterial);

		this.mesh.add(line);
		this._surfaceGrid = line;
	}

	_createOrbitPath() {
		const segments = CONFIG.ORBIT_LINE_SEGMENTS;
		const points = [];

		for (let i = 0; i <= segments; i++) {
			const angle = (i / segments) * Math.PI * 2;

			points.push(
				new THREE.Vector3(
					Math.sin(angle) * this._orbitRadius,
					0,
					Math.cos(angle) * this._orbitRadius
				)
			);
		}

		const geometry = new THREE.BufferGeometry().setFromPoints(points);

		const material = new THREE.LineBasicMaterial({
			color: this.orbitPathColor,
			opacity: CONFIG.DEBUG_OPACITY,
		});

		this.orbitPath = new THREE.LineLoop(geometry, material);
	}

	static _createTerrainGeometry({
		radius,
		segments,
		amplitude,
		noise3D
	}) {
		const geometry = new THREE.SphereGeometry(
			radius,
			segments,
			segments
		);

		if (amplitude <= 0) {
			return geometry;
		}

		const position = geometry.attributes.position;
		const normal = new THREE.Vector3();
		const vertex = new THREE.Vector3();

		for (let i = 0; i < position.count; i++) {
			vertex.fromBufferAttribute(position, i);
			normal.copy(vertex).normalize();

			const terrainValue = Planet._sampleTerrainValue(
				noise3D,
				normal.x,
				normal.y,
				normal.z
			);

			const displacement = amplitude * terrainValue;

			vertex
				.copy(normal)
				.multiplyScalar(radius + displacement);

			position.setXYZ(i, vertex.x, vertex.y, vertex.z);
		}

		position.needsUpdate = true;
		geometry.computeVertexNormals();
		geometry.computeBoundingSphere();
		geometry.computeBoundingBox();

		return geometry;
	}

	static _generateTexture(color1, color2, color3, seed) {
		const noise3D = createNoise3D(alea(seed));

		const size = 512;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;

		const ctx = canvas.getContext('2d');

		const low = new THREE.Color(color1);
		const mid = new THREE.Color(color2);
		const high = new THREE.Color(color3);

		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const theta = (x / size) * Math.PI * 2;
				const phi = (y / size) * Math.PI;

				const nx = Math.sin(phi) * Math.cos(theta);
				const ny = Math.sin(phi) * Math.sin(theta);
				const nz = Math.cos(phi);

				const rawT = Planet._samplePlanetNoise(noise3D, nx, ny, nz);
				const t = Math.floor(rawT * 8) / 8;

				let r;
				let g;
				let b;

				if (t < 0.4) {
					const s = t / 0.4;

					r = low.r + (mid.r - low.r) * s;
					g = low.g + (mid.g - low.g) * s;
					b = low.b + (mid.b - low.b) * s;
				} else {
					const s = (t - 0.4) / 0.6;

					r = mid.r + (high.r - mid.r) * s;
					g = mid.g + (high.g - mid.g) * s;
					b = mid.b + (high.b - mid.b) * s;
				}

				ctx.fillStyle = `rgb(${Math.floor(r * 255)},${Math.floor(g * 255)},${Math.floor(b * 255)})`;
				ctx.fillRect(x, y, 1, 1);
			}
		}

		return new THREE.CanvasTexture(canvas);
	}

	static _samplePlanetNoise(noise3D, nx, ny, nz) {
		return Math.max(
			0,
			Math.min(
				1,
				(
					noise3D(
						nx * CONFIG.TERRAIN_LOW_FREQUENCY,
						ny * CONFIG.TERRAIN_LOW_FREQUENCY,
						nz * CONFIG.TERRAIN_LOW_FREQUENCY
					) * 0.6 +
					noise3D(
						nx * CONFIG.TERRAIN_MID_FREQUENCY,
						ny * CONFIG.TERRAIN_MID_FREQUENCY,
						nz * CONFIG.TERRAIN_MID_FREQUENCY
					) * 0.3 +
					noise3D(
						nx * CONFIG.TERRAIN_HIGH_FREQUENCY,
						ny * CONFIG.TERRAIN_HIGH_FREQUENCY,
						nz * CONFIG.TERRAIN_HIGH_FREQUENCY
					) * 0.1 +
					1
				) / 2
			)
		);
	}

	static _sampleTerrainValue(noise3D, nx, ny, nz) {
		const rawT = Planet._samplePlanetNoise(noise3D, nx, ny, nz);
		const colorHeight = (rawT - 0.5) * 2;

		const detail =
			noise3D(nx * 22, ny * 22, nz * 22) * 0.18 +
			noise3D(nx * 38, ny * 38, nz * 38) * 0.08;

		return THREE.MathUtils.clamp(
			colorHeight * 0.85 + detail,
			-1,
			1
		);
	}
}
