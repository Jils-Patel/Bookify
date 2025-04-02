document.addEventListener('DOMContentLoaded', function() {
    const findBooksBtn = document.getElementById('findBooksBtn');
    const userInput = document.getElementById('userInput');
    
    findBooksBtn.addEventListener('click', handleUserInput);
    
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleUserInput();
        }
    });
    
    addMessageToHistory('Hi! I\'m your AI assistant. I can help you find book recommendations, research papers (both recent and archival), or answer questions about books and academic topics. How can I help you today?');
});

let chatHistory = [];

function addMessageToHistory(message, isUser = false, items = null, responseType = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;
    
    if (items && items.length > 0) {
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = message;
        messageContent.appendChild(textDiv);
        
        const itemGrid = document.createElement('div');
        itemGrid.className = 'message-book-grid';
        
        const gridTitle = document.createElement('div');
        gridTitle.className = 'grid-title';
        
        if (responseType === 'RESEARCH_RECENT') {
            gridTitle.textContent = 'Recent Research Papers:';
        } else if (responseType === 'RESEARCH_ARCHIVE') {
            gridTitle.textContent = 'Archival Research & Documents:';
        } else {
            gridTitle.textContent = 'Book Recommendations:';
        }
        
        messageContent.appendChild(gridTitle);
        
        items.forEach(item => {
            let itemCard;
            if (responseType === 'RESEARCH_RECENT') {
                itemCard = createScholarCard(item);
            } else if (responseType === 'RESEARCH_ARCHIVE') {
                itemCard = createResearchCard(item);
            } else {
                itemCard = createBookCard(item);
            }
            itemGrid.appendChild(itemCard);
        });
        messageContent.appendChild(itemGrid);
        
        messageDiv.appendChild(messageContent);
    } else {
        // For text-only messages
        messageDiv.textContent = message;
    }
    
    const chatHistoryDiv = document.querySelector('.chat-history');
    chatHistoryDiv.appendChild(messageDiv);
    chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
    
    chatHistory.push({ message, isUser, items, responseType });
}

function handleUserInput() {
    const userInput = document.getElementById('userInput').value.trim();
    
    if (!userInput) {
        alert('Please enter your question or tell me what kind of books or research you\'re interested in.');
        return;
    }
    
    addMessageToHistory(userInput, true);
    document.getElementById('userInput').value = '';
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant-message';
    const typingContainer = document.createElement('div');
    typingContainer.className = 'typing-animation';
    const typingSpan = document.createElement('span');
    typingSpan.className = 'typing-dots';
    typingContainer.appendChild(typingSpan);
    loadingDiv.appendChild(typingContainer);

    document.querySelector('.chat-history').appendChild(loadingDiv);
    
    fetch('/recommend', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            user_input: userInput
        })
    })
    .then(response => response.json())
    .then(data => {
        loadingDiv.remove();
        
        if (data.response_type === 'BOOKS' || data.response_type === 'RESEARCH_RECENT' || data.response_type === 'RESEARCH_ARCHIVE') {
            addMessageToHistory(data.ai_response, false, data.books, data.response_type);
        } else {
            addMessageToHistory(data.ai_response, false);
        }
    })
    .catch(error => {
        loadingDiv.remove();
        addMessageToHistory('Sorry, I encountered an error while processing your request. Please try again.');
        console.error('Error:', error);
    });
}

function createBookCard(book) {
    const bookDiv = document.createElement('div');
    bookDiv.className = 'book-cover';
    
    const imageUrl = book.cover_url || "/static/images/book-placeholder.svg";
    
    bookDiv.innerHTML = `
        <div class="book-cover-wrapper">
            <img src="${imageUrl}" alt="${book.title} cover" 
                 onerror="this.src='/static/images/book-placeholder.svg'">
            ${book.has_ebook ? '<div class="ebook-badge"><i class="fas fa-book-open"></i> E-book</div>' : ''}
        </div>
        <p class="book-title">${book.title}</p>
        <p class="book-author">by ${book.author}</p>
        <p class="book-year">${book.year}</p>
    `;
    
    bookDiv.onclick = () => showModal(book);
    return bookDiv;
}

