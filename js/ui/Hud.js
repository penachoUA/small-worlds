export default class Hud {
	constructor() {
		this.root = document.createElement('div');
		this.root.style.position = 'fixed';
		this.root.style.top = '16px';
		this.root.style.left = '16px';
		this.root.style.zIndex = '10';
		this.root.style.padding = '12px 18px';
		this.root.style.borderRadius = '999px';
		this.root.style.background = 'rgba(10, 10, 20, 0.35)';
		this.root.style.backdropFilter = 'blur(6px)';
		this.root.style.color = '#fff1a8';
		this.root.style.fontFamily = 'system-ui, sans-serif';
		this.root.style.fontSize = '20px';
		this.root.style.fontWeight = '700';
		this.root.style.letterSpacing = '0.04em';
		this.root.style.textShadow = '0 0 12px rgba(255, 143, 61, 0.9)';
		this.root.style.pointerEvents = 'none';
		this.root.style.userSelect = 'none';

		document.body.appendChild(this.root);

		this.setOrbCount(0);
	}

	setOrbCount(count) {
		this.root.textContent = `✦ ${count}`;
	}

	dispose() {
		this.root.remove();
	}
}
