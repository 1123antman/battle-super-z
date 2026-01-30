// JS Fractal Module
(function () {
    function init(container) {
        // Canvas Setup
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        container.appendChild(canvas);

        // UI Controls
        const controls = document.createElement('div');
        controls.className = 'controls';
        controls.innerHTML = `
            <div style="color:white; font-size: 0.9rem; margin-bottom: 5px;">Mode: JS Fallback (High Performance)</div>
            <button id="btn-reset">Reset View</button>
            <button id="btn-theme">Change Theme</button>
        `;
        container.appendChild(controls);

        let width, height;
        let imageData, data;

        // Fractal Params
        let panX = -0.5;
        let panY = 0;
        let zoom = 1;
        let maxIter = 100;

        let isDrawing = false;
        let themeId = 0;

        function resize() {
            width = container.clientWidth;
            height = container.clientHeight;
            canvas.width = width;
            canvas.height = height;

            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, width, height);

            imageData = ctx.createImageData(width, height);
            data = new Uint32Array(imageData.data.buffer);

            draw();
        }

        function draw() {
            if (isDrawing) return;
            isDrawing = true;

            requestAnimationFrame(() => {
                renderFractal();
                ctx.putImageData(imageData, 0, 0);
                isDrawing = false;
            });
        }

        function renderFractal() {
            const w = width;
            const h = height;
            const m = maxIter;

            const zoomFactor = 1 / (0.5 * zoom * h);

            for (let y = 0; y < h; y++) {
                const cy = (y - h / 2) * zoomFactor + panY;

                for (let x = 0; x < w; x++) {
                    const cx = (x - w / 2) * zoomFactor + panX;

                    let zx = 0.0;
                    let zy = 0.0;
                    let i = 0;

                    while (zx * zx + zy * zy < 4.0 && i < m) {
                        let temp = zx * zx - zy * zy + cx;
                        zy = 2.0 * zx * zy + cy;
                        zx = temp;
                        i++;
                    }

                    if (i === m) {
                        data[y * w + x] = 0xFF000000;
                    } else {
                        data[y * w + x] = getColor(i);
                    }
                }
            }
        }

        function getColor(i) {
            if (themeId === 0) {
                const r = (i * 9) % 255;
                const g = (i * 7) % 255;
                const b = (i * 5) % 255;
                return (255 << 24) | (b << 16) | (g << 8) | r;
            } else {
                const r = (i * 15) % 255;
                const g = (i * 3) % 150;
                const b = (i * 1) % 50;
                return (255 << 24) | (b << 16) | (g << 8) | r;
            }
        }

        // Interactions
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1;
            if (e.deltaY < 0) {
                zoom *= (1 + zoomSpeed);
            } else {
                zoom /= (1 + zoomSpeed);
            }
            draw();
        }, { passive: false });

        let isDragging = false;
        let lastX, lastY;

        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        window.addEventListener('mouseup', () => isDragging = false);

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;

            const moveScale = 1 / (0.5 * zoom * height);

            panX -= dx * moveScale;
            panY -= dy * moveScale;

            lastX = e.clientX;
            lastY = e.clientY;

            draw();
        });

        const btnReset = container.querySelector('#btn-reset');
        if (btnReset) btnReset.addEventListener('click', () => {
            panX = -0.5;
            panY = 0;
            zoom = 1;
            draw();
        });

        const btnTheme = container.querySelector('#btn-theme');
        if (btnTheme) btnTheme.addEventListener('click', () => {
            themeId = 1 - themeId;
            draw();
        });

        const ro = new ResizeObserver(resize);
        ro.observe(container);
        resize();
    }

    window.GATP.modules.wasm = init;
})();
