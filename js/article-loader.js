let currentAudio = null;
let currentSlug = '';
let playingSentenceId = null;
let allBlocks = [];
let articleGlossary = [];
let currentModalIndex = -1;

async function loadArticle() {
    const { mode, slug } = parseUrl();
    currentSlug = slug;

    // Set language mode class
    document.body.classList.add(`mode-${mode}`);

    if (!slug) {
        document.getElementById('app').innerHTML = '<div class="error">Article not found.</div>';
        return;
    }

    try {
        const [articleRes, transRes, glossaryRes] = await Promise.all([
            fetch(`/data/articles/${slug}.json`),
            fetch(`/data/articles/${slug}.translation.ja.json`),
            fetch(`/data/articles/${slug}.glossary.ja.json`)
        ]);

        const article = await articleRes.json();
        const translation = await transRes.json();
        const glossaryData = await glossaryRes.json();

        allBlocks = article.blocks;
        articleGlossary = glossaryData.glossary || [];

        renderArticle(article, translation.translations);
        renderGlossary(articleGlossary);
        setupAudio(allBlocks);
    } catch (error) {
        console.error('Error loading article:', error);
        document.getElementById('app').innerHTML = '<div class="error">Error loading article content.</div>';
    }
}

function parseUrl() {
    const path = window.location.pathname;
    // Match /:mode/articles/:slug or /articles/:slug
    // Modes: en-ja, en, ja, en-vn
    const match = path.match(/^\/?(?:(en|ja|en-ja|en-vn)\/)?articles\/([^/]+)/);
    if (match) {
        return {
            mode: match[1] || 'en', // Default to 'en' (Immersion) if no mode present
            slug: match[2]
        };
    }

    // Fallback for legacy or direct file access
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    if (slug) {
        return { mode: 'en-ja', slug };
    }

    return { mode: null, slug: null };
}

function renderArticle(article, translations) {
    const app = document.getElementById('app');
    let html = '';

    article.blocks.forEach((block, index) => {
        if (block.type === 'title') {
            html += `
                <header>
                    ${article.meta && article.meta.image ? `
                        <div class="featured-image-container" style="--bg-image: url('/${article.meta.image}')">
                            <img src="/${article.meta.image}" alt="${block.text}" class="featured-image">
                        </div>
                    ` : ''}
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
                <span class="sentence" data-id="${block.id}" onclick="openModal(${index})">
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
        const escapedWord = entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b(${escapedWord})\\b`, 'gi');
        decoratedText = decoratedText.replace(regex, `<span class="glossary-link" onclick="event.stopPropagation(); selectGlossaryWord('$1')">$1</span>`);
    });
    document.getElementById('modal-english').innerHTML = decoratedText;

    // Cache and set initial translation
    const sentenceEl = document.querySelector(`.sentence[data-id="${sentenceId}"]`);
    const translationOverlay = sentenceEl.querySelector('.translation-overlay');
    currentSentenceTranslation = translationOverlay ? translationOverlay.innerText : '';
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

loadArticle();
