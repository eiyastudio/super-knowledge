let currentAudio = null;
let currentSlug = '';
let playingSentenceId = null;
let allBlocks = [];
let articleGlossary = [];
let currentModalIndex = -1;

async function loadArticle() {
    let { mode, category, slug } = parseUrl();

    // Handle legacy URLs where category is missing: /articles/:slug
    if (!slug && category) {
        // e.g. /articles/the-fool -> category='the-fool', slug=undefined
        slug = category;
        category = '';
    }

    // Set language mode class
    document.body.classList.add(`mode-${mode}`);
    renderLanguageSwitcher(mode, slug, category); // Updated signature

    if (!slug) {
        document.getElementById('app').innerHTML = '<div class="error">Article not found.</div>';
        return;
    }

    // If category is missing, try to resolve it from the index
    if (!category) {
        try {
            const indexRes = await fetch('/data/articles-index.json');
            if (indexRes.ok) {
                const index = await indexRes.json();
                const found = index.find(a => a.slug === slug);
                if (found) category = found.category;
            }
        } catch (e) {
            console.warn('Failed to load index for category resolution', e);
        }
    }

    currentSlug = slug;

    // Construct path: if category found, use it. Else assume root (legacy backup) or fail.
    const pathPrefix = category ? `/data/articles/${category}/${slug}` : `/data/articles/${slug}`;

    try {
        const [articleRes, transRes, glossaryRes] = await Promise.all([
            fetch(`${pathPrefix}.json`),
            fetch(`${pathPrefix}.translation.ja.json`),
            fetch(`${pathPrefix}.glossary.ja.json`)
        ]);

        if (!articleRes.ok) throw new Error('Article not found');

        const article = await articleRes.json();

        let translationsMap = {};
        if (transRes.ok) {
            try {
                const translation = await transRes.json();
                // Support both { translations: { ... } } and flat { "0": "..." } formats
                translationsMap = translation.translations || translation || {};
            } catch (e) {
                console.warn('Failed to parse translation JSON', e);
            }
        }

        let glossaryList = [];
        if (glossaryRes.ok) {
            try {
                const glossaryData = await glossaryRes.json();
                // Support both { glossary: [...] } and flat [...] formats
                glossaryList = Array.isArray(glossaryData) ? glossaryData : (glossaryData.glossary || []);
            } catch (e) {
                console.warn('Failed to parse glossary JSON', e);
            }
        }

        allBlocks = article.blocks;
        articleGlossary = glossaryList;

        renderArticle(article, translationsMap, mode);
        renderGlossary(articleGlossary);
        setupAudio(allBlocks);
    } catch (error) {
        console.error('Error loading article:', error);
        document.getElementById('app').innerHTML = `<div class="error">Error loading article content.<br><small>${error.message}</small></div>`;
    }
}

function parseUrl() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(p => p);

    // Expected: [mode, 'articles', category, slug]  OR [mode, 'articles', slug]
    // Or: ['articles', slug]

    let mode = 'en'; // default
    let category = '';
    let slug = '';

    const modeCandidates = ['en', 'ja', 'en-ja', 'en-vn'];
    let startIndex = 0;

    if (modeCandidates.includes(parts[0])) {
        mode = parts[0];
        startIndex = 1;
    }

    if (parts[startIndex] === 'articles') {
        const remaining = parts.slice(startIndex + 1);
        if (remaining.length === 2) {
            category = remaining[0];
            slug = remaining[1];
        } else if (remaining.length === 1) {
            // Ambiguous: could be category/index (future) or just slug
            // For now assume it is slug (legacy URL)
            slug = remaining[0];
        }
    }

    return { mode, category, slug };
}

