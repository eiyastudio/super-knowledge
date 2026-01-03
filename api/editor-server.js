const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

// --- LLM Prompts ---

const SYSTEM_PROMPT_EN = `You are a professional content creator. 
Your goal is to write a high-quality, philosophical article about Tarot in natural English.
Use Markdown (# for title, ## for headings). 

CRITICAL: Do NOT use JSON or any numbering for sentences. Write it as a natural, readable article. 
The style references provided are in JSON format, but you must output NATURAL English text only.`;

const SYSTEM_PROMPT_JA = `You are a professional translator and specialist in tarot/esoteric studies. 
Translate the English article into natural, dignified Japanese. 

CRITICAL: Do NOT use JSON or ID mapping. Write as a natural Japanese narrative in paragraphs.
QUALITY TIPS:
- Maintain a philosophical and esoteric tone.
- "Sensual" in tarot often refers to sensory experience of the material world; use high-quality terms like "官能" or "感覚".
- Titles like "The Architect of Fecundity" should be translated with dignity (e.g., "豊穣の設計者").
- Focus on the flow of the mystery revealed.`;

const SYSTEM_PROMPT_GLOSSARY = `You are an English teacher. 
Provide a list of 10-15 key terms from the text with Japanese explanations. 

CRITICAL: Do NOT use JSON. Return a simple, readable list of terms and their meanings.`;

const SYSTEM_PROMPT_FORMAT = `You are a technical data formatter. 
Convert the approved English article, Japanese translation, and Glossary into the exact JSON structure required.

JSON BLOCK RULES:
- 'type': 'title', 'heading', or 'sentence'.
- 'paragraph_end': Set to true ONLY to separate paragraphs. OMIT if the next block is a heading or title.
- 'line_break': Set to true ONLY for internal line breaks that don't end a paragraph.

Structures:
- 'content': { "slug": "...", "meta": {...}, "blocks": [...] }
- 'translation': { "language": "ja-JP", "translations": { "0": "translation0", "1": "translation1" } }
- 'glossary': { "glossary": { "term": { "text": "explanation", "sentences": [id] } } }

Return ALL three objects in one JSON structure. Use the English blocks as the source of truth for sentence IDs.`;

// --- Endpoints ---

app.get('/api/articles', async (req, res) => {
    try {
        const files = await fs.readdir(path.join(__dirname, '../public/data/articles'));
        const slugs = [...new Set(files.filter(f => f.endsWith('.json') && !f.includes('.translation.') && !f.includes('.glossary.'))
            .map(f => f.replace('.json', '')))];
        res.json(slugs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/article-data', async (req, res) => {
    const { slugs } = req.body;
    try {
        const data = await Promise.all(slugs.map(async slug => {
            const content = await fs.readJson(path.join(__dirname, `../public/data/articles/${slug}.json`));
            return { slug, content };
        }));
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chat', async (req, res) => {
    const { message, history, systemPrompt } = req.body;
    let actualPrompt = SYSTEM_PROMPT_EN;
    if (systemPrompt.includes('JA')) actualPrompt = SYSTEM_PROMPT_JA;
    if (systemPrompt.includes('GLOSSARY')) actualPrompt = SYSTEM_PROMPT_GLOSSARY;
    if (systemPrompt.includes('FORMAT')) actualPrompt = SYSTEM_PROMPT_FORMAT;

    try {
        const chat = model.startChat({
            history: history,
            generationConfig: { maxOutputTokens: 2000 },
        });

        const result = await chat.sendMessage(actualPrompt + "\n\nUser instructions: " + message);
        const response = await result.response;
        res.json({ text: response.text() });
    } catch (error) {
        console.error('LLM Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/save', async (req, res) => {
    const { slug, data, type } = req.body;
    const baseDir = path.join(__dirname, '../public/data/articles');
    let fileName = '';

    if (type === 'content') fileName = `${slug}.json`;
    else if (type === 'translation') fileName = `${slug}.translation.ja.json`;
    else if (type === 'glossary') fileName = `${slug}.glossary.ja.json`;

    try {
        await fs.ensureDir(baseDir);
        await fs.writeJson(path.join(baseDir, fileName), data, { spaces: 4 });
        res.json({ success: true, path: fileName });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-audio', (req, res) => {
    const { slug } = req.body;
    const scriptPath = path.join(__dirname, '../scripts/generate-audio.js');

    exec(`node ${scriptPath} ${slug}`, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: stderr });
        }
        res.json({ success: true, output: stdout });
    });
});

app.listen(port, () => {
    console.log(`Editor server running at http://localhost:${port}`);
});
