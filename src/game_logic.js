export class GameLogic {
    constructor() {
        this.state = "MENU"; // MENU, PLAYING, GAMEOVER
        this.score = 0;
        this.wpm = 0;
        this.difficulty = "Normal";
        this.enemies = [];
        this.particles = [];
        this.startTime = 0;
        this.basicWords = ["START"];
        this.advancedWords = [];
        this.bossWordList = ["ANTIGRAVITY"];
        this.currentTarget = null;
        this.startInput = ""; // Buffer for "START" typing
        this.restartInput = ""; // Buffer for "RESTART" typing
        this.ttsThreshold = 0.5;
        this.onSpeak = null;
        this.onDestroy = null; // Callback for particle explosions
        this.health = 100;
        this.wpmHistory = [];
        this.difficultChars = [];
        this.bossWordList = ["ANTIGRAVITY", "OPTIMIZATION", "RECONSTRUCTION", "MULTITHREADING", "ARCHITECTURE"];
    }

    init() {
        // Don't spawn enemies yet
    }

    spawnEnemy() {
        const isBoss = Math.random() < 0.1 && this.score > 150;
        let word;

        // Difficulty levels: 0-50 (Basic), 50-150 (Mixed), 150+ (Advanced)
        let pool;
        if (this.score < 50) {
            pool = this.basicWords;
        } else if (this.score < 150) {
            pool = Math.random() < 0.6 ? this.basicWords : this.advancedWords;
        } else {
            pool = Math.random() < 0.3 ? this.basicWords : this.advancedWords;
        }

        if (isBoss) {
            word = this.bossWordList[Math.floor(Math.random() * this.bossWordList.length)];
        } else {
            // Smart selection: prioritize words starting with difficult characters if they exist in the pool
            const smartPool = pool.filter(w => this.difficultChars.includes(w[0]));
            const finalPool = smartPool.length > 0 && Math.random() < 0.5 ? smartPool : pool;
            word = finalPool[Math.floor(Math.random() * finalPool.length)];
        }

        // Speed ramp: starts at 0.0002, increases with score
        const baseSpeed = 0.0002 + Math.min(this.score * 0.000003, 0.0008);
        const speed = isBoss ? baseSpeed * 0.6 : baseSpeed;

        this.enemies.push({
            word: word,
            x: Math.random() * 0.8 + 0.1,
            y: -0.1,
            speed: speed,
            active: true,
            matchedIndex: 0,
            spoken: false,
            isBoss: isBoss
        });
    }

    update(dt) {
        if (this.state !== "PLAYING") return;

        // Move enemies
        for (const enemy of this.enemies) {
            enemy.y += enemy.speed * dt;
            if (enemy.y > 1.0) {
                enemy.active = false;
                this.health -= 20; // Lose health
                if (this.health <= 0) {
                    this.state = "GAMEOVER";
                }
                if (this.currentTarget === enemy) {
                    this.currentTarget = null;
                }
            }

            // Check for TTS trigger
            if (!enemy.spoken && enemy.y >= this.ttsThreshold) {
                if (this.onSpeak) {
                    this.onSpeak(enemy.word);
                }
                enemy.spoken = true;
            }
        }

        // Cleanup inactive enemies
        this.enemies = this.enemies.filter(e => e.active);

        // Randomly spawn new enemies
        const spawnChance = 0.01 + (this.score * 0.0001);
        if (Math.random() < spawnChance && this.enemies.length < 10) {
            this.spawnEnemy();
        }
    }

    handleInput(key) {
        if (key.length !== 1) return;
        const char = key.toUpperCase();
        const rawChar = key; // Keep original for accented matching if needed

        if (this.state === "MENU") {
            const target = "START";
            if (char === target[this.startInput.length]) {
                this.startInput += char;
                console.log("Menu Input:", this.startInput);
                if (this.startInput === "START") {
                    this.startGame();
                }
            } else {
                this.startInput = ""; // Reset on mistake
            }
            return;
        }

        if (this.state === "GAMEOVER") {
            const target = "RESTART";
            if (char === target[this.restartInput.length]) {
                this.restartInput += char;
                if (this.restartInput === "RESTART") {
                    this.startGame();
                }
            } else {
                this.restartInput = "";
            }
            return;
        }

        if (this.state !== "PLAYING") return;

        if (!this.currentTarget) {
            const potentialTargets = this.enemies
                .filter(e => e.word.startsWith(char))
                .sort((a, b) => b.y - a.y);

            if (potentialTargets.length > 0) {
                this.currentTarget = potentialTargets[0];
                this.currentTarget.matchedIndex = 1;
                console.log("Target acquired:", this.currentTarget.word);
            }
        } else {
            const nextChar = this.currentTarget.word[this.currentTarget.matchedIndex];
            if (char === nextChar) {
                this.currentTarget.matchedIndex++;
                if (this.currentTarget.matchedIndex >= this.currentTarget.word.length) {
                    if (this.onDestroy) {
                        this.onDestroy(this.currentTarget.x, this.currentTarget.y);
                    }
                    this.currentTarget.active = false;
                    this.currentTarget = null;
                    this.score += 10;
                    this.wpm += 1;
                    console.log("Enemy destroyed!");
                }
            } else {
                console.log("Mistake!");
            }
        }
    }

    setDictionary(dict) {
        this.basicWords = dict.basicWords;
        this.advancedWords = dict.advancedWords;
        this.bossWordList = dict.bossWords;
    }

    startGame() {
        this.state = "PLAYING";
        this.score = 0;
        this.health = 100;
        this.enemies = [];
        this.startInput = "";
        this.restartInput = "";
        this.wpmHistory = [];
        this.startTime = Date.now();
        this.spawnEnemy();
        console.log("Game Started!");
    }

    getState() {
        return {
            state: this.state,
            score: this.score,
            enemies: this.enemies,
            particles: this.particles,
            startInput: this.startInput // Expose for UI
        };
    }
}
