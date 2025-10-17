async function loadSearchIndex() {
    const response = await fetch('./search-index.json');
    return response.json();
}

function search(query, index) {
    return index.filter(entry =>
        entry.title.toLowerCase().includes(query.toLowerCase()) ||
        entry.content.toLowerCase().includes(query.toLowerCase())
    );
}

document.getElementById('search-bar').addEventListener('input', async (event) => {
    const query = event.target.value;
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';

    if (query.length < 3) return; // Minimum query length

    const index = await loadSearchIndex();
    const results = search(query, index);

    results.forEach(result => {
        const resultElement = document.createElement('div');
        resultElement.innerHTML = `
            <a href="${result.path}">
                <h3>${result.title}</h3>
                <p>${result.content.substring(0, 200)}...</p>
            </a>
        `;
        resultsContainer.appendChild(resultElement);
    });
});