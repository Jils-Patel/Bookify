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
    
    // Add initial welcome message
    addMessageToHistory('Hi! I\'m your AI assistant. I can help you find book recommendations, research papers (both recent and archival), or answer questions about books and academic topics. How can I help you today?');
});

let chatHistory = [];

function addMessageToHistory(message, isUser = false, items = null, responseType = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;
    
    if (items && items.length > 0) {
        // Create a message container for both text and items (books or papers)
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Add the text message
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = message;
        messageContent.appendChild(textDiv);
        
        // Add the item grid (books or research papers)
        const itemGrid = document.createElement('div');
        itemGrid.className = 'message-book-grid';
        
        // Add a different title based on response type
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
    
    // Add user message to chat
    addMessageToHistory(userInput, true);
    
    // Clear input
    document.getElementById('userInput').value = '';
    
    // Show loading state
    // Show loading state
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant-message';

    // Create typing animation
    const typingContainer = document.createElement('div');
    typingContainer.className = 'typing-animation';
    const typingSpan = document.createElement('span');
    typingSpan.className = 'typing-dots';
    typingContainer.appendChild(typingSpan);
    loadingDiv.appendChild(typingContainer);

    document.querySelector('.chat-history').appendChild(loadingDiv);
    
    // Get response
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
        // Remove loading message
        loadingDiv.remove();
        
        // Add assistant response based on response type
        if (data.response_type === 'BOOKS' || data.response_type === 'RESEARCH_RECENT' || data.response_type === 'RESEARCH_ARCHIVE') {
            // Add response with both message and items
            addMessageToHistory(data.ai_response, false, data.books, data.response_type);
        } else {
            // Add text-only response
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
    
    // Use Internet Archive thumbnail or placeholder
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

function showModal(book) {
    const modal = document.getElementById('bookModal');
    const modalContent = document.getElementById('modalContent');
    
    const subjectsHtml = book.subjects && book.subjects.length > 0 
        ? `<div class="modal-book-subjects">
            ${book.subjects.map(subject => `<span class="subject-tag">${subject}</span>`).join('')}
           </div>`
        : '';
    
    // Create a read online button if available
    const readOnlineHtml = book.has_ebook && book.reading_url
        ? `<div class="read-online-section">
            <a href="${book.reading_url}" target="_blank" class="read-online-btn">
                <i class="fas fa-book-reader"></i> Read Online
            </a>
           </div>`
        : '';
    
    // Create Amazon buy button
    const buyButtonHtml = book.buy_link
        ? `<div class="buy-section">
            <a href="${book.buy_link}" target="_blank" class="buy-btn">
                <i class="fas fa-shopping-cart"></i> Buy on Amazon
            </a>
           </div>`
        : '';
    
    modalContent.innerHTML = `
        <div class="modal-book-info">
            <div class="modal-book-cover">
                <div class="book-cover-wrapper">
                    <img src="${book.cover_url}" alt="${book.title} cover" 
                         onerror="this.src='/static/images/book-placeholder.svg'">
                         <div class="action-buttons">
                        ${readOnlineHtml}
                        ${buyButtonHtml}
                    </div>
                    ${book.has_ebook ? '<div class="ebook-badge"><i class="fas fa-book-open"></i> E-book</div>' : ''}
                </div>
            </div>
            <div class="modal-book-details">
                <h2 class="modal-book-title">${book.title}</h2>
                <div class="modal-book-metadata">
                    <p>by ${book.author}</p>
                    <p>Published: ${book.year}</p>
                </div>
                ${subjectsHtml}
                
                ${book.first_sentence ? `<p class="first-sentence">${book.first_sentence}</p>` : ''}
                <div class="modal-book-recommendation">
                    <h3>Summary</h3>
                    <p>${book.recommendation || ""}</p>
                </div>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function showResearchModal(paper) {
    const modal = document.getElementById('bookModal');
    const modalContent = document.getElementById('modalContent');
    
    // Build subjects HTML if available
    let subjectsHtml = '';
    if (paper.subjects && paper.subjects.length > 0) {
        subjectsHtml = `
        <div class="modal-book-subjects">
            ${paper.subjects.map(subject => `<span class="subject-tag">${subject}</span>`).join('')}
        </div>`;
    }
    
    // Build view/download buttons
    let viewOnlineBtn = '';
    if (paper.view_url) {
        viewOnlineBtn = `
        <div class="read-online-section">
            <a href="${paper.view_url}" target="_blank" class="read-online-btn">
                <i class="fas fa-external-link-alt"></i> View Online
            </a>
        </div>`;
    }
    
    let downloadBtn = '';
    if (paper.download_url) {
        downloadBtn = `
        <div class="buy-section">
            <a href="${paper.download_url}" target="_blank" class="buy-btn">
                <i class="fas fa-file-download"></i> Download PDF
            </a>
        </div>`;
    }
    
    // Format description (use recommendation if available)
    const description = paper.recommendation || paper.description || 'No description available.';
    
    // Construct the modal HTML
    modalContent.innerHTML = `
        <div class="modal-book-info">
            <div class="modal-book-cover">
                <div class="book-cover-wrapper">
                    <img src="${paper.cover_url || '/static/images/research-placeholder.svg'}" 
                        alt="${paper.title}" 
                        onerror="this.src='/static/images/research-placeholder.svg'">
                    ${paper.has_ebook ? '<div class="ebook-badge"><i class="fas fa-file-pdf"></i> PDF</div>' : ''}
                </div>
                <div class="action-buttons">
                    ${viewOnlineBtn}
                    ${downloadBtn}
                </div>
            </div>
            <div class="modal-book-details">
                <h2 class="modal-book-title">${paper.title}</h2>
                <div class="modal-book-metadata">
                    <p>By ${paper.author} <span class="year-badge">${paper.year}</span></p>
                </div>
                ${subjectsHtml}
                <div class="modal-book-recommendation">
                    <p>${description}</p>
                </div>
            </div>
        </div>
    `;
    
    // Show the modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('bookModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('bookModal');
    if (event.target == modal) {
        closeModal();
    }
}

// Close modal on escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});

// Create a new function for Semantic Scholar papers
function createScholarCard(paper) {
    const paperDiv = document.createElement('div');
    paperDiv.className = 'book-cover scholar-paper';
    
    // Use Semantic Scholar thumbnail or placeholder
    const imageUrl = paper.cover_url || "/static/images/scholar-placeholder.svg";
    
    // Create badge text
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

// Function for Semantic Scholar paper modals
function showScholarModal(paper) {
    const modal = document.getElementById('bookModal');
    const modalContent = document.getElementById('modalContent');
    
    // Format citation information
    let citationHtml = '';
    if (paper.citation_count > 0) {
        citationHtml = `
        <div class="citation-stats">
            <span class="citation-count">
                <i class="fas fa-quote-right"></i> ${paper.citation_count} citations
            </span>
            ${paper.influential_citation_count > 0 ? 
                `<span class="influential-count">
                    <i class="fas fa-star"></i> ${paper.influential_citation_count} influential
                </span>` : 
                ''}
        </div>`;
    }
    
    // Build view/download buttons
    let viewOnlineBtn = '';
    if (paper.view_url) {
        viewOnlineBtn = `
        <div class="read-online-section">
            <a href="${paper.view_url}" target="_blank" class="read-online-btn">
                <i class="fas fa-external-link-alt"></i> View on Semantic Scholar
            </a>
        </div>`;
    }
    
    let downloadBtn = '';
    if (paper.download_url) {
        downloadBtn = `
        <div class="buy-section">
            <a href="${paper.download_url}" target="_blank" class="buy-btn">
                <i class="fas fa-file-download"></i> ${paper.is_open_access ? 'Download Open Access PDF' : 'Download PDF'}
            </a>
        </div>`;
    }
    
    // Format description (use abstract if available)
    const description = paper.abstract || paper.description || 'No abstract available for this paper.';
    
    // Construct the modal HTML
    modalContent.innerHTML = `
        <div class="modal-book-info">
            <div class="modal-book-cover">
                <div class="book-cover-wrapper">
                    <img src="${paper.cover_url || '/static/images/scholar-placeholder.svg'}" 
                        alt="${paper.title}" 
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
                <h2 class="modal-book-title">${paper.title}</h2>
                <div class="modal-book-metadata">
                    <p>By ${paper.all_authors || paper.author}</p>
                    <p>Published: <span class="year-badge">${paper.year}</span> in <span class="venue-badge">${paper.venue || 'Unknown Venue'}</span></p>
                </div>
                ${citationHtml}
                <div class="modal-book-recommendation">
                    <h3>Abstract</h3>
                    <p>${description}</p>
                </div>
            </div>
        </div>
    `;
    
    // Show the modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
} 