document.addEventListener('DOMContentLoaded', function() {
    // Initialize charts
    let statusChart = null;
    let progressChart = null;

    // Initialize Firebase auth state
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            console.log('User is signed in');
            initDashboard();
        } else {
            console.log('No user is signed in');
            window.location.href = '/login';
        }
    });

    async function initDashboard() {
        try {
            showLoading('Loading your dashboard...');
            await updateStats();
            await loadRecentActivity();
            hideLoading();
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            showErrorMessage('Failed to load dashboard data. Please try again later.');
            hideLoading();
        }
    }

    async function updateStats() {
        try {
            const currentUser = firebase.auth().currentUser;
    
            if (!currentUser) {
                console.error('No authenticated user');
                return;
            }
    
            const userEmail = currentUser.email;
            const db = firebase.firestore();
            
            // Query Firestore for books belonging to the user
            const booksRef = db.collection('Documents').where("user_id", "==", userEmail);
            const snapshot = await booksRef.get();
    
            if (snapshot.empty) {
                console.log('No books found for user.');
                updateStatsUI(0, 0, 0, 0, 0, 0);
                updateChartsUI([], []);
                return;
            }
    
            let totalBooks = 0, readingCount = 0, toReadCount = 0, finishedCount = 0;
            let totalPagesRead = 0, totalPagesLeft = 0;
            let books = [];
    
            snapshot.forEach(doc => {
                const book = doc.data();
                books.push({
                    id: doc.id,
                    ...book
                });
                
                totalBooks++;
    
                // Normalize the status field
                const status = normalizeStatus(book.status);
    
                if (status === 'reading') readingCount++;
                else if (status === 'to-read') toReadCount++;
                else if (status === 'finished') finishedCount++;
    
                // Extract pages read and total pages safely
                const pagesRead = parseInt(book.pages_read || book.pagesRead || 0);
                const totalPages = parseInt(book.total_pages || book.totalPages || 0);
    
                totalPagesRead += pagesRead;
                
                if (status !== 'finished' && totalPages > 0) {
                    totalPagesLeft += Math.max(0, totalPages - pagesRead);
                }
            });
    
            console.log('Stats:', { totalBooks, readingCount, toReadCount, finishedCount, totalPagesRead, totalPagesLeft });
    
            // Update UI elements
            updateStatsUI(totalBooks, readingCount, toReadCount, finishedCount, totalPagesRead, totalPagesLeft);
            updateChartsUI([readingCount, toReadCount, finishedCount], books);
    
        } catch (error) {
            console.error('Error fetching stats:', error);
            showErrorMessage('Failed to load your reading statistics');
        }
    }

    function normalizeStatus(status) {
        if (!status) return 'to-read';
        
        status = status.toLowerCase();
        
        if (status === 'reading' || status === 'currently reading' || status === 'in progress') {
            return 'reading';
        } else if (status === 'to read' || status === 'to-read' || status === 'want to read' || status === 'not started') {
            return 'to-read';
        } else if (status === 'finished' || status === 'completed' || status === 'done' || status === 'read') {
            return 'finished';
        }
        
        return 'to-read'; // Default
    }

    function updateStatsUI(totalBooks, readingCount, toReadCount, finishedCount, totalPagesRead, totalPagesLeft) {
        // Update the stats cards
        document.getElementById('totalBooks').textContent = totalBooks;
        document.getElementById('readingCount').textContent = readingCount;
        document.getElementById('toReadCount').textContent = toReadCount;
        document.getElementById('finishedCount').textContent = finishedCount;
        document.getElementById('totalPagesRead').textContent = totalPagesRead;
        document.getElementById('pagesLeft').textContent = totalPagesLeft;
    }

    function updateChartsUI(statusData, books) {
        // Status Chart
        const statusCtx = document.getElementById('statusChart').getContext('2d');
        
        if (statusChart) {
            statusChart.destroy();
        }
        
        statusChart = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: ['Reading', 'To Read', 'Finished'],
                datasets: [{
                    data: statusData,
                    backgroundColor: [
                        '#F6AD55', // Orange for Reading
                        '#63B3ED', // Blue for To Read
                        '#68D391'  // Green for Finished
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 5,
                        bottom: 5
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            font: {
                                size: 11
                            },
                            padding: 10
                        }
                    }
                }
            }
        });
        
        // Pages Read vs Pages Left Pie Chart
        const progressCtx = document.getElementById('progressChart').getContext('2d');
        
        if (progressChart) {
            progressChart.destroy();
        }
        
        const totalPagesRead = books.reduce((total, book) => {
            const pagesRead = parseInt(book.pages_read || book.pagesRead || 0);
            return total + pagesRead;
        }, 0);
        
        const totalPagesLeft = books.reduce((total, book) => {
            const status = normalizeStatus(book.status);
            if (status !== 'finished') {
                const totalPages = parseInt(book.total_pages || book.totalPages || 0);
                const pagesRead = parseInt(book.pages_read || book.pagesRead || 0);
                return total + Math.max(0, totalPages - pagesRead);
            }
            return total;
        }, 0);
        
        if (totalPagesRead > 0 || totalPagesLeft > 0) {
            progressChart = new Chart(progressCtx, {
                type: 'pie',
                data: {
                    labels: ['Pages Left', 'Pages Read'],
                    datasets: [{
                        data: [totalPagesLeft, totalPagesRead],
                        backgroundColor: [
                            '#FC8181',  // Red for Pages Left
                            '#68D391'   // Green for Pages Read
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            top: 5,
                            bottom: 5
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                font: {
                                    size: 11
                                },
                                padding: 10
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = totalPagesRead + totalPagesLeft;
                                    const percentage = Math.round((value / total) * 100);
                                    return `${label}: ${value} pages (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        } else {
            // Show empty state for progress chart
            progressChart = new Chart(progressCtx, {
                type: 'pie',
                data: {
                    labels: ['No page data available'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#E2E8F0'],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            top: 5,
                            bottom: 5
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                font: {
                                    size: 11
                                },
                                padding: 10
                            }
                        }
                    }
                }
            });
        }
    }

    async function loadRecentActivity() {
        try {
            const currentUser = firebase.auth().currentUser;
            if (!currentUser) return;
            
            const userEmail = currentUser.email;
            const db = firebase.firestore();
            
            // Get activities from user's books based on timestamp
            const booksRef = db.collection('Documents')
                .where("user_id", "==", userEmail)
                
            const snapshot = await booksRef.get();
            
            const activityContainer = document.getElementById('recentActivity');
            
            if (snapshot.empty) {
                activityContainer.innerHTML = `
                    <div class="empty-state">
                        <p>No recent activity to display. Start adding and updating books to see your activity here!</p>
                    </div>
                `;
                return;
            }
            
            let activitiesHTML = '';
            let count = 0;
            
            // Process the last 5 books as activities
            snapshot.forEach(doc => {
                if (count >= 5) return; // Limit to 5 activities
                
                const book = doc.data();
                const status = normalizeStatus(book.status);
                let actionType = 'added';
                let iconClass = 'added';
                let actionText = 'Added to your collection';
                
                // Add extra context for reading status
                if (status === 'reading') {
                    actionType = 'reading';
                    iconClass = 'updated';
                    actionText = 'Currently reading';
                } else if (status === 'finished') {
                    actionType = 'finished';
                    iconClass = 'finished';
                    actionText = 'Finished reading';
                }
                
                const dateAdded = book.date_added ? new Date(book.date_added.toDate()) : new Date();
                const timeAgo = formatTimeAgo(dateAdded);
                
                activitiesHTML += `
                    <div class="activity-item" onclick="window.location.href='/tracker'">
                        <div class="activity-icon ${iconClass}">
                            ${getActivityIcon(actionType)}
                        </div>
                        <div class="activity-details">
                            <div class="activity-title">${book.title}</div>
                            <div class="activity-description">${actionText} by ${book.author || 'Unknown Author'}</div>
                            <div class="activity-time">${timeAgo}</div>
                        </div>
                    </div>
                `;
                
                count++;
            });
            
            activityContainer.innerHTML = activitiesHTML;
            
        } catch (error) {
            console.error('Error loading recent activity:', error);
            document.getElementById('recentActivity').innerHTML = `
                <div class="empty-state">
                    <p>Failed to load recent activity. Please try again later.</p>
                </div>
            `;
        }
    }
    
    function getActivityIcon(type) {
        switch(type) {
            case 'added':
                return '<i class="fas fa-plus"></i>';
            case 'reading':
                return '<i class="fas fa-book-open"></i>';
            case 'finished':
                return '<i class="fas fa-check"></i>';
            default:
                return '<i class="fas fa-book"></i>';
        }
    }
    
    function formatTimeAgo(date) {
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        
        let interval = Math.floor(seconds / 31536000);
        if (interval >= 1) {
            return interval === 1 ? '1 year ago' : `${interval} years ago`;
        }
        
        interval = Math.floor(seconds / 2592000);
        if (interval >= 1) {
            return interval === 1 ? '1 month ago' : `${interval} months ago`;
        }
        
        interval = Math.floor(seconds / 86400);
        if (interval >= 1) {
            return interval === 1 ? '1 day ago' : `${interval} days ago`;
        }
        
        interval = Math.floor(seconds / 3600);
        if (interval >= 1) {
            return interval === 1 ? '1 hour ago' : `${interval} hours ago`;
        }
        
        interval = Math.floor(seconds / 60);
        if (interval >= 1) {
            return interval === 1 ? '1 minute ago' : `${interval} minutes ago`;
        }
        
        return 'Just now';
    }

    function truncateTitle(title, maxLength) {
        if (!title) return 'Untitled';
        return title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
    }
    
    //setInterval(updateDashboard, 60000); // Refresh every 30 seconds
    
    // Watch for localStorage changes 
    window.addEventListener('storage', function(e) {
        // If books or bookTrackerBooks changed, update the dashboard
        if (e.key === 'books' || e.key === 'bookTrackerBooks') {
            console.log('Detected change in book data, updating dashboard...');
            updateDashboard();
        }
    });
    
    // Add a custom event listener for book data changes (can be dispatched from other scripts)
    window.addEventListener('bookDataChanged', function() {
        updateDashboard();
    });

    async function updateDashboard() {
        localStorage.removeItem('dashboardCachedData');
        
        // If no books are found, try to trigger the book tracker to load them
        const books = await loadBooks(true);
        if (books.length === 0) {
            await loadBooksFromTracker();
        }
        
        updateStats();
        updateReadingGoals();
        updateRecommendations();
        updateRecentActivity();
    }

    async function loadBooks(useLocalFallback = true) {
        try {
            const localStorageBooks = localStorage.getItem('books');
            if (localStorageBooks) {
                const books = JSON.parse(localStorageBooks);
                console.log('Loaded books directly from localStorage books key:', books.length);
                return books;
            }
            
            // Try Firestore API if no localStorage data
            console.log('No books in localStorage, trying API endpoint...');
            const response = await fetch('/get_books');
            const data = await response.json();
            
            console.log('Raw API response:', data);
            
            if (data && Array.isArray(data)) {
                console.log('Loaded books from API:', data.length);
                // Save to localStorage for future use
                localStorage.setItem('books', JSON.stringify(data));
                return data;
            } else {
                console.error('Error loading books from API: Invalid format', data);
                // Last resort - try bookTrackerBooks
                if (useLocalFallback) {
                    const fallbackBooks = localStorage.getItem('bookTrackerBooks');
                    console.log('Trying bookTrackerBooks as last resort...');
                    if (fallbackBooks) {
                        const parsedBooks = JSON.parse(fallbackBooks);
                        console.log('Loaded books from bookTrackerBooks:', parsedBooks.length);
                        return parsedBooks;
                    }
                }
                return [];
            }
        } catch (error) {
            console.error('Error fetching books from API:', error);
            // Try bookTrackerBooks as last resort
            if (useLocalFallback) {
                console.log('Error occurred, trying bookTrackerBooks...');
                const fallbackBooks = localStorage.getItem('bookTrackerBooks');
                if (fallbackBooks) {
                    const parsedBooks = JSON.parse(fallbackBooks);
                    console.log('Loaded books from bookTrackerBooks after error:', parsedBooks.length);
                    return parsedBooks;
                }
            }
            return [];
        }
    }

    // Function to attempt loading books from tracker.js
    async function loadBooksFromTracker() {
        // First check if tracker.js has a loadBooks function we can call
        if (window.loadBooks) {
            console.log('Found loadBooks in global scope, calling it...');
            try {
                await window.loadBooks();
                console.log('Successfully called loadBooks function');
                return true;
            } catch (error) {
                console.error('Error calling loadBooks function:', error);
            }
        }
        
        // Alternatively, try to fetch books directly from the database
        try {
            console.log('Attempting to load books directly from database...');
            const response = await fetch('/get_books');
            const data = await response.json();
            
            if (data && Array.isArray(data) && data.length > 0) {
                console.log('Successfully loaded books from database:', data.length);
                // Store in localStorage to make it available for other functions
                localStorage.setItem('books', JSON.stringify(data));
                return true;
            }
        } catch (error) {
            console.error('Error loading books from database:', error);
        }
        
        console.warn('Failed to load books from any source');
        return false;
    }

    async function updateReadingGoals() {
        // This function is no longer needed as we calculate everything in updateStats
        // Leaving it empty to avoid breaking any existing code that calls it
    }

    async function updateRecommendations() {
        // For recommendations, we can use local storage as a fallback
        const books = await loadBooks(false); // true means fall back to localStorage
        const container = document.getElementById('recommendedBooks');
        
        if (!container) {
            console.error('recommendedBooks container not found');
            return;
        }

        if (books.length === 0) {
            container.innerHTML = '<p>Add books to your collection to get personalized recommendations!</p>';
            return;
        }

        // Get user preferences from Firestore
        let userPreferences = '';
        try {
            // Get the current Firebase user's ID token
            const currentUser = firebase.auth().currentUser;
            if (currentUser) {
                const idToken = await currentUser.getIdToken(true);
                
                // Make authenticated request to get settings
                const response = await fetch('/get_settings', {
                    headers: {
                        'Authorization': `Bearer ${idToken}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                const settings = await response.json();
                
                if (settings && settings.reading_preferences) {
                    userPreferences = settings.reading_preferences;
                } else {
                    console.log('No reading preferences found in Firestore');
                }
            } else {
                console.log('No authenticated user, cannot fetch reading preferences');
            }
        } catch (error) {
            console.error('Error loading preferences from Firestore:', error);
        }
        
        // Extract keywords based on user preferences or from collection
        let keywords;
        if (userPreferences && userPreferences.trim() !== '') {
            try {
                const response = await fetch('/recommend', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_input: userPreferences,
                        max_results: 10
                    })
                });
                
                const data = await response.json();
                if (data.books && data.books.length > 0) {
                    keywords = data.books.slice(0, 5).flatMap(book => {
                        const words = [];
                        if (book.title) words.push(...book.title.toLowerCase().split(/\s+/).filter(w => w.length > 3));
                        if (book.author) words.push(book.author.toLowerCase());
                        return words;
                    });
                } else {
                    keywords = extractKeywordsFromRecent(books);
                }
            } catch (error) {
                console.error('Error getting recommendations from preferences:', error);
                keywords = extractKeywordsFromRecent(books);
            }
        } else {
            console.log('No reading preferences found, using collection data');
            keywords = extractKeywordsFromRecent(books);
        }
        
        console.log('Using keywords for recommendations:', keywords);
        
        // Display loading state
        container.innerHTML = '<p>Finding recommendations based on your preferences and collection...</p>';

        try {
            const [openLibrary, internetArchive, semanticScholar] = await Promise.all([
                getOpenLibraryRecommendations(keywords),
                //getInternetArchiveRecommendations(keywords),
                //getSemanticScholarRecommendations(keywords)
            ]);
            const existingTitles = new Set(books.map(book => book.title.toLowerCase()));
            const filteredRecommendations = {
                openLibrary: openLibrary.filter(book => !existingTitles.has(book.title.toLowerCase())).slice(0, 5),
                //internetArchive: internetArchive.filter(book => !existingTitles.has(book.title.toLowerCase())).slice(0, 5),
                //semanticScholar: semanticScholar.filter(book => !existingTitles.has(book.title.toLowerCase())).slice(0, 5)
            };

            displayRecommendationsBySource(filteredRecommendations);
        } catch (error) {
            console.error('Error fetching recommendations:', error);
            container.innerHTML = '<p>Unable to load recommendations at this time.</p>';
        }
    }

    function extractKeywordsFromRecent(books) {
        const shuffledBooks = [...books].sort(() => Math.random() - 0.5);

        const randomBooks = shuffledBooks.slice(0, 5);
        const keywordCounts = new Map();
        
        randomBooks.forEach(book => {
            // Extract words from titles
            if (book.title) {
                book.title.split(/\s+/).forEach(word => {
                    word = word.toLowerCase().replace(/[^a-z]/g, '');
                    if (word.length > 3) {
                        keywordCounts.set(word, (keywordCounts.get(word) || 0) + 2);
                    }
                });
            }

            if (book.author) {
                book.author.split(/\s+/).forEach(word => {
                    word = word.toLowerCase().replace(/[^a-z]/g, '');
                    if (word.length > 3) {
                        keywordCounts.set(word, (keywordCounts.get(word) || 0) + 2);
                    }
                });
            }

            if (book.subjects) {
                book.subjects.forEach(subject => {
                    subject.split(/\s+/).forEach(word => {
                        word = word.toLowerCase().replace(/[^a-z]/g, '');
                        if (word.length > 3) {
                            keywordCounts.set(word, (keywordCounts.get(word) || 0) + 1);
                        }
                    });
                });
            }
        });

        return Array.from(keywordCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([keyword]) => keyword);
    }

    async function getOpenLibraryRecommendations(keywords) {
        const recommendations = [];
        const searchQuery = keywords.slice(0, 3).join(' OR '); // Use top 3 keywords

        try {
            const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(searchQuery)}&limit=10`);
            const data = await response.json();

            recommendations.push(...data.docs.map(book => ({
                title: book.title,
                author: book.author_name ? book.author_name[0] : 'Unknown Author',
                coverUrl: book.cover_i 
                    ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
                    : '/static/images/book-placeholder.svg',
                source: 'Open Library',
                year: book.first_publish_year,
                description: book.description || book.excerpt || book.first_sentence || 'No description available.',
                readUrl: book.key 
                    ? `https://openlibrary.org${book.key}`
                    : null,
                buyUrl: `https://www.amazon.com/s?k=${encodeURIComponent(book.title + ' ' + (book.author_name ? book.author_name[0] : ''))}`,
                id: book.key
            })));
            
            // For each book that doesn't have a description, fetch its details
            for (let i = 0; i < recommendations.length; i++) {
                if (recommendations[i].description === 'No description available.' && recommendations[i].id) {
                    try {
                        const bookResponse = await fetch(`https://openlibrary.org${recommendations[i].id}.json`);
                        const bookData = await bookResponse.json();
                        
                        if (bookData.description) {
                            recommendations[i].description = typeof bookData.description === 'string' 
                                ? bookData.description 
                                : bookData.description.value || 'No description available.';
                        }
                    } catch (err) {
                        console.log('Failed to fetch details for book:', recommendations[i].title);
                    }
                }
            }
        } catch (error) {
            console.error('Open Library API error:', error);
        }

        return recommendations;
    }

    async function getInternetArchiveRecommendations(keywords) {
        const recommendations = [];
        const searchQuery = keywords.slice(0, 3).join(' OR '); // Use top 3 keywords

        try {
            const response = await fetch(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(searchQuery)}+AND+mediatype:(texts)&fl[]=title,creator,identifier,description,downloadable&output=json&rows=10`);
            const data = await response.json();

            recommendations.push(...data.response.docs.map(book => ({
                title: book.title,
                author: book.creator || 'Unknown Author',
                coverUrl: `https://archive.org/services/img/${book.identifier}`,
                source: 'Internet Archive',
                description: book.description || 'No description available.',
                readUrl: `https://archive.org/details/${book.identifier}`,
                downloadUrl: book.downloadable ? `https://archive.org/download/${book.identifier}/${book.identifier}.pdf` : null,
                has_ebook: book.downloadable || false,
                id: book.identifier
            })));
            
            // If descriptions are missing, fetch individual metadata
            for (let i = 0; i < recommendations.length; i++) {
                if (recommendations[i].description === 'No description available.' && recommendations[i].id) {
                    try {
                        const metadataUrl = `https://archive.org/metadata/${recommendations[i].id}`;
                        const metadataResponse = await fetch(metadataUrl);
                        const metadata = await metadataResponse.json();
                        
                        if (metadata.metadata && metadata.metadata.description) {
                            recommendations[i].description = metadata.metadata.description;
                        }
                    } catch (err) {
                        console.log('Failed to fetch metadata for item:', recommendations[i].title);
                    }
                }
            }
        } catch (error) {
            console.error('Internet Archive API error:', error);
        }

        return recommendations;
    }

    async function getSemanticScholarRecommendations(keywords) {
        const recommendations = [];
        const searchQuery = keywords.slice(0, 3).join(' OR '); // Use top 3 keywords

        try {
            const response = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(searchQuery)}&limit=10&fields=title,authors,year,abstract,url,openAccessPdf`);
            const data = await response.json();

            recommendations.push(...data.data.map(paper => ({
                title: paper.title,
                author: paper.authors?.[0]?.name || 'Unknown Author',
                coverUrl: '/static/images/book-placeholder.svg', // Use placeholder for papers
                source: 'Semantic Scholar',
                year: paper.year,
                description: paper.abstract || 'No description available.',
                readUrl: paper.url,
                downloadUrl: paper.openAccessPdf?.url || null,
                has_ebook: paper.openAccessPdf?.url ? true : false,
                id: paper.paperId
            })));
            
            // For papers without abstracts, try to fetch more details
            for (let i = 0; i < recommendations.length; i++) {
                if (recommendations[i].description === 'No description available.' && recommendations[i].id) {
                    try {
                        const paperUrl = `https://api.semanticscholar.org/graph/v1/paper/${recommendations[i].id}?fields=abstract`;
                        const paperResponse = await fetch(paperUrl);
                        const paperData = await paperResponse.json();
                        
                        if (paperData.abstract) {
                            recommendations[i].description = paperData.abstract;
                        }
                    } catch (err) {
                        console.log('Failed to fetch details for paper:', recommendations[i].title);
                    }
                }
            }
        } catch (error) {
            console.error('Semantic Scholar API error:', error);
        }

        return recommendations;
    }

    function displayRecommendationsBySource(recommendations) {
        const container = document.getElementById('recommendedBooks');
        container.innerHTML = '';

        const createSourceSection = (title, books, source) => {
            if (!books || books.length === 0) return '';
            
            const booksHtml = books.map(book => `
                <div class="book-card" onclick="showBookDetails(${JSON.stringify(book).replace(/'/g, "\\'").replace(/"/g, '&quot;')})">
                    <div class="book-cover">
                        <img src="${book.coverUrl || '/static/images/book-placeholder.svg'}" 
                             alt="${book.title}" 
                                         onerror="this.src='/static/images/book-placeholder.svg'">
                        ${book.has_ebook ? '<div class="ebook-badge"><i class="fas fa-book-open"></i></div>' : ''}
                    </div>
                    <div class="book-info">
                        <h3 class="book-title">${book.title}</h3>
                        <p class="book-author">by ${book.author}</p>
                        <p class="book-year">${book.year || ''}</p>
                        <div class="book-source">${source}</div>
                                </div>
                            </div>
            `).join('');
            
            return `
                <div class="recommendations-section">
                    <h3 class="section-title">${title}</h3>
                    <div class="source-books">
                        ${booksHtml}
                    </div>
                </div>
            `;
        };

        const sections = [
            createSourceSection('', recommendations.openLibrary, 'Open Library'),
            createSourceSection('', recommendations.semanticScholar, 'Semantic Scholar'),
            createSourceSection('', recommendations.internetArchive, 'Internet Archive')
        ].filter(Boolean); // Remove empty sections
        
        if (sections.length > 0) {
            container.innerHTML = sections.join('');
        } else {
            container.innerHTML = '<p>No recommendations available at this time.</p>';
        }
        
        // Define showBookDetails function if not already defined
        if (!window.showBookDetails) {
            window.showBookDetails = function(bookData) {
                // Parse the book data if it's a string
                if (typeof bookData === 'string') {
                    try {
                        bookData = JSON.parse(bookData);
                    } catch (e) {
                        console.error('Error parsing book data:', e);
                        return;
                    }
                }
                
                // Get or create modal elements
                let modal = document.getElementById('bookModal');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'bookModal';
                    modal.className = 'modal';
                    document.body.appendChild(modal);
                }
                
                // Create action buttons HTML
                const actionButtons = [];
                
                
                // Read Online button if URL exists
                if (bookData.readUrl) {
                    actionButtons.push(`
                        <a href="${bookData.readUrl}" target="_blank" class="action-button read-online">
                            <i class="fas fa-book-reader"></i> Read Online
                        </a>
                    `);
                }
                
                // Buy button if URL exists
                if (bookData.buyUrl) {
                    actionButtons.push(`
                        <a href="${bookData.buyUrl}" target="_blank" class="action-button buy">
                            <i class="fas fa-shopping-cart"></i> Buy on Amazon
                        </a>
                    `);
                }
                
                // Download button if URL exists
                if (bookData.downloadUrl) {
                    actionButtons.push(`
                        <a href="${bookData.downloadUrl}" target="_blank" class="action-button download">
                            <i class="fas fa-download"></i> Download PDF
                        </a>
                    `);
                }

                // Add to Collection button
                actionButtons.push(`
                    <button class="action-button add-to-collection" onclick="addToCollection(${JSON.stringify(bookData).replace(/"/g, '&quot;')}, '${bookData.source}')">
                        <i class="fas fa-plus"></i> Add to Collection
                    </button>
                `);
                
                // Populate the modal content
                modal.innerHTML = `
                    <div class="modal-content">
                        <span class="close-button" onclick="closeModal()">&times;</span>
                        <div class="book-detail">
                            <div class="book-detail-header">
                                <div class="book-detail-cover-container">
                                    <img src="${bookData.coverUrl || '/static/images/book-placeholder.svg'}" 
                                         alt="${bookData.title}" 
                                         class="book-detail-cover"
                                         onerror="this.src='/static/images/book-placeholder.svg'">
                                    <div class="book-detail-actions">
                                        ${actionButtons.join('')}
                                    </div>
                                </div>
                                <div class="book-detail-info">
                                    <h2>${bookData.title}</h2>
                                    <p class="author">by ${bookData.author}</p>
                                    ${bookData.year ? `<p class="year">${bookData.year}</p>` : ''}
                                    <p class="source">${bookData.source}</p>
                                    <div class="book-detail-description">
                                        <h3>Description</h3>
                                        <p>${formatDescription(bookData.description)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Display the modal
                modal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            };
            
            // Function to format and sanitize description text
            function formatDescription(description) {
                if (!description || description === 'No description available.') {
                    return 'No description available.';
                }
                
                // If it's an array, join it
                if (Array.isArray(description)) {
                    description = description.join(' ');
                }
                
                // Convert to string if it's not already
                description = String(description);
                
                // Remove HTML tags for safety
                description = description.replace(/<\/?[^>]+(>|$)/g, '');
                
                // Replace newlines with <br> tags
                description = description.replace(/\n/g, '<br>');
                
                // Truncate very long descriptions
                if (description.length > 1000) {
                    description = description.substring(0, 1000) + '...';
                }
                
                return description;
            }
            
            // Add closeModal function if not defined
            if (!window.closeModal) {
                window.closeModal = function() {
                    const modal = document.getElementById('bookModal');
                    if (modal) {
                        modal.style.display = 'none';
                        document.body.style.overflow = 'auto';
                    }
                };
                
                // Close modal when clicking outside
                window.addEventListener('click', function(event) {
                    const modal = document.getElementById('bookModal');
                    if (event.target === modal) {
                        closeModal();
                    }
                });
                
                // Close modal on escape key
                document.addEventListener('keydown', function(event) {
                    if (event.key === 'Escape') {
                        closeModal();
                    }
                });
            }
        }
        
        // If window.addToCollection is not defined yet, define it to save to the database
        if (!window.addToCollection) {
            window.addToCollection = function(item, source) {
                // Parse the book data if it's a string
                if (typeof item === 'string') {
                    try {
                        item = JSON.parse(item);
                    } catch (e) {
                        console.error('Error parsing book data:', e);
                        return;
                    }
                }
                
                const bookData = {
                    title: item.title || '',
                    author: item.author || '',
                    description: item.description || '',
                    cover_url: item.coverUrl || item.cover_url || '',
                    total_pages: item.total_pages || null,
                    pages_read: 0,
                    status: 'to-read',
                    notes: '',
                    source_url: item.readUrl || item.reading_url || '',
                    download_url: item.downloadUrl || item.download_url || '',
                    buy_link: item.buyUrl || item.buy_link || '',
                    year: item.year || 'Unknown'
                };
                
                // Show a success notification
                showNotification('Adding "' + bookData.title + '" to your collection...', 'loading');
                
                // Save to Supabase via API
                fetch('/api/documents', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(bookData)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Show success message
                        showNotification('Added "' + bookData.title + '" to your collection!', 'success');
                        
                        // Close the modal
                        closeModal();
                        
                        // Update stats to reflect new addition
                        setTimeout(updateDashboard, 500);
                    } else {
                        // Show error message
                        showNotification('Error: ' + (data.message || 'Could not add to collection'), 'error');
                    }
                })
                .catch(error => {
                    console.error('Error adding to collection:', error);
                    showNotification('Error: Could not add to collection. Please try again.', 'error');
                });
            };
        }
        
        // Helper function for notifications
        if (!window.showNotification) {
            window.showNotification = function(message, type = 'info') {
                // Remove any existing notifications
                const existingNotifications = document.querySelectorAll('.notification');
                existingNotifications.forEach(notification => notification.remove());
                
                // Create notification element
                const notification = document.createElement('div');
                notification.className = `notification ${type}-notification`;
                
                // Set icon based on type
                let icon = 'info-circle';
                if (type === 'success') icon = 'check-circle';
                if (type === 'error') icon = 'exclamation-circle';
                if (type === 'loading') icon = 'spinner fa-spin';
                
                notification.innerHTML = `
                    <i class="fas fa-${icon}"></i>
                    <span>${message}</span>
                `;
                
                // Add to DOM
                document.body.appendChild(notification);
                
                // Remove after delay (except for loading)
                if (type !== 'loading') {
                    setTimeout(() => {
                        notification.classList.add('fade-out');
                        setTimeout(() => notification.remove(), 300);
                    }, 3000);
                }
                
                return notification;
            };
        }
    }

    async function updateRecentActivity() {
        try {
            const currentUser = firebase.auth().currentUser;
            
            const userEmail = currentUser.email;
        const container = document.getElementById('activityList');
        
        if (!container) {
            console.error('activityList container not found');
            return;
        }
        
            // Show loading state
            container.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading recent activity...</p>';
    
            // Get user's book collection from Firestore (without ordering to avoid index requirement)
            const db = firebase.firestore();
            const booksRef = db.collection('Documents')
                .where("user_id", "==", userEmail)
                .limit(5);  // Removed orderBy to avoid index issue
    
            const snapshot = await booksRef.get();
    
            if (snapshot.empty) {
                console.log('No books found in user collection');
            container.innerHTML = '<p>No activity yet. Add books to your collection!</p>';
            return;
        }

            // Format activities from Firestore data
            const activities = [];
            snapshot.forEach(doc => {
                const book = doc.data();
    
                // Format the date (if exists)
                const dateAdded = book.date_added ? 
                    new Date(book.date_added.toDate ? book.date_added.toDate() : book.date_added) 
                    : new Date();
                    
                const dateFormatted = dateAdded.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
    
                // Try different cover field names
                const coverUrl = book.cover_url || book.coverUrl || book.cover || book.image || '/static/images/book-placeholder.svg';
                const year = book.year || 'Unknown year';
    
                activities.push(`
                    <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-plus-circle"></i>
                    </div>
                        <div class="activity-details">
                            <div class="activity-title">Added to Collection - <b>${book.title}</b> by <b>${book.author}</b>${year ? ' (' + year + ')' : ''}</div>
                            <div class="activity-date">${dateFormatted}</div>
                    </div>
                    <div class="activity-cover">
                            <img src="${coverUrl}" 
                             alt="${book.title}" 
                             onerror="this.src='/static/images/book-placeholder.svg'">
                        </div>
                    </div>
                `);
            });
    
            container.innerHTML = activities.length > 0 ? activities.join('') : '<p>No recent activity</p>';
            
        } catch (error) {
            console.error('Error loading recent activity:', error);
            document.getElementById('activityList').innerHTML = '<p>Could not load recent activity. Please try again later.</p>';
        }
    }
    

    // Add styling for messages
    const messageStyles = `
        .loading-message {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1000;
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
        
        .error-message {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1000;
        }
    `;

    // Add styles to document
    const messageStyleSheet = document.createElement("style");
    messageStyleSheet.textContent = messageStyles;
    document.head.appendChild(messageStyleSheet);
}); 