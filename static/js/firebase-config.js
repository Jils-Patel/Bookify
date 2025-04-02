const firebaseConfig = {
    apiKey: "AIzaSyB3dxIhLUE7gqA-PQS7rvVJCgwUT5_6uJk",
    authDomain: "bookify-ee9d0.firebaseapp.com",
    projectId: "bookify-ee9d0",
    storageBucket: "bookify-ee9d0.firebasestorage.app",
    messagingSenderId: "650229262126",
    appId: "1:650229262126:web:4b6c414dabcd9da8b37cbf",
    measurementId: "G-TNXY1YZP5X"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
let currentUser = null;
let currentUserEmail = null;

firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
        currentUser = user;
        currentUserEmail = user.email;
        
        document.dispatchEvent(new CustomEvent('user-logged-in', {
            detail: { user: currentUser }
        }));
    } else {
        currentUser = null;
        currentUserEmail = null;
        console.log('User is signed out');
    }
});

function getUserEmail() {
    return currentUserEmail;
}

function isUserAuthenticated() {
    return !!currentUserEmail;
}

function addBookToCollection(bookData) {
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
        
        db.collection('Documents')
            .add(bookToAdd)
            .then((docRef) => {
                console.log('Book added with ID:', docRef.id);
                showSuccessMessage(`Added "${bookToAdd.title}" to your collection!`);
                resolve(docRef.id);
            })
            .catch((error) => {
                console.error('Error adding book:', error);
                showErrorMessage(`Error adding to collection: ${error.message}`);
                reject(error);
            });
    });
}

function getUserBooks() {
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
                console.log(`Found ${books.length} books for user ${currentUserEmail}`);
                resolve(books);
            })
            .catch((error) => {
                console.error('Error getting books:', error);
                
                // Provide more detailed error message
                if (error.code === 'permission-denied') {
                    console.error('Firestore permission denied. Please check your security rules.');
                    showErrorMessage('Permission denied accessing your books. Please contact support.');
                } else {
                    showErrorMessage(`Error loading books: ${error.message}`);
                }
                
                resolve([]);
            });
    });
}

function updateBook(bookId, bookData) {
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
                console.log('Book updated successfully');
                showSuccessMessage('Book updated successfully!');
                resolve();
            })
            .catch((error) => {
                console.error('Error updating book:', error);
                showErrorMessage(`Error updating book: ${error.message}`);
                reject(error);
            });
    });
}

function deleteBook(bookId) {
    return new Promise((resolve, reject) => {
        if (!isUserAuthenticated()) {
            showErrorMessage('Please log in to delete books');
            reject(new Error('User not authenticated'));
            return;
        }
        
        db.collection('Documents')
            .doc(bookId)
            .delete()
            .then(() => {
                console.log('Book deleted successfully');
                showSuccessMessage('Book deleted successfully!');
                resolve();
            })
            .catch((error) => {
                console.error('Error deleting book:', error);
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

window.db = db;
window.currentUser = currentUser;
window.currentUserEmail = currentUserEmail;
window.addBookToCollection = addBookToCollection;
window.getUserBooks = getUserBooks;
window.updateBook = updateBook;
window.deleteBook = deleteBook;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showSuccessMessage = showSuccessMessage;
window.showErrorMessage = showErrorMessage; 