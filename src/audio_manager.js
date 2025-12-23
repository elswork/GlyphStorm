export class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.bpm = 120;
        this.isPlaying = false;
        this.nextNoteTime = 0;
        this.currentNote = 0;
    }

    async init() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    playClick() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    startMusic() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.nextNoteTime = this.ctx.currentTime;
        this.scheduler();
    }

    scheduler() {
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.scheduleNote(this.nextNoteTime);
            this.nextNoteTime += 60.0 / this.bpm / 2; // 8th notes
        }
        if (this.isPlaying) {
            setTimeout(() => this.scheduler(), 25);
        }
    }

    scheduleNote(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        // Simple beat
        if (this.currentNote % 8 === 0) {
            osc.frequency.setValueAtTime(60, time); // Kick
            gain.gain.setValueAtTime(0.2, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
        } else if (this.currentNote % 8 === 4) {
            osc.type = 'square'; // Snare-ish
            osc.frequency.setValueAtTime(150, time);
            gain.gain.setValueAtTime(0.1, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        } else {
            osc.frequency.setValueAtTime(200, time); // Hat-ish
            gain.gain.setValueAtTime(0.05, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
        }

        osc.start(time);
        osc.stop(time + 0.2);
        this.currentNote++;
    }

    updateBPM(score) {
        this.bpm = 120 + Math.min(score / 5, 60);
    }
}
