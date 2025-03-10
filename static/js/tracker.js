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
    const addBookFloatingBtn = document.getElementById('addBookFloatingBtn');
    const formModal = document.getElementById('formModal');
    const formTitle = document.getElementById('formTitle');
    const booksList = document.getElementById('booksList');
    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchInput');
    
    // Search book elements
    const bookSearchInput = document.getElementById('bookSearchInput');
    const searchBookBtn = document.getElementById('searchBookBtn');
    const searchResults = document.getElementById('searchResults');
    
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
    addBookFloatingBtn.addEventListener('click', showAddBookModal);
    saveBookBtn.addEventListener('click', saveBook);
    statusFilter.addEventListener('change', renderBooks);
    searchInput.addEventListener('input', renderBooks);
    
    // Add search book functionality
    searchBookBtn.addEventListener('click', searchBooks);
    bookSearchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchBooks();
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
    
    function showAddBookModal() {
        clearForm();
        formTitle.textContent = 'Add New Book';
        saveBookBtn.textContent = 'Add Book';
        currentEditId = null;
        formModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        bookTitleInput.focus();
    }
    
    function saveBook() {
        // Validate required fields
        if (!bookTitleInput.value || !bookAuthorInput.value) {
            alert('Please enter at least a title and author.');
            return;
        }
        
        const bookData = {
            title: bookTitleInput.value,
            author: bookAuthorInput.value,
            status: bookStatusInput.value,
            totalPages: totalPagesInput.value ? parseInt(totalPagesInput.value) : null,
            pagesRead: pagesReadInput.value ? parseInt(pagesReadInput.value) : 0,
            coverUrl: coverUrlInput.value || "https://via.placeholder.com/150x200?text=No+Cover+Available",
            description: bookDescriptionInput.value,
            notes: bookNotesInput.value,
            dateAdded: new Date().toISOString()
        };
        
        if (currentEditId) {
            // Update existing book
            const index = books.findIndex(book => book.id === currentEditId);
            if (index !== -1) {
                bookData.id = currentEditId;
                books[index] = bookData;
            }
        } else {
            // Add new book
            bookData.id = generateId();
            books.push(bookData);
        }
        
        saveBooks();
        closeFormModal();
        renderBooks();
        updateStats();
    }
    
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
    
    function clearForm() {
        bookTitleInput.value = '';
        bookAuthorInput.value = '';
        bookStatusInput.value = 'to-read';
        totalPagesInput.value = '';
        pagesReadInput.value = '';
        coverUrlInput.value = '';
        bookDescriptionInput.value = '';
        bookNotesInput.value = '';
    }
    
    function closeFormModal() {
        formModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        currentEditId = null;
    }
    
    function renderBooks() {
        const filterStatus = statusFilter.value;
        const searchTerm = searchInput.value.toLowerCase();
        
        // Filter books
        let filteredBooks = books;
        
        if (filterStatus !== 'all') {
            filteredBooks = filteredBooks.filter(book => book.status === filterStatus);
        }
        
        if (searchTerm) {
            filteredBooks = filteredBooks.filter(book => 
                book.title.toLowerCase().includes(searchTerm) || 
                book.author.toLowerCase().includes(searchTerm)
            );
        }
        
        // Clear books list
        booksList.innerHTML = '';
        
        // Show empty state if no books
        if (filteredBooks.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            
            if (books.length === 0) {
                emptyState.innerHTML = '<p>No books added yet. Click the + button to add a book!</p>';
            } else {
                emptyState.innerHTML = '<p>No books match your current filters.</p>';
            }
            
            booksList.appendChild(emptyState);
            return;
        }
        
        // Render each book
        filteredBooks.forEach(book => {
            const bookCard = createBookCard(book);
            booksList.appendChild(bookCard);
        });
    }
    
    function createBookCard(book) {
        const bookCard = document.createElement('div');
        bookCard.className = 'book-card';
        
        let statusClass = '';
        let statusText = '';
        
        switch (book.status) {
            case 'to-read':
                statusClass = 'status-to-read';
                statusText = 'To Read';
                break;
            case 'reading':
                statusClass = 'status-reading';
                statusText = 'Reading';
                break;
            case 'finished':
                statusClass = 'status-finished';
                statusText = 'Finished';
                break;
        }
        
        // Calculate progress percentage
        let progressPercent = 0;
        let progressText = '';
        
        if (book.totalPages) {
            progressPercent = Math.min(100, Math.round((book.pagesRead / book.totalPages) * 100));
            progressText = `${book.pagesRead} / ${book.totalPages} pages (${progressPercent}%)`;
        }
        
        bookCard.innerHTML = `
            <div class="book-status ${statusClass}">${statusText}</div>
            <div class="book-card-inner">
                <div class="book-cover-container">
                    <img src="${book.coverUrl || '/static/images/book-placeholder.svg'}" alt="${book.title} cover" 
                         onerror="this.src='/static/images/book-placeholder.svg'">
                </div>
                <div class="book-info">
                    <h3 class="book-title">${book.title}</h3>
                    <p class="book-author">by ${book.author}</p>
                    ${book.totalPages ? `
                        <div class="progress-container">
                            <div class="progress-bar" style="width: ${progressPercent}%"></div>
                        </div>
                        <p class="progress-text">${progressText}</p>
                    ` : ''}
                    <div class="book-actions">
                        <button class="book-action-btn edit-btn" data-id="${book.id}" title="Edit Book">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="book-action-btn delete-btn" data-id="${book.id}" title="Delete Book">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners to the actions
        bookCard.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            showEditModal(book.id);
        });
        
        bookCard.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            showDeleteConfirmModal(book.id, book.title);
        });
        
        // Open details modal on card click
        bookCard.addEventListener('click', () => {
            showBookDetails(book);
        });
        
        return bookCard;
    }
    
    function showEditModal(id) {
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
        formTitle.textContent = 'Edit Book';
        saveBookBtn.textContent = 'Update Book';
        
        formModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
    
    function deleteBook(id) {
        const index = books.findIndex(book => book.id === id);
        if (index !== -1) {
            books.splice(index, 1);
            saveBooks();
            renderBooks();
            updateStats();
        }
    }
    
    function showBookDetails(book) {
        const modal = document.getElementById('bookModal');
        const modalContent = document.getElementById('modalContent');
        
        let statusClass = '';
        let statusText = '';
        
        switch (book.status) {
            case 'to-read':
                statusClass = 'status-to-read';
                statusText = 'To Read';
                break;
            case 'reading':
                statusClass = 'status-reading';
                statusText = 'Reading';
                break;
            case 'finished':
                statusClass = 'status-finished';
                statusText = 'Finished';
                break;
        }
        
        // Calculate progress
        let progressHtml = '';
        if (book.totalPages) {
            const progressPercent = Math.min(100, Math.round((book.pagesRead / book.totalPages) * 100));
            progressHtml = `
                <div class="book-detail-progress">
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${progressPercent}%"></div>
                    </div>
                    <p class="progress-text">${book.pagesRead} / ${book.totalPages} pages (${progressPercent}%)</p>
                </div>
            `;
        }
        
        modalContent.innerHTML = `
            <div class="book-detail-header">
                <div class="book-detail-cover">
                    <img src="${book.coverUrl}" alt="${book.title} cover" 
                         onerror="this.src='https://via.placeholder.com/150x200?text=No+Cover+Available'">
                </div>
                <div class="book-detail-info">
                    <h2 class="book-detail-title">${book.title}</h2>
                    <p class="book-detail-author">by ${book.author}</p>
                    <div class="book-detail-status ${statusClass}">${statusText}</div>
                    ${progressHtml}
                </div>
            </div>
            
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
            
            <div class="book-detail-actions">
                <button class="primary-button" onclick="editBook('${book.id}')">Edit</button>
                <button class="secondary-button" onclick="closeModal()">Close</button>
            </div>
        `;
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
    
    // Export functions to window for use in inline handlers
    window.closeModal = function() {
        const modal = document.getElementById('bookModal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    };
    
    window.closeFormModal = function() {
        closeFormModal();
    };
    
    window.editBook = function(id) {
        closeModal(); // Close details modal
        showEditModal(id); // Open edit modal
    };
    
    // Close modals when clicking outside
    window.onclick = function(event) {
        const bookModal = document.getElementById('bookModal');
        const formModal = document.getElementById('formModal');
        
        if (event.target == bookModal) {
            closeModal();
        }
        
        if (event.target == formModal) {
            closeFormModal();
        }
    };
    
    // Close modals on escape key
    window.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeModal();
            closeFormModal();
            closeDeleteConfirmModal();
        }
    });
    
    // Function to search for books using the Open Library API
    function searchBooks() {
        const query = bookSearchInput.value.trim();
        if (!query) return;
        
        // Show loading state
        searchResults.innerHTML = '<div class="search-loading">Searching...</div>';
        searchResults.classList.add('active');
        
        // Fetch books from the API
        fetch(`/search_books?query=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                if (!data.books || data.books.length === 0) {
                    searchResults.innerHTML = '<div class="search-empty">No books found. Try a different search or add manually.</div>';
                    return;
                }
                
                // Display the search results
                searchResults.innerHTML = '';
                data.books.forEach(book => {
                    const resultItem = document.createElement('div');
                    resultItem.className = 'search-result-item';
                    resultItem.innerHTML = `
                        <img src="${book.cover_url || '/static/images/book-placeholder.svg'}" alt="${book.title}" class="search-result-cover">
                        <div class="search-result-info">
                            <div class="search-result-title">${book.title}</div>
                            <div class="search-result-author">${book.author}</div>
                        </div>
                    `;
                    
                    // Add click event to select this book
                    resultItem.addEventListener('click', () => selectBook(book));
                    
                    searchResults.appendChild(resultItem);
                });
            })
            .catch(error => {
                console.error('Error searching books:', error);
                searchResults.innerHTML = '<div class="search-error">Error searching for books. Please try again.</div>';
            });
    }
    
    // Function to select a book from search results and get more details
    function selectBook(book) {
        // Pre-fill the basic information
        bookTitleInput.value = book.title;
        bookAuthorInput.value = book.author;
        if (book.cover_url) {
            coverUrlInput.value = book.cover_url;
        }
        
        // Clear search results
        searchResults.innerHTML = '';
        searchResults.classList.remove('active');
        bookSearchInput.value = '';
        
        // If we have an Open Library ID, get more detailed information
        if (book.olid) {
            fetch(`/book_details/${book.olid}`)
                .then(response => response.json())
                .then(details => {
                    if (details.description) {
                        bookDescriptionInput.value = details.description;
                    }
                })
                .catch(error => {
                    console.error('Error fetching book details:', error);
                });
        }
    }
    
    // Show delete confirmation modal
    function showDeleteConfirmModal(id, title) {
        const modal = document.getElementById('deleteConfirmModal');
        const titleSpan = document.getElementById('deleteBookTitle');
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        
        // Set the book title in the confirmation message
        titleSpan.textContent = title;
        
        // Set up the confirm button to delete when clicked
        confirmBtn.onclick = function() {
            deleteBook(id);
            closeDeleteConfirmModal();
        };
        
        // Display the modal
        modal.style.display = 'block';
    }
    
    // Close delete confirmation modal
    function closeDeleteConfirmModal() {
        const modal = document.getElementById('deleteConfirmModal');
        modal.style.display = 'none';
    }
    
    // Add closeDeleteConfirmModal to window for onclick/button access
    window.closeDeleteConfirmModal = closeDeleteConfirmModal;
    
    // Add modal closing on ESC and clicking outside for delete confirmation modal
    window.addEventListener('click', function(event) {
        const deleteModal = document.getElementById('deleteConfirmModal');
        if (event.target == deleteModal) {
            closeDeleteConfirmModal();
        }
    });
}); 