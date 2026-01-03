const API_URL = 'http://localhost:3001/api';

let currentStep = 1;
let currentSlug = '';
let currentData = null; // Article JSON
let currentTranslation = null;
let currentGlossary = null;
let chatHistory = [];

const steps = {
    1: { id: 'EN', prompt: 'SYSTEM_PROMPT_EN' },
    2: { id: 'JA', prompt: 'SYSTEM_PROMPT_JA' },
    3: { id: 'GLOSSARY', prompt: 'SYSTEM_PROMPT_GLOSSARY' }
};

const dom = {
    articleSelect: document.getElementById('article-select'),
    addRefBtn: document.getElementById('add-ref-btn'),
    selectedRefsList: document.getElementById('selected-refs-list'),
    chatHistory: document.getElementById('chat-history'),
    userInput: document.getElementById('user-input'),
    sendBtn: document.getElementById('send-btn'),
    contentContainer: document.getElementById('content-container'),
    approveBtn: document.getElementById('btn-approve'),
    saveBtn: document.getElementById('btn-save'),
    audioBtn: document.getElementById('btn-audio'),
    slugUI: document.getElementById('file-slug-ui'),
    steps: document.querySelectorAll('.step')
};

let selectedStyleReferences = [];

// Initialize
fetchArticles();

async function fetchArticles() {
    try {
        const res = await fetch(`${API_URL}/articles`);
        const slugs = await res.json();
        dom.articleSelect.innerHTML = '<option value="">Select Article...</option>' +
            slugs.map(slug => `<option value="${slug}">${slug}</option>`).join('');
    } catch (e) {
        console.error('Error loading articles:', e);
    }
}

dom.addRefBtn.onclick = () => {
    const slug = dom.articleSelect.value;
    if (slug && !selectedStyleReferences.includes(slug)) {
        selectedStyleReferences.push(slug);
        renderRefTags();
    }
};

function renderRefTags() {
    dom.selectedRefsList.innerHTML = selectedStyleReferences.map(slug => `
        <span style="background: var(--surface); padding: 0.2rem 0.6rem; border-radius: 1rem; font-size: 0.7rem; border: 1px solid var(--glass-border); display: flex; align-items: center; gap: 0.3rem;">
            ${slug}
            <span onclick="removeRef('${slug}')" style="cursor: pointer; color: var(--accent); font-weight: 800;">×</span>
        </span>
    `).join('');
}

window.removeRef = (slug) => {
    selectedStyleReferences = selectedStyleReferences.filter(s => s !== slug);
    renderRefTags();
};

dom.sendBtn.onclick = () => sendMessage();
dom.userInput.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

async function sendMessage(overrideText = null) {
    const text = overrideText || dom.userInput.value.trim();
    if (!text) return;

    // Show initial user message in chat
    addChatBubble('user', text);
    if (!overrideText) dom.userInput.value = '';

    let contextualMessage = text;

    // If it's the first message, fetch and include style references
    if (chatHistory.length === 0) {
        let referenceContext = '';
        if (selectedStyleReferences.length > 0) {
            try {
                const res = await fetch(`${API_URL}/article-data`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ slugs: selectedStyleReferences })
                });
                const refData = await res.json();
                referenceContext = "\n\n### STYLE REFERENCES (Emulate this structure and tone):\n" +
                    refData.map(d => `--- ARTICLE: ${d.slug} ---\n${JSON.stringify(d.content, null, 2)}`).join('\n\n');
            } catch (e) {
                console.error('Failed to fetch reference context:', e);
            }
        }

        contextualMessage = `New Article Subject: ${text}${referenceContext}\n\nTask: Propose a Title and Slug, then generate the English content. Follow the style of the references provided above.`;
    }

    try {
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: contextualMessage,
                history: chatHistory,
                // On server side we'll pick the real one, but we pass hints
                systemPrompt: `Phase: ${steps[currentStep].id}`
            })
        });

        const data = await response.json();
        if (data.error) {
            addChatBubble('ai', 'API Error: ' + data.error);
            return;
        }

        addChatBubble('ai', data.text);
        chatHistory.push({ role: 'user', parts: [{ text }] });
        chatHistory.push({ role: 'model', parts: [{ text: data.text }] });

        updatePreview(data.text);
    } catch (error) {
        console.error('Chat error:', error);
        addChatBubble('ai', 'Error: Could not connect to the server.');
    }
}

