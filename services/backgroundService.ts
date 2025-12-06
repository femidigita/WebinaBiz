export class BackgroundService {
  private selfieSegmentation: any;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private active = false;
  private mode: 'BLUR' | 'IMAGE' = 'BLUR';
  private backgroundImage: HTMLImageElement | null = null;

  constructor() {
    // @ts-ignore
    if (window.SelfieSegmentation) {
      // @ts-ignore
      this.selfieSegmentation = new SelfieSegmentation({
        locateFile: (file: string) => {
          // Explicitly use the same version as index.html to ensure WASM files are found
          return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/${file}`;
        },
      });

      this.selfieSegmentation.setOptions({
        modelSelection: 1, // 0: landscape (faster), 1: general (better accuracy)
        selfieMode: false,
      });

      this.selfieSegmentation.onResults(this.onResults);
      
      // Preload a default office background
      this.backgroundImage = new Image();
      this.backgroundImage.src = "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=80";
    }
  }

  public setMode(mode: 'BLUR' | 'IMAGE') {
    this.mode = mode;
  }

  private onResults = (results: any) => {
    if (!this.ctx || !this.canvas) return;

    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.drawImage(
      results.segmentationMask,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    // Only overwrite existing pixels.
    this.ctx.globalCompositeOperation = 'source-in';
    
    // Draw the camera image (foreground)
    this.ctx.drawImage(
      results.image,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    // Only draw over empty pixels.
    this.ctx.globalCompositeOperation = 'destination-over';

    if (this.mode === 'BLUR') {
        this.ctx.filter = 'blur(10px)';
        this.ctx.drawImage(
            results.image,
            0,
            0,
            this.canvas.width,
            this.canvas.height
        );
    } else if (this.mode === 'IMAGE' && this.backgroundImage) {
        this.ctx.drawImage(
            this.backgroundImage,
            0,
            0,
            this.canvas.width,
            this.canvas.height
        );
    } else {
        // Fallback to blur if image fails
        this.ctx.filter = 'blur(10px)';
        this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);
    }

    this.ctx.restore();
  };

  public async processStream(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement
  ): Promise<void> {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.active = true;

    if (!this.selfieSegmentation) return;

    const processFrame = async () => {
      if (!this.active) return;
      
      // Ensure dimensions match
      if (videoElement.videoWidth && canvasElement.width !== videoElement.videoWidth) {
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;
      }

      // Only send if video has data
      if (videoElement.readyState >= 2) {
          try {
              await this.selfieSegmentation.send({ image: videoElement });
          } catch (error) {
              console.warn("MediaPipe processing error (will retry):", error);
          }
      }
      
      if (this.active) {
        requestAnimationFrame(processFrame);
      }
    };

    processFrame();
  }

  public stop() {
    this.active = false;
  }
}

export const backgroundService = new BackgroundService();