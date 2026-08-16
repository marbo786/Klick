/**
 * Master output chain for Klick synth.
 * Manages the final gain, compression, and analysis before output.
 */
export default class MasterBus {
    private readonly ctx: AudioContext;
    private readonly masterGain: GainNode;
    private readonly compressor: DynamicsCompressorNode;
    private readonly analyser: AnalyserNode;
    private linearVolume: number = 1.0;

    constructor(ctx: AudioContext) {
        this.ctx = ctx;

        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 1.0;

        this.compressor = ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -8;
        this.compressor.knee.value = 6;
        this.compressor.ratio.value = 6;
        this.compressor.attack.value = 0.002;
        this.compressor.release.value = 0.06;

        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.3;

        // Routing: masterGain -> compressor -> analyser -> destination
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
    }

    /**
     * Returns the master gain node to which voices should connect.
     * @returns The master gain node
     */
    public getInputNode(): GainNode {
        return this.masterGain;
    }

    /**
     * Sets the volume (0.0 to 1.0).
     * Applies a quadratic curve for a natural-feeling control.
     * @param volume Linear volume from 0.0 to 1.0
     */
    public setVolume(volume: number): void {
        this.linearVolume = Math.max(0, Math.min(1, volume));
        const curvedVolume = this.linearVolume * this.linearVolume;
        
        // Use an exponential ramp with epsilon floor, never ramp to zero.
        const targetValue = Math.max(1e-4, curvedVolume);
        
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
        this.masterGain.gain.exponentialRampToValueAtTime(targetValue, this.ctx.currentTime + 0.05);
    }

    /**
     * Returns the linear volume value (0.0 to 1.0).
     * @returns The linear volume
     */
    public getVolume(): number {
        return this.linearVolume;
    }

    /**
     * Returns the analyser node for waveform visualization.
     * @returns The analyser node
     */
    public getAnalyserNode(): AnalyserNode {
        return this.analyser;
    }

    /**
     * Disconnects all nodes and cleans up.
     */
    public dispose(): void {
        this.masterGain.disconnect();
        this.compressor.disconnect();
        this.analyser.disconnect();
    }
}
