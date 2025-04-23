document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Wait for Firebase to be initialized
        await waitForFirebase();
        
        // Initialize Firebase auth state
        firebase.auth().onAuthStateChanged(function(user) {
            if (user) {
                initDashboard();
            } else {
                window.location.href = '/login';
            }
        });
    } catch (error) {
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            Error initializing the application. Please try refreshing the page.
        `;
        document.body.appendChild(errorMsg);
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

    let statusChart = null;
    let progressChart = null;

    // Set up refresh button for recommendations
    const refreshRecommendationsBtn = document.getElementById('refreshRecommendations');
    if (refreshRecommendationsBtn) {
        refreshRecommendationsBtn.addEventListener('click', function() {
            // Show a rotating animation on the button while refreshing
            this.classList.add('refreshing');
            
            // Force refresh the recommendations
            loadRecommendations(true)
                .finally(() => {
                    // Remove the animation class after a short delay
                    setTimeout(() => {
                        refreshRecommendationsBtn.classList.remove('refreshing');
                    }, 1000);
                });
        });
    }

    // Define showBookModal function globally
    window.showBookModal = function(book) {
        // Get or create modal elements
        let modal = document.getElementById('bookModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'bookModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        
        // Create action buttons
        const actionButtons = [];
        
        // Read Online button
        if (book.reading_url) {
            actionButtons.push(`
                <a href="${book.reading_url}" target="_blank" class="read-online-btn">
                    <i class="fas fa-book-reader"></i> View Online
                </a>
            `);
        }
        
        // Buy button
        if (book.buy_link) {
            actionButtons.push(`
                <a href="${book.buy_link}" target="_blank" class="buy-btn">
                    <i class="fas fa-shopping-cart"></i> Buy on Amazon
                </a>
            `);
        }
        
        // Add to collection button
        actionButtons.push(`
            <button class="add-to-collection-btn" onclick="addToCollection(${JSON.stringify(book).replace(/"/g, '&quot;')})">
                <i class="fas fa-plus"></i> Add to Collection
            </button>
        `);
        
        // Populate modal with book data
        modal.innerHTML = `
            <div class="modal-content">
                <!--<span class="close-button" onclick="closeBookModal()">&times;</span>-->
                <div class="modal-book-info">
                    <div class="modal-book-cover">
                        <div class="book-cover-wrapper">
                            <img src="${book.cover_url || '/static/images/book-placeholder.svg'}" 
                                 alt="${book.title} cover" 
                                 onerror="this.src='/static/images/book-placeholder.svg'">
                            ${book.has_ebook ? '<div class="ebook-badge"><i class="fas fa-book-open"></i> E-book</div>' : ''}
                        </div>
                        <div class="action-buttons">
                            ${actionButtons.join('')}
                        </div>
                    </div>
                    <div class="modal-book-details">
                        <h2 class="modal-book-title">${book.title}</h2>
                        <div class="modal-book-metadata">
                            <p>by ${book.author || 'Unknown Author'}</p>
                            <p>Published: ${book.year || 'Unknown'}</p>
                        </div>
                        <div class="modal-book-recommendation">
                            <h3>Description</h3>
                            <p>${book.recommendation || book.description || 'No description available.'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    };
    
    window.closeBookModal = function() {
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
            closeBookModal();
        }
    });
    
    // Close modal on escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeBookModal();
        }
    });
    
    // Add to collection function
    window.addToCollection = function(bookData) {
        if (typeof window.addBookToCollection === 'function') {
            // Make sure we preserve important properties like reading_url
            const bookToAdd = {
                ...bookData,
                reading_url: bookData.reading_url || null,
                buy_link: bookData.buy_link || null,
                has_ebook: bookData.has_ebook || false,
                // Map reading_url to source_url for the book tracker page
                source_url: bookData.reading_url || null
            };
            
            window.addBookToCollection(bookToAdd)
                .then(docId => {
                    closeBookModal();
                    loadRecentActivity(); // Refresh the recent activity
                })
                .catch(error => {
                    // Check if this is the book tracking limit error
                    if (error.message && error.message.includes('limit of 5 tracked books')) {
                        showTrackingLimitError(error.message);
                    } else {
                        showErrorMessage('Could not add to collection. Please try again later.');
                    }
                });
        } else {
            showErrorMessage('Could not add to collection. Please try again later.');
        }
    };

    // Show tracking limit error in a popup modal
    function showTrackingLimitError(message) {
        const modal = document.createElement('div');
        modal.className = 'error-modal';
        modal.innerHTML = `
            <div class="error-modal-content">
                <div class="error-modal-header">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Book Tracking Limit Reached</h3>
                    <button class="close-button" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="error-modal-body">
                    <p>${message}</p>
                </div>
                <div class="error-modal-footer">
                    <a href="/Settings" class="upgrade-button">Upgrade to Pro</a>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Close modal when clicking outside
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.remove();
            }
        });
        
        // Close modal with ESC key
        const escHandler = function(event) {
            if (event.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    async function initDashboard() {
        try {
            showLoading('Loading your dashboard...');
            
            // Load the main dashboard data
            await Promise.all([
                updateStats(),
                loadRecentActivity()
            ]);
            
            hideLoading();
            
            // Load recommendations separately after main content is displayed
            // Check if reading preferences have changed in the settings, forcing a refresh if needed
            const refreshNeeded = await haveReadingPreferencesChanged();
            loadRecommendations(refreshNeeded).catch(error => {
                const recommendationsContainer = document.getElementById('recommendationsContainer');
                if (recommendationsContainer) {
                    recommendationsContainer.innerHTML = '<div class="empty-state"><p>Failed to load recommendations. Please try again later.</p></div>';
                }
            });
            
            } catch (error) {
            showErrorMessage('Failed to load dashboard data. Please try again later.');
            hideLoading();
        }
    }

    async function updateStats() {
        try {
            const currentUser = firebase.auth().currentUser;
    
            if (!currentUser) {
                return;
            }
    
            const userEmail = currentUser.email;
            const db = firebase.firestore();
            
            // Query Firestore for books belonging to the user
            const booksRef = db.collection('Documents').where("user_id", "==", userEmail);
            const snapshot = await booksRef.get();
    
            if (snapshot.empty) {
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
    
    
            // Update UI elements
            updateStatsUI(totalBooks, readingCount, toReadCount, finishedCount, totalPagesRead, totalPagesLeft);
            updateChartsUI([readingCount, toReadCount, finishedCount], books);
    
        } catch (error) {
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
                        '#bee3f8', // Orange for Reading
                        '#63B3ED', // Blue for To Read
                        '#4a90e2'  // Green for Finished
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
                            '#bee3f8',  // Red for Pages Left
                            '#4a90e2'   // Green for Pages Read
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
            
            // Create an array to store all activities
            const activities = [];
            
            // Process all books and add them to the activities array
            snapshot.forEach(doc => {
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
                
                // Add the activity to the array
                activities.push({
                    book,
                    status,
                    actionType,
                    iconClass,
                    actionText,
                    dateAdded
                });
            });
            
            // Sort activities by date in descending order (most recent first)
            activities.sort((a, b) => b.dateAdded - a.dateAdded);
            
            // Take only the 5 most recent activities
            const recentActivities = activities.slice(0, 5);
            
            let activitiesHTML = '';
            
            // Generate HTML for the 5 most recent activities
            recentActivities.forEach(activity => {
                const timeAgo = formatTimeAgo(activity.dateAdded);
                
                activitiesHTML += `
                    <div class="activity-item" onclick="window.location.href='/Tracker'">
                        <div class="activity-icon ${activity.iconClass}">
                            ${getActivityIcon(activity.actionType)}
                        </div>
                        <div class="activity-details">
                            <div class="activity-title">${activity.book.title}</div>
                            <div class="activity-description">${activity.actionText} by ${activity.book.author || 'Unknown Author'}</div>
                            <div class="activity-time">${timeAgo}</div>
                        </div>
                    </div>
                `;
            });
            
            activityContainer.innerHTML = activitiesHTML;
        } catch (error) {
            const activityContainer = document.getElementById('recentActivity');
            activityContainer.innerHTML = `
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
        
        // Update the primary content first
        await Promise.all([
            updateStats(),
            updateReadingGoals(),
            loadRecentActivity()
        ]);
        
        // Check if reading preferences have changed before refreshing recommendations
        const refreshNeeded = await haveReadingPreferencesChanged();
        loadRecommendations(refreshNeeded);
    }

    async function loadBooks(useLocalFallback = true) {
        try {
            const localStorageBooks = localStorage.getItem('books');
            if (localStorageBooks) {
                const books = JSON.parse(localStorageBooks);
                return books;
            }
            
            const response = await fetch('/Get_Books');
            const data = await response.json();
            
            if (data && Array.isArray(data)) {
                // Save to localStorage for future use
                localStorage.setItem('books', JSON.stringify(data));
                return data;
            } else {
                // Last resort - try bookTrackerBooks
                if (useLocalFallback) {
                    const fallbackBooks = localStorage.getItem('bookTrackerBooks');
                    if (fallbackBooks) {
                        const parsedBooks = JSON.parse(fallbackBooks);
                        return parsedBooks;
                    }
                }
                return [];
            }
        } catch (error) {
            // Try bookTrackerBooks as last resort
            if (useLocalFallback) {
                const fallbackBooks = localStorage.getItem('bookTrackerBooks');
                if (fallbackBooks) {
                    const parsedBooks = JSON.parse(fallbackBooks);
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
            try {
                await window.loadBooks();
                return true;
            } catch (error) {
            }
        }
        
        // Alternatively, try to fetch books directly from the database
        try {
            const response = await fetch('/Get_Books');
            const data = await response.json();

            if (data && Array.isArray(data) && data.length > 0) {
                // Store in localStorage to make it available for other functions
                localStorage.setItem('books', JSON.stringify(data));
                return true;
            }
        } catch (error) {
        }
        return false;
    }

    async function updateReadingGoals() {
        // This function is no longer needed as we calculate everything in updateStats
        // Leaving it empty to avoid breaking any existing code that calls it
    }

    async function loadRecommendations(forceRefresh = false) {
        const recommendationsContainer = document.getElementById('recommendationsContainer');
        
        if (!recommendationsContainer) return;
        
        try {
            // Check if we have cached recommendations in localStorage
            const cachedRecommendations = localStorage.getItem('cachedRecommendations');
            const cachedPreferences = localStorage.getItem('cachedReadingPreferences');
            const lastUpdated = localStorage.getItem('recommendationsLastUpdated');
            
            // Get current user
            const currentUser = firebase.auth().currentUser;
            if (!currentUser) {
                recommendationsContainer.innerHTML = '<div class="empty-state"><p>Please sign in to see personalized recommendations.</p></div>';
                return;
            }
            
            // Fetch current user settings to check reading preferences
            const idToken = await currentUser.getIdToken(true);
            const settingsResponse = await fetch('/Get_Settings', {
                headers: {
                    'Authorization': `Bearer ${idToken}`
                }
            });
            
            if (!settingsResponse.ok) {
                throw new Error('Failed to retrieve user settings');
            }
            
            const settings = await settingsResponse.json();
            let currentPreferences = settings && settings.reading_preferences ? 
                settings.reading_preferences.trim() : 
                "popular fiction and non-fiction books";
            
            // Determine if we need to fetch new recommendations
            const preferencesChanged = cachedPreferences !== currentPreferences;
            const shouldRefresh = forceRefresh || !cachedRecommendations || preferencesChanged;
            
            if (!shouldRefresh && cachedRecommendations) {
                recommendationsContainer.innerHTML = cachedRecommendations;
                return;
            }
            
            // Show loading state
            recommendationsContainer.innerHTML = `
                <div class="loading-recommendations">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Finding personalized book recommendations based on your preferences...</span>
                </div>
            `;
            
            let query = currentPreferences;
            
            // Fetch new recommendations
            const recommendResponse = await fetch('/Recommend', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_input: query,
                    max_results: 10
                })
            });
            
            if (recommendResponse.status === 403) {
                const data = await recommendResponse.json();
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
                            <p>${data.ai_response}</p>
                        </div>
                        <div class="error-modal-footer">
                            <a href="/settings" class="upgrade-button">Upgrade to Pro</a>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
                recommendationsContainer.innerHTML = '';
                return;
            }
            
            if (!recommendResponse.ok) {
                throw new Error('Failed to retrieve recommendations');
            }
            
            const recommendData = await recommendResponse.json();
            
            if (!recommendData.books || recommendData.books.length === 0) {
                const emptyState = '<div class="empty-state"><p>No recommendations found based on your preferences. Try updating your reading preferences in Settings.</p></div>';
                recommendationsContainer.innerHTML = emptyState;
                localStorage.setItem('cachedRecommendations', emptyState);
                localStorage.setItem('cachedReadingPreferences', currentPreferences);
                localStorage.setItem('recommendationsLastUpdated', new Date().toISOString());
                        return;
            }
            
            // Generate HTML for recommendations
            let recommendationsHTML = '';
            
            recommendData.books.forEach(book => {
                recommendationsHTML += `
                    <div class="book-recommendation" onclick="showBookModal(${JSON.stringify(book).replace(/"/g, '&quot;')})">
                        <div class="book-cover-wrapper">
                            <img src="${book.cover_url || '/static/images/book-placeholder.svg'}" 
                                alt="${book.title} cover" 
                                onerror="this.src='/static/images/book-placeholder.svg'">
                            ${book.has_ebook ? '<div class="ebook-badge"><i class="fas fa-book-open"></i> E-book</div>' : ''}
                        </div>
                        <div class="book-info">
                            <div class="book-title">${book.title}</div>
                            <div class="book-author">by ${book.author || 'Unknown Author'}</div>
                        </div>
                    </div>
                `;
            });
            
            // Update the UI and cache
            recommendationsContainer.innerHTML = recommendationsHTML;
            localStorage.setItem('cachedRecommendations', recommendationsHTML);
            localStorage.setItem('cachedReadingPreferences', currentPreferences);
            localStorage.setItem('recommendationsLastUpdated', new Date().toISOString());
            
        } catch (error) {
            recommendationsContainer.innerHTML = '<div class="empty-state"><p>Failed to load recommendations. Please try again later.</p></div>';
        }
    }

    // Helper function to check if reading preferences have changed
    async function haveReadingPreferencesChanged() {
        try {
            const currentUser = firebase.auth().currentUser;
            if (!currentUser) return true; // Force refresh if no user
            
            const cachedPreferences = localStorage.getItem('cachedReadingPreferences');
            if (!cachedPreferences) return true; // Force refresh if no cached preferences
            
            // Get current preferences from settings
            const idToken = await currentUser.getIdToken(true);
            const settingsResponse = await fetch('/Get_Settings', {
                headers: {
                    'Authorization': `Bearer ${idToken}`
                }
            });
            
            if (!settingsResponse.ok) return true; // Force refresh if can't get settings
            
            const settings = await settingsResponse.json();
            const currentPreferences = settings && settings.reading_preferences ? 
                settings.reading_preferences.trim() : 
                "popular fiction and non-fiction books";
            
            // Return true if preferences have changed
            return cachedPreferences !== currentPreferences;
        } catch (error) {
            return true; // Force refresh if there's an error
        }
    }

    async function updateRecentActivity() {
        try {
            const currentUser = firebase.auth().currentUser;
            
            const userEmail = currentUser.email;
        const container = document.getElementById('activityList');
        
        if (!container) {
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

    try {
        // Wait for Firebase to be initialized
        await waitForFirebase();
        
        // Initialize the dashboard
        await initDashboard();
    } catch (error) {
        showErrorMessage('Error initializing the application. Please try refreshing the page.');
    }
}); 