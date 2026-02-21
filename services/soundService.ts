class SoundService {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private createGain(startTime: number, duration: number, initialVolume: number) {
    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(initialVolume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    gain.connect(this.ctx!.destination);
    return gain;
  }

  playMove() {
    this.init();
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.createGain(now, 0.1, 0.1);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);

    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playCapture() {
    this.init();
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.createGain(now, 0.15, 0.15);

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);

    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playReject() {
    this.init();
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    // A shorter, harsher sound for rejection
    const gain = this.createGain(now, 0.2, 0.12);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(40, now + 0.15);

    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playCheck() {
    this.init();
    const now = this.ctx!.currentTime;
    const osc1 = this.ctx!.createOscillator();
    const osc2 = this.ctx!.createOscillator();
    const gain = this.createGain(now, 0.4, 0.08);

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1100, now + 0.1);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(660, now);
    osc2.frequency.exponentialRampToValueAtTime(880, now + 0.1);

    osc1.connect(gain);
    osc2.connect(gain);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
  }

  playPromote() {
    this.init();
    const now = this.ctx!.currentTime;
    const duration = 0.5;
    const gain = this.createGain(now, duration, 0.1);

    [440, 554.37, 659.25, 880].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      osc.connect(gain);
      osc.start(now + i * 0.08);
      osc.stop(now + duration);
    });
  }

  playGameOver() {
    this.init();
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    gain.connect(this.ctx!.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 1.5);

    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 1.5);
  }
}

export const soundService = new SoundService();