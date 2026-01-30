// p5.js Art Module: Strange Attractors
(function () {
    function init(container) {
        const sketch = (p) => {
            // Lorenz Attractor parameters
            let x = 0.1, y = 0, z = 0;
            let sigma = 10;
            let rho = 28;
            let beta = 8.0 / 3.0;

            let points = [];
            let hue = 0;

            p.setup = () => {
                let w = container.clientWidth || 800;
                let h = container.clientHeight || 600;
                if (w === 0) w = window.innerWidth;
                if (h === 0) h = window.innerHeight;

                const canvas = p.createCanvas(w, h, p.WEBGL); // WEBGL for 3D lines
                canvas.parent(container);

                p.colorMode(p.HSB, 255);
                p.background(0);

                // UI
                const ui = document.createElement('div');
                ui.className = 'controls';
                ui.innerHTML = `
                    <div style="color:white; font-size:0.9em; margin-bottom:5px;">System: Lorenz Attractor</div>
                    <button id="p5-reset">Reset</button>
                    <button id="p5-mode">Change System</button>
                `;
                container.appendChild(ui);

                container.querySelector('#p5-reset').onclick = () => {
                    x = 0.1; y = 0; z = 0;
                    points = [];
                    p.background(0);
                };
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                p.background(0);
            };

            p.draw = () => {
                p.background(0);

                // Orbit control fallback logic
                // p.orbitControls(); // p.orbitControls is standard in p5 global mode but instance mode? 
                if (p.orbitControls) p.orbitControls();
                else {
                    // Simple rotate if orbitControls missing
                    p.rotateY(p.frameCount * 0.005);
                }

                p.scale(5); // Zoom in
                p.noFill();

                // Calculate next point
                let dt = 0.01;
                let dx = (sigma * (y - x)) * dt;
                let dy = (x * (rho - z) - y) * dt;
                let dz = (x * y - beta * z) * dt;

                x = x + dx;
                y = y + dy;
                z = z + dz;

                points.push(new p5.Vector(x, y, z));

                if (points.length > 2000) {
                    points.shift(); // Keep visual buffer limited for perf
                }

                // Draw
                p.beginShape();
                let hu = 0;
                for (let v of points) {
                    p.stroke(hu, 255, 255);
                    p.vertex(v.x, v.y, v.z);

                    hu += 0.5;
                    if (hu > 255) hu = 0;
                }
                p.endShape();
            };
        };

        if (window.p5) {
            new window.p5(sketch);
        } else {
            container.innerHTML = "Error: p5.js library not loaded";
        }
    }

    window.GATP.modules.p5 = init;
})();
