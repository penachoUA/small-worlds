import * as THREE from 'three';
import Windmill from '../entities/props/Windmill.js';

export default class PlanetBuilder {
	constructor(planets) {
		this.planets = planets;
	}

	populate() {
		this._populateGreenPlanet();
	}

	_populateGreenPlanet() {
		const greenPlanet = this.planets.green;

		const tallWindmill = new Windmill({
			height: 0.82,
			width: 0.48,
			spinSpeed: 1.0
		});

		greenPlanet.addProp(
			tallWindmill,
			new THREE.Vector3(-0.62, 1, 0.18),
			0.03
		);

		tallWindmill.root.rotateY(0.65);

		const shortWindmill = new Windmill({
			height: 0.50,
			width: 0.55,
			spinSpeed: 0.65,
			bodyColor: 0xcdbb91,
			roofColor: 0x9f2f2f
		});

		greenPlanet.addProp(
			shortWindmill,
			new THREE.Vector3(0.88, 0.72, -0.52),
			0.026
		);

		shortWindmill.root.rotateY(-1.85);
	}
}