function createResearchCard(paper) {
    const paperDiv = document.createElement('div');
    paperDiv.className = 'book-cover research-paper';
    const imageUrl = paper.cover_url || "/static/images/research-placeholder.svg";
    
    paperDiv.innerHTML = `
        <div class="book-cover-wrapper">
            <img src="${imageUrl}" alt="${paper.title} cover" 
                 onerror="this.src='/static/images/research-placeholder.svg'">
            ${paper.has_ebook ? '<div class="ebook-badge"><i class="fas fa-file-pdf"></i> PDF</div>' : ''}
        </div>
        <p class="book-title">${paper.title}</p>
        <p class="book-author">by ${paper.author}</p>
        <p class="book-year">${paper.year}</p>
    `;
    
    paperDiv.onclick = () => showResearchModal(paper);
    return paperDiv;
}

function checkImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

function showModal(content) {
    const modal = document.getElementById('bookModal');
    const modalContent = document.getElementById('modalContent');
    
    if (typeof content === 'string') {
        modalContent.innerHTML = content;
    } else {
        const subjectsHtml = content.subjects && content.subjects.length > 0 
            ? `<div class="modal-book-subjects">
                ${content.subjects.map(subject => `<span class="subject-tag">${subject}</span>`).join('')}
               </div>`
            : '';
        
        const readOnlineHtml = content.has_ebook && content.reading_url
            ? `<div class="read-online-section">
                <a href="${content.reading_url}" target="_blank" class="read-online-btn">
                    <i class="fas fa-book-reader"></i> Read Online
                </a>
               </div>`
            : '';
        
        const buyButtonHtml = content.buy_link
            ? `<div class="buy-section">
                <a href="${content.buy_link}" target="_blank" class="buy-btn">
                    <i class="fas fa-shopping-cart"></i> Buy on Amazon
                </a>
               </div>`
            : '';
        
        modalContent.innerHTML = `
            <div class="modal-body">
                <div class="modal-book-info">
                    <div class="modal-book-cover">
                        <div class="book-cover-wrapper">
                            <img src="${content.cover_url}" alt="${content.title} cover" 
                                 onerror="this.src='/static/images/book-placeholder.svg'">
                            ${content.has_ebook ? '<div class="ebook-badge"><i class="fas fa-book-open"></i> E-book</div>' : ''}
                        </div>
                        <div class="action-buttons">
                            ${readOnlineHtml}
                            ${buyButtonHtml}
                            <button class="add-to-collection-btn" onclick="addToCollection(${JSON.stringify(content).replace(/"/g, '&quot;')}, 'book')">
                                <i class="fas fa-plus"></i> Add to Collection
                            </button>
                        </div>
                    </div>
                    <div class="modal-book-details">
                        <div class="modal-book-metadata">
                            <h2>${content.title}</h2>
                            <p>by ${content.author || content.authors || content.all_authors || 'Unknown'}</p>
                            <p>Published: ${content.year || 'Unknown'}</p>
                        </div>
                        ${subjectsHtml}
                        ${content.first_sentence ? `<p class="first-sentence">${content.first_sentence}</p>` : ''}
                        <div class="modal-book-recommendation">
                            <h3>Summary</h3>
                            <p>${content.recommendation || content.description || content.abstract || "No description available."}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function showResearchModal(paper) {
    const researchModalHtml = `
        <div class="modal-body">
            <div class="modal-book-info">
                <div class="modal-book-cover">
                    <div class="book-cover-wrapper">
                        <img src="${paper.cover_url || '/static/images/research-placeholder.svg'}" 
                             alt="${paper.title} cover"
                             onerror="this.src='/static/images/research-placeholder.svg'">
                        <div class="ebook-badge"><i class="fas fa-file-pdf"></i> PDF</div>
                    </div>
                    <div class="action-buttons">
                        ${paper.view_url ? `
                            <div class="read-online-section">
                                <a href="${paper.view_url}" target="_blank" class="read-online-btn">
                                    <i class="fas fa-book-reader"></i>Read Online
                                </a>
                            </div>
                        ` : ''}
                        ${paper.download_url ? `
                            <div class="read-online-section">
                                <a href="${paper.download_url}" target="_blank" class="read-online-btn">
                                    <i class="fas fa-download"></i>Download PDF
                                </a>
                            </div>
                        ` : ''}
                        <button class="add-to-collection-btn" onclick='addToCollection(${JSON.stringify(paper).replace(/"/g, '&quot;')})'>
                            <i class="fas fa-plus"></i>Add to Collection
                        </button>
                    </div>
                </div>
                <div class="modal-book-details">
                    <div class="modal-book-metadata">
                        <h2>${paper.title}</h2>
                        <p><strong>Author(s):</strong> ${paper.author || paper.authors || paper.all_authors || 'Unknown'}</p>
                        <p><strong>Year:</strong> ${paper.year || 'Unknown'}</p>
                        ${paper.journal ? `<p><strong>Journal:</strong> ${paper.journal}</p>` : ''}
                        ${paper.conference ? `<p><strong>Conference:</strong> ${paper.conference}</p>` : ''}
                    </div>
                    <div class="book-description">
                        <h3>Abstract</h3>
                        <p>${paper.abstract || paper.description || 'No abstract available.'}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.getElementById('bookModal');
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = researchModalHtml;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function showScholarModal(paper) {
    const scholarModalHtml = `
        <div class="modal-body">
            <div class="modal-book-info">
                <div class="modal-book-cover">
                    <div class="book-cover-wrapper">
                        <img src="${paper.cover_url || '/static/images/scholar-placeholder.svg'}" 
                             alt="${paper.title} cover"
                             onerror="this.src='/static/images/scholar-placeholder.svg'">
                        <div class="ebook-badge scholar-badge">
                            <i class="fas fa-file-alt"></i> ${paper.is_open_access ? 'Open Access' : (paper.has_ebook ? 'PDF' : 'Article')}
                        </div>
                    </div>
                    <div class="action-buttons">
                        ${paper.view_url ? `
                            <div class="read-online-section">
                                <a href="${paper.view_url}" target="_blank" class="read-online-btn">
                                    <i class="fas fa-book-reader"></i>View Online
                                </a>
                            </div>
                        ` : ''}
                        ${paper.download_url ? `
                            <div class="buy-section">
                                <a href="${paper.download_url}" target="_blank" class="buy-btn">
                                    <i class="fas fa-download"></i>Download PDF
                                </a>
                            </div>
                        ` : ''}
                        <button class="add-to-collection-btn" onclick='addToCollection(${JSON.stringify(paper).replace(/"/g, '&quot;')})'>
                            <i class="fas fa-plus"></i>Add to Collection
                        </button>
                    </div>
                </div>
                <div class="modal-book-details">
                    <div class="modal-book-metadata">
                        <h2>${paper.title}</h2>
                        <p><strong>Author(s):</strong> ${paper.author || paper.all_authors || 'Unknown'}</p>
                        <p><strong>Year:</strong> ${paper.year || 'Unknown'}</p>
                        ${paper.venue ? `<p><strong>Venue:</strong> <span class="venue-badge">${paper.venue}</span></p>` : ''}
                        ${paper.citation_count ? `
                            <div class="citation-stats">
                                <span class="citation-count">
                                    <i class="fas fa-quote-right"></i> ${paper.citation_count} citations
                                </span>
                                ${paper.influential_citation_count ? `
                                    <span class="influential-count">
                                        <i class="fas fa-star"></i> ${paper.influential_citation_count} influential
                                    </span>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                    <div class="book-description">
                        <h3>Abstract</h3>
                        <p>${paper.abstract || paper.description || 'No abstract available.'}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.getElementById('bookModal');
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = scholarModalHtml;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('bookModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

window.onclick = function(event) {
    const modal = document.getElementById('bookModal');
    if (event.target == modal) {
        closeModal();
    }
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});

function createScholarCard(paper) {
    const paperDiv = document.createElement('div');
    paperDiv.className = 'book-cover scholar-paper';
    const imageUrl = paper.cover_url || "/static/images/scholar-placeholder.svg";
    
    let badgeText = paper.has_ebook ? 'PDF' : 'Article';
    if (paper.is_open_access && paper.has_ebook) {
        badgeText = 'Open Access';
    }
    
    paperDiv.innerHTML = `
        <div class="book-cover-wrapper">
            <img src="${imageUrl}" alt="${paper.title} cover" 
                 onerror="this.src='/static/images/scholar-placeholder.svg'">
            <div class="ebook-badge"><i class="fas fa-file-alt"></i> ${badgeText}</div>
        </div>
        <p class="book-title">${paper.title}</p>
        <p class="book-author">by ${paper.author}</p>
        <p class="book-year">${paper.venue ? paper.venue + ' · ' : ''}${paper.year}</p>
    `;
    
    paperDiv.onclick = () => showScholarModal(paper);
    return paperDiv;
}

function addToCollection(item, type = 'book') {
    const id = 'book_' + Date.now();
    
    const bookData = {
        id: id,
        title: item.title,
        author: item.author || (Array.isArray(item.authors) ? item.authors.join(', ') : item.all_authors || 'Unknown'),
        year: item.year || 'Unknown',
        coverUrl: item.cover_url || '',
        description: item.description || item.recommendation || item.abstract || '',
        status: 'to-read',
        totalPages: item.page_count || 0,
        pagesRead: 0,
        notes: '',
        dateAdded: new Date().toISOString(),
        source_url: item.view_url || item.reading_url || '',
        download_url: item.download_url || '',
        buy_link: item.buy_link || '',
        has_ebook: item.has_ebook || false,
        is_open_access: item.is_open_access || false,
        venue: item.venue || '',
        citation_count: item.citation_count || 0,
        influential_citation_count: item.influential_citation_count || 0,
        subjects: item.subjects || []
    };
    
    // Get existing books from localStorage
    let books = [];
    const storedBooks = localStorage.getItem('bookTrackerBooks');
    if (storedBooks) {
        books = JSON.parse(storedBooks);
    }
    
    // Add the new book
    books.push(bookData);
    
    // Save back to localStorage
    localStorage.setItem('bookTrackerBooks', JSON.stringify(books));
    
    const successMsg = document.createElement('div');
    successMsg.className = 'success-message';
    successMsg.innerHTML = `<i class="fas fa-check-circle"></i> Added to your collection!`;
    document.body.appendChild(successMsg);
    
    setTimeout(() => {
        successMsg.remove();
    }, 3000);
}

function showCustomBookForm() {
    const modal = document.getElementById('bookModal');
    const modalContent = document.getElementById('modalContent');
    
    const formHtml = `
        <div class="modal-header">
            <h2>Add Custom Book</h2>
            <button class="close-button">&times;</button>
        </div>
        <div class="modal-body">
            <form id="customBookForm" class="custom-book-form" onsubmit="handleCustomBookSubmit(event)">
                <div class="form-group">
                    <label for="title">Title *</label>
                    <input type="text" id="title" name="title" required>
                </div>
                <div class="form-group">
                    <label for="author">Author *</label>
                    <input type="text" id="author" name="author" required>
                </div>
                <div class="form-group">
                    <label for="year">Year</label>
                    <input type="number" id="year" name="year" min="1000" max="${new Date().getFullYear()}">
                </div>
                <div class="form-group">
                    <label for="cover_url">Cover Image URL</label>
                    <input type="url" id="cover_url" name="cover_url">
                </div>
                <div class="form-group">
                    <label for="description">Description</label>
                    <textarea id="description" name="description"></textarea>
                </div>
                <div class="form-group">
                    <label for="page_count">Total Pages</label>
                    <input type="number" id="page_count" name="page_count" min="0">
                </div>
                <div class="form-group">
                    <label for="buy_link">Buy Link (Amazon or other)</label>
                    <input type="url" id="buy_link" name="buy_link">
                </div>
                <div class="form-group">
                    <label for="reading_url">Online Reading URL</label>
                    <input type="url" id="reading_url" name="reading_url">
                </div>
                <div class="form-group">
                    <label for="subjects">Subjects (comma-separated)</label>
                    <input type="text" id="subjects" name="subjects">
                </div>
                <div class="form-actions">
                    <button type="button" class="cancel-btn" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="submit-btn">Add Book</button>
                </div>
            </form>
        </div>
    `;
    
    modalContent.innerHTML = formHtml;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function handleCustomBookSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const bookData = {
        id: 'book_' + Date.now(),
        title: formData.get('title'),
        author: formData.get('author'),
        year: formData.get('year') || 'Unknown',
        cover_url: formData.get('cover_url') || '',
        description: formData.get('description') || '',
        page_count: parseInt(formData.get('page_count')) || 0,
        buy_link: formData.get('buy_link') || '',
        reading_url: formData.get('reading_url') || '',
        subjects: formData.get('subjects') ? formData.get('subjects').split(',').map(s => s.trim()) : [],
        status: 'to-read',
        pagesRead: 0,
        notes: '',
        dateAdded: new Date().toISOString(),
        has_ebook: !!formData.get('reading_url')
    };
    
    addToCollection(bookData, 'book');
    closeModal();
} 