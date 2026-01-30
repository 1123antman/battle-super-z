// Main Logic (Non-Module)

// Ensure namespace exists (loaded from setup.js)
window.GATP = window.GATP || { modules: {} };

const routes = {
    home: { title: 'Home', render: renderHome },
    canvas: { title: '2D Art', render: (c) => renderModule('canvas', c) },
    p5: { title: 'p5.js Art', render: (c) => renderModule('p5', c) },
    three: { title: '3D Art', render: (c) => renderModule('three', c) },
    wasm: { title: 'WASM Fractal', render: (c) => renderModule('wasm', c) },
    interactive: { title: 'Interactive', render: (c) => renderModule('interactive', c) },
    settings: { title: 'Settings', render: (c) => renderModule('settings', c) },
};

let currentRoute = 'home';

function init() {
    setupNavigation();
    navigate('home');
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.main-nav button');
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.dataset.target;
            if (target) navigate(target);
        });
    });
}

function navigate(target) {
    if (!routes[target]) return;

    currentRoute = target;

    // Update active state in nav
    document.querySelectorAll('.main-nav button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === target);
    });

    // Handle Content
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '';

    if (target === 'home') {
        renderHome(contentArea);
    } else {
        const container = document.createElement('div');
        container.className = 'canvas-container';
        container.id = `art-container-${target}`;
        contentArea.appendChild(container);

        routes[target].render(container);
    }
}

function renderHome(container) {
    container.innerHTML = `
    <section id="home" class="page active" style="display:block; height:100%;">
          <div class="hero">
            <h1>Welcome to the Algorithm.</h1>
            <p>Code becomes Art. Logic becomes Emotion.</p>
            <div class="explore-btn-container">
                <button class="explore-btn" onclick="document.querySelector('[data-target=\\'canvas\\']').click()">Explore Now</button>
            </div>
          </div>
        </section>
    `;
}

function renderModule(moduleName, container) {
    if (window.GATP.modules[moduleName]) {
        window.GATP.modules[moduleName](container);
    } else {
        container.innerHTML = `<p>Error: Module '${moduleName}' not loaded.</p>`;
    }
}

// Start
document.addEventListener('DOMContentLoaded', init);
