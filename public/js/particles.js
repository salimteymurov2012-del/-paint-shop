// Starry particles animation - inspired by Starry Night
(function() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];
  let stars = [];

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.size = Math.random() * 3 + 1;
      this.speedX = (Math.random() - 0.5) * 0.3;
      this.speedY = (Math.random() - 0.5) * 0.3;
      this.opacity = Math.random() * 0.6 + 0.1;
      this.pulseSpeed = Math.random() * 0.02 + 0.005;
      this.pulseOffset = Math.random() * Math.PI * 2;
      this.color = this.randomColor();
    }
    randomColor() {
      const colors = [
        '255, 215, 0',    // gold
        '107, 163, 214',  // soft blue
        '240, 208, 128',  // light gold
        '139, 92, 246',    // purple
        '255, 255, 255',   // white
        '74, 123, 181'     // blue
      ];
      return colors[Math.floor(Math.random() * colors.length)];
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.opacity = (Math.sin(Date.now() * this.pulseSpeed + this.pulseOffset) * 0.3 + 0.5) * (Math.random() * 0.3 + 0.5);

      if (this.x < -10 || this.x > width + 10 || this.y < -10 || this.y > height + 10) {
        this.reset();
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color}, ${this.opacity})`;
      ctx.fill();

      // Glow effect
      if (this.size > 2) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color}, ${this.opacity * 0.1})`;
        ctx.fill();
      }
    }
  }

  // Swirl/nebula effect
  class SwirlParticle {
    constructor() {
      this.angle = Math.random() * Math.PI * 2;
      this.radius = Math.random() * 300 + 50;
      this.centerX = Math.random() * width;
      this.centerY = Math.random() * height;
      this.size = Math.random() * 2 + 0.5;
      this.speed = (Math.random() * 0.002 + 0.001) * (Math.random() > 0.5 ? 1 : -1);
      this.color = `rgba(212, 168, 67, ${Math.random() * 0.05})`;
    }
    update() {
      this.angle += this.speed;
      this.radius += Math.sin(Date.now() * 0.001 + this.angle) * 0.1;
    }
    draw() {
      const x = this.centerX + Math.cos(this.angle) * this.radius;
      const y = this.centerY + Math.sin(this.angle) * this.radius * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }
  }

  function init() {
    resize();
    particles = [];
    for (let i = 0; i < 150; i++) {
      particles.push(new Particle());
    }
    for (let i = 0; i < 30; i++) {
      stars.push(new SwirlParticle());
    }
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      p.update();
      p.draw();
    }
    for (const s of stars) {
      s.update();
      s.draw();
    }

    // Connecting lines between nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(212, 168, 67, ${0.04 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', resize);
  init();
  animate();
})();
