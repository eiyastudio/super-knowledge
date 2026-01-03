async function loadArticle() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    if (!slug) {
        document.getElementById('app').innerHTML = '<div class="error">Article not found.</div>';
        return;
    }

    try {
        // Fetch article, translation, and glossary data in parallel
        const [articleRes, transRes, glossaryRes] = await Promise.all([
            fetch(`data/articles/${slug}.json`),
            fetch(`data/articles/${slug}.translation.ja.json`),
            fetch(`data/articles/${slug}.glossary.ja.json`)
        ]);

        const article = await articleRes.json();
        const translation = await transRes.json();
        const glossaryData = await glossaryRes.json();

        renderArticle(article, translation.translations);
        renderGlossary(glossaryData.glossary);
    } catch (error) {
        console.error('Error loading article:', error);
        document.getElementById('app').innerHTML = '<div class="error">Error loading article content.</div>';
    }
}

function renderArticle(article, translations) {
    const app = document.getElementById('app');
    let html = '';

    article.blocks.forEach(block => {
        if (block.type === 'title') {
            html += `<header><h1>${block.text}</h1></header><div class="article-content">`;
        } else if (block.type === 'heading') {
            html += `<h2>${block.text}</h2>`;
        } else if (block.type === 'sentence') {
            const trans = translations[block.id] || '';
            html += `
                <span class="sentence" data-id="${block.id}">
                    ${block.text}
                    ${trans ? `<span class="translation-overlay">${trans}</span>` : ''}
                </span> `;
            if (block.paragraph_end) {
                html += '<div class="paragraph"></div>';
            }
        }
    });

    html += '</div>';
    app.innerHTML = html;
}

function renderGlossary(glossary) {
    const glossarySection = document.getElementById('glossary');
    const glossaryList = document.getElementById('glossary-list');
    
    if (!glossary || Object.keys(glossary).length === 0) return;

    glossarySection.style.display = 'block';
    let html = '';

    for (const [term, data] of Object.entries(glossary)) {
        html += `
            <div class="glossary-item">
                <span class="glossary-term">${term}</span>
                <div class="glossary-definition">${data.text}</div>
            </div>
        `;
    }

    glossaryList.innerHTML = html;
}

loadArticle();
