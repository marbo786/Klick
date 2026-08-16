export class WaveformVisualizer {
  private analyserNode: AnalyserNode | null = null;
  private dataArray: Float32Array;
  private ctx: CanvasRenderingContext2D;
  private animationId: number | null = null;
  private isRunning = false;
  
  private canvas: HTMLCanvasElement;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D context from canvas');
    }
    this.ctx = context;
    // Default size, will be updated in render loop
    this.dataArray = new Float32Array(2048); 
  }

  public connect(analyserNode: AnalyserNode) {
    this.analyserNode = analyserNode;
    this.dataArray = new Float32Array(this.analyserNode.fftSize);
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.render();
  }

  public stop() {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private render = () => {
    if (!this.isRunning) return;

    this.animationId = requestAnimationFrame(this.render);

    const width = this.canvas.width = this.canvas.clientWidth;
    const height = this.canvas.height = this.canvas.clientHeight;

    this.ctx.clearRect(0, 0, width, height);

    if (!this.analyserNode) {
      this.drawIdleState(width, height);
      return;
    }

    this.analyserNode.getFloatTimeDomainData(this.dataArray as Float32Array<ArrayBuffer>);

    let isIdle = true;
    for (let i = 0; i < this.dataArray.length; i++) {
      if (Math.abs(this.dataArray[i]) >= 0.005) {
        isIdle = false;
        break;
      }
    }

    if (isIdle) {
      this.drawIdleState(width, height);
      return;
    }

    this.ctx.lineWidth = 2;
    // Use the warm amber accent (#C69A5C -> rgb(198, 154, 92))
    this.ctx.strokeStyle = 'rgba(198, 154, 92, 0.6)'; 
    this.ctx.shadowBlur = 4;
    this.ctx.shadowColor = 'rgba(198, 154, 92, 0.3)';
    
    this.ctx.beginPath();
    
    const sliceWidth = width * 1.0 / this.dataArray.length;
    let x = 0;

    for (let i = 0; i < this.dataArray.length; i++) {
      const v = this.dataArray[i];
      // Scale up the visual amplitude slightly for better visual effect behind text
      const y = (v * height) + (height / 2);

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    this.ctx.lineTo(width, height / 2);
    this.ctx.stroke();
    
    // reset shadow
    this.ctx.shadowBlur = 0;
  };

  private drawIdleState(width: number, height: number) {
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = 'rgba(198, 154, 92, 0.15)';
    this.ctx.beginPath();
    this.ctx.moveTo(0, height / 2);
    this.ctx.lineTo(width, height / 2);
    this.ctx.stroke();
  }

  public dispose() {
    this.stop();
    this.analyserNode = null;
  }
}
