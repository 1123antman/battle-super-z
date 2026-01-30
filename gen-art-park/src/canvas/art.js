// Canvas Art Module (Glow Edition)
(function () {
    function init(container) {
        const noise = window.GATP.utils.noise;
        const noiseDetail = window.GATP.utils.noiseDetail;

        // Setup Canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        container.appendChild(canvas);

        // Setup UI Controls
        const controls = document.createElement('div');
        controls.className = 'controls';
        controls.innerHTML = `
            <button id="btn-regen">Regenerate Flow</button>
            <button id="btn-save">Save Image</button>
        `;
        container.appendChild(controls);

        let width, height;
        let particles = [];
        let animationId;
        const particleCount = 4000; // Increased count
        const scale = 0.003; // Smoother noise
        const speed = 1.5;

        function resize() {
            width = container.clientWidth;
            height = container.clientHeight;
            canvas.width = width;
            canvas.height = height;

            // Initial Background (Deep Black)
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);

            initParticles();
        }

        class Particle {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                // Cyberpunk / Neon Palette
                const hue = Math.random() > 0.5 ? Math.random() * 60 + 160 : Math.random() * 60 + 280; // Cyan-Blue OR Purple-Pink
                this.color = `hsl(${hue}, 80%, 60%)`;
                this.life = Math.random() * 100 + 50;
            }

            update() {
                const angle = noise(this.x * scale, this.y * scale) * Math.PI * 4;

                this.x += Math.cos(angle) * speed;
                this.y += Math.sin(angle) * speed;
                this.life--;

                if (this.x < 0 || this.x > width || this.y < 0 || this.y > height || this.life < 0) {
                    this.x = Math.random() * width;
                    this.y = Math.random() * height;
                    this.life = Math.random() * 100 + 50;
                }
            }

            draw() {
                ctx.beginPath();
                ctx.fillStyle = this.color;
                ctx.globalAlpha = 0.05; // Very transparent
                ctx.arc(this.x, this.y, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function initParticles() {
            particles = [];
            noiseDetail(8, 0.65); // More detail
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
        }

        function loop() {
            // Glow Effect!
            ctx.globalCompositeOperation = 'lighter'; // Additive blending

            particles.forEach(p => {
                p.update();
                p.draw();
            });

            // Reset for background fade (trick to keep trails but fade slowly)
            // Note: In additive mode, we can't easily fade with black. 
            // We switch back, draw semi-transparent black, then switch back.

            ctx.globalCompositeOperation = 'source-over';
            // ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
            // ctx.fillRect(0, 0, width, height);
            // Actually, for "generative painting" style, no fade is often better. Let it accumulate.

            // Let's add a very subtle fade to preventing white-out
            if (Math.random() > 0.9) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.01)';
                ctx.fillRect(0, 0, width, height);
            }

            animationId = requestAnimationFrame(loop);
        }

        // Initialize
        resize();
        loop();

        const ro = new ResizeObserver(resize);
        ro.observe(container);

        const btnRegen = container.querySelector('#btn-regen');
        if (btnRegen) btnRegen.addEventListener('click', () => {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
            initParticles();
        });

        const btnSave = container.querySelector('#btn-save');
        if (btnSave) btnSave.addEventListener('click', () => {
            const link = document.createElement('a');
            link.download = `glow-art-${Date.now()}.png`;
            link.href = canvas.toDataURL();
            link.click();
        });
    }

    window.GATP.modules.canvas = init;
})();
