
async function initCategoryPage() {
    const { mode, category } = parseUrl();

    // Set Body Class
    document.body.classList.add(`mode-${mode}`);

    // Render Language Switcher
    renderLanguageSwitcher(mode, category);

    // Update Header
    updateHeader(category, mode);

    // Fetch and Render Articles
    try {
        const res = await fetch('/data/articles-index.json');
        if (!res.ok) throw new Error('Failed to load index');
        const articles = await res.json();

        // Filter by category
        const filtered = articles.filter(a => a.category === category);
        renderGrid(filtered, mode);
    } catch (e) {
        console.error(e);
        document.getElementById('article-grid').innerHTML = '<div class="error">Failed to load articles.</div>';
    }
}

function parseUrl() {
    const path = window.location.pathname;
    // Expected: /:mode/articles/:category
    const parts = path.split('/').filter(p => p);
    // parts[0] = mode (en, ja, en-ja)
    // parts[1] = 'articles'
    // parts[2] = category

    // Handle root access or missing parts safely
    const mode = parts[0] || 'en-ja';
    const category = parts[2] || '';

    return { mode, category };
}

function updateHeader(category, mode) {
    const titleEl = document.getElementById('category-title');
    const descEl = document.getElementById('category-description');

    // Simple mapping for display purposes
    // In a real app, this could also come from a json file
    const catMap = {
        'tarot': {
            title: 'Tarot Arcana',
            descEn: 'Explore the archetypes of the Major Arcana.',
            descJa: '大アルカナの原型を探求する。'
        },
        'finance': {
            title: 'Finance & Skills',
            descEn: 'Master the language of business and value.',
            descJa: 'ビジネスと価値の言語を習得する。'
        },
        'science': {
            title: 'Science & Systems',
            descEn: 'Understand the mechanisms of the world.',
            descJa: '世界のメカニズムを理解する。'
        }
    };

    const info = catMap[category] || { title: category, descEn: '', descJa: '' };

    titleEl.textContent = info.title;
    descEl.innerHTML = `
        <span class="en-text">${info.descEn}</span>
        <span class="ja-text">${info.descJa}</span>
    `;

    // Also update dynamic home link to preserve mode
    const homeLink = document.getElementById('home-link');
    if (homeLink) {
        let homeHref = '/';
        if (mode === 'ja') homeHref = '/ja/';
        if (mode === 'en') homeHref = '/en/';
        homeLink.setAttribute('href', homeHref);
    }
}

function renderGrid(articles, mode) {
    const grid = document.getElementById('article-grid');
    if (articles.length === 0) {
        grid.innerHTML = '<p>No articles found in this category.</p>';
        return;
    }

    grid.innerHTML = articles.map(article => {
        // Construct Link
        // Articles are at /:mode/articles/:category/:slug
        const href = `/${mode}/articles/${article.category}/${article.slug}`;

        return `
        <a href="${href}" class="article-card">
            ${article.image ? `
            <div class="card-thumb-container">
                <img src="/${article.image}" alt="${article.title}" class="card-thumbnail">
            </div>` : ''}
            <h3>
                <span class="en-text">${article.title}</span>
                <span class="ja-text">${article.titleJa || article.title}</span>
            </h3>
            <p>
                <span class="en-text">${article.summary}</span>
                <span class="ja-text">${article.summaryJa || article.summary}</span>
            </p>
            <div class="card-tag">
                <span class="en-text">${article.tags[0] || ''}</span>
                <span class="ja-text">${article.tags[0] || ''}</span> <!-- Need tag translation map eventually -->
            </div>
        </a>
        `;
    }).join('');
}

function renderLanguageSwitcher(currentMode, category) {
    const container = document.getElementById('lang-switcher');
    if (!container) return;

    const modes = [
        { id: 'en', label: 'English' },
        { id: 'en-ja', label: '英語学習 (Dual)' },
        { id: 'ja', label: '日本語' }
    ];

    const currentModeObj = modes.find(m => m.id === currentMode) || modes[1];

    container.innerHTML = `
        <div class="lang-dropdown">
            <button class="lang-btn-trigger" id="lang-btn">
                ${currentModeObj.label} <span style="font-size: 0.8em; opacity: 0.7;">▼</span>
            </button>
            <div class="lang-menu" id="lang-menu">
                ${modes.map(m => {
        const href = `/${m.id}/articles/${category}`;
        return `<a href="${href}" class="lang-option ${m.id === currentMode ? 'active' : ''}">${m.label}</a>`;
    }).join('')}
            </div>
        </div>
    `;

    const btn = document.getElementById('lang-btn');
    const menu = document.getElementById('lang-menu');

    if (btn && menu) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');
        });
        document.addEventListener('click', () => {
            menu.classList.remove('show');
        });
    }
}

initCategoryPage();