function renderArticle(article, translations, mode) {
    const app = document.getElementById('app');
    let html = '';

    article.blocks.forEach((block, index) => {
        if (block.type === 'title') {
            const trans = translations[block.id] || '';
            html += `
                <header>
                    ${article.meta && article.meta.image ? `
                        <div class="featured-image-container" style="--bg-image: url('/${article.meta.image}')">
                            <img src="/${article.meta.image}" alt="${block.text}" class="featured-image">
                        </div>
                    ` : ''}
                    <h1>
                        <span class="en-text">${block.text}</span>
                        ${trans ? `<span class="translation-overlay">${trans}</span>` : ''}
                    </h1>
                    <div class="controls">
                        <button id="play-all" class="btn-play">
                            <span class="icon">▶</span> Play Article
                        </button>
                    </div>
                </header>
                <div class="article-content">`;
        } else if (block.type === 'heading') {
            const trans = translations[block.id] || '';
            html += `
                <h2 data-id="${block.id}">
                    <span class="en-text">${block.text}</span>
                    ${trans ? `<span class="translation-overlay">${trans}</span>` : ''}
                </h2>`;
        } else if (block.type === 'sentence') {
            const trans = translations[block.id] || '';
            const onClickAttr = mode === 'ja' ? '' : `onclick="openModal(${index})"`;
            html += `
                <span class="sentence" data-id="${block.id}" ${onClickAttr}>
                    <span class="en-text">${block.text}</span>
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

    const audioUrl = `/audio/${currentSlug}/${id}.mp3`;
    currentAudio = new Audio(audioUrl);
    playingSentenceId = id;

    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) el.classList.add('playing');

    const modalPlayBtn = document.getElementById('modal-play-pause');
    if (modalPlayBtn) modalPlayBtn.innerHTML = '<span class="icon">⏸</span> Pause';

    currentAudio.play().catch(err => console.error('Audio play failed:', err));

    currentAudio.onended = () => {
        if (el) el.classList.remove('playing');
        playingSentenceId = null;

        currentRepetition++;

        if (currentRepetition < repeatCount) {
            // Repeat the same sentence
            setTimeout(() => {
                // Check if still in modal/same sentence to avoid ghost play
                if (document.getElementById('study-modal').style.display === 'flex') {
                    playSentence(id, true); // Pass true to indicate it's a repetition
                }
            }, 600);
        } else {
            // Repetitions finished
            if (modalPlayBtn) modalPlayBtn.innerHTML = '<span class="icon">▶</span> Play Again';

            if (isAutoMode) {
                setTimeout(() => {
                    if (isAutoMode) nextSentence();
                }, 1000); // Natural pause between sentences
            }
        }
    };
}

// Overload playSentence to support repetition tracking
const originalPlaySentence = playSentence;
playSentence = function (id, isRepetition = false) {
    if (!isRepetition) currentRepetition = 0;
    return originalPlaySentence(id);
};

function playSequence(blocks, index) {
    if (index >= blocks.length) {
        document.getElementById('play-all').innerHTML = '<span class="icon">▶</span> Play Article';
        return;
    }

    const block = blocks[index];
    const playAllBtn = document.getElementById('play-all');
    playAllBtn.innerHTML = '<span class="icon">⏸</span> Pause Article';

    const audioUrl = `/audio/${currentSlug}/${block.id}.mp3`;
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

    if (!glossary || !Array.isArray(glossary) || glossary.length === 0) return;

    glossarySection.style.display = 'block';
    glossaryList.innerHTML = generateGlossaryHTML(glossary);
}

function generateGlossaryHTML(glossary) {
    if (!glossary || glossary.length === 0) return '';

    return glossary.map(entry => {
        const wordSlug = entry.word.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-$/, '');
        return `
            <div class="glossary-item">
                <div class="glossary-term-container">
                    <div class="glossary-word-group">
                        <span class="glossary-word" onclick="playGlossaryWord('${wordSlug}')">${entry.word}</span>
                        <button class="btn-jump" onclick="event.stopPropagation(); jumpToSentence(${entry.sentenceId})" title="Jump to sentence">↗</button>
                    </div>
                </div>
                <div class="glossary-definition">
                    <span class="short-definition">${entry.definition}</span>
                    <p class="explanation">${entry.explanation}</p>
                </div>
            </div>
        `;
    }).join('');
}

function jumpToSentence(id) {
    const index = allBlocks.findIndex(b => b.id === id);
    if (index !== -1) {
        openModal(index);
    }
}

async function playGlossaryWord(wordSlug) {
    if (currentAudio) {
        currentAudio.pause();
    }
    const audioUrl = `/audio/${currentSlug}/glossary/${wordSlug}.mp3`;
    currentAudio = new Audio(audioUrl);
    currentAudio.play().catch(err => console.error('Glossary audio failed:', err));
}

// Modal Logic
let currentSentenceTranslation = '';
let isAutoMode = false;
let repeatCount = 1;
let currentRepetition = 0;

function toggleRepeatMode() {
    repeatCount = (repeatCount % 3) + 1;
    const btn = document.getElementById('modal-repeat-toggle');
    if (btn) {
        btn.innerText = `Repeat: ${repeatCount}x`;
    }
}

function toggleAutoMode() {
    isAutoMode = !isAutoMode;
    const btn = document.getElementById('modal-auto-toggle');
    if (btn) {
        btn.classList.toggle('active', isAutoMode);
        btn.innerText = `Auto Mode: ${isAutoMode ? 'ON' : 'OFF'}`;
    }
    // If auto mode turned on and nothing is playing, start playing
    if (isAutoMode && (!currentAudio || currentAudio.paused)) {
        currentRepetition = 0; // Reset for a clean start
        playSentence(allBlocks[currentModalIndex].id);
    }
}

function openModal(index) {
    currentModalIndex = index;
    const modal = document.getElementById('study-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    updateModalContent();
    playSentence(allBlocks[index].id);
}

function closeModal() {
    const modal = document.getElementById('study-modal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
    if (currentAudio) currentAudio.pause();

    // Stop auto mode
    isAutoMode = false;
    const btn = document.getElementById('modal-auto-toggle');
    if (btn) {
        btn.classList.remove('active');
        btn.innerText = 'Auto Mode: OFF';
    }
}

function updateModalContent() {
    const block = allBlocks[currentModalIndex];
    if (!block || block.type !== 'sentence') return;

    const sentenceId = block.id;
    const rawText = block.text;

    // Filter relevant glossary for this sentence (Flat Schema v2)
    const relevantGlossary = articleGlossary.filter(entry => entry.sentenceId === sentenceId);

    // Decorate English sentence with interactive links
    let decoratedText = rawText;
    relevantGlossary.forEach(entry => {
        const matchTerm = entry.textMatch || entry.word;
        const escapedWord = matchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b(${escapedWord})\\b`, 'gi');
        decoratedText = decoratedText.replace(regex, (match) => {
            const safeWord = entry.word.replace(/'/g, "\\'");
            return `<span class="glossary-link" onclick="event.stopPropagation(); selectGlossaryWord('${safeWord}')">${match}</span>`;
        });
    });
    document.getElementById('modal-english').innerHTML = decoratedText;

    // Cache and set initial translation
    const sentenceEl = document.querySelector(`.sentence[data-id="${sentenceId}"]`);
    const translationOverlay = sentenceEl.querySelector('.translation-overlay');
    currentSentenceTranslation = translationOverlay ? translationOverlay.textContent.trim() : ''; // Use textContent to get text even if hidden
    resetToTranslation();

    // Play button
    const playBtn = document.getElementById('modal-play-pause');
    playBtn.onclick = () => {
        if (currentAudio && !currentAudio.paused) {
            currentAudio.pause();
            playBtn.innerHTML = '<span class="icon">▶</span> Play';
        } else {
            playSentence(sentenceId);
            playBtn.innerHTML = '<span class="icon">⏸</span> Pause';
        }
    };

    updateNavArrows();
}

function updateNavArrows() {
    // Check for previous sentence
    let hasPrev = false;
    let i = currentModalIndex - 1;
    while (i >= 0) {
        if (allBlocks[i].type === 'sentence') {
            hasPrev = true;
            break;
        }
        i--;
    }

    // Check for next sentence
    let hasNext = false;
    let j = currentModalIndex + 1;
    while (j < allBlocks.length) {
        if (allBlocks[j].type === 'sentence') {
            hasNext = true;
            break;
        }
        j++;
    }

    const prevBtn = document.querySelector('.nav-prev');
    const nextBtn = document.querySelector('.nav-next');

    if (prevBtn) prevBtn.style.visibility = hasPrev ? 'visible' : 'hidden';
    if (nextBtn) nextBtn.style.visibility = hasNext ? 'visible' : 'hidden';
}

function resetToTranslation() {
    document.querySelectorAll('.glossary-link').forEach(el => el.classList.remove('active'));
    const infoContent = document.getElementById('modal-info-content');
    if (infoContent) {
        infoContent.innerHTML = `<div class="modal-text-ja">${currentSentenceTranslation}</div>`;
    }
}

function selectGlossaryWord(word) {
    // Highlight active link
    document.querySelectorAll('.glossary-link').forEach(el => {
        el.classList.toggle('active', el.innerText.toLowerCase() === word.toLowerCase());
    });

    const entry = articleGlossary.find(e =>
        e.word.toLowerCase() === word.toLowerCase() && e.sentenceId === allBlocks[currentModalIndex].id
    );

    if (entry) {
        const wordSlug = word.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-$/, '');
        const infoContent = document.getElementById('modal-info-content');

        if (infoContent) {
            infoContent.innerHTML = `
                <div class="glossary-detail-card">
                    <div class="glossary-detail-header">
                        <div class="glossary-detail-title-group">
                            <div class="glossary-detail-title">${word}</div>
                            <div class="glossary-detail-definition">${entry.definition}</div>
                        </div>
                        <button class="btn-play" onclick="playGlossaryWord('${wordSlug}')" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                            <span class="icon">🔊</span> Listen
                        </button>
                    </div>
                    <div class="glossary-detail-explanation">${entry.explanation}</div>
                    <button class="btn-back-translation" onclick="resetToTranslation()">← Back to translation</button>
                </div>
            `;
        }
    }
}

