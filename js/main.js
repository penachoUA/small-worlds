import Game from './core/Game.js';

const loadingScreen = document.getElementById('loading-screen');
const startBtn = document.getElementById('start-btn');
const loadingText = document.getElementById('loading-text');

// Game signals ready via this callback
function onGameReady() {
	loadingText.textContent = '';
	startBtn.textContent = 'Begin';
	startBtn.disabled = false;
}

startBtn.addEventListener('click', () => {
	loadingScreen.classList.add('hidden');
	// Remove from DOM after fade
	setTimeout(() => loadingScreen.remove(), 900);
});

new Game(onGameReady);
