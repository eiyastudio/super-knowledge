const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

const client = new textToSpeech.TextToSpeechClient({
    apiKey: process.env.GOOGLE_API_KEY
});

async function generateAudio(slug) {
    const articlePath = path.join(__dirname, '../public/data/articles', `${slug}.json`);
    const glossaryPath = path.join(__dirname, '../public/data/articles', `${slug}.glossary.ja.json`);
    const outputDir = path.join(__dirname, '../public/audio', slug);
    const glossaryOutputDir = path.join(outputDir, 'glossary');

    // 1. Process Main Article
    if (fs.existsSync(articlePath)) {
        await fs.ensureDir(outputDir);
        const article = await fs.readJson(articlePath);
        console.log(`Generating article audio for: ${slug}...`);

        for (const block of article.blocks) {
            if (['sentence', 'title', 'heading'].includes(block.type)) {
                const filePath = path.join(outputDir, `${block.id}.mp3`);
                if (fs.existsSync(filePath)) continue;

                console.log(`Processing Block ${block.id}: ${block.text.substring(0, 30)}...`);
                await synthesize(block.text, filePath, "Narrate this in a calm, authoritative, and dignified tone, suitable for a professional philosophical lecture on tarot and esoteric mysteries.");
            }
        }
    }

    // 2. Process Glossary (Updated for v2 Flat Schema)
    if (fs.existsSync(glossaryPath)) {
        await fs.ensureDir(glossaryOutputDir);
        const glossaryData = await fs.readJson(glossaryPath);
        console.log(`Generating glossary audio for: ${slug}...`);

        const entries = Array.isArray(glossaryData.glossary) ? glossaryData.glossary : [];
        for (const entry of entries) {
            const word = entry.word;
            const wordSlug = word.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-$/, '');
            const filePath = path.join(glossaryOutputDir, `${wordSlug}.mp3`);

            if (fs.existsSync(filePath)) continue;

            console.log(`Processing Word: ${word}...`);
            await synthesize(word, filePath, "Pronounce this word clearly and naturally as if it were part of a high-quality academic dictionary entry. Ensure the tone is dignified and the articulation is perfect.");
        }
    }

    console.log('Finished!');
}

async function synthesize(text, filePath, prompt) {
    const request = {
        input: { text },
        voice: { languageCode: 'en-US', name: 'en-US-Neural2-F' },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9 },
    };

    try {
        const [response] = await client.synthesizeSpeech(request);
        await fs.writeFile(filePath, response.audioContent, 'binary');
        console.log(`Saved: ${filePath}`);
    } catch (err) {
        console.error(`Error generating audio for "${text.substring(0, 20)}":`, err.message);
    }
}

const slug = process.argv[2];
if (!slug) {
    console.log('Usage: node generate-audio.js <article-slug>');
    process.exit(1);
}

generateAudio(slug);
