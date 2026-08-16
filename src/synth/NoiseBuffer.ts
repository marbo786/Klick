import { NOISE_BUFFER_DURATION } from './types.ts';

export default class NoiseBuffer {
  private buffer: AudioBuffer;
  private ctx: AudioContext;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    const sampleRate = this.ctx.sampleRate;
    const frameCount = sampleRate * NOISE_BUFFER_DURATION;
    
    this.buffer = this.ctx.createBuffer(1, frameCount, sampleRate);
    const channelData = this.buffer.getChannelData(0);
    
    for (let i = 0; i < frameCount; i++) {
      // Generate white noise between -1.0 and 1.0
      channelData[i] = Math.random() * 2 - 1;
    }
  }

  /**
   * Creates a new AudioBufferSourceNode connected to the shared noise buffer.
   * If an offset is not provided, a random offset within the buffer is used
   * to ensure successive keystrokes don't sound identical.
   * 
   * @param offset - Optional starting offset in seconds.
   * @returns A new AudioBufferSourceNode.
   */
  public createSource(offset?: number): AudioBufferSourceNode {
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    
    const startOffset = offset !== undefined ? offset : Math.random() * NOISE_BUFFER_DURATION;
    
    // Intercept the start method to automatically apply the chosen offset 
    // when the source node is played, if one is not explicitly provided.
    const originalStart = source.start.bind(source);
    source.start = (when?: number, o?: number, duration?: number) => {
      const actualOffset = o !== undefined ? o : startOffset;
      if (duration !== undefined) {
        originalStart(when || 0, actualOffset, duration);
      } else {
        originalStart(when || 0, actualOffset);
      }
    };
    
    return source;
  }
}
