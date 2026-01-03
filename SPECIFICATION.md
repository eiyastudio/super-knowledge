# Technical Specification: Arcana English

This document defines the architecture, data structures, and content standards for the Arcana English web service.

---

## 1. Project Philosophy
Arcana English is a premium, static-first learning platform. It emphasizes:
- **Dignified Content**: Philosophical and esoteric articles (Tarot) written at an advanced level.
- **Visual Immersion**: A "dark-themed glassmorphism" aesthetic that matches the mystical subject matter.
- **Zero Runtime Overhead**: No database; strictly JSON-based content served as static assets.

---

## 2. Data Structures (The "Three-JSON" Model)
Each article is defined by three distinct JSON files located in `public/data/articles/`.

### 2.1 Content Schema (`{slug}.json`)
Defines the English narrative and block structure.

| Property | Type | Description |
| :--- | :--- | :--- |
| `slug` | `string` | URL-friendly identifier. |
| `meta.tags` | `array` | Category tags (e.g., `major-arcana`). |
| `meta.image` | `string` | Path to the featured image (e.g., `images/articles/the-fool.jpg`). |
| `blocks` | `array` | List of content objects (Title, Heading, Sentence). |

**Block Properties**:
- `id`: (Integer) Unique ID used for translation mapping and audio file naming.
- `type`: One of `title`, `heading`, or `sentence`.
- `text`: The raw text content.
- `paragraph_end`: (Boolean)
  - `true`: When the sentence definitively ends a paragraph.
  - `false`: Omitted or set to false if the next block is another sentence in the same paragraph OR a `heading`/`title`.
- `line_break`: (Boolean) Set to `true` to force a line break (`<br>`) within a paragraph narrative.

### 2.2 Translation Schema (`{slug}.translation.ja.json`)
Maps block IDs to Japanese translations.
- **Format**: `{ "language": "ja-JP", "translations": { "0": "...", "1": "..." } }`
- **Quality Standard**: Use dignified, esoteric Japanese (e.g., "Sensual" -> "官能", "Architect" -> "建築家").

### 2.3 Glossary Schema (`{slug}.glossary.ja.json`)
Defines vocabulary highlights as an ordered array.

- **Structure**:
| Property | Type | Description |
| :--- | :--- | :--- |
| `language` | `string` | Target language (e.g., `ja-JP`). |
| `glossary` | `array` | List of entries. |

- **Entry Properties**:
  - `explanation`: Detailed explanation in the target language.
  - `items`: An array of objects:
    - `word`: The English word/phrase.
    - `sentenceId`: The block ID to jump to for this specific word.

- **Interaction Rules**: 
  - Each `word` is individually clickable for **high-quality pronunciation** (Static MP3).
  - Each `word` has a small **"Jump" icon** next to it to scroll the article up to its specific `sentenceId` (triggers modal).

---

## 3. Sentential Study Modal
A focused learning view triggered by clicking any sentence.

- **Content**:
  - **English Sentence**: Large, clear display for focused study.
  - **Translation**: High-contrast display below the English text.
  - **Audio**: Play/Pause button for the block's pre-rendered MP3.
  - **Navigation**: "Previous" and "Next" arrows to move through the article's sentences sequentially.
  - **Glossary Filter**: Lists glossary items that specifically belong to the current `sentenceId`.
- **Logic**:
  - Triggered by clicking any `.sentence` in the main article.
  - State (current sentence) persists within the modal during navigation.
  - Keyboard: `ArrowLeft` / `ArrowRight` for navigation, `Space` for toggle play.

---

## 3. Audio Specification (Gemini-TTS)
Narration is pre-generated using Google Cloud's Gemini-powered Text-to-Speech.

- **Model**: `Neural2` / `gemini-2.5-pro-tts` (Project Dependent)
- **Voice**: `en-US-Neural2-F` / `Charon`
- **Article Narration Prompt**: *"Narrate this in a calm, authoritative, and dignified tone, suitable for a professional philosophical lecture on tarot and esoteric mysteries."*
- **Glossary Pronunciation Prompt**: *"Pronounce this word clearly and naturally as if it were part of a high-quality academic dictionary entry. Ensure the tone is dignified and the articulation is perfect."*
- **Storage**: 
  - Article Blocks: `public/audio/{slug}/{id}.mp3`
  - Glossary Words: `public/audio/{slug}/glossary/{word_slug}.mp3`

---

## 4. Content Creation Workflow
As the assistant, I handle the formatting of articles to ensure high standards:
1. **Drafting**: Create natural English and Japanese narratives.
2. **Formatting**: Manually convert text into the Three-JSON structure, strictly following the `paragraph_end` rules.
3. **Audio**: Run the generation script with the specific Style Prompt.
4. **Integration**: Update `index.html` with the new article card.

---

## 5. Design & CSS
- **Typography**: Inter (Variable), focus on readability and weight.
- **Layout**: Slate-900 background with deep indigo primary elements. 
- **Animations**: Use `.fade-in` for content entry and `.playing` for active sentence highlighting.
