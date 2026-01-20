# Technical Specification & Content Guidelines: Arcana English

This document defines the architecture, data structures, naming conventions, and workflows for the Arcana English web service.

---

## 1. Project Philosophy
Arcana English is a premium, static-first learning platform. It emphasizes:
- **Dignified Content**: Philosophical and esoteric articles (Tarot) written at an advanced level.
- **Visual Immersion**: A "dark-themed glassmorphism" aesthetic that matches the mystical subject matter.
- **Zero Runtime Overhead**: No database; strictly JSON-based content served as static assets.

---

## 2. Naming Conventions

### 2.1 Slug Format
The article slug must uniquely identify the content.
- **Format**: `kebab-case`.
- **General Rule**: `[title]-[author]` (e.g., `emergence-steven-johnson`).
- **Exception**: Unique concepts or specific series (like Tarot) may use just `[title]` (e.g., `the-fool`).

### 2.2 File Naming
All data files reside in `public/data/articles/`.

| File Type | Naming Pattern | Description |
| :--- | :--- | :--- |
| **Content** | `[slug].json` | Main English text and metadata. |
| **Translation** | `[slug].translation.ja.json` | Japanese translation mapped by block ID. |
| **Glossary** | `[slug].glossary.ja.json` | Vocabulary definitions. |

---

## 3. Data Structures (The "Three-JSON" Model)
Each article is defined by three distinct JSON files.

### 3.1 Content Schema (`{slug}.json`)
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
  - `false`/omitted: If the next block is part of the same paragraph.
- `line_break`: (Boolean) Set to `true` to force a line break (`<br>`) within a paragraph.

**Content Style**:
- **TTS Friendly**: Minimize parentheses. Rewrite parenthetical phrases as natural clauses.

### 3.2 Translation Schema (`{slug}.translation.ja.json`)
Maps block IDs to Japanese translations.
- **Format**: `{ "language": "ja-JP", "translations": { "0": "...", "1": "..." } }`
- **Quality Standard**: Use dignified, esoteric Japanese (e.g., "Sensual" -> "官能").
- **No Redundant English**: Do NOT include English terms in parentheses (e.g., avoid "借方(Debit)").

### 3.3 Glossary Schema (`{slug}.glossary.ja.json`)
Defines vocabulary highlights with a flat, high-focus structure.

- **Structure**:
| Property | Type | Description |
| :--- | :--- | :--- |
| `language` | `string` | Target language (e.g., `ja-JP`). |
| `glossary` | `array` | List of entries. |

- **Entry Properties**:
  - `word`: (String) The English word/phrase to highlight (Normalized).
  - `sentenceId`: (Integer) The block ID where this word first appears.
  - `definition`: (String) Short translation or immediate meaning.
  - `explanation`: (String) Detailed narrative or philosophical context.
  - `textMatch`: (String, Optional) **CRITICAL**: Use this if the actual text in the article differs from the `word` (e.g., "grinding out" in text vs "grind out" in word).

- **Interaction Rules**: 
  - Each `word` is individually clickable for **high-quality pronunciation** (Static MP3).
  - Clicking a word replaces the translation with a card showing `word`, `definition`, and `explanation`.

- **Term Normalization Rules**:
  - **Verbs**: Use the base form (remove -s, -ing, -ed).
  - **Nouns**: Use the singular form unless the plural has a specific distinct meaning.
  - **Constraint**: If `word` differs from the article text, you MUST provide `textMatch` containing the exact string from the text to ensure the UI can locate and highlight it.

---

## 4. Sentential Study Modal
A focused learning view triggered by clicking any sentence.
- **Content**: English Sentence, Translation, Audio (Pre-rendered MP3).
- **Navigation**: Arrow keys to move through sentences.
- **Glossary Filter**: Lists glossary items belonging to the current `sentenceId`.

---

## 5. Audio Specification (Gemini-TTS)
Narration is pre-generated using Google Cloud's Gemini-powered Text-to-Speech.

- **Model**: `Neural2` / `gemini-2.5-pro-tts`
- **Voice**: `en-US-Neural2-F` / `Charon` (Dignified, Authoritative)
- **Storage**: 
  - Article Blocks: `public/audio/{slug}/{id}.mp3`
  - Glossary Words: `public/audio/{slug}/glossary/{word_slug}.mp3`

---

## 6. Content Creation Workflow & Verification

### 6.1 Workflow
1. **Drafting**: Create natural English and Japanese narratives.
2. **Formatting**: Manually convert text into the Three-JSON structure.
   - *Draft Normalization*: Discard headers, clean glossary terms, flatten lists.
3. **Audio**: Run the generation script.
4. **Integration**: Update `index.html`.

### 6.2 Verification Checklist
- [ ] **Slug Check**: Does the slug follow the naming convention?
- [ ] **ID Matching**: All `blocks` IDs must exist in the translation JSON.
- [ ] **Paragraph Ends**: `paragraph_end: true` flags set correctly?
- [ ] **Glossary Match**: Do glossary terms appear in the text?
    - If the form differs (e.g. conjugation), is `textMatch` provided?

---

## 7. Routing & URL Strategy
- **Dual Language**: `/en-ja/articles/{slug}`
- **Immersion**: `/en/articles/{slug}`
- **Native Reader**: `/ja/articles/{slug}`
- **Default**: No prefix redirects to `/en/` or defaults to Immersion.
