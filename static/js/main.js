document.addEventListener('DOMContentLoaded', function() {
    // Initialize UI elements
    const findBooksBtn = document.getElementById('findBooksBtn');
    const userInput = document.getElementById('userInput');
    const newChatBtn = document.getElementById('newChatBtn');
    const renameChatBtn = document.getElementById('renameChatBtn');
    const deleteChatBtn = document.getElementById('deleteChatBtn');
    const chatsList = document.getElementById('chatsList');
    const currentChatTitle = document.getElementById('currentChatTitle');
    
    // Current chat state
    let currentChatId = null;
    let chats = [];
    let chatHistory = [];
    
    // Initialize Firebase auth state
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            console.log('User is authenticated, loading chats...');
            loadUserChats();
        } else {
            console.error('User is not authenticated');
            showWelcomeMessage();
        }
    });
    
    // Set up event listeners
    findBooksBtn.addEventListener('click', handleUserInput);
    
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleUserInput();
        }
    });
    
    newChatBtn.addEventListener('click', createNewChat);
    renameChatBtn.addEventListener('click', renameCurrentChat);
    deleteChatBtn.addEventListener('click', promptDeleteCurrentChat);
    
    // Show welcome message
    function showWelcomeMessage() {
    addMessageToHistory('Hi! I\'m your AI assistant. I can help you find book recommendations, research papers (both recent and archival), or answer questions about books and academic topics. How can I help you today?');
    }
    
    // Load user's chats from Firebase
    function loadUserChats() {
        if (!firebase.auth().currentUser) return;
        
        const userEmail = firebase.auth().currentUser.email;
        
        db.collection('Chats')
            .where('user_id', '==', userEmail)
            .orderBy('updated_at', 'desc')
            .get()
            .then((querySnapshot) => {
                chats = [];
                chatsList.innerHTML = '';
                
                if (querySnapshot.empty) {
                    chatsList.innerHTML = `
                        <div class="chat-list-empty">
                            <p>No conversations yet</p>
                        </div>
                    `;
                    createNewChat(); // Create a default chat if none exists
                    return;
                }
                
                querySnapshot.forEach((doc) => {
                    const chat = {
                        id: doc.id,
                        ...doc.data()
                    };
                    chats.push(chat);
                    renderChatItem(chat);
                });
                
                // Select the first chat
                if (chats.length > 0) {
                    selectChat(chats[0].id);
                }
            })
            .catch((error) => {
                console.error('Error loading chats:', error);
                showErrorMessage('Failed to load your conversations. Please try again later.');
            });
    }
    
    // Create a new chat
    function createNewChat() {
        if (!firebase.auth().currentUser) {
            showErrorMessage('Please sign in to create a new chat');
            return;
        }
        
        const userEmail = firebase.auth().currentUser.email;
        const newChat = {
            title: 'New Conversation',
            user_id: userEmail,
            created_at: firebase.firestore.Timestamp.now(),
            updated_at: firebase.firestore.Timestamp.now(),
            messages: []
        };
        
        db.collection('Chats')
            .add(newChat)
            .then((docRef) => {
                const chat = {
                    id: docRef.id,
                    ...newChat
                };
                chats.unshift(chat);
                renderChatItem(chat, true);
                selectChat(docRef.id);
            })
            .catch((error) => {
                console.error('Error creating new chat:', error);
                showErrorMessage('Failed to create a new conversation');
            });
    }
    
    // Render a chat item in the sidebar
    function renderChatItem(chat, prepend = false) {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.id = chat.id;
        
        const preview = chat.messages && chat.messages.length > 0 
            ? chat.messages[chat.messages.length - 1].message.substring(0, 40) + (chat.messages[chat.messages.length - 1].message.length > 40 ? '...' : '')
            : 'No messages yet';
        
        chatItem.innerHTML = `
            <div class="chat-item-content" onclick="selectChat('${chat.id}')">
                <div class="chat-item-title">${chat.title}</div>
                <div class="chat-item-preview">${preview}</div>
            </div>
            <!--<div class="chat-item-actions">
                <button class="chat-item-delete" onclick="event.stopPropagation(); deleteChatById('${chat.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div> -->
        `;
        
        // Check if this is the active chat
        if (chat.id === currentChatId) {
            chatItem.classList.add('active');
        }
        
        // Removes the "No conversations yet" message if it exists
        const emptyChatList = document.querySelector('.chat-list-empty');
        if (emptyChatList) {
            emptyChatList.remove();
        }
        
        if (prepend && chatsList.firstChild) {
            chatsList.insertBefore(chatItem, chatsList.firstChild);
        } else {
            chatsList.appendChild(chatItem);
        }
    }
    
    // Select a chat and load its messages
    function selectChat(chatId) {
        // Don't reload if it's already the current chat
        if (chatId === currentChatId) return;
        
        // Remove active class from previous chat
        const activeChat = document.querySelector('.chat-item.active');
        if (activeChat) {
            activeChat.classList.remove('active');
        }
        
        // Add active class to selected chat
        const selectedChat = document.querySelector(`.chat-item[data-id="${chatId}"]`);
        if (selectedChat) {
            selectedChat.classList.add('active');
        }
        
        // Update current chat ID
        currentChatId = chatId;
        
        // Find the chat in our array
        const chat = chats.find(c => c.id === chatId);
        if (!chat) return;
        
        // Update the chat title
        currentChatTitle.textContent = chat.title;
        
        // Clear the current chat history
        chatHistory = [];
        const chatHistoryDiv = document.querySelector('.chat-history');
        chatHistoryDiv.innerHTML = '';
        
        // Load messages from the selected chat
        if (chat.messages && chat.messages.length > 0) {
            chat.messages.forEach(msg => {
                addMessageToHistory(msg.message, msg.isUser, msg.items, msg.responseType, false);
            });
        } else {
            // Show welcome message in an empty chat
            showWelcomeMessage();
        }
    }
    
    function renameCurrentChat() {
        if (!currentChatId) return;
        
        const chat = chats.find(c => c.id === currentChatId);
        if (!chat) return;
        
        // Create modal elements
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.cssText = `
            background-color: white;
            border-radius: 8px;
            padding: 24px;
            width: 400px;
            max-width: 90%;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        
        const modalHeader = document.createElement('h3');
        modalHeader.textContent = 'Rename Conversation';
        modalHeader.style.cssText = `
            margin-top: 0;
            margin-bottom: 16px;
            color: black;
            font-size: 18px;
            font-weight: 600;
        `;
        
        const modalInput = document.createElement('input');
        modalInput.type = 'text';
        modalInput.value = chat.title;
        modalInput.style.cssText = `
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            font-size: 16px;
            margin-bottom: 20px;
            box-sizing: border-box;
            outline: none;
        `;
        modalInput.addEventListener('focus', () => {
            modalInput.style.borderColor = '#4a90e2';
        });
        modalInput.addEventListener('blur', () => {
            modalInput.style.borderColor = '#e0e0e0';
        });
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        `;
        
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.style.cssText = `
            padding: 8px 16px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            background-color: white;
            color: black;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
        `;
        cancelButton.addEventListener('mouseover', () => {
            cancelButton.style.backgroundColor = '#f5f5f5';
        });
        cancelButton.addEventListener('mouseout', () => {
            cancelButton.style.backgroundColor = 'white';
        });
        
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.style.cssText = `
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            background-color: #4a90e2;
            color: white;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
        `;
        saveButton.addEventListener('mouseover', () => {
            saveButton.style.backgroundColor = '#3a80d2';
        });
        saveButton.addEventListener('mouseout', () => {
            saveButton.style.backgroundColor = '#4a90e2';
        });
        
        // Assemble modal
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(saveButton);
        
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalInput);
        modalContent.appendChild(buttonContainer);
        
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
        
        // Focus input after modal is shown
        setTimeout(() => modalInput.focus(), 100);
        
        // Handle input events
        modalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveNewTitle();
            } else if (e.key === 'Escape') {
                closeModal();
            }
        });
        
        // Handle button events
        cancelButton.addEventListener('click', closeModal);
        saveButton.addEventListener('click', saveNewTitle);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
        
        function closeModal() {
            document.body.removeChild(modalOverlay);
        }
        
        function saveNewTitle() {
            const newTitle = modalInput.value.trim();
            closeModal();
            
            if (!newTitle || newTitle === chat.title) return;
            
            db.collection('Chats').doc(currentChatId)
                .update({
                    title: newTitle,
                    updated_at: firebase.firestore.Timestamp.now()
                })
                .then(() => {
                    // Update local data
                    chat.title = newTitle;
                    currentChatTitle.textContent = newTitle;
                    
                    // Update the sidebar item
                    const chatItem = document.querySelector(`.chat-item[data-id="${currentChatId}"] .chat-item-title`);
                    if (chatItem) {
                        chatItem.textContent = newTitle;
                    }
                })
                .catch((error) => {
                    console.error('Error renaming chat:', error);
                    showErrorMessage('Failed to rename conversation');
                });
        }
    }
    
    function promptDeleteCurrentChat() {
        if (!currentChatId) return;
        
        // Create modal elements
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.cssText = `
            background-color: white;
            border-radius: 8px;
            padding: 24px;
            width: 400px;
            max-width: 90%;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        
        const modalHeader = document.createElement('h3');
        modalHeader.textContent = 'Delete Conversation';
        modalHeader.style.cssText = `
            margin-top: 0;
            margin-bottom: 8px;
            color: black;
            font-size: 18px;
            font-weight: 600;
        `;
        
        const modalMessage = document.createElement('p');
        modalMessage.textContent = 'Are you sure you want to delete this conversation? This action cannot be undone.';
        modalMessage.style.cssText = `
            margin-bottom: 20px;
            color: #333;
            font-size: 14px;
            line-height: 1.5;
        `;
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        `;
        
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.style.cssText = `
            padding: 8px 16px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            background-color: white;
            color: black;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
        `;
        cancelButton.addEventListener('mouseover', () => {
            cancelButton.style.backgroundColor = '#f5f5f5';
        });
        cancelButton.addEventListener('mouseout', () => {
            cancelButton.style.backgroundColor = 'white';
        });
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.style.cssText = `
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            background-color: #ff4d4f;
            color: white;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
        `;
        deleteButton.addEventListener('mouseover', () => {
            deleteButton.style.backgroundColor = '#ff3133';
        });
        deleteButton.addEventListener('mouseout', () => {
            deleteButton.style.backgroundColor = '#ff4d4f';
        });
        
        // Assemble modal
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(deleteButton);
        
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalMessage);
        modalContent.appendChild(buttonContainer);
        
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
        
        // Handle button events
        cancelButton.addEventListener('click', closeModal);
        deleteButton.addEventListener('click', () => {
            closeModal();
            deleteChatById(currentChatId);
        });
        
        // Close when clicking outside or pressing Escape
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
        
        document.addEventListener('keydown', handleKeyDown);
        
        function handleKeyDown(e) {
            if (e.key === 'Escape') {
                closeModal();
            }
        }
        
        function closeModal() {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.removeChild(modalOverlay);
        }
    }
    
    // Delete a chat by ID
    function deleteChatById(chatId) {
        db.collection('Chats').doc(chatId)
            .delete()
            .then(() => {
                // Remove from the UI
                const chatItem = document.querySelector(`.chat-item[data-id="${chatId}"]`);
                if (chatItem) {
                    chatItem.remove();
                }
                
                // Remove from our array
                chats = chats.filter(c => c.id !== chatId);
                
                // If we deleted the current chat, select another one or create a new one
                if (chatId === currentChatId) {
                    if (chats.length > 0) {
                        selectChat(chats[0].id);
                    } else {
                        createNewChat();
                    }
                }
                
                // If no chats left, show empty state
                if (chats.length === 0) {
                    chatsList.innerHTML = `
                        <div class="chat-list-empty">
                            <p>No conversations yet</p>
                        </div>
                    `;
                }
            })
            .catch((error) => {
                console.error('Error deleting chat:', error);
                showErrorMessage('Failed to delete conversation');
            });
    }
    
    // Clear the current chat
    function clearCurrentChat() {
        if (!currentChatId) return;
        
        if (confirm('Are you sure you want to clear all messages in this conversation? This action cannot be undone.')) {
            db.collection('Chats').doc(currentChatId)
                .update({
                    messages: [],
                    updated_at: firebase.firestore.Timestamp.now()
                })
                .then(() => {
                    // Clear the chat history UI
                    chatHistory = [];
                    const chatHistoryDiv = document.querySelector('.chat-history');
                    chatHistoryDiv.innerHTML = '';
                    
                    // Update the chat item preview
                    const chatItem = document.querySelector(`.chat-item[data-id="${currentChatId}"] .chat-item-preview`);
                    if (chatItem) {
                        chatItem.textContent = 'No messages yet';
                    }
                    
                    // Show welcome message
                    showWelcomeMessage();
                    
                    // Update local chat data
                    const chat = chats.find(c => c.id === currentChatId);
                    if (chat) {
                        chat.messages = [];
                    }
                })
                .catch((error) => {
                    console.error('Error clearing chat:', error);
                    showErrorMessage('Failed to clear conversation');
                });
        }
    }
    
    // Add a message to the chat history
    function addMessageToHistory(message, isUser = false, items = null, responseType = null, shouldSave = true) {
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
    
        // Add to history array
        const messageObj = { message, isUser, items, responseType, timestamp: new Date().toISOString() };
        chatHistory.push(messageObj);
        
        // Save to Firebase if needed
        if (shouldSave && currentChatId) {
            saveMessageToFirebase(messageObj);
        }
        
        // Update the chat preview in the sidebar
        if (shouldSave && currentChatId) {
            const chatItem = document.querySelector(`.chat-item[data-id="${currentChatId}"] .chat-item-preview`);
            if (chatItem) {
                chatItem.textContent = message.substring(0, 40) + (message.length > 40 ? '...' : '');
            }
        }
    }
    
    // Save a message to Firebase
    function saveMessageToFirebase(messageObj) {
        if (!currentChatId) return;
        
        db.collection('Chats').doc(currentChatId)
            .update({
                messages: firebase.firestore.FieldValue.arrayUnion(messageObj),
                updated_at: firebase.firestore.Timestamp.now()
            })
            .catch((error) => {
                console.error('Error saving message:', error);
            });
    }
    
    // Auto-generate a title for the chat based on the first user message
    function generateChatTitle(userMessage) {
        if (!currentChatId) return;
        
        const chat = chats.find(c => c.id === currentChatId);
        if (!chat || chat.title !== 'New Conversation') return;
        
        // Only auto-generate for the first message in a new chat
        if (chat.messages && chat.messages.length > 0) return;
        
        // Generate a short title based on the user's first message
        let title = userMessage.substring(0, 30);
        if (userMessage.length > 30) {
            title += '...';
        }
        
        db.collection('Chats').doc(currentChatId)
            .update({
                title: title,
                updated_at: firebase.firestore.Timestamp.now()
            })
            .then(() => {
                // Update local data
                chat.title = title;
                currentChatTitle.textContent = title;
                
                // Update the sidebar item
                const chatItem = document.querySelector(`.chat-item[data-id="${currentChatId}"] .chat-item-title`);
                if (chatItem) {
                    chatItem.textContent = title;
                }
            })
            .catch((error) => {
                console.error('Error updating chat title:', error);
            });
    }
    
    // Handle user input and send to API
