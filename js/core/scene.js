import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

document.body.appendChild(renderer.domElement);

const effect = new OutlineEffect(renderer, {
	defaultThickness: 0.0015,
	defaultColor: [0, 0, 0],
	defaultAlpha: 0.8,
	defaultKeepAlive: true
});

let composer = null;
let renderingOutline = false;

function initComposer(camera) {
	const renderPass = new RenderPass(scene, camera);

	const bloomPass = new UnrealBloomPass(
		new THREE.Vector2(window.innerWidth, window.innerHeight),
		0.22,   // strength
		0.35,   // radius
		0.85	// threshold
	);

	composer = new EffectComposer(renderer);
	composer.addPass(renderPass);
	composer.addPass(bloomPass);
	composer.addPass(new OutputPass());

	// Apply outlines after each render inside the composer
	scene.onAfterRender = function() {
		if (renderingOutline) return;
		renderingOutline = true;
		effect.renderOutline(scene, camera);
		renderingOutline = false;
	};
}

function getComposer() { return composer; }

export { scene, renderer, effect, initComposer, getComposer };
