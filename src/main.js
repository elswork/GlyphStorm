import { WebGPURenderer } from './webgpu_renderer.js';
import { GameLogic } from './game_logic.js';
import { AIManager } from './ai_manager.js';
import { AudioManager } from './audio_manager.js';

const renderer = new WebGPURenderer('gpu-canvas');
const game = new GameLogic();
const ai = new AIManager();
const audio = new AudioManager();

let lastTime = 0;

async function init() {
    try {
        await renderer.init();
        await ai.init();
        game.init();

        // TTS setup
        game.onSpeak = (text) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.2;
            utterance.pitch = 1.0;
            window.speechSynthesis.speak(utterance);
        };

        game.onDestroy = (x, y) => {
            renderer.addExplosion(x, y);
        };

        // Input handling
        window.addEventListener('keydown', (e) => {
            audio.init(); // Resume context if needed
            audio.playClick();

            const prevState = game.state;
            game.handleInput(e.key);
            ai.recordKeystroke(e.key, 100); // Latency mock

            if (prevState === "MENU" && game.state === "PLAYING") {
                audio.startMusic();
            }
        });

        requestAnimationFrame(gameLoop);
    } catch (err) {
        console.error("Initialization failed:", err);
        document.body.innerHTML += `<div style="color:red; position:absolute; top:50%; width:100%; text-align:center;">${err.message}</div>`;
    }
}

async function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    game.update(dt);

    // Periodically run AI analysis (e.g., every 2 seconds)
    if (Math.floor(timestamp / 2000) > Math.floor((timestamp - dt) / 2000)) {
        const aiAnalysis = await ai.analyze();
        const aiState = typeof aiAnalysis === 'string' ? aiAnalysis : aiAnalysis.state;
        const ttsThreshold = aiAnalysis.ttsThreshold || 0.5;

        document.getElementById('ai-state').innerText = aiState;
        game.ttsThreshold = ttsThreshold;
        game.difficultChars = ai.getDifficultChars();
        audio.updateBPM(game.score);

        // Dynamic Themes: Update background color based on threshold
        // Flow (0.75) -> Cyan/Blue, Struggling (0.25) -> Red, Normal (0.5) -> Gray
        if (ttsThreshold > 0.6) {
            renderer.clearColor = { r: 0.05, g: 0.1, b: 0.15, a: 1.0 }; // Deep Teal
        } else if (ttsThreshold < 0.4) {
            renderer.clearColor = { r: 0.2, g: 0.05, b: 0.05, a: 1.0 }; // Deep Red
        } else {
            renderer.clearColor = { r: 0.1, g: 0.1, b: 0.1, a: 1.0 }; // Standard Gray
        }
    }

    const state = game.getState();
    renderer.render(state);

    // Update UI
    document.getElementById('score').innerText = game.score;

    // Toggle Start Screen
    const centerDisplay = document.getElementById('center-display');
    if (state.state === "MENU") {
        centerDisplay.classList.remove('hidden');
        const typed = state.startInput || "";
        const target = "START";
        let html = "";
        for (let i = 0; i < target.length; i++) {
            if (i < typed.length) {
                html += `<span style="color: #00ffff">${target[i]}</span>`;
            } else {
                html += `<span style="color: #333">${target[i]}</span>`;
            }
        }
        document.getElementById('target-word').innerHTML = html;
    } else {
        centerDisplay.classList.add('hidden');
    }

    // Toggle Game Over Screen
    const gameOverDisplay = document.getElementById('game-over');
    if (state.state === "GAMEOVER") {
        gameOverDisplay.classList.remove('hidden');
        document.getElementById('final-score').innerText = state.score;
        document.getElementById('final-wpm').innerText = game.wpm; // Simplistic
    } else {
        gameOverDisplay.classList.add('hidden');
    }

    // Update Enemy Labels
    const enemyLayer = document.getElementById('enemy-layer');
    // Clear existing labels (inefficient but simple for prototype)
    enemyLayer.innerHTML = '';

    if (state.state === "PLAYING") {
        state.enemies.forEach(enemy => {
            const el = document.createElement('div');
            el.style.position = 'absolute';
            // Convert normalized coordinates (0-1) to pixels
            // Enemy x is 0-1, y is 0-1. 
            // WebGPU renderer draws quad centered at pos + size/2? 
            // Let's align text to top-left of enemy box.
            el.style.left = (enemy.x * window.innerWidth) + 'px';
            el.style.top = (enemy.y * window.innerHeight) + 'px';
            el.style.color = 'white';
            el.style.fontWeight = 'bold';
            el.style.fontSize = '20px';
            el.style.textShadow = '0 0 5px black';
            el.style.transform = 'translate(5px, 5px)'; // Offset slightly into box

            // Highlight matched part
            const word = enemy.word;
            const matched = enemy.matchedIndex || 0;
            const matchedPart = word.substring(0, matched);
            const remainingPart = word.substring(matched);

            el.innerHTML = `<span style="color: #00ff00">${matchedPart}</span>${remainingPart}`;

            enemyLayer.appendChild(el);
        });
    }

    requestAnimationFrame(gameLoop);
}

init();