function handleUserInput() {
        const userInputValue = userInput.value.trim();
    
        if (!userInputValue) {
        alert('Please enter your question or tell me what kind of books or research you\'re interested in.');
        return;
    }
    
        // Make sure we have a current chat
        if (!currentChatId) {
            createNewChat().then(() => {
                processUserInput(userInputValue);
            });
        } else {
            processUserInput(userInputValue);
        }
    }
    
    // Process the user input and get a response
    function processUserInput(userInputValue) {
        // Try to auto-generate a title for new conversations
        generateChatTitle(userInputValue);
        
        // Add the user message to the chat
        addMessageToHistory(userInputValue, true);
        userInput.value = '';
        
        // Show typing indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant-message';
    const typingContainer = document.createElement('div');
    typingContainer.className = 'typing-animation';
    const typingSpan = document.createElement('span');
    typingSpan.className = 'typing-dots';
    typingContainer.appendChild(typingSpan);
    loadingDiv.appendChild(typingContainer);
    document.querySelector('.chat-history').appendChild(loadingDiv);
    
        // Get last few messages for context
        const conversationContext = getConversationContext();
        
        // Send to API
    fetch('/recommend', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
                user_input: userInputValue,
                conversation_context: conversationContext
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

    // Get recent conversation context for sending to the API
    function getConversationContext() {
        // Get last 10 messages maximum (or fewer if there aren't that many)
        const contextLength = 10;
        const startIdx = Math.max(0, chatHistory.length - contextLength);
        const recentMessages = chatHistory.slice(startIdx);
        
        // Format for API
        return recentMessages.map(item => ({
            role: item.isUser ? 'user' : 'assistant',
            content: item.message
        }));
    }
    
    // Show error message
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
        }, 3000);
    }
    
    // Export functions to window
    window.selectChat = selectChat;
    window.deleteChatById = deleteChatById;
    window.clearCurrentChat = clearCurrentChat;
    window.createNewChat = createNewChat;
});

