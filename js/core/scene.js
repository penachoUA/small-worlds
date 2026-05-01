import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const effect = new OutlineEffect(renderer, {
	defaultThickness: 0.001,
	defaultColor: [0, 0, 0],
	defaultAlpha: 0.8,
	defaultKeepAlive: true
});

export { scene, renderer, effect };
