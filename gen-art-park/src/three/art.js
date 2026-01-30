// Three.js Art Module: Morphing Sphere
(function () {
    function init(container) {
        container.style.position = "relative";

        // Error helper
        function showError(msg) {
            container.innerHTML = `<div style="color:red; padding:20px;">${msg}</div>`;
        }

        try {
            if (!window.THREE) { showError("Three.js missing"); return; }
            const THREE = window.THREE;
            const noise = window.GATP.utils.noise; // Use our Perlin noise

            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x000000);

            const w = container.clientWidth || window.innerWidth;
            const h = container.clientHeight || window.innerHeight;
            const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
            camera.position.z = 30;

            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(w, h);
            container.appendChild(renderer.domElement);

            let controls;
            if (THREE.OrbitControls) controls = new THREE.OrbitControls(camera, renderer.domElement);
            else if (window.OrbitControls) controls = new window.OrbitControls(camera, renderer.domElement);
            if (controls) { controls.enableDstamping = true; controls.autoRotate = true; }

            // GEOMETRY: Sphere
            // We use Icosahedron for uniform vertices
            const geometry = new THREE.IcosahedronGeometry(10, 30); // Radius 10, Detail 6
            const count = geometry.attributes.position.count;

            // Store original positions for morphing
            geometry.userData = { originalPosition: geometry.attributes.position.clone() };

            // Material: Points for "digital data" look
            const material = new THREE.PointsMaterial({
                size: 0.15,
                color: 0x00ffff,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending
            });

            const sphere = new THREE.Points(geometry, material);
            scene.add(sphere);

            // Inner Core Glow
            const coreGeo = new THREE.SphereGeometry(8, 32, 32);
            const coreMat = new THREE.MeshBasicMaterial({ color: 0x0044ff, wireframe: true, transparent: true, opacity: 0.1 });
            const core = new THREE.Mesh(coreGeo, coreMat);
            scene.add(core);

            // Animate
            let time = 0;
            function animate() {
                requestAnimationFrame(animate);
                time += 0.01;

                if (controls) controls.update();

                // Morph vertices
                if (typeof noise === 'function') {
                    const pos = geometry.attributes.position;
                    const origPos = geometry.userData.originalPosition;

                    for (let i = 0; i < count; i++) {
                        const ox = origPos.getX(i);
                        const oy = origPos.getY(i);
                        const oz = origPos.getZ(i);

                        // Perlin noise based on direction and time
                        // Normalize vector approx
                        const mag = Math.sqrt(ox * ox + oy * oy + oz * oz);
                        const nx = ox / mag;
                        const ny = oy / mag;
                        const nz = oz / mag;

                        // Noise value (-1 to 1 approx)
                        const n = noise(nx + time, ny + time, nz + time);
                        const distortion = 1 + n * 0.5; // Scale 0.5 to 1.5

                        pos.setXYZ(i, ox * distortion, oy * distortion, oz * distortion);
                    }
                    pos.needsUpdate = true;

                    // Color cycling
                    const hue = (time * 10) % 360;
                    material.color.setHSL(hue / 360, 1.0, 0.6);
                    core.material.color.setHSL((hue + 180) % 360 / 360, 1.0, 0.5);
                }

                renderer.render(scene, camera);
            }
            animate();

            new ResizeObserver(() => {
                const nw = container.clientWidth;
                const nh = container.clientHeight;
                camera.aspect = nw / nh;
                camera.updateProjectionMatrix();
                renderer.setSize(nw, nh);
            }).observe(container);

        } catch (e) {
            console.error(e);
            showError(e.message);
        }
    }
    window.GATP.modules.three = init;
})();