// Create a book card for display in the grid
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

// Create a research card for display in the grid
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

// Create a scholarly article card
function createScholarCard(paper) {
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

// Show a modal with content
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

// Show a research paper modal
function showResearchModal(paper) {
    const modal = document.getElementById('bookModal');
    const modalContent = document.getElementById('modalContent');
    
    const viewButtonHtml = paper.view_url
        ? `<div class="read-online-section">
            <a href="${paper.view_url}" target="_blank" class="read-online-btn">
                <i class="fas fa-external-link-alt"></i> View Online
            </a>
           </div>`
        : '';
    
    const downloadButtonHtml = paper.download_url
        ? `<div class="buy-section">
            <a href="${paper.download_url}" target="_blank" class="buy-btn">
                <i class="fas fa-file-download"></i> Download PDF
            </a>
           </div>`
        : '';
    
    modalContent.innerHTML = `
        <div class="modal-body">
            <div class="modal-book-info">
                <div class="modal-book-cover">
                    <div class="book-cover-wrapper">
                        <img src="${paper.cover_url || '/static/images/research-placeholder.svg'}" 
                             alt="${paper.title} cover"
                             onerror="this.src='/static/images/research-placeholder.svg'">
                        ${paper.has_ebook ? '<div class="ebook-badge"><i class="fas fa-file-pdf"></i> PDF</div>' : ''}
                    </div>
                    <div class="action-buttons">
                        ${viewButtonHtml}
                        ${downloadButtonHtml}
                        <button class="add-to-collection-btn" onclick="addToCollection(${JSON.stringify(paper).replace(/"/g, '&quot;')}, 'archive')">
                            <i class="fas fa-plus"></i> Add to Collection
                        </button>
                    </div>
                </div>
                <div class="modal-book-details">
                    <div class="modal-book-metadata">
                        <h2>${paper.title}</h2>
                        <p>by ${paper.author || 'Unknown Author'}</p>
                        <p>Published: <span class="year-badge">${paper.year || 'Unknown'}</span></p>
                    </div>
                    <div class="modal-book-recommendation">
                        <h3>Abstract</h3>
                        <p>${paper.description || "No abstract available."}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// Close the modal
function closeModal() {
    const modal = document.getElementById('bookModal');
    if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}
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