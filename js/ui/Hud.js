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

	animateOrbCollect({ from, count }) {
		const targetRect = this.root.getBoundingClientRect();

		const target = {
			x: targetRect.left + targetRect.width * 0.5,
			y: targetRect.top + targetRect.height * 0.5
		};

		const orb = document.createElement('div');

		orb.style.position = 'fixed';
		orb.style.left = `${from.x}px`;
		orb.style.top = `${from.y}px`;
		orb.style.width = '46px';
		orb.style.height = '46px';
		orb.style.borderRadius = '50%';
		orb.style.pointerEvents = 'none';
		orb.style.zIndex = '999';
		orb.style.transform = 'translate(-50%, -50%) scale(1)';
		orb.style.background = 'radial-gradient(circle, #fff 0%, #ffd1f0 28%, #ff4fd8 58%, rgba(255, 79, 216, 0) 72%)';
		orb.style.boxShadow = '0 0 14px rgba(255, 79, 216, 0.95), 0 0 34px rgba(255, 79, 216, 0.75)';
		orb.style.opacity = '1';

		document.body.appendChild(orb);

		const dx = target.x - from.x;
		const dy = target.y - from.y;

		const distance = Math.hypot(dx, dy);
		const arcLift = Math.min(180, Math.max(60, distance * 0.22));

		const animation = orb.animate(
			[
				{
					transform: 'translate(-50%, -50%) scale(1)',
					opacity: 1,
					offset: 0
				},
				{
					// Tiny pop away from the pickup point so the player notices it.
					transform: `translate(calc(-50% + ${-dx * 0.05}px), calc(-50% + ${-dy * 0.05 - 18}px)) scale(1.35)`,
					opacity: 1,
					offset: 0.18
				},
				{
					// Curved high point before being sucked into the counter.
					transform: `translate(calc(-50% + ${dx * 0.45}px), calc(-50% + ${dy * 0.45 - arcLift}px)) scale(0.85)`,
					opacity: 0.9,
					offset: 0.62
				},
				{
					transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.18)`,
					opacity: 0.1,
					offset: 1
				}
			],
			{
				duration: 1000,
				easing: 'cubic-bezier(0.18, 0.85, 0.22, 1)',
				fill: 'forwards'
			}
		);

		animation.finished.finally(() => {
			orb.remove();
			this.setOrbCount(count);
			this._pulseCounter();
		});
	}

	setOrbCount(count) {
		this.root.textContent = `✦ ${count}`;
	}

	dispose() {
		this.root.remove();
	}

	_pulseCounter() {
		this.root.animate(
			[
				{ transform: 'scale(1)' },
				{ transform: 'scale(1.16)' },
				{ transform: 'scale(1)' }
			],
			{
				duration: 260,
				easing: 'ease-out'
			}
		);
	}
}
