let currentAudio = null;
let currentSlug = '';
let playingSentenceId = null;
let allBlocks = [];
let articleGlossary = [];
let currentModalIndex = -1;

async function loadArticle() {
    let { mode, category, slug: urlSlug } = parseUrl();
    currentSlug = urlSlug;

    // Handle legacy URLs where category is missing: /articles/:slug
    if (!currentSlug && category) {
        currentSlug = category;
        category = '';
    }

    const slug = currentSlug; // local alias for rest of function

    document.body.classList.add(`mode-${mode}`);
    renderLanguageSwitcher(mode, slug, category);

    if (!slug) {
        document.getElementById('app').innerHTML = '<div class="error">Article not found.</div>';
        return;
    }

    // Try to resolve category if missing, or load category index if present
    let categoryIndex = null;
    let categoryData = null;

    // 1. If we have a category, try to load its index
    if (category) {
        try {
            const indexRes = await fetch(`/data/indices/${category}.json`);
            if (indexRes.ok) {
                categoryData = await indexRes.json();
                categoryIndex = categoryData.items;
            }
        } catch (e) {
            console.warn('Failed to load category index', e);
        }
    }
    // 2. If no category, try to find one by bruteforcing known indices? 
    // For now, let's assume we stick to the provided structure. 
    // If the user lands on /articles/the-fool without category, we might miss the nav.
    // Ideally, we'd have a global map. But let's proceed with what we have.

    // Construct path.
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
                translationsMap = translation.translations || translation || {};
            } catch (e) {
                console.warn('Failed to parse translation JSON', e);
            }
        }

        let glossaryList = [];
        if (glossaryRes.ok) {
            try {
                const glossaryData = await glossaryRes.json();
                glossaryList = Array.isArray(glossaryData) ? glossaryData : (glossaryData.glossary || []);
            } catch (e) {
                console.warn('Failed to parse glossary JSON', e);
            }
        }

        allBlocks = article.blocks;
        articleGlossary = glossaryList;

        // Render with new capabilities
        renderArticle(article, translationsMap, mode, category, categoryIndex, categoryData);
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

