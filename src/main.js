import { WebGPURenderer } from './webgpu_renderer.js';
import { GameLogic } from './game_logic.js';
import { AIManager } from './ai_manager.js';

const renderer = new WebGPURenderer('gpu-canvas');
const game = new GameLogic();
const ai = new AIManager();

let lastTime = 0;

async function init() {
    try {
        await renderer.init();
        await ai.init();
        game.init();

        // Input handling
        window.addEventListener('keydown', (e) => {
            game.handleInput(e.key);
            ai.recordKeystroke(e.key, Math.random() * 200); // Mock latency for now
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
        const aiState = await ai.analyze();
        document.getElementById('ai-state').innerText = aiState;
    }

    const state = game.getState();
    renderer.render(state);

    // Update UI
    document.getElementById('score').innerText = game.score;

    // Toggle Start Screen
    const centerDisplay = document.getElementById('center-display');
    if (state.state === "MENU") {
        centerDisplay.classList.remove('hidden');
        // Show typing progress
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
