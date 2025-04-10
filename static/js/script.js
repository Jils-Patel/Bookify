function addToCollection(item, type) {
    if (!firebase.auth().currentUser) {
        showErrorMessage('Please log in to add books to your collection');
        return;
    }
    
    const bookData = {
        title: item.title,
        author: item.author || (Array.isArray(item.authors) ? item.authors.join(', ') : item.all_authors),
        description: item.description || item.abstract || item.recommendation || '',
        cover_url: item.cover_url,
        total_pages: item.total_pages || null,
        pages_read: 0,
        status: 'to-read',
        notes: '',
        source_url: item.reading_url || item.view_url || item.url || null,
        download_url: item.download_url || null,
        buy_link: item.buy_link || null,
        year: item.year || 'Unknown'
    };
    
    showLoading('Adding to your collection...');
    
    fetch('/add_to_collection', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ book_data: bookData })
    })
    .then(response => {
        if (response.status === 403) {
            return response.json().then(data => {
                throw new Error(data.error);
            });
        }
        if (!response.ok) {
            throw new Error('Failed to add book to collection');
        }
        return response.json();
    })
    .then(data => {
        hideLoading();
        showSuccessMessage(`Added "${bookData.title}" to your collection!`);
    })
    .catch(error => {
        hideLoading();
        showErrorMessage(error.message);
    });
}

function createBookCard(book) {
    const card = document.createElement('div');
    card.className = 'book-cover';
    
    const coverWrapper = document.createElement('div');
    coverWrapper.className = 'book-cover-wrapper';
    
    const img = document.createElement('img');
    img.src = book.cover_url || '/static/images/book-placeholder.svg';
    img.alt = book.title;
    img.onerror = function() {
        this.src = '/static/images/book-placeholder.svg';
    };
    coverWrapper.appendChild(img);
    
    if (book.has_ebook) {
        const badge = document.createElement('div');
        badge.className = 'ebook-badge';
        badge.innerHTML = '<i class="fas fa-book-open"></i> E-book';
        coverWrapper.appendChild(badge);
    }
    
    card.appendChild(coverWrapper);
    
    const info = document.createElement('div');
    info.className = 'book-info';
    info.innerHTML = `
        <div class="book-title">${book.title}</div>
        <div class="book-author">${book.author}</div>
        <div class="book-year">${book.year || ''}</div>
    `;
    card.appendChild(info);
    card.addEventListener('click', () => showBookDetails(book));
    return card;
}

// Add to Collection button styles
const addToCollectionStyles = `
    .add-to-collection-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 12px 20px;
        background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1em;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-top: 15px;
        box-shadow: 0 2px 4px rgba(66, 153, 225, 0.2);
    }

    .add-to-collection-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(66, 153, 225, 0.3);
        background: linear-gradient(135deg, #3182ce 0%, #2c5282 100%);
    }

    .add-to-collection-btn:active {
        transform: translateY(0);
    }

    .add-to-collection-btn i {
        font-size: 1.1em;
    }

    .success-message {
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        animation: slideIn 0.3s ease-out, fadeOut 0.3s ease-in 2.7s forwards;
        z-index: 1000;
    }
`;

const styleSheet = document.createElement("style");
styleSheet.textContent = addToCollectionStyles;
document.head.appendChild(styleSheet);

function showBookDetails(book) {
    const modal = document.getElementById('bookModal');
    const modalContent = document.getElementById('modalContent');
    
    let content = `
        <div class="modal-book-info">
            <div class="modal-book-cover">
                <div class="book-cover-wrapper">
                    <img src="${book.cover_url || '/static/images/book-placeholder.svg'}" 
                         alt="${book.title} cover" 
                         onerror="this.src='/static/images/book-placeholder.svg'">
                    ${book.has_ebook ? '<div class="ebook-badge"><i class="fas fa-book-open"></i> E-book</div>' : ''}
                </div>
                <div class="action-buttons">
                    ${book.reading_url ? `
                        <a href="${book.reading_url}" target="_blank" class="read-online-btn">
                            <i class="fas fa-book-reader"></i> Read Online
                        </a>
                    ` : ''}
                    ${book.buy_link ? `
                        <a href="${book.buy_link}" target="_blank" class="buy-btn">
                            <i class="fas fa-shopping-cart"></i> Buy on Amazon
                        </a>
                    ` : ''}
                    <button class="add-to-collection-btn" onclick="addToCollection(${JSON.stringify(book).replace(/"/g, '&quot;')}, 'book')">
                        <i class="fas fa-plus"></i> Add to Collection
                    </button>
                </div>
            </div>
            <div class="modal-book-details">
                <h2 class="modal-book-title">${book.title}</h2>
                <div class="modal-book-metadata">
                    <p>by ${book.author}</p>
                    <p>Published: ${book.year || 'Unknown'}</p>
                </div>
                <div class="modal-book-recommendation">
                    <h3>Description</h3>
                    <p>${book.recommendation || book.description || 'No description available.'}</p>
                </div>
            </div>
        </div>
    `;
    
    modalContent.innerHTML = content;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

window.addToCollection = addToCollection;
window.showBookDetails = showBookDetails; 