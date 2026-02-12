class Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  angle: number;
  rotateDirection: number;

  constructor(x: number, y: number, width: number, height: number, color: string) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
    this.angle = 0;
    this.rotateDirection = Math.random() > 0.5 ? 1 : -1;
  }

  private draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
  }

  fall(speed: number) {
    this.y += speed;
  }

  animate(ctx: CanvasRenderingContext2D, rotateSpeed: number, fallSpeed: number) {
    this.angle += rotateSpeed;
    this.fall(fallSpeed);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotateDirection * this.angle);
    this.draw(ctx);
    ctx.restore();
  }
}

export default Rectangle;
