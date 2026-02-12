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
  }

  private draw(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
  }

  fall(speed: number) {
    this.y += speed;
  }

  animate(ctx: CanvasRenderingContext2D, rotateSpeed: number, fallSpeed: number) {
    if (this.skewered) {
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
