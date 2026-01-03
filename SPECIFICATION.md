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
Defines vocabulary highlights.
- **Property**: `glossary > {term} > text`: Detailed explanation in Japanese.
- **Property**: `glossary > {term} > sentences`: Array of block IDs where the term appears.

---

## 3. Audio Specification (Gemini-TTS)
Narration is pre-generated using Google Cloud's Gemini-powered Text-to-Speech.

- **Model**: `gemini-2.5-pro-tts`
- **Voice**: `Charon`
- **Style Prompt**: *"Narrate this in a calm, authoritative, and dignified tone, suitable for a professional philosophical lecture on tarot and esoteric mysteries."*
- **Storage**: `public/audio/{slug}/{id}.mp3`

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
