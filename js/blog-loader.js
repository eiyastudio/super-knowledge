
const SERVICE_DOMAIN = import.meta.env.VITE_MICROCMS_SERVICE_DOMAIN;
const API_KEY = import.meta.env.VITE_MICROCMS_API_KEY;
const ENDPOINT = import.meta.env.VITE_MICROCMS_ENDPOINT;

const container = document.getElementById('blog-container');

async function init() {
    if (!SERVICE_DOMAIN || !API_KEY || !ENDPOINT || SERVICE_DOMAIN.includes('YOUR_')) {
        renderError('Configuration missing. Please set VITE_MICROCMS_SERVICE_DOMAIN, VITE_MICROCMS_API_KEY, and VITE_MICROCMS_ENDPOINT in your .env file.');
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (id) {
        await loadDetail(id);
    } else {
        await loadList();
    }
}

async function fetchMicroCMS(path) {
    const url = `https://${SERVICE_DOMAIN}.microcms.io/api/v1/${ENDPOINT}${path}`;
    const headers = { 'X-MICROCMS-API-KEY': API_KEY };
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return res.json();
}

async function loadList() {
    try {
        const data = await fetchMicroCMS('');
        const contents = data.contents || [];

        if (contents.length === 0) {
            container.innerHTML = '<p>No blog posts found.</p>';
            return;
        }

        const html = `
            <h2 class="main-section-title">Latest Posts</h2>
            <div class="article-grid">
                ${contents.map(post => `
                    <a href="/blog.html?id=${post.id}" class="article-card">
                        <div class="card-thumb-container">
                            ${post.thumbnail ? `<img src="${post.thumbnail.url}" class="card-thumbnail" alt="${post.title}">` : '<div style="width:100%;height:100%;background:#333;"></div>'}
                        </div>
                        <h3>${post.title}</h3>
                        <p>${post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}</p>
                    </a>
                `).join('')}
            </div>
        `;
        container.innerHTML = html;
    } catch (e) {
        renderError(e.message);
    }
}

async function loadDetail(id) {
    try {
        const post = await fetchMicroCMS(`/${id}`);

        container.innerHTML = `
            <article class="blog-post">
                ${post.thumbnail ? `<img src="${post.thumbnail.url}" style="width:100%; max-height:400px; object-fit:cover; border-radius:12px; margin-bottom:2rem;" alt="${post.title}">` : ''}
                <h1 style="font-size: 2.5rem; margin-bottom: 1rem;">${post.title}</h1>
                <div class="text-muted" style="margin-bottom: 2rem;">${new Date(post.publishedAt).toLocaleDateString()}</div>
                <div class="article-content">
                    ${post.content || post.body || ''} 
                </div>
            </article>
        `;
    } catch (e) {
        renderError(e.message);
    }
}

function renderError(msg) {
    container.innerHTML = `<div class="error" style="color: #ff6b6b; padding: 2rem; border: 1px solid #ff6b6b; border-radius: 8px;">Error: ${msg}</div>`;
}

init();
