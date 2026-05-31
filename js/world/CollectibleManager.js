import * as THREE from 'three';
import Collectible from '../entities/props/Collectible.js';

const SPAWN = {
	PREFERRED_ATTEMPTS: 40,
	FALLBACK_ATTEMPTS: 40,
	PREVIOUS_POSITION_CLEARANCE: 0.35,
	OBSTACLE_CLEARANCE_RADIUS_MULTIPLIER: 2,
	SURFACE_OFFSET: -0.01
};

const _playerNormal = new THREE.Vector3();
const _spawnDirection = new THREE.Vector3();
const _collectibleWorldPosition = new THREE.Vector3();

export default class CollectibleManager {
	constructor({ planets, player, onCollect = null }) {
		this.planetList = planets;
		this.player = player;
		this.onCollect = onCollect;
		this.collectible = new Collectible();
		this.score = 0;
		this.currentSpawn = null;

		this.spawnNext();
	}

	update() {
		if (
			!this.collectible.planet ||
			this.player.currentPlanet !== this.collectible.planet
		) {
			return;
		}

		this.player.getSurfaceNormal(_playerNormal);

		const surfaceDistance =
			_playerNormal.angleTo(this.collectible.surfaceNormal) *
			this.collectible.planet.radius;

		const collectDistance =
			(this.collectible.collectRadius + this.player.radius) * 0.65;

		if (surfaceDistance < collectDistance) {
			this.collect();
		}
	}

	collect() {
		this.score += 1;

		this.collectible.root.getWorldPosition(_collectibleWorldPosition);

		this.onCollect?.({
			score: this.score,
			worldPosition: _collectibleWorldPosition.clone()
		});

		this.spawnNext();
	}

	spawnNext() {
		const spawn = this._findSpawn();

		if (!spawn) return;

		this._detachCollectible();

		spawn.planet.addProp(
			this.collectible,
			spawn.direction,
			SPAWN.SURFACE_OFFSET
		);

		this.collectible.planet = spawn.planet;
		this.collectible.surfaceNormal.copy(spawn.direction);
		this.currentSpawn = spawn;
	}

	_findSpawn() {
		const previousPlanet = this.currentSpawn?.planet ?? null;

		for (let i = 0; i < SPAWN.PREFERRED_ATTEMPTS; i++) {
			const spawn = this._attemptSpawn(previousPlanet);
			if (spawn) return spawn;
		}

		for (let i = 0; i < SPAWN.FALLBACK_ATTEMPTS; i++) {
			const spawn = this._attemptSpawn();
			if (spawn) return spawn;
		}

		const planet = this._randomPlanet();

		if (!planet) return null;

		console.warn('Collectible spawn fallback used.');

		return {
			planet,
			direction: this._randomSurfaceDirection(new THREE.Vector3())
		};
	}

	_attemptSpawn(avoidPlanet = null) {
		const planet = this._randomPlanet(avoidPlanet);

		if (!planet) return null;

		const direction = this._randomSurfaceDirection(_spawnDirection);

		if (!this._isValidSpawn(planet, direction)) {
			return null;
		}

		return {
			planet,
			direction: direction.clone()
		};
	}

	_isValidSpawn(planet, direction) {
		const obstacleClearance =
			this.collectible.collectRadius *
			SPAWN.OBSTACLE_CLEARANCE_RADIUS_MULTIPLIER;

		if (planet.isSurfaceBlocked(direction, obstacleClearance)) {
			return false;
		}

		if (!this.currentSpawn || planet !== this.currentSpawn.planet) {
			return true;
		}

		const distanceFromPreviousSpawn =
			direction.angleTo(this.currentSpawn.direction) *
			planet.radius;

		return distanceFromPreviousSpawn > SPAWN.PREVIOUS_POSITION_CLEARANCE;
	}

	_randomPlanet(avoidPlanet = null) {
		if (this.planetList.length === 0) return null;

		const candidates = avoidPlanet && this.planetList.length > 1
			? this.planetList.filter((planet) => planet !== avoidPlanet)
			: this.planetList;

		return candidates[Math.floor(Math.random() * candidates.length)];
	}

	_randomSurfaceDirection(target) {
		const z = Math.random() * 2 - 1;
		const theta = Math.random() * Math.PI * 2;
		const radius = Math.sqrt(1 - z * z);

		return target.set(
			Math.cos(theta) * radius,
			z,
			Math.sin(theta) * radius
		);
	}

	_detachCollectible() {
		const oldPlanet = this.collectible.planet;

		this.collectible.root.parent?.remove(this.collectible.root);

		if (!oldPlanet?.props) return;

		const index = oldPlanet.props.indexOf(this.collectible);

		if (index !== -1) {
			oldPlanet.props.splice(index, 1);
		}
	}
}
