import * as THREE from 'three';

const colors = new Uint8Array([0, 255]);

const gradientMap = new THREE.DataTexture(
	colors,
	colors.length,
	1,
	THREE.RedFormat
);

gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;
gradientMap.needsUpdate = true;

export default gradientMap;
