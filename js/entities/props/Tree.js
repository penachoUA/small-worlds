import * as THREE from 'three';

export default class Tree {
	constructor({
		gltf,
		trunkColor = 0x7a4a24,
		leafColor = 0x2f9e44
	}) {
		this.root = new THREE.Object3D();

		this.trunkColor = new THREE.Color(trunkColor);
		this.leafColor = new THREE.Color(leafColor);

		this.material = new THREE.MeshToonMaterial({
			vertexColors: true
		});

		this._setupModel(gltf);
	}

	addTo(parent) {
		parent.add(this.root);
		return this;
	}

	_setupModel(gltf) {
		const model = gltf.scene.clone(true);

		model.traverse((child) => {
			if (!child.isMesh) return;

			child.castShadow = true;
			child.receiveShadow = true;

			child.geometry = child.geometry.clone();

			this._applyHeightColors(child.geometry);

			child.material = this.material;
		});

		this.root.add(model);
	}

	_applyHeightColors(geometry) {
		const position = geometry.attributes.position;

		let minY = Infinity;
		let maxY = -Infinity;

		for (let i = 0; i < position.count; i++) {
			const y = position.getY(i);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
		}

		const rangeY = maxY - minY || 1;
		const colors = [];

		for (let i = 0; i < position.count; i++) {
			const y = position.getY(i);
			const t = (y - minY) / rangeY;

			const color = new THREE.Color();

			/*
				Lower 35% = mostly trunk.
				Upper part = mostly leaves.
				This is a visual heuristic for single-material tree meshes.
			*/
			if (t < 0.35) {
				color.copy(this.trunkColor);
			} else {
				color.copy(this.leafColor);
			}

			colors.push(color.r, color.g, color.b);
		}

		geometry.setAttribute(
			'color',
			new THREE.Float32BufferAttribute(colors, 3)
		);
	}
}
