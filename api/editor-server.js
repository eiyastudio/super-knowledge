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

const SYSTEM_PROMPT_EN = `You are a professional content creator for an English learning service. 
Your goal is to create high-quality, philosophical, and insightful articles about Tarot cards.
Structure the article into logical blocks: title, headings, and sentences.
Each sentence should be meaningful and at an advanced English level.
Avoid fluff. Focus on the esoteric and psychological meaning of the card.
Return the result as a raw text with markdown-like headers (# for title, ## for subheadings).`;

const SYSTEM_PROMPT_JA = `You are a translator specializing in esoteric and psychological texts.
Translate the following English tarot article into natural, high-quality Japanese.
Maintain the dignified and philosophical tone.
Return strictly the translation of each sentence, mapping them as a JSON object where keys are the sequence numbers starting from 0.`;

const SYSTEM_PROMPT_GLOSSARY = `You are an English teacher. 
Select 10-15 advanced vocabulary words or phrases from the provided text that would be challenging for English learners.
Explain them in Japanese, focusing on the specific context of the article.
Return a JSON object: { "glossary": { "term": { "text": "explanation" } } }.`;

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