function nextSentence() {
    let nextIndex = currentModalIndex + 1;
    while (nextIndex < allBlocks.length && allBlocks[nextIndex].type !== 'sentence') {
        nextIndex++;
    }
    if (nextIndex < allBlocks.length) {
        currentModalIndex = nextIndex;
        updateModalContent();
        playSentence(allBlocks[currentModalIndex].id);
    }
}

function prevSentence() {
    let prevIndex = currentModalIndex - 1;
    while (prevIndex >= 0 && allBlocks[prevIndex].type !== 'sentence') {
        prevIndex--;
    }
    if (prevIndex >= 0) {
        currentModalIndex = prevIndex;
        updateModalContent();
        playSentence(allBlocks[currentModalIndex].id);
    }
}

// Global exposure
window.openModal = openModal;
window.closeModal = closeModal;
window.nextSentence = nextSentence;
window.prevSentence = prevSentence;
window.playSentence = playSentence;
window.jumpToSentence = jumpToSentence;
window.playGlossaryWord = playGlossaryWord;
window.selectGlossaryWord = selectGlossaryWord;
window.resetToTranslation = resetToTranslation;
window.toggleAutoMode = toggleAutoMode;
window.toggleRepeatMode = toggleRepeatMode;

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('study-modal');
    if (modal && modal.style.display === 'flex') {
        if (e.key === 'ArrowRight') nextSentence();
        if (e.key === 'ArrowLeft') prevSentence();
        if (e.key === 'Escape') closeModal();
        if (e.key === ' ') {
            e.preventDefault();
            document.getElementById('modal-play-pause').click();
        }
    }
});



