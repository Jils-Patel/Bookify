// Book Tracker JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const bookTitleInput = document.getElementById('bookTitle');
    const bookAuthorInput = document.getElementById('bookAuthor');
    const bookStatusInput = document.getElementById('bookStatus');
    const totalPagesInput = document.getElementById('totalPages');
    const pagesReadInput = document.getElementById('pagesRead');
    const coverUrlInput = document.getElementById('coverUrl');
    const bookDescriptionInput = document.getElementById('bookDescription');
    const bookNotesInput = document.getElementById('bookNotes');
    const saveBookBtn = document.getElementById('saveBookBtn');
    const booksList = document.getElementById('booksList');
    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchInput');
    
    // Stats elements
    const totalBooksEl = document.getElementById('totalBooks');
    const readingCountEl = document.getElementById('readingCount');
    const toReadCountEl = document.getElementById('toReadCount');
    const finishedCountEl = document.getElementById('finishedCount');
    
    // Current book being edited (if any)
    let currentEditId = null;
    
    // Load books from local storage
    let books = loadBooks();
    
    // Initialize
    renderBooks();
    updateStats();
    
    // Event Listeners
    saveBookBtn.addEventListener('click', saveBook);
    statusFilter.addEventListener('change', renderBooks);
    searchInput.addEventListener('input', renderBooks);
    
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
    
    // Functions
    function loadBooks() {
        const storedBooks = localStorage.getItem('bookTrackerBooks');
        return storedBooks ? JSON.parse(storedBooks) : [];
    }
    
    function saveBooks() {
        localStorage.setItem('bookTrackerBooks', JSON.stringify(books));
    }
    
    function updateStats() {
        const totalBooks = books.length;
        const reading = books.filter(book => book.status === 'reading').length;
        const toRead = books.filter(book => book.status === 'to-read').length;
        const finished = books.filter(book => book.status === 'finished').length;
        
        totalBooksEl.textContent = totalBooks;
        readingCountEl.textContent = reading;
        toReadCountEl.textContent = toRead;
        finishedCountEl.textContent = finished;
    }
    
    function renderBooks() {
        const statusFilterValue = statusFilter.value;
        const searchTerm = searchInput.value.toLowerCase();
        
        // Filter books based on status and search term
        const filteredBooks = books.filter(book => {
            const matchesStatus = statusFilterValue === 'all' || book.status === statusFilterValue;
            const matchesSearch = book.title.toLowerCase().includes(searchTerm) || 
                                book.author.toLowerCase().includes(searchTerm);
            return matchesStatus && matchesSearch;
        });
        
        if (filteredBooks.length === 0) {
            booksList.innerHTML = `
                <div class="empty-state">
                    <p>No books found. Add books from the Book Discovery or Quick Search pages!</p>
                </div>
            `;
            return;
        }
        
        booksList.innerHTML = filteredBooks.map(book => createBookCard(book)).join('');
    }
    
    function createBookCard(book) {
        const progress = book.totalPages ? Math.round((book.pagesRead / book.totalPages) * 100) : null;
        const statusClass = `status-${book.status.replace(/\s+/g, '-')}`;
        const statusText = {
            'to-read': 'To Read',
            'reading': 'Reading',
            'finished': 'Finished'
        }[book.status];
        
        return `
            <div class="book-card" onclick="showBookDetails('${book.id}')">
                <div class="book-cover">
                    <img src="${book.coverUrl || '/static/images/book-placeholder.svg'}" 
                         alt="${book.title} cover"
                         onerror="this.src='/static/images/book-placeholder.svg'">
                </div>
                <div class="book-info">
                    <div class="book-status ${statusClass}">${statusText}</div>
                    <h3 class="book-title">${book.title}</h3>
                    <p class="book-author">by ${book.author}</p>
                    <p class="book-year">${book.year || 'Unknown'}</p>
                    ${progress !== null ? `
                        <div class="progress-bar">
                            <div class="progress" style="width: ${progress}%"></div>
                        </div>
                        <p class="progress-text">${progress}% completed (${book.pagesRead}/${book.totalPages} pages)</p>
                    ` : ''}
                </div>
                <div class="book-actions">
                    <button onclick="event.stopPropagation(); editBook('${book.id}')" class="icon-button edit-btn" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="event.stopPropagation(); showDeleteConfirm('${book.id}', '${book.title}')" class="icon-button delete-btn" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    function showBookDetails(id) {
        const book = books.find(book => book.id === id);
        if (!book) return;
        
        const progress = book.totalPages ? Math.round((book.pagesRead / book.totalPages) * 100) : null;
        const statusClass = `status-${book.status.replace(/\s+/g, '-')}`;
        const statusText = {
            'to-read': 'To Read',
            'reading': 'Reading',
            'finished': 'Finished'
        }[book.status];
        
        const modal = document.getElementById('bookModal');
        const modalContent = document.getElementById('modalContent');
        
        // Create action buttons based on available sources
        const readOnlineBtn = book.source_url ? `
            <div class="read-online-section">
                <a href="${book.source_url}" target="_blank" class="read-online-btn">
                    <i class="fas fa-book-reader"></i> Read Online
                </a>
            </div>
        ` : '';
        
        const downloadBtn = book.download_url ? `
            <div class="buy-section">
                <a href="${book.download_url}" target="_blank" class="buy-btn">
                    <i class="fas fa-file-download"></i> Download PDF
                </a>
            </div>
        ` : '';
        
        const buyBtn = book.buy_link ? `
            <div class="buy-section">
                <a href="${book.buy_link}" target="_blank" class="buy-btn">
                    <i class="fas fa-shopping-cart"></i> Buy on Amazon
                </a>
            </div>
        ` : '';
        
        modalContent.innerHTML = `
            <div class="book-detail-header">
                <div class="book-detail-cover">
                    <img src="${book.coverUrl || '/static/images/book-placeholder.svg'}" 
                         alt="${book.title} cover"
                         onerror="this.src='/static/images/book-placeholder.svg'">
                        
                         <div class="action-buttons">
                        ${readOnlineBtn}
                        ${downloadBtn}
                        ${buyBtn}
                    </div>
                </div>
                <div class="book-detail-info">
                    <h2 class="book-detail-title">${book.title}</h2>
                    <p class="book-detail-author">by ${book.author}</p>
                    <p class="book-detail-year">${book.year || 'Unknown'}</p>
                    <div class="book-detail-status ${statusClass}">${statusText}</div>
                    ${progress !== null ? `
                        <div class="book-detail-progress">
                            <div class="progress-bar">
                                <div class="progress" style="width: ${progress}%"></div>
                            </div>
                            <p class="progress-text">${progress}% completed (${book.pagesRead}/${book.totalPages} pages)</p>
                        </div>
                    ` : ''}
                    ${book.description ? `
                        <div class="book-detail-section">
                            <h3>Description</h3>
                            <p class="book-detail-description">${book.description}</p>
                        </div>
                    ` : ''}
                    ${book.notes ? `
                        <div class="book-detail-section">
                            <h3>Notes</h3>
                            <p class="book-detail-notes">${book.notes}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
    
    function editBook(id) {
        const book = books.find(book => book.id === id);
        if (!book) return;
        
        bookTitleInput.value = book.title;
        bookAuthorInput.value = book.author;
        bookStatusInput.value = book.status;
        totalPagesInput.value = book.totalPages || '';
        pagesReadInput.value = book.pagesRead || '';
        coverUrlInput.value = book.coverUrl || '';
        bookDescriptionInput.value = book.description || '';
        bookNotesInput.value = book.notes || '';
        
        currentEditId = id;
        
        const formModal = document.getElementById('formModal');
        formModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
    
    function saveBook() {
        const bookData = {
            title: bookTitleInput.value.trim(),
            author: bookAuthorInput.value.trim(),
            status: bookStatusInput.value,
            totalPages: totalPagesInput.value ? parseInt(totalPagesInput.value) : null,
            pagesRead: pagesReadInput.value ? parseInt(pagesReadInput.value) : 0,
            coverUrl: coverUrlInput.value.trim(),
            description: bookDescriptionInput.value.trim(),
            notes: bookNotesInput.value.trim()
        };
        
        if (!bookData.title || !bookData.author) {
            alert('Title and author are required!');
            return;
        }
        
        if (currentEditId) {
            // Update existing book
            const index = books.findIndex(book => book.id === currentEditId);
            if (index !== -1) {
                books[index] = { ...books[index], ...bookData };
            }
        } else {
            // Add new book
            const newBook = {
                ...bookData,
                id: 'book_' + Date.now(),
                dateAdded: new Date().toISOString(),
                has_ebook: false,
                subjects: []
            };
            books.push(newBook);
        }
        
        saveBooks();
        renderBooks();
        updateStats();
        closeFormModal();
        
        // Show success message
        showSuccessMessage(currentEditId ? 'Book updated successfully!' : 'Book added successfully!');
    }
    
    function deleteBook(id) {
        books = books.filter(book => book.id !== id);
        saveBooks();
        renderBooks();
        updateStats();
        
        // Show success message
        const successMsg = document.createElement('div');
        successMsg.className = 'success-message';
        successMsg.innerHTML = `<i class="fas fa-check-circle"></i> Book deleted successfully!`;
        document.body.appendChild(successMsg);
        
        // Remove the message after 3 seconds
        setTimeout(() => {
            successMsg.remove();
        }, 3000);
    }
    
    function showSuccessMessage(message) {
        const successMsg = document.createElement('div');
        successMsg.className = 'success-message';
        successMsg.innerHTML = `
            <i class="fas fa-check-circle"></i>
            ${message}
        `;
        document.body.appendChild(successMsg);
        
        // Remove the message after 3 seconds
        setTimeout(() => {
            successMsg.remove();
        }, 3000);
    }
    
    // Export functions to window for use in inline handlers
    window.showBookDetails = showBookDetails;
    window.editBook = editBook;
    window.deleteBook = deleteBook;
    window.showSuccessMessage = showSuccessMessage;
    window.showCustomBookForm = showCustomBookForm;
    
    window.showDeleteConfirm = function(id, title) {
        const modal = document.getElementById('deleteConfirmModal');
        const bookTitleSpan = document.getElementById('deleteBookTitle');
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        
        bookTitleSpan.textContent = title;
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Remove any existing click handler
        confirmDeleteBtn.replaceWith(confirmDeleteBtn.cloneNode(true));
        
        // Add new click handler
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
            deleteBook(id);
            closeDeleteConfirmModal();
        });
    };
    
    window.closeModal = function() {
        const modal = document.getElementById('bookModal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    };
    
    window.closeFormModal = function() {
        const formModal = document.getElementById('formModal');
        formModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        currentEditId = null;
    };
    
    window.closeDeleteConfirmModal = function() {
        const modal = document.getElementById('deleteConfirmModal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    };
    
    // Add custom book button click handler
    function showCustomBookForm() {
        // Reset all form inputs
        bookTitleInput.value = '';
        bookAuthorInput.value = '';
        bookStatusInput.value = 'to-read';
        totalPagesInput.value = '';
        pagesReadInput.value = '';
        coverUrlInput.value = '';
        bookDescriptionInput.value = '';
        bookNotesInput.value = '';
        
        // Set currentEditId to null to indicate this is a new book
        currentEditId = null;
        
        // Show the form modal
        const formModal = document.getElementById('formModal');
        formModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
});

// Modal functions
function closeModal() {
    const modal = document.getElementById('bookModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Handle custom book form submission
function handleCustomBookSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const bookData = {
        id: 'book_' + Date.now(),
        title: formData.get('title'),
        author: formData.get('author'),
        year: formData.get('year') || 'Unknown',
        coverUrl: formData.get('cover_url') || '',
        description: formData.get('description') || '',
        totalPages: parseInt(formData.get('page_count')) || 0,
        pagesRead: 0,
        status: 'to-read',
        notes: '',
        dateAdded: new Date().toISOString(),
        source_url: formData.get('reading_url') || '',
        buy_link: formData.get('buy_link') || '',
        has_ebook: !!formData.get('reading_url'),
        subjects: formData.get('subjects') ? formData.get('subjects').split(',').map(s => s.trim()) : []
    };
    
    // Get existing books from localStorage
    let books = loadBooks();
    
    // Add the new book
    books.push(bookData);
    
    // Save back to localStorage
    localStorage.setItem('bookTrackerBooks', JSON.stringify(books));
    
    // Show success message
    const successMsg = document.createElement('div');
    successMsg.className = 'success-message';
    successMsg.innerHTML = `<i class="fas fa-check-circle"></i> Added to your collection!`;
    document.body.appendChild(successMsg);
    
    // Remove the message after 3 seconds
    setTimeout(() => {
        successMsg.remove();
    }, 3000);
    
    // Close modal and refresh book list
    closeModal();
    renderBooks();
    updateStats();
} 