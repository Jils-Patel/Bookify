// Initialize Firebase with config from backend
let firebaseConfig = null;
let db = null;
let currentUser = null;
let currentUserEmail = null;
let firebaseInitialized = false;

async function initializeFirebase() {
    try {
        const response = await fetch('/get_firebase_config');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const firebaseConfig = await response.json();
        
        if (!firebaseConfig || !firebaseConfig.apiKey) {
            throw new Error('Invalid Firebase configuration received');
        }
        
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        firebaseInitialized = true;
        
        // Set up auth state listener
        firebase.auth().onAuthStateChanged(function(user) {
            if (user) {
                currentUser = user;
                currentUserEmail = user.email;
            } else {
                currentUser = null;
                currentUserEmail = null;
            }
        });
        
        // Dispatch event to notify other scripts that Firebase is ready
        document.dispatchEvent(new CustomEvent('firebase-initialized'));
    } catch (error) {
        showErrorMessage('Error initializing the application. Please try refreshing the page.');
    }
}

// Initialize Firebase when the script loads
initializeFirebase();

// Helper function to wait for Firebase initialization
function waitForFirebase() {
    return new Promise((resolve) => {
        if (firebaseInitialized) {
            resolve();
        } else {
            document.addEventListener('firebase-initialized', () => {
                resolve();
            });
        }
    });
}

// Export functions that depend on Firebase
async function getUserEmail() {
    await waitForFirebase();
    return currentUserEmail;
}

async function isUserAuthenticated() {
    await waitForFirebase();
    return !!currentUserEmail;
}

async function addBookToCollection(bookData) {
    await waitForFirebase();
    return new Promise((resolve, reject) => {
        if (!isUserAuthenticated()) {
            showErrorMessage('Please log in to add books to your collection');
            reject(new Error('User not authenticated'));
            return;
        }
        const bookToAdd = {
            ...bookData,
            user_id: currentUserEmail,
            date_added: firebase.firestore.Timestamp.now()
        };
        
        // Call the server endpoint to check limits and add the book
        fetch('/Add_To_Collection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ book_data: bookToAdd })
        })
        .then(response => {
            if (response.status === 403) {
                // This is the tracking limit error
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
                showSuccessMessage(`Added "${bookToAdd.title}" to your collection!`);
            resolve(data.id);
            })
        .catch(error => {
                //showErrorMessage(`Error adding to collection: ${error.message}`);
                reject(error);
            });
    });
}

async function getUserBooks() {
    await waitForFirebase();
    return new Promise((resolve, reject) => {
        
        
        db.collection('Documents')
            .where('user_id', '==', currentUserEmail)
            .get()
            .then((querySnapshot) => {
                const books = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    books.push({
                        id: doc.id,
                        ...data
                    });
                });
                resolve(books);
            })
            .catch((error) => {
                
                // Provide more detailed error message
                if (error.code === 'permission-denied') {
                    showErrorMessage('Permission denied accessing your books. Please contact support.');
                } else {
                    showErrorMessage(`Error loading books: ${error.message}`);
                }
                
                resolve([]);
            });
    });
}

async function updateBook(bookId, bookData) {
    await waitForFirebase();
    return new Promise((resolve, reject) => {
        if (!isUserAuthenticated()) {
            showErrorMessage('Please log in to update books');
            reject(new Error('User not authenticated'));
            return;
        }
        
        db.collection('Documents')
            .doc(bookId)
            .update(bookData)
            .then(() => {
                showSuccessMessage('Book updated successfully!');
                resolve();
            })
            .catch((error) => {
                showErrorMessage(`Error updating book: ${error.message}`);
                reject(error);
            });
    });
}

async function deleteBook(bookId) {
    await waitForFirebase();
    return new Promise((resolve, reject) => {
        if (!isUserAuthenticated()) {
            showErrorMessage('Please log in to delete books');
            reject(new Error('User not authenticated'));
            return;
        }
        
        if (!bookId) {
            showErrorMessage('Invalid book ID');
            reject(new Error('Invalid book ID'));
            return;
        }

        // First verify the book exists and belongs to the user
        db.collection('Documents')
            .doc(bookId)
            .get()
            .then((doc) => {
                if (!doc.exists) {
                    reject(new Error('Book not found'));
                    return;
                }
                
                const bookData = doc.data();
                if (bookData.user_id !== currentUserEmail) {
                    reject(new Error('Unauthorized to delete this book'));
                    return;
                }
                
                // If verification passes, delete the book
                return db.collection('Documents').doc(bookId).delete();
            })
            .then(() => {
                showSuccessMessage('Book deleted successfully!');
                resolve();
            })
            .catch((error) => {
                showErrorMessage(`Error deleting book: ${error.message}`);
                reject(error);
            });
    });
}

function showLoading(message) {
    let loadingEl = document.getElementById('loadingIndicator');
    
    if (!loadingEl) {
        loadingEl = document.createElement('div');
        loadingEl.id = 'loadingIndicator';
        loadingEl.className = 'loading-indicator';
        document.body.appendChild(loadingEl);
    }
    
    loadingEl.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-text">${message || 'Loading...'}</div>
    `;
    
    loadingEl.style.display = 'flex';
}

function hideLoading() {
    const loadingEl = document.getElementById('loadingIndicator');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

function showSuccessMessage(message) {
    const successMsg = document.createElement('div');
    successMsg.className = 'success-message';
    successMsg.innerHTML = `
        <i class="fas fa-check-circle"></i>
        ${message}
    `;
    document.body.appendChild(successMsg);
    
    setTimeout(() => {
        successMsg.remove();
    }, 3000);
}

function showErrorMessage(message) {
    const errorMsg = document.createElement('div');
    errorMsg.className = 'error-message';
    errorMsg.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        ${message}
    `;
    document.body.appendChild(errorMsg);
    
    setTimeout(() => {
        errorMsg.remove();
    }, 5000);
}

// Export the functions to the window object
window.db = db;
window.currentUser = currentUser;
window.currentUserEmail = currentUserEmail;
window.addBookToCollection = addBookToCollection;
window.getUserBooks = getUserBooks;
window.updateBook = updateBook;
window.deleteBookFromFirebase = deleteBook;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showSuccessMessage = showSuccessMessage;
window.showErrorMessage = showErrorMessage;
window.waitForFirebase = waitForFirebase; 