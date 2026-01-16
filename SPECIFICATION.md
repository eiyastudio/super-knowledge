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

**Content Style**:
- **TTS Friendly**: Minimize parentheses. Rewrite parenthetical phrases as natural clauses (e.g., use "or Debit" instead of "(Debit)") to ensure natural reading by the TTS engine.

### 2.2 Translation Schema (`{slug}.translation.ja.json`)
Maps block IDs to Japanese translations.
- **Format**: `{ "language": "ja-JP", "translations": { "0": "...", "1": "..." } }`
- **Quality Standard**: Use dignified, esoteric Japanese (e.g., "Sensual" -> "官能", "Architect" -> "建築家").
- **No Redundant English**: Do NOT include English terms in parentheses within the Japanese translation (e.g., avoid "借方(Debit)" or "借方、英語で言うDebit"). Use the Japanese term only. The original English is already available in the UI.

### 2.3 Glossary Schema (`{slug}.glossary.ja.json`)
Defines vocabulary highlights with a flat, high-focus structure.

- **Structure**:
| Property | Type | Description |
| :--- | :--- | :--- |
| `language` | `string` | Target language (e.g., `ja-JP`). |
| `glossary` | `array` | List of entries. |

- **Entry Properties**:
  - `word`: (String) The English word/phrase to highlight.
  - `sentenceId`: (Integer) The block ID where this word first appears.
  - `definition`: (String) Short translation or immediate meaning (e.g., " 土台、基礎").
  - `explanation`: (String) Detailed narrative or philosophical context.

- **Interaction Rules**: 
  - Each `word` is individually clickable for **high-quality pronunciation** (Static MP3).
  - Clicking a word replaces the translation with a card showing `word`, `definition`, and `explanation`.
  - Multiple terms separated by "/" are abolished in favor of single-word entries.

- **Term Normalization Rules**:
  - **Verbs**: Use the base form (remove -s, -ing, -ed).
  - **Nouns**: Use the singular form unless the plural has a specific distinct meaning.
  - **Text Match**: In cases where the normalization differs from the text, use the `textMatch` property to link the specific occurrence to the normalized term.

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

## 4. Audio Specification (Gemini-TTS)
Narration is pre-generated using Google Cloud's Gemini-powered Text-to-Speech.

- **Model**: `Neural2` / `gemini-2.5-pro-tts` (Project Dependent)
- **Voice**: `en-US-Neural2-F` / `Charon`
- **Article Narration Prompt**: *"Narrate this in a calm, authoritative, and dignified tone, suitable for a professional philosophical lecture on tarot and esoteric mysteries."*
- **Glossary Pronunciation Prompt**: *"Pronounce this word clearly and naturally as if it were part of a high-quality academic dictionary entry. Ensure the tone is dignified and the articulation is perfect."*
- **Storage**: 
  - Article Blocks: `public/audio/{slug}/{id}.mp3`
  - Glossary Words: `public/audio/{slug}/glossary/{word_slug}.mp3`

---

## 5. Content Creation Workflow
As the assistant, I handle the formatting of articles to ensure high standards:
1. **Drafting**: Create natural English and Japanese narratives.
2. **Formatting**: Manually convert text into the Three-JSON structure, strictly following the `paragraph_end` rules.
3. **Audio**: Run the generation script with the specific Style Prompt.
4. **Integration**: Update `index.html` with the new article card.

### 5.1 Draft Normalization Guidelines
To ensure "stable" article creation from diverse draft formats, follow these normalization rules:

- **Ignore Structural Markers**: Discard headers like "Part 1: English Text" or "Part 2: Translation". Only extract the actual content.
- **Glossary Cleaning**:
  - Remove part-of-speech tags (e.g., `(名詞)`, `(verb)`) from the `word` field.
  - Simplify definitions. If the draft has `Word (Noun): Definition`, extract only `Word` as the key and `Definition` as the value.
  - Flatten nested lists.
- **Strict Schema Adherence**: regardless of how the draft uses bullet points or numbering, map the content strictly to the `sentences` (blocks), `translations`, and `glossary` arrays defined in Section 2.

---

## 6. Design & CSS
- **Typography**: Inter (Variable), focus on readability and weight.
- **Layout**: Slate-900 background with deep indigo primary elements. 
- **Animations**: Use `.fade-in` for content entry and `.playing` for active sentence highlighting.

---

## 7. Routing & URL Strategy
The service uses path-based routing to define the "Learning Mode" (Language Configuration).

### 7.1 URL Structure
Format: `/{mode}/articles/{slug}`

| Path | Mode Name | Description | Content Display |
| :--- | :--- | :--- | :--- |
| `/en-ja/` | **Dual Language** | Standard study mode. | English text + Japanese translation. |
| `/en/` | **Immersion** | For advanced learners / native speakers. | English text only. Japanese hidden. |
| `/ja/` | **Native Reader** | For reading the content as a localized article. | Japanese text only. English hidden. |
| `/en-vn/` | **Vietnam Local** | (Future) For Vietnamese speakers. | English text + Vietnamese translation. |

### 7.2 Default Routing Rules
- **No Mode**: Accessing `/articles/{slug}` without a language prefix defaults to **Immersion Mode (`/en/`)**.
  - *Behavior*: Redirect to `/en/articles/{slug}` OR render as English-only.
- **Root**: Visiting `/` should redirect to or render the default listing (likely `/en-ja/` or user's last preference).
