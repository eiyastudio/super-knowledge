# Technical Specification: Arcana English

This document provides a comprehensive overview of the design, features, and technical implementation of the Arcana English web service.

---

## 1. Project Overview
Arcana English is a Blinkist-inspired web service designed for English learners. It provides short, high-quality articles (focused on Tarot) with integrated learning tools like hover-to-translate and speech synthesis.

### Key Principles
- **Privacy & Security**: 100% static project with no runtime database. API keys are strictly local.
- **Premium UX**: Modern, immersive design using dark mode, glassmorphism, and smooth animations.
- **Static First**: All content and assets are pre-loaded or pre-generated to ensure speed and Vercel compatibility.

---

## 2. Technical Stack
- **Frontend**: Vanilla HTML5, CSS3, and JavaScript (ES6+).
- **Build Tool**: [Vite](https://vitejs.dev/) for development and production bundling.
- **Backend (Static CLI)**: Node.js with `@google-cloud/text-to-speech` for audio generation.
- **Storage**: JSON files for content; MP3 files for audio.

---

## 3. Directory Structure
```text
super-knowlege/
├── public/
│   ├── data/
│   │   └── articles/           # Article content in JSON
│   └── audio/                  # Per-article audio directories
│       └── {slug}/             # MP3 files named by block ID
├── js/
│   └── article-loader.js       # Main frontend rendering and audio logic
├── scripts/
│   └── generate-audio.js       # CLI tool for pre-generating TTS audio
├── .env                        # Local secrets (API Keys) - Git ignored
├── index.html                  # Landing page
├── article.html                # Dynamic article viewer template
└── style.css                   # Global styles and animations
```

---

## 4. Features & Specifications

### 4.1 Article Rendering
Articles are loaded dynamically based on a `slug` query parameter (e.g., `article.html?slug=the-fool`).
- **Data Source**: Fetches three JSON files per article:
  - `the-fool.json`: Structure and English text blocks.
  - `the-fool.translation.ja.json`: Sentence-level mappings to Japanese.
  - `the-fool.glossary.ja.json`: Vocabulary definitions.
- **Block Types**:
  - `title`: Main header of the article.
  - `heading`: Section headers.
  - `sentence`: Interactive text units.

### 4.2 Learning Tools
- **Hover Translation**: Sentences use a CSS-driven overlay to show Japanese text on hover.
- **Glossary**: Automatically populated at the bottom of the article. Terms are highlighted in the article and detailed in the glossary section.

### 4.3 Read-Aloud (TTS) System
- **AudioManager**: A custom JavaScript state machine in `article-loader.js` that:
  - Sequences playback of sentences.
  - Highlights the current sentence with the `.playing` CSS class.
  - Handles Pause/Resume and manual "jump" to any sentence.
- **Static Generation Tool**: 
  - Uses Google Cloud Neural2 voices.
  - Saves audio to `public/audio/{slug}/{id}.mp3`.
  - Check for existing files before generating to save API costs.

---

## 5. Development Guide

### Adding a New Article
1. Create `new-article.json`, `new-article.translation.ja.json`, and `new-article.glossary.ja.json` in `public/data/articles/`.
2. Add a link to the new slug in `index.html`.
3. Run the audio generator:
   ```bash
   node scripts/generate-audio.js new-article
   ```

### Security & Deployment
- **API Keys**: Stored in `.env` as `GOOGLE_API_KEY`. Never commit this file.
- **Vercel**: The project is ready for Vercel. Folders like `public/audio` are served as static assets.
- **Filesystem**: Vercel's runtime is read-only. **All audio must be generated locally and committed to Git before deployment.**

---

## 6. CSS Design Tokens
- **Primary**: `#6366f1` (Indigo)
- **Accent**: `#f59e0b` (Amber)
- **Background**: `#0f172a` (Slate-900)
- **Glass**: `rgba(255, 255, 255, 0.05)` with `backdrop-filter: blur(10px)`
