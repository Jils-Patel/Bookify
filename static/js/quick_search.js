document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.querySelector('.search-form');
    const searchSource = document.getElementById('searchSource');
    const searchQuery = document.getElementById('searchQuery');
    const maxResults = document.getElementById('maxResults');
    const searchButton = document.getElementById('searchButton');
    const spinner = document.getElementById('spinner');
    const searchResults = document.getElementById('searchResults');
    const modal = document.getElementById('bookModal');
    const modalContent = document.getElementById('modalContent');

    const imageCache = new Map();

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

    function showErrorMessage(message) {
        const modal = document.createElement('div');
        modal.className = 'error-modal';
        modal.innerHTML = `
            <div class="error-modal-content">
                <div class="error-modal-header">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Usage Limit Reached</h3>
                    <button class="close-button" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="error-modal-body">
                    <p>${message}</p>
                </div>
                <div class="error-modal-footer">
                    <a href="/settings" class="upgrade-button">Upgrade to Pro</a>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    function showErrorMessageAuth(message) {
        const modal = document.createElement('div');
        modal.className = 'error-modal';
        modal.innerHTML = `
            <div class="error-modal-content">
                <div class="error-modal-header">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Error</h3>
                    <button class="close-button" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="error-modal-body">
                    <p>${message}</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Add styles for the error modal
    const errorModalStyles = `
        .error-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        
        .error-modal-content {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            position: relative;
            text-align: center;
        }
        
        .error-modal-header {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 15px;
            position: relative;
        }
        
        .error-modal-header i {
            color: #e53e3e;
            font-size: 24px;
        }
        
        .error-modal-header h3 {
            margin: 0;
            color: #2d3748;
            text-align: center;
        }
        
        .error-modal-body {
            margin-bottom: 20px;
            text-align: center;
        }
        
        .error-modal-body p {
            margin: 0;
            color: #4a5568;
            line-height: 1.5;
        }
        
        .error-modal-footer {
            display: flex;
            justify-content: center;
            gap: 10px;
        }
        
        .upgrade-button {
            background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            text-decoration: none;
            font-weight: 500;
            transition: all 0.3s ease;
        }
        
        .upgrade-button:hover {
            background: linear-gradient(135deg, #3182ce 0%, #2c5282 100%);
        }

        .close-button {
            position: absolute;
            top: -10px;
            right: -10px;
            background: white;
            border: none;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            color: #4a5568;
            transition: all 0.3s ease;
        }

        .close-button:hover {
            background: #f7fafc;
            color: #2d3748;
        }
    `;

    // Add styles to document
    const styleSheet = document.createElement("style");
    styleSheet.textContent = errorModalStyles;
    document.head.appendChild(styleSheet);

    async function performSearch() {
        if (!searchSource.value) {
            alert('Please select a search source');
            return;
        }

        if (!searchQuery.value.trim()) {
            showErrorMessageAuth('Please enter a search query!');
            return;
        }

        spinner.style.display = 'block';
        searchResults.innerHTML = '';

        const params = new URLSearchParams({
            source: searchSource.value,
            query: searchQuery.value.trim(),
            max_results: maxResults.value
        });

        try {
            const response = await fetch(`/Quick_Search/Results?${params.toString()}`);
            
            if (response.status === 403) {
                const data = await response.json();
                showErrorMessage(data.error);
                spinner.style.display = 'none';
                return;
            }
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            const data = await response.json();

            spinner.style.display = 'none';
            const resultsHtml = await Promise.all(data.map(async (item) => {
                let imageUrl;
                if (item.cover_url) {
                    const imageExists = await checkImage(item.cover_url);
                    imageUrl = imageExists ? item.cover_url : 
                        (searchSource.value === 'books' ? '/static/images/book-placeholder.svg' : '/static/images/paper-placeholder.png');
                } else {
                    imageUrl = searchSource.value === 'books' ? '/static/images/book-placeholder.svg' : '/static/images/paper-placeholder.png';
                }
                const cleanItem = {...item};
                
                if (cleanItem.cover_url) {
                    cleanItem.cover_url = cleanItem.cover_url.replace(/\s+/g, '');
                }
                if (cleanItem.reading_url) {
                    cleanItem.reading_url = cleanItem.reading_url.replace(/\s+/g, '');
                }
                if (cleanItem.buy_link) {
                    cleanItem.buy_link = cleanItem.buy_link.replace(/\s+/g, '');
                }
                if (cleanItem.description) {
                    cleanItem.description = cleanItem.description.replace(/\r\n/g, '\n').replace(/"/g, '&quot;');
                }
                if (cleanItem.recommendation) {
                    cleanItem.recommendation = cleanItem.recommendation.replace(/\r\n/g, '\n').replace(/"/g, '&quot;');
                }
                const itemData = encodeURIComponent(JSON.stringify(cleanItem));
                
                return `
                    <div class="result-card" data-item="${itemData}" data-source="${searchSource.value}">
                        <img src="${imageUrl}" 
                             alt="${cleanItem.title}"
                             onerror="this.src='${searchSource.value === 'books' ? '/static/images/book-placeholder.svg' : '/static/images/paper-placeholder.png'}'">
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
                    }
                });
            });

        } catch (error) {
            spinner.style.display = 'none';
            searchResults.innerHTML = '<p class="error-message">An error occurred while searching. Please try again.</p>';
        }
    }

    window.showDetails = function(item, source) {
        let content;
        
        if (source === 'books') {
            const subjectsHtml = item.subjects && item.subjects.length > 0 
                ? `<div class="modal-book-subjects">
                    ${item.subjects.map(subject => `<span class="subject-tag">${subject}</span>`).join('')}
                   </div>`
                : '';
            
            const readOnlineHtml = item.reading_url
                ? `<div class="read-online-section">
                    <a href="${item.reading_url}" target="_blank" class="read-online-btn">
                        <i class="fas fa-book-reader"></i> Read Online
                    </a>
                   </div>`
                : '';
            
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
                            <button class="add-to-collection-btn" onclick="addToCollection(${JSON.stringify(item).replace(/"/g, '&quot;')}, 'book')">
                                <i class="fas fa-plus"></i> Add to Collection
                            </button>
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
                        <i class="fas fa-external-link-alt"></i> View Paper
                    </a>
                   </div>`
                : '';
            
            const downloadBtn = item.download_url
                ? `<div class="buy-section">
                    <a href="${item.download_url}" target="_blank" class="buy-btn">
                        <i class="fas fa-file-download"></i> ${item.is_open_access ? 'Download PDF' : 'Download PDF'}
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
                            <button class="add-to-collection-btn" onclick="addToCollection(${JSON.stringify(item).replace(/"/g, '&quot;')}, 'research')">
                                <i class="fas fa-plus"></i> Add to Collection
                            </button>
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
                            <button class="add-to-collection-btn" onclick="addToCollection(${JSON.stringify(item).replace(/"/g, '&quot;')}, 'archive')">
                                <i class="fas fa-plus"></i> Add to Collection
                            </button>
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

    searchButton.addEventListener('click', performSearch);

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        performSearch();
    });

    // Add modal closing functionality
    const bookModal = document.getElementById('bookModal');
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === bookModal) {
            closeModal();
        }
    });
    
    // Close modal on escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeModal();
        }
    });
    
    // Close modal function
    window.closeModal = function() {
        bookModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    };

    searchQuery.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });

    window.addToCollection = function(item, type) {
        
        const bookData = {
            title: item.title,
            author: item.author || (Array.isArray(item.authors) ? item.authors.join(', ') : item.all_authors),
            description: item.description || item.abstract || item.recommendation || '',
            cover_url: item.cover_url,
            total_pages: null,
            pages_read: 0,
            status: 'to-read',
            notes: '',
            source_url: item.reading_url || item.view_url || item.url || null,
            download_url: item.download_url || null,
            buy_link: item.buy_link || null,
            year: item.year || 'Unknown'
        };
        
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">Adding to your collection...</div>
        `;
        document.body.appendChild(loadingIndicator);
        
        addBookToCollection(bookData)
            .then(() => {
                loadingIndicator.remove();
            })
            .catch(error => {
                loadingIndicator.remove();
                // Check if this is the book tracking limit error
                if (error.message && error.message.includes('limit of 5 tracked books')) {
                    // Use the existing showErrorMessage function which already shows as a modal
                    showErrorMessage(error.message);
                } else {
                    // Use the error message component for other errors
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'error-message';
                    errorMsg.innerHTML = `
                        <i class="fas fa-exclamation-circle"></i>
                        ${error.message}
                    `;
                    document.body.appendChild(errorMsg);
                    
                    setTimeout(() => {
                        errorMsg.remove();
                    }, 5000);
                }
            });
    };
}); 