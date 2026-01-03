const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

const client = new textToSpeech.TextToSpeechClient({
    apiKey: process.env.GOOGLE_API_KEY
});

async function generateAudio(slug) {
    const articlePath = path.join(__dirname, '../public/data/articles', `${slug}.json`);
    const outputDir = path.join(__dirname, '../public/audio', slug);

    if (!fs.existsSync(articlePath)) {
        console.error(`Article not found: ${articlePath}`);
        return;
    }

    await fs.ensureDir(outputDir);
    const article = await fs.readJson(articlePath);

    console.log(`Generating audio for: ${slug}...`);

    for (const block of article.blocks) {
        if (block.type === 'sentence' || block.type === 'title' || block.type === 'heading') {
            const fileName = `${block.id}.mp3`;
            const filePath = path.join(outputDir, fileName);

            if (fs.existsSync(filePath)) {
                console.log(`Skipping existing: ${fileName}`);
                continue;
            }

            console.log(`Processing: ${block.text.substring(0, 30)}...`);

            const request = {
                input: { text: block.text },
                voice: { languageCode: 'en-US', name: 'en-US-Neural2-F' },
                audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9 },
            };

            try {
                // The client.synthesizeSpeech handles the mapping
                const [response] = await client.synthesizeSpeech(request);
                await fs.writeFile(filePath, response.audioContent, 'binary');
                console.log(`Saved: ${fileName}`);
            } catch (err) {
                console.error(`Error generating ${fileName}:`, err);
            }
        }
    }

    console.log('Finished!');
}

const slug = process.argv[2];
if (!slug) {
    console.log('Usage: node generate-audio.js <article-slug>');
    process.exit(1);
}

generateAudio(slug);
