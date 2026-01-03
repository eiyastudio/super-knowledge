let currentAudio = null;
let currentSlug = '';
let playingSentenceId = null;

async function loadArticle() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    currentSlug = slug;
    if (!slug) {
        document.getElementById('app').innerHTML = '<div class="error">Article not found.</div>';
        return;
    }

    try {
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
        setupAudio(article.blocks);
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
            html += `
                <header>
                    <h1>${block.text}</h1>
                    <div class="controls">
                        <button id="play-all" class="btn-play">
                            <span class="icon">▶</span> Play Article
                        </button>
                    </div>
                </header>
                <div class="article-content">`;
        } else if (block.type === 'heading') {
            html += `<h2 data-id="${block.id}">${block.text}</h2>`;
        } else if (block.type === 'sentence') {
            const trans = translations[block.id] || '';
            html += `
                <span class="sentence" data-id="${block.id}" onclick="playSentence(${block.id})">
                    ${block.text}
                    ${trans ? `<span class="translation-overlay">${trans}</span>` : ''}
                </span> `;
            if (block.line_break) {
                html += '<br>';
            }
            if (block.paragraph_end) {
                html += '<div class="paragraph"></div>';
            }
        }
    });

    html += '</div>';
    app.innerHTML = html;
}

function setupAudio(blocks) {
    const playAllBtn = document.getElementById('play-all');
    if (!playAllBtn) return;

    const playableBlocks = blocks.filter(b => b.type === 'sentence' || b.type === 'heading' || b.type === 'title');
    let currentIndex = 0;

    playAllBtn.onclick = () => {
        if (currentAudio && !currentAudio.paused) {
            currentAudio.pause();
            playAllBtn.innerHTML = '<span class="icon">▶</span> Resume Article';
        } else if (currentAudio && currentAudio.paused && playingSentenceId !== null) {
            currentAudio.play();
            playAllBtn.innerHTML = '<span class="icon">⏸</span> Pause Article';
        } else {
            playSequence(playableBlocks, 0);
        }
    };
}

async function playSentence(id) {
    if (currentAudio) {
        currentAudio.pause();
        document.querySelectorAll('.sentence, h2').forEach(el => el.classList.remove('playing'));
    }

    const audioUrl = `audio/${currentSlug}/${id}.mp3`;
    currentAudio = new Audio(audioUrl);
    playingSentenceId = id;

    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) el.classList.add('playing');

    currentAudio.play().catch(err => console.error('Audio play failed:', err));

    currentAudio.onended = () => {
        if (el) el.classList.remove('playing');
        playingSentenceId = null;
    };
}

function playSequence(blocks, index) {
    if (index >= blocks.length) {
        document.getElementById('play-all').innerHTML = '<span class="icon">▶</span> Play Article';
        return;
    }

    const block = blocks[index];
    const playAllBtn = document.getElementById('play-all');
    playAllBtn.innerHTML = '<span class="icon">⏸</span> Pause Article';

    const audioUrl = `audio/${currentSlug}/${block.id}.mp3`;
    currentAudio = new Audio(audioUrl);
    playingSentenceId = block.id;

    const el = document.querySelector(`[data-id="${block.id}"]`);
    document.querySelectorAll('.sentence, h2').forEach(e => e.classList.remove('playing'));
    if (el) {
        el.classList.add('playing');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    currentAudio.play().catch(err => {
        console.warn(`Audio missing for ${block.id}, skipping...`);
        playSequence(blocks, index + 1);
    });

    currentAudio.onended = () => {
        if (el) el.classList.remove('playing');
        playSequence(blocks, index + 1);
    };
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