function renderLanguageSwitcher(currentMode, slug) {
    const container = document.getElementById('lang-switcher');
    if (!container) return;

    const modes = [
        { id: 'en', label: 'English' },
        { id: 'en-ja', label: '英語学習 (Dual)' },
        { id: 'ja', label: '日本語' }
    ];

    const currentModeObj = modes.find(m => m.id === currentMode) || modes[1]; // default en-ja

    container.innerHTML = `
        <div class="lang-dropdown">
            <button class="lang-btn-trigger" id="lang-btn">
                ${currentModeObj.label} <span style="font-size: 0.8em; opacity: 0.7;">▼</span>
            </button>
            <div class="lang-menu" id="lang-menu">
                ${modes.map(m => {
        // Force slug relative path for correctness? 
        // No, absolute path with mode prefix is safer.
        // Special handling: if we rely on vite rewrites, /ja/articles/slug works.
        // But standard link is /en-ja/articles/slug.
        // Let's use the explicit prefixes.
        let prefix = m.id === 'en-ja' ? '/en-ja' : ('/' + m.id);
        // Actually wait, en-ja mode path is /en-ja/articles/...
        // en mode path is /en/articles/...
        // ja mode path is /ja/articles/...

        const href = `/${m.id}/articles/${slug}`;
        return `<a href="${href}" class="lang-option ${m.id === currentMode ? 'active' : ''}">${m.label}</a>`;
    }).join('')}
            </div>
        </div>
    `;

    // Dropdown Interactivity
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

    // Update Home Link
    const homeLink = document.getElementById('home-link');
    if (homeLink) {
        let homeHref = '/';
        if (currentMode === 'ja') homeHref = '/ja/';
        if (currentMode === 'en') homeHref = '/en/';
        // en-ja goes to root /
        homeLink.setAttribute('href', homeHref);
    }
}

loadArticle();
