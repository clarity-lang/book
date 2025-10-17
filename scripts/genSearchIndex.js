const fs = require('fs');
const path = require('path');
const markdownIt = require('markdown-it')();

const srcDir = path.join(__dirname, '../src');
const outputFile = path.join(__dirname, '../build/search-index.json');

async function generateSearchIndex() {
    const index = [];

    function processMarkdownFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const html = markdownIt.render(content);
        const titleMatch = content.match(/^#\s+(.*)/m);
        const title = titleMatch ? titleMatch[1] : 'Untitled';
        const relativePath = path.relative(srcDir, filePath);

        index.push({
            title,
            content: html.replace(/<[^>]*>/g, ''), // Strip HTML tags
            path: relativePath.replace(/\.md$/, '.html'),
        });
    }

    fs.readdirSync(srcDir).forEach(file => {
        if (file.endsWith('.md')) {
            processMarkdownFile(path.join(srcDir, file));
        }
    });

    await fs.promises.mkdir(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(index, null, 2));
    console.log('Search index generated:', outputFile);
}

module.exports = generateSearchIndex;