function renderArticle(article, translations, mode, category, categoryIndex, categoryData) {
    const app = document.getElementById('app');
    let html = '';

    article.blocks.forEach((block, index) => {
        if (block.type === 'title') {
            const trans = translations[block.id] || '';
            const onClickAttr = mode === 'ja' ? '' : `onclick="openModal(${index})"`;
            html += `
                <header>
                    ${article.meta && article.meta.image ? `
                        <div class="featured-image-container" style="--bg-image: url('/${article.meta.image}')">
                            <img src="/${article.meta.image}" alt="${block.text}" class="featured-image">
                        </div>
                    ` : ''}
                    <h1 data-id="${block.id}" ${onClickAttr} class="${mode !== 'ja' ? 'clickable' : ''}">
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
            const onClickAttr = mode === 'ja' ? '' : `onclick="openModal(${index})"`;
            html += `
                <h2 data-id="${block.id}" ${onClickAttr} class="${mode !== 'ja' ? 'clickable' : ''}">
                    <span class="en-text">${block.text}</span>
                    ${trans ? `<span class="translation-overlay">${trans}</span>` : ''}
                </h2>`;
        } else if (block.type === 'sentence') {
            const trans = translations[block.id] || '';
            const onClickAttr = mode === 'ja' ? '' : `onclick="openModal(${index})"`;

            // Process Inline Links
            let displayText = block.text;
            if (block.links && block.links.length > 0) {
                block.links.forEach(link => {
                    // Escape special regex chars
                    const esc = link.textMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(esc, 'g');
                    // If it's internal, construct local link. If external, normal href.
                    // Assuming internal usually:
                    // We need the category for the link. If we know the target is in the same category, use current 'category'.
                    // But we don't strictly know. For major arcana -> major arcana, yes.
                    // For now, assume same category if not specified or check index?
                    // Simplest: defaults to same category.
                    const targetCategory = category || 'tarot'; // fallback
                    const url = link.type === 'external'
                        ? link.slug
                        : `/${mode}/articles/${targetCategory}/${link.slug}`;

                    const anchor = `<a href="${url}" class="inline-link" onclick="event.stopPropagation()">${link.textMatch}</a>`;
                    displayText = displayText.replace(regex, anchor);
                });
            }

            html += `
                <span class="sentence" data-id="${block.id}" ${onClickAttr}>
                    <span class="en-text">${displayText}</span>
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

    // Related Articles Section
    if (article.meta.related && article.meta.related.length > 0) {
        html += `<div class="related-section">
            <h3>Related Articles</h3>
            <div class="related-grid">
                ${article.meta.related.map(slug => {
            // Try to find title in index, else prettify slug
            const item = categoryIndex ? categoryIndex.find(i => i.slug === slug) : null;
            const title = item ? item.title : slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const url = `/${mode}/articles/${category || 'tarot'}/${slug}`;
            return `<a href="${url}" class="related-card">${title}</a>`;
        }).join('')}
            </div>
        </div>`;
    }

    // Navigation Buttons (Next/Prev)
    if (categoryIndex && categoryIndex.length > 0) {
        const currentIndex = categoryIndex.findIndex(item => item.slug === article.slug);
        if (currentIndex !== -1) {
            const prevItem = currentIndex > 0 ? categoryIndex[currentIndex - 1] : null;
            const nextItem = currentIndex < categoryIndex.length - 1 ? categoryIndex[currentIndex + 1] : null;

            html += `<nav class="article-navigation">`;
            if (prevItem) {
                html += `<a href="/${mode}/articles/${category}/${prevItem.slug}" class="nav-btn prev">
                            <span class="nav-label">Previous</span>
                            <span class="nav-title">← ${prevItem.title}</span>
                         </a>`;
            } else {
                html += `<div class="nav-spacer"></div>`;
            }

            if (nextItem) {
                html += `<a href="/${mode}/articles/${category}/${nextItem.slug}" class="nav-btn next">
                            <span class="nav-label">Next</span>
                            <span class="nav-title">${nextItem.title} →</span>
                         </a>`;
            } else {
                html += `<div class="nav-spacer"></div>`;
            }
            html += `</nav>`;

            // Category List Table of Contents
            html += `
            <div class="category-index-section">
                <h3>In this Collection: ${categoryData?.category || category}</h3>
                <ul class="category-list">
                    ${categoryIndex.map(item => {
                const isCurrent = item.slug === article.slug;
                const itemUrl = `/${mode}/articles/${category}/${item.slug}`;
                return `
                        <li>
                            <a href="${itemUrl}" class="category-list-link ${isCurrent ? 'current' : ''}">
                                ${item.title}
                                ${isCurrent ? '<span class="current-indicator">(Current)</span>' : ''}
                            </a>
                        </li>`;
            }).join('')}
                </ul>
            </div>`;
        }
    }

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
    // Allow sentence, heading, and title
    if (!block || (block.type !== 'sentence' && block.type !== 'heading' && block.type !== 'title')) return;

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
    // Use generic selector to find element by data-id, handling sentences, h1, h2
    const sentenceEl = document.querySelector(`[data-id="${sentenceId}"]`);
    const translationOverlay = sentenceEl ? sentenceEl.querySelector('.translation-overlay') : null;
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
    const isPlayable = (b) => b.type === 'sentence' || b.type === 'heading' || b.type === 'title';

    // Check for previous sentence
    let hasPrev = false;
    let i = currentModalIndex - 1;
    while (i >= 0) {
        if (isPlayable(allBlocks[i])) {
            hasPrev = true;
            break;
        }
        i--;
    }

    // Check for next sentence
    let hasNext = false;
    let j = currentModalIndex + 1;
    while (j < allBlocks.length) {
        if (isPlayable(allBlocks[j])) {
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
    const isPlayable = (b) => b.type === 'sentence' || b.type === 'heading' || b.type === 'title';
    let nextIndex = currentModalIndex + 1;
    while (nextIndex < allBlocks.length && !isPlayable(allBlocks[nextIndex])) {
        nextIndex++;
    }
    if (nextIndex < allBlocks.length) {
        currentModalIndex = nextIndex;
        updateModalContent();
        playSentence(allBlocks[currentModalIndex].id);
    }
}

function prevSentence() {
    const isPlayable = (b) => b.type === 'sentence' || b.type === 'heading' || b.type === 'title';
    let prevIndex = currentModalIndex - 1;
    while (prevIndex >= 0 && !isPlayable(allBlocks[prevIndex])) {
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



function renderLanguageSwitcher(currentMode, slug, category) {
    const container = document.getElementById('lang-switcher');
    if (!container) return;

    // Configuration: Add new languages here
    const languages = [
        { code: 'en', label: 'English' },
        { code: 'ja', label: '日本語' }
        // Example: { code: 'vn', label: 'Vietnamese' }
    ];

    // Helper: Determine the "Base Language" (dropdown selection) from the current mode
    // en -> en
    // ja -> ja
    // en-ja -> ja (Dual mode belongs to the specific language context)
    const getBaseLangCode = (mode) => {
        if (mode === 'en') return 'en';
        if (mode.startsWith('en-')) return mode.split('-')[1];
        return mode;
    };

    const currentBaseLangCode = getBaseLangCode(currentMode);
    const currentLangObj = languages.find(l => l.code === currentBaseLangCode) || languages[0];

    // Build Dropdown
    const dropdownHtml = `
        <div class="lang-dropdown">
            <button class="lang-btn-trigger" id="lang-btn">
                ${currentLangObj.label} <span style="font-size: 0.8em; opacity: 0.7;">▼</span>
            </button>
            <div class="lang-menu" id="lang-menu">
                ${languages.map(l => {
        // Switching language in dropdown always resets to that language's base mode (Learning OFF)
        let href;
        if (category) {
            href = `/${l.code}/articles/${category}/${slug}`;
        } else {
            href = `/${l.code}/articles/${slug}`;
        }
        const isActive = l.code === currentBaseLangCode;
        return `<a href="${href}" class="lang-option ${isActive ? 'active' : ''}">${l.label}</a>`;
    }).join('')}
            </div>
        </div>
    `;

    // Build Learning Toggle (Visible for any non-English base language)
    let toggleHtml = '';
    // We assume any non-English language potentially supports "English Learning Mode" (en-{code})
    if (currentBaseLangCode !== 'en') {
        const isLearningMode = currentMode === `en-${currentBaseLangCode}`;
        const targetMode = isLearningMode ? currentBaseLangCode : `en-${currentBaseLangCode}`;

        let href;
        if (category) {
            href = `/${targetMode}/articles/${category}/${slug}`;
        } else {
            href = `/${targetMode}/articles/${slug}`;
        }

        toggleHtml = `
            <a href="${href}" class="btn-learning-toggle ${isLearningMode ? 'active' : ''}">
                <span class="toggle-icon">${isLearningMode ? '✓' : ''}</span>
                <span class="toggle-label">English Learning</span>
            </a>
        `;
    }

    container.innerHTML = `<div class="lang-switcher-group">${dropdownHtml}${toggleHtml}</div>`;

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
        if (currentBaseLangCode !== 'en') {
            homeHref = `/${currentBaseLangCode}/`; // e.g., /ja/, /vn/
        } else {
            homeHref = '/en/';
        }
        homeLink.setAttribute('href', homeHref);
    }
}

loadArticle();
