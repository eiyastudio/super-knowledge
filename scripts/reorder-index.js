const fs = require('fs-extra');
const path = require('path');

async function reorderIndex() {
    const indexPath = path.join(__dirname, '../public/data/articles-index.json');
    const articles = await fs.readJson(indexPath);

    // Separate Tarot articles from others
    const tarot = articles.filter(a => a.category === 'tarot');
    const others = articles.filter(a => a.category !== 'tarot');

    // Sort Tarot articles by title number
    tarot.sort((a, b) => {
        const getNum = (title) => {
            const match = title.match(/^(\d+)\./);
            return match ? parseInt(match[1], 10) : 999;
        };
        return getNum(a.title) - getNum(b.title);
    });

    // Reassemble: Others first (preserving their relative order?), or specifically grouped?
    // The original file had Finance, Games, Creativity mixed initially? 
    // Actually, looking at the file content in Step 247:
    // It starts with Finance, then Games, then Creativity... then Tarot is likely at the end or mixed.
    // The previous view showed Tarot starting around line 174.
    // Let's keep others in their original order, and place Tarot where it fits or at the end.
    // Simpler: Just concat others + tarot.

    // Wait, strictly preserving the "top page" order if it relies on this file is important.
    // But if we want Tarot sorted, we can just sort the whole array by category then custom logic?
    // Let's just update the Tarot portion in place if possible, or appending.

    // Strategy: Rebuild the list. 
    // 1. Finance
    // 2. Games
    // 3. Creativity
    // 4. Ideation
    // 5. Tarot (Sorted)

    const categories = ['finance', 'games', 'creativity', 'ideation'];
    let newOrder = [];

    categories.forEach(cat => {
        const catArticles = articles.filter(a => a.category === cat);
        newOrder = newOrder.concat(catArticles);
    });

    newOrder = newOrder.concat(tarot);

    await fs.writeJson(indexPath, newOrder, { spaces: 2 });
    console.log('Reordered articles-index.json');
}

reorderIndex();
