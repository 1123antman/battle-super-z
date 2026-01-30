// Interactive Art Module
(function () {
    function init(container) {
        // Canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        container.appendChild(canvas);

        // UI
        const controls = document.createElement('div');
        controls.className = 'controls';
        controls.innerHTML = `
            <button id="btn-audio">Start Audio</button>
            <div style="color:#aaa; font-size:0.8rem; margin-top:5px;">Click to enable microphone</div>
        `;
        container.appendChild(controls);

        let width, height;
        let audioContext, analyser, dataArray;
        let isAudioActive = false;
        let trails = [];

        function resize() {
            width = container.clientWidth;
            height = container.clientHeight;
            canvas.width = width;
            canvas.height = height;
        }

        // Mouse tracking
        let mouse = { x: -100, y: -100 };
        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;

            trails.push({ x: mouse.x, y: mouse.y, age: 0 });
        });

        async function initAudio() {
            try {
                // Check if context is available
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) throw new Error("AudioContext not supported");

                audioContext = new AudioContext();
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }

                // getUserMedia is often blocked on file://
                if (location.protocol === 'file:') {
                    controls.innerHTML = '<div style="color:orange">Microphone not supported in offline mode (file://).<br>Mouse interaction only.</div>';
                    return;
                }

                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const source = audioContext.createMediaStreamSource(stream);
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                dataArray = new Uint8Array(analyser.frequencyBinCount);
                isAudioActive = true;
                controls.innerHTML = '<div style="color:#0f0">Audio Active</div>';
            } catch (e) {
                console.error(e);
                controls.innerHTML = `<div style="color:red">Audio Error: ${e.message}<br>(Microphone requires HTTPS or Localhost)</div>`;
            }
        }

        const btnAudio = container.querySelector('#btn-audio');
        if (btnAudio) btnAudio.addEventListener('click', initAudio);

        function loop() {
            // Clear with fade
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, width, height);

            // Audio Viz
            let r_mod = 0;
            if (isAudioActive) {
                analyser.getByteFrequencyData(dataArray);

                const centerX = width / 2;
                const centerY = height / 2;
                const radius = 100;

                ctx.beginPath();
                ctx.strokeStyle = `hsl(180, 100%, 50%)`;
                ctx.lineWidth = 2;

                for (let i = 0; i < dataArray.length; i++) {
                    const angle = (i / dataArray.length) * Math.PI * 2;
                    const amp = dataArray[i];
                    r_mod += amp;
                    const r = radius + amp;
                    const x = centerX + Math.cos(angle) * r;
                    const y = centerY + Math.sin(angle) * r;

                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.stroke();

                r_mod /= dataArray.length; // avg volume
            }

            // Mouse Trails
            for (let i = trails.length - 1; i >= 0; i--) {
                const t = trails[i];
                t.age++;

                const ratio = t.age / 50;

                ctx.beginPath();
                ctx.fillStyle = `hsla(${ratio * 360 + r_mod}, 80%, 60%, ${1 - ratio})`;
                ctx.arc(t.x, t.y, 10 + r_mod / 5, 0, Math.PI * 2);
                ctx.fill();

                if (t.age > 50) {
                    trails.splice(i, 1);
                }
            }

            requestAnimationFrame(loop);
        }

        const ro = new ResizeObserver(resize);
        ro.observe(container);
        resize();
        loop();
    }

    window.GATP.modules.interactive = init;
})();