function addChatBubble(role, text) {
    const div = document.createElement('div');
    div.className = `chat-bubble ${role}`;
    div.innerText = text;
    dom.chatHistory.appendChild(div);
    dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;
}

function updatePreview(text) {
    if (currentStep === 1) {
        // Try to identify slug if AI proposed it
        const slugMatch = text.match(/Slug:\s*([a-z0-9-]+)/i);
        if (slugMatch) {
            currentSlug = slugMatch[1].toLowerCase();
            dom.slugUI.innerText = `Slug: ${currentSlug}`;
        }

        const blocks = parseMarkdownToBlocks(text);
        currentData = { slug: currentSlug, meta: { language: 'en-US', version: 1, tags: ['tarot'] }, blocks };
        dom.contentContainer.innerHTML = renderJSON(currentData);
        dom.approveBtn.style.display = 'block';
    } else if (currentStep === 2) {
        try {
            const json = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
            currentTranslation = { language: 'ja-JP', translations: json };
            dom.contentContainer.innerHTML = renderJSON(currentTranslation);
            dom.approveBtn.style.display = 'block';
        } catch (e) {
            dom.contentContainer.innerHTML = `<p>Error parsing JSON translation. Please check the AI output.</p><pre>${text}</pre>`;
        }
    } else if (currentStep === 3) {
        try {
            const json = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
            currentGlossary = { language: 'ja-JP', target: 'english-learners', ...json };
            dom.contentContainer.innerHTML = renderJSON(currentGlossary);
            dom.saveBtn.style.display = 'block';
        } catch (e) {
            dom.contentContainer.innerHTML = `<p>Error parsing Glossary JSON.</p><pre>${text}</pre>`;
        }
    }
}

function parseMarkdownToBlocks(md) {
    const lines = md.split('\n');
    const blocks = [];
    let idCounter = 0;

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        if (line.startsWith('# ')) {
            blocks.push({ id: idCounter++, type: 'title', text: line.replace('# ', '') });
        } else if (line.startsWith('## ') || line.startsWith('### ')) {
            blocks.push({ id: idCounter++, type: 'heading', text: line.replace(/#+ /, '') });
        } else {
            // Split sentences roughly
            const sentences = line.match(/[^.!?]+[.!?]+/g) || [line];
            sentences.forEach((s, idx) => {
                blocks.push({
                    id: idCounter++,
                    type: 'sentence',
                    text: s.trim(),
                    paragraph_end: idx === sentences.length - 1
                });
            });
        }
    });
    return blocks;
}

function renderJSON(obj) {
    return `<pre class="json-preview">${JSON.stringify(obj, null, 2)}</pre>`;
}

dom.approveBtn.onclick = () => {
    if (currentStep === 1) {
        currentStep = 2;
        addChatBubble('ai', 'English approved! Now generating/refining the Japanese translation...');
    } else if (currentStep === 2) {
        currentStep = 3;
        addChatBubble('ai', 'Translation approved! Now generating the glossary...');
    }
    dom.approveBtn.style.display = 'none';
    updateStepUI();
};

function updateStepUI() {
    dom.steps.forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.step) === currentStep);
    });
}

dom.saveBtn.onclick = async () => {
    try {
        await save('content', currentData);
        await save('translation', currentTranslation);
        await save('glossary', currentGlossary);
        addChatBubble('ai', 'All files saved to disk! You can now generate audio.');
        dom.audioBtn.style.display = 'block';
    } catch (e) {
        addChatBubble('ai', 'Save failed: ' + e.message);
    }
};

async function save(type, data) {
    const res = await fetch(`${API_URL}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: currentSlug, data, type })
    });
    if (!res.ok) throw new Error('Save failed for ' + type);
}

dom.audioBtn.onclick = async () => {
    addChatBubble('ai', 'Starting audio generation... this may take a minute.');
    try {
        const res = await fetch(`${API_URL}/generate-audio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: currentSlug })
        });
        const data = await res.ok ? await res.json() : { error: 'Unknown error' };
        if (data.success) {
            addChatBubble('ai', 'Audio generation complete! The article is now fully ready.');
        } else {
            addChatBubble('ai', 'Audio Error: ' + data.error);
        }
    } catch (e) {
        addChatBubble('ai', 'Audio Error: ' + e.message);
    }
};
