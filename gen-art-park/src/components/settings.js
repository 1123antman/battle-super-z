// Settings Module
(function () {
    function init(container) {
        container.innerHTML = `
            <div class="hero">
                <h1>Settings</h1>
                <div style="text-align: left; max-width: 600px; margin: 0 auto; background: rgba(255,255,255,0.05); padding: 2rem; border-radius: 12px;">
                    <div style="margin-bottom: 2rem;">
                        <h3>Color Theme</h3>
                        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                            <button class="theme-btn" data-theme="default" style="background:#00ff88; color:#000;">Cyberpunk</button>
                            <button class="theme-btn" data-theme="dark" style="background:#ffffff; color:#000;">Monochrome</button>
                            <button class="theme-btn" data-theme="sunset" style="background:#ff5e00; color:#fff;">Sunset</button>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 2rem;">
                        <h3>Graphics Quality</h3>
                        <select id="quality-select" style="padding: 0.5rem; width: 100%; margin-top: 0.5rem; background: #333; color: white; border: none;">
                            <option value="high">High (Default)</option>
                            <option value="low">Low (Power Save)</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        const themes = {
            default: {
                '--bg-color': '#0a0a0a',
                '--primary-color': '#00ff88',
                '--accent-color': '#00d2ff'
            },
            dark: {
                '--bg-color': '#000000',
                '--primary-color': '#ffffff',
                '--accent-color': '#888888'
            },
            sunset: {
                '--bg-color': '#2a0a1a',
                '--primary-color': '#ffb000',
                '--accent-color': '#ff5e00'
            }
        };

        container.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const themeKey = e.target.dataset.theme;
                const theme = themes[themeKey];
                const root = document.documentElement;

                for (const [key, val] of Object.entries(theme)) {
                    root.style.setProperty(key, val);
                }
            });
        });
    }

    window.GATP.modules.settings = init;
})();
