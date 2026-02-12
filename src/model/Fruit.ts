class Fruit {
  x: number;
  y: number;
  width: number;
  height: number;
  image: HTMLImageElement;
  angle: number;
  rotateDirection: number;
  skewered: boolean;
  targetY: number;
  vx: number;
  vy: number;
  angularVelocity: number;
  bouncing: boolean;

  constructor(x: number, y: number, width: number, height: number, image: HTMLImageElement) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.image = image;
    this.angle = 0;
    this.rotateDirection = Math.random() > 0.5 ? 1 : -1;
    this.skewered = false;
    this.targetY = 0;
    this.vx = 0;
    this.vy = 0;
    this.angularVelocity = 0;
    this.bouncing = false;
  }

  private draw(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
  }

  fall(speed: number) {
    this.y += speed;
  }

  bounce(fromX: number, fromY: number) {
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const angle = Math.atan2(dy, dx);
    const speed = 6;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.angularVelocity = this.vx > 0 ? 0.1 : -0.1;
    this.bouncing = true;
  }

  animate(ctx: CanvasRenderingContext2D, rotateSpeed: number, fallSpeed: number) {
    if (this.bouncing) {
      this.vy += 0.15;
      this.x += this.vx;
      this.y += this.vy;
      this.angle += this.angularVelocity;
    } else if (this.skewered) {
      // Smoothly move to target Y position
      const dy = this.targetY - this.y;
      this.y += dy * 0.05;
    } else {
      this.angle += rotateSpeed;
      this.fall(fallSpeed);
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotateDirection * this.angle);
    this.draw(ctx);
    ctx.restore();
  }
}

export default Fruit;
