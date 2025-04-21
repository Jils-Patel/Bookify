/**
 * Language Selector Utility
 * This utility adds language selection functionality for books with multiple editions
 * in different languages available on Internet Archive.
 */

// Function to detect language from IA identifier
function detectLanguageFromId(iaId) {
    // Common language codes in IA identifiers
    const langCodes = {
        'eng': 'English',
        'fre': 'French',
        'ger': 'German',
        'spa': 'Spanish',
        'ita': 'Italian',
        'rus': 'Russian',
        'chi': 'Chinese',
        'jpn': 'Japanese',
        'por': 'Portuguese',
        'ara': 'Arabic',
        'lat': 'Latin',
        'gre': 'Greek',
        'dut': 'Dutch',
        'hin': 'Hindi',
        'san': 'Sanskrit'
    };
    
    // Look for language code in identifier
    for (const [code, language] of Object.entries(langCodes)) {
        if (iaId.includes(`_${code}`) || iaId.includes(`.${code}`) || iaId.includes(`-${code}`)) {
            return language;
        }
    }
    
    // Default to "Unknown" if no language code is found
    return "Unknown";
}

// Function to create a user-friendly label for a language option
function createLanguageLabel(iaId, metadata) {
    let language = "Unknown";
    
    // If metadata contains language info, use that
    if (metadata && metadata.language) {
        language = metadata.language;
    } else {
        // Otherwise try to detect from the ID
        language = detectLanguageFromId(iaId);
    }
    
    // Include publication info if available
    let publishInfo = "";
    if (metadata && metadata.publisher && metadata.publish_date) {
        publishInfo = ` (${metadata.publisher}, ${metadata.publish_date})`;
    } else if (metadata && metadata.publish_date) {
        publishInfo = ` (${metadata.publish_date})`;
    } else if (metadata && metadata.publisher) {
        publishInfo = ` (${metadata.publisher})`;
    }
    
    return `${language}${publishInfo}`;
}

// Main function to add language selector to a containing element
function addLanguageSelector(book, containerElement) {
    // Create language selector container
    const selectorContainer = document.createElement('div');
    selectorContainer.className = 'language-selector-container';
    
    // Add heading
    const heading = document.createElement('h4');
    heading.textContent = 'Available Editions';
    selectorContainer.appendChild(heading);
    
    // Create language selector
    const selector = document.createElement('div');
    selector.className = 'language-selector';
    
    // If we have more than just IDs, show extended info
    if (book.ia_ids && book.language_metadata && 
        book.ia_ids.length === book.language_metadata.length) {
        
        // Create radio buttons for each language
        book.ia_ids.forEach((iaId, index) => {
            const metadata = book.language_metadata[index];
            const label = createLanguageLabel(iaId, metadata);
            
            const option = document.createElement('div');
            option.className = 'language-option';
            
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `lang-${book.id}`;
            radio.id = `lang-${book.id}-${index}`;
            radio.value = iaId;
            radio.checked = index === 0; // Select first option by default
            
            const labelElement = document.createElement('label');
            labelElement.htmlFor = `lang-${book.id}-${index}`;
            labelElement.textContent = label;
            
            option.appendChild(radio);
            option.appendChild(labelElement);
            selector.appendChild(option);
        });
    } else if (book.ia_ids) {
        // Simple version with just IDs and minimal info
        book.ia_ids.forEach((iaId, index) => {
            const label = detectLanguageFromId(iaId);
            
            const option = document.createElement('div');
            option.className = 'language-option';
            
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `lang-${book.id || 'book'}`;
            radio.id = `lang-${book.id || 'book'}-${index}`;
            radio.value = iaId;
            radio.checked = index === 0; // Select first option by default
            
            const labelElement = document.createElement('label');
            labelElement.htmlFor = `lang-${book.id || 'book'}-${index}`;
            labelElement.textContent = `${label} Edition`;
            
            option.appendChild(radio);
            option.appendChild(labelElement);
            selector.appendChild(option);
        });
    }
    
    selectorContainer.appendChild(selector);
    
    // Add action button to use selected language
    const actionButton = document.createElement('a');
    actionButton.className = 'read-button language-select-button';
    actionButton.textContent = 'Read Selected Edition';
    actionButton.href = `https://archive.org/details/${book.ia_ids[0]}`;
    actionButton.target = '_blank';
    
    // Update link when selection changes
    selector.addEventListener('change', (e) => {
        if (e.target && e.target.tagName === 'INPUT') {
            actionButton.href = `https://archive.org/details/${e.target.value}`;
        }
    });
    
    selectorContainer.appendChild(actionButton);
    
    // Add the selector to the container element
    containerElement.appendChild(selectorContainer);
    
    // Add styles if not already present
    if (!document.getElementById('language-selector-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'language-selector-styles';
        styleElement.textContent = `
            .language-selector-container {
                margin-top: 15px;
                padding: 10px;
                background-color: #f5f5f5;
                border-radius: 4px;
            }
            
            .language-selector-container h4 {
                margin: 0 0 10px 0;
                font-size: 16px;
                color: #333;
            }
            
            .language-selector {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 15px;
            }
            
            .language-option {
                display: flex;
                align-items: center;
            }
            
            .language-option input {
                margin-right: 8px;
            }
            
            .language-option label {
                cursor: pointer;
            }
            
            .language-select-button {
                display: inline-block;
                width: fit-content;
            }
        `;
        document.head.appendChild(styleElement);
    }
    
    return selectorContainer;
}

// Export the function for use in other modules
window.addLanguageSelector = addLanguageSelector; 