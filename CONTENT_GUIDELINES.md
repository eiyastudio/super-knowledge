# Content Creation Guidelines

This document outlines the standards, workflows, and templates for creating content within the Super Knowledge platform.

## 1. Naming Conventions

### 1.1 Slug Format
The article slug must uniquely identify the content and, to avoid collisions, should include the author's name for non-unique titles.

- **Format**: `kebab-case`
- **Rule**: `[title]-[author]` (e.g., `emergence-steven-johnson`)
- **Exception**: Unique concepts or specific series (like Tarot) may use just `[title]` (e.g., `the-fool`).

### 1.2 File Naming
All data files reside in `public/data/articles/`.

| File Type | Naming Pattern | Description |
| :--- | :--- | :--- |
| **Content** | `[slug].json` | Main English text and metadata. |
| **Translation** | `[slug].translation.ja.json` | Japanese translation mapped by block ID. |
| **Glossary** | `[slug].glossary.ja.json` | Vocabulary definitions (v2 format). |

## 2. Draft Normalization
To ensure stable article creation from diverse raw drafts, follow these normalization rules:

- **Ignore Structural Markers**: Discard headers like "Part 1: English Text" or "Part 2: Translation". Only extract the actual content.
- **Glossary Cleaning**:
  - Remove part-of-speech tags (e.g., `(名詞)`, `(verb)`) from the `word` field.
  - Simplify definitions. If the draft has `Word (Noun): Definition`, extract only `Word` as the key and `Definition` as the value.
  - Flatten nested lists.
- **Strict Schema Adherence**: Regardless of how the draft uses bullet points or numbering, map the content strictly to the `sentences` (blocks), `translations`, and `glossary` arrays.

## 3. JSON Templates

### 3.1 Content JSON (`[slug].json`)
The source of truth for the article's structure.

```json
{
  "slug": "emergence-steven-johnson",
  "meta": {
    "tags": ["CATEGORY_NAME", "TOPIC"],
    "image": "images/articles/emergence-steven-johnson.jpg"
  },
  "blocks": [
    {
      "id": 0,
      "type": "title",
      "text": "Article Title"
    },
    {
      "id": 1,
      "type": "sentence",
      "text": "First sentence of the article.",
      "paragraph_end": true
    },
    {
      "id": 2,
      "type": "heading",
      "text": "Section Heading"
    }
  ]
}
```

### 3.2 Translation JSON (`[slug].translation.ja.json`)
Maps English block IDs to Japanese text.

```json
{
  "0": "記事のタイトル",
  "1": "記事の最初の文。",
  "2": "セクションの見出し"
}
```

### 3.3 Glossary JSON (`[slug].glossary.ja.json`)
Defines vocabulary terms used in the article.

```json
[
  {
    "word": "Term",
    "definition": "用語の定義。",
    "example": "Example sentence using the term. (用語を使った例文。)",
    "matchStrategy": "exact"
  },
  {
    "word": "Another Term",
    "definition": "別の用語の定義。",
    "matchStrategy": "fuzzy"
  }
]
```

## 4. Verification Checklist
- [ ] **Slug Check**: Does the slug follow `[title]-[author]`?
- [ ] **ID Matching**: Do all IDs in `blocks` exist in the translation JSON?
- [ ] **Paragraph Ends**: Are `paragraph_end: true` flags set correctly to create logical grouping?
- [ ] **Glossary Match**: Do glossary terms appear in the text?
