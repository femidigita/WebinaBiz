export class BackgroundService {
  private selfieSegmentation: any = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private active = false;
  private mode: 'BLUR' | 'IMAGE' = 'BLUR';
  private backgroundImage: HTMLImageElement | null = null;
  private isInitializing = false;

  constructor() {
    // We delay initialization until the first use to ensure external scripts are loaded
    // Preload a default office background
    this.backgroundImage = new Image();
    this.backgroundImage.src = "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=80";
  }

  public setMode(mode: 'BLUR' | 'IMAGE') {
    this.mode = mode;
  }

  private async ensureInitialized(): Promise<boolean> {
    if (this.selfieSegmentation) return true;
    if (this.isInitializing) return false; // Avoid double init
    
    // Check if script loaded on window
    // @ts-ignore
    if (!window.SelfieSegmentation) {
        console.warn("MediaPipe SelfieSegmentation script not loaded on window object yet.");
        // We will retry in the loop if this returns false
        return false;
    }

    this.isInitializing = true;
    try {
        console.log("Initializing SelfieSegmentation...");
        // @ts-ignore
        this.selfieSegmentation = new SelfieSegmentation({
            locateFile: (file: string) => {
                // Ensure we point to the correct version matching index.html to find wasm/tflite
                return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/${file}`;
            },
        });

        this.selfieSegmentation.setOptions({
            modelSelection: 1, // 1: landscape (faster)
            selfieMode: false,
        });

        this.selfieSegmentation.onResults(this.onResults);
        console.log("SelfieSegmentation initialized.");
        return true;
    } catch (e) {
        console.error("Failed to initialize SelfieSegmentation:", e);
        this.isInitializing = false;
        return false;
    }
  }

  private onResults = (results: any) => {
    if (!this.ctx || !this.canvas) return;

    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Draw the segmentation mask (person is white, bg is black)
    this.ctx.drawImage(
      results.segmentationMask,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    // 2. Keep only the opaque pixels (the person)
    this.ctx.globalCompositeOperation = 'source-in';
    
    // 3. Draw the actual camera image onto the mask
    this.ctx.drawImage(
      results.image,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    // 4. Draw behind the person
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
        // Fallback
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

    // Ensure library is ready before processing
    const ready = await this.ensureInitialized();
    if (!ready) {
        // Retry shortly if scripts are still loading
        if (this.active) {
            setTimeout(() => this.processStream(videoElement, canvasElement), 500);
        }
        return;
    }

    const processFrame = async () => {
      if (!this.active) return;
      
      // Ensure dimensions match
      if (videoElement.videoWidth && canvasElement.width !== videoElement.videoWidth) {
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;
      }

      // Only send if video has data and dimensions
      if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
          try {
              if (this.selfieSegmentation) {
                await this.selfieSegmentation.send({ image: videoElement });
              }
          } catch (error) {
              // Only log critical errors, ignore hiccups
              console.warn("Segmentation send error (retrying):", error);
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