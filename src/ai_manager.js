export class AIManager {
    constructor() {
        this.model = null;
        this.isReady = false;
        this.typingHistory = [];
        this.charLatencies = {}; // key: char, value: [latencies]
    }

    async init() {
        console.log("Initializing AI Manager...");
        // TODO: Load LiteRT model here
        // For now, simulate initialization delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.isReady = true;
        console.log("AI Manager Ready");
    }

    recordKeystroke(char, latency) {
        const c = char.toUpperCase();
        if (!this.charLatencies[c]) this.charLatencies[c] = [];
        this.charLatencies[c].push(latency);
        if (this.charLatencies[c].length > 10) this.charLatencies[c].shift();

        this.typingHistory.push({ char: c, latency, timestamp: Date.now() });
        if (this.typingHistory.length > 50) {
            this.typingHistory.shift();
        }
    }

    async analyze() {
        if (!this.isReady) return "Initializing";

        // In a real implementation with LiteRT:
        // 1. Convert this.typingHistory to a tensor (e.g., sequence of latencies)
        // 2. Run this.model.predict(tensor)
        // 3. Interpret output class (0=Bored, 1=Flow, 2=Stressed)

        // Simulation based on heuristics:
        if (this.typingHistory.length < 5) return "Gathering Data...";

        const avgLatency = this.typingHistory.reduce((sum, k) => sum + k.latency, 0) / this.typingHistory.length;
        const variance = this.typingHistory.reduce((sum, k) => sum + Math.pow(k.latency - avgLatency, 2), 0) / this.typingHistory.length;

        // Simple heuristic:
        // Fast & Consistent -> Flow (Increase Difficulty)
        // Slow & Inconsistent -> Struggling (Decrease Difficulty)
        // Fast & Inconsistent -> Stressed/Spamming

        if (avgLatency < 150 && variance < 2000) {
            return { state: "Flow State (High)", ttsThreshold: 0.75 };
        } else if (avgLatency > 300) {
            return { state: "Struggling (Low)", ttsThreshold: 0.25 };
        } else {
            return { state: "Normal", ttsThreshold: 0.5 };
        }
    }

    getDifficultChars() {
        const difficult = [];
        for (const char in this.charLatencies) {
            const latencies = this.charLatencies[char];
            const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
            if (avg > 250) difficult.push(char);
        }
        return difficult;
    }
}
