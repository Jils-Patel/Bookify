document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.querySelector('.search-form');
    const searchSource = document.getElementById('searchSource');
    const searchQuery = document.getElementById('searchQuery');
    const maxResults = document.getElementById('maxResults');
    const searchButton = document.getElementById('searchButton');
    const loadingSpinner = document.querySelector('.loading-spinner');
    const searchResults = document.getElementById('searchResults');
    const modal = document.getElementById('bookModal');
    const modalContent = document.getElementById('modalContent');
    const closeButton = document.querySelector('.close-button');

    // Cache for storing image load status
    const imageCache = new Map();

    // Function to check if an image exists
    async function checkImage(url) {
        if (!url) return false;
        if (imageCache.has(url)) return imageCache.get(url);

        return new Promise((resolve) => {
            const img = new Image();
            img.onload = function() {
                imageCache.set(url, true);
                resolve(true);
            };
            img.onerror = function() {
                imageCache.set(url, false);
                resolve(false);
            };
            img.src = url;
        });
    }

    // Search function
    async function performSearch() {
        if (!searchSource.value) {
            alert('Please select a search source');
            return;
        }

        if (!searchQuery.value.trim()) {
            alert('Please enter a search query');
            return;
        }

        // Show loading spinner
        loadingSpinner.style.display = 'flex';
        searchResults.innerHTML = '';

        // Build query parameters
        const params = new URLSearchParams({
            source: searchSource.value,
            query: searchQuery.value.trim(),
            max_results: maxResults.value
        });

        try {
            const response = await fetch(`/quick_search/results?${params.toString()}`);
            const data = await response.json();

            // Hide loading spinner
            loadingSpinner.style.display = 'none';

            // Display results
            const resultsHtml = await Promise.all(data.map(async (item) => {
                let imageUrl;
                if (item.cover_url) {
                    const imageExists = await checkImage(item.cover_url);
                    imageUrl = imageExists ? item.cover_url : 
                        (searchSource.value === 'books' ? '/static/images/book-placeholder.png' : '/static/images/paper-placeholder.png');
                } else {
                    imageUrl = searchSource.value === 'books' ? '/static/images/book-placeholder.png' : '/static/images/paper-placeholder.png';
                }

                // Clean and encode the item data
                const cleanItem = {...item};
                
                // Clean URLs
                if (cleanItem.cover_url) {
                    cleanItem.cover_url = cleanItem.cover_url.replace(/\s+/g, '');
                }
                if (cleanItem.reading_url) {
                    cleanItem.reading_url = cleanItem.reading_url.replace(/\s+/g, '');
                }
                if (cleanItem.buy_link) {
                    cleanItem.buy_link = cleanItem.buy_link.replace(/\s+/g, '');
                }
                
                // Clean description/recommendation text
                if (cleanItem.description) {
                    cleanItem.description = cleanItem.description.replace(/\r\n/g, '\n').replace(/"/g, '&quot;');
                }
                if (cleanItem.recommendation) {
                    cleanItem.recommendation = cleanItem.recommendation.replace(/\r\n/g, '\n').replace(/"/g, '&quot;');
                }
                
                // Stringify and encode the item data
                const itemData = encodeURIComponent(JSON.stringify(cleanItem));
                
                return `
                    <div class="result-card" data-item="${itemData}" data-source="${searchSource.value}">
                        <img src="${imageUrl}" 
                             alt="${cleanItem.title}"
                             onerror="this.src='${searchSource.value === 'books' ? '/static/images/book-placeholder.png' : '/static/images/paper-placeholder.png'}'">
                        <div class="info">
                            <div class="title">${cleanItem.title}</div>
                            <div class="author">${Array.isArray(cleanItem.authors) ? cleanItem.authors.join(', ') : cleanItem.author || 'Unknown Author'}</div>
                        </div>
                    </div>
                `;
            }));

            searchResults.innerHTML = resultsHtml.join('');

            // Add click event listeners to all result cards
            document.querySelectorAll('.result-card').forEach(card => {
                card.addEventListener('click', function() {
                    try {
                        const itemData = JSON.parse(decodeURIComponent(this.getAttribute('data-item')));
                        const source = this.getAttribute('data-source');
                        showDetails(itemData, source);
                    } catch (error) {
                        console.error('Error parsing item data:', error);
                    }
                });
            });

        } catch (error) {
            console.error('Search error:', error);
            loadingSpinner.style.display = 'none';
            searchResults.innerHTML = '<p class="error-message">An error occurred while searching. Please try again.</p>';
        }
    }

    // Show details in modal
    window.showDetails = function(item, source) {
        let content;
        
        if (source === 'books') {
            // Book modal content
            const subjectsHtml = item.subjects && item.subjects.length > 0 
                ? `<div class="modal-book-subjects">
                    ${item.subjects.map(subject => `<span class="subject-tag">${subject}</span>`).join('')}
                   </div>`
                : '';
            
            // Create a read online button if available
            const readOnlineHtml = item.reading_url
                ? `<div class="read-online-section">
                    <a href="${item.reading_url}" target="_blank" class="read-online-btn">
                        <i class="fas fa-book-reader"></i> Read Online
                    </a>
                   </div>`
                : '';
            
            // Create Amazon buy button
            const buyButtonHtml = item.buy_link
                ? `<div class="buy-section">
                    <a href="${item.buy_link}" target="_blank" class="buy-btn">
                        <i class="fas fa-shopping-cart"></i> Buy on Amazon
                    </a>
                   </div>`
                : '';
            
            content = `
                <div class="modal-book-info">
                    <div class="modal-book-cover">
                        <div class="book-cover-wrapper">
                            <img src="${item.cover_url || '/static/images/book-placeholder.svg'}" 
                                 alt="${item.title} cover" 
                                 onerror="this.src='/static/images/book-placeholder.svg'">
                            ${item.has_ebook ? '<div class="ebook-badge"><i class="fas fa-book-open"></i> E-book</div>' : ''}
                        </div>
                        <div class="action-buttons">
                            ${readOnlineHtml}
                            ${buyButtonHtml}
                        </div>
                    </div>
                    <div class="modal-book-details">
                        <h2 class="modal-book-title">${item.title}</h2>
                        <div class="modal-book-metadata">
                            <p>by ${item.author}</p>
                            <p>Published: ${item.year || 'Unknown'}</p>
                        </div>
                        ${subjectsHtml}
                        <div class="modal-book-recommendation">
                            <h3>Summary</h3>
                            <p>${item.recommendation || item.description || 'No description available.'}</p>
                        </div>
                    </div>
                </div>
            `;
        } else if (source === 'recent_research' || source === 'semantic_scholar') {
            // Semantic Scholar paper modal content
            const citationHtml = item.citation_count > 0 
                ? `<div class="citation-stats">
                    <span class="citation-count">
                        <i class="fas fa-quote-right"></i> ${item.citation_count} citations
                    </span>
                    ${item.influential_citation_count > 0 ? 
                        `<span class="influential-count">
                            <i class="fas fa-star"></i> ${item.influential_citation_count} influential
                        </span>` : 
                        ''}
                   </div>`
                : '';
            
            const viewOnlineBtn = item.view_url || item.url
                ? `<div class="read-online-section">
                    <a href="${item.view_url || item.url}" target="_blank" class="read-online-btn">
                        <i class="fas fa-external-link-alt"></i> View on Semantic Scholar
                    </a>
                   </div>`
                : '';
            
            const downloadBtn = item.download_url
                ? `<div class="buy-section">
                    <a href="${item.download_url}" target="_blank" class="buy-btn">
                        <i class="fas fa-file-download"></i> ${item.is_open_access ? 'Download Open Access PDF' : 'Download PDF'}
                    </a>
                   </div>`
                : '';
            
            content = `
                <div class="modal-book-info">
                    <div class="modal-book-cover">
                        <div class="book-cover-wrapper">
                            <img src="${item.cover_url || '/static/images/scholar-placeholder.svg'}" 
                                alt="${item.title}" 
                                onerror="this.src='/static/images/scholar-placeholder.svg'">
                            <div class="ebook-badge scholar-badge">
                                <i class="fas fa-file-alt"></i> Semantic Scholar
                            </div>
                        </div>
                        <div class="action-buttons">
                            ${viewOnlineBtn}
                            ${downloadBtn}
                        </div>
                    </div>
                    <div class="modal-book-details">
                        <h2 class="modal-book-title">${item.title}</h2>
                        <div class="modal-book-metadata">
                            <p>By ${item.all_authors || item.author}</p>
                            <p>Published: <span class="year-badge">${item.year || 'Unknown'}</span> 
                               ${item.venue ? `in <span class="venue-badge">${item.venue}</span>` : ''}
                            </p>
                        </div>
                        ${citationHtml}
                        <div class="modal-book-recommendation">
                            <h3>Abstract</h3>
                            <p>${item.abstract || item.description || 'No abstract available for this paper.'}</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Archive research paper modal content
            const viewOnlineBtn = item.view_url
                ? `<div class="read-online-section">
                    <a href="${item.view_url}" target="_blank" class="read-online-btn">
                        <i class="fas fa-external-link-alt"></i> View Online
                    </a>
                   </div>`
                : '';
            
            const downloadBtn = item.download_url
                ? `<div class="buy-section">
                    <a href="${item.download_url}" target="_blank" class="buy-btn">
                        <i class="fas fa-file-download"></i> Download PDF
                    </a>
                   </div>`
                : '';
            
            content = `
                <div class="modal-book-info">
                    <div class="modal-book-cover">
                        <div class="book-cover-wrapper">
                            <img src="${item.cover_url || '/static/images/research-placeholder.svg'}" 
                                alt="${item.title}" 
                                onerror="this.src='/static/images/research-placeholder.svg'">
                            ${item.has_ebook ? '<div class="ebook-badge"><i class="fas fa-file-pdf"></i> PDF</div>' : ''}
                        </div>
                        <div class="action-buttons">
                            ${viewOnlineBtn}
                            ${downloadBtn}
                        </div>
                    </div>
                    <div class="modal-book-details">
                        <h2 class="modal-book-title">${item.title}</h2>
                        <div class="modal-book-metadata">
                            <p>By ${item.author}</p>
                            <p>Published: <span class="year-badge">${item.year || 'Unknown'}</span></p>
                        </div>
                        ${item.subjects && item.subjects.length > 0 ? `
                            <div class="modal-book-subjects">
                                ${item.subjects.map(subject => `<span class="subject-tag">${subject}</span>`).join('')}
                            </div>
                        ` : ''}
                        <div class="modal-book-recommendation">
                            <p>${item.recommendation || item.description || 'No description available.'}</p>
                        </div>
                    </div>
                </div>
            `;
        }
        
        modalContent.innerHTML = content;
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    };

    // Event listeners
    searchButton.addEventListener('click', performSearch);

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        performSearch();
    });

    // Close modal
    closeButton.onclick = function() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    };

    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    };

    // Handle Enter key in search query field
    searchQuery.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    });

    // Close modal on escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
}); 