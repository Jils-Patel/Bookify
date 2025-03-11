from flask import Flask, request, jsonify, render_template
import openai
import requests
import json
import re
import internetarchive
from urllib.parse import quote

app = Flask(__name__)

# OpenAI API Key
openai.api_key = "sk-None-tuMHMcLlpx1Jp9W58F6lT3BlbkFJJjoDDYpdxje8KdqwQy9a"

def extract_search_terms_with_gpt(user_input):
    """Extract key search terms from user input using GPT"""
    try:
        prompt = f"""
        Extract the main keywords from this request. 
        If it's about books, extract: book titles, author names, genres, or series titles.
        If it's about research, extract: research topics, academic subjects, scientific concepts, or academic keywords.
        Only return the key search terms, nothing else.
        
        Request: "{user_input}"
        
        """

        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that extracts key search terms for a book and research recommendation system. Extract the most relevant search terms only, 1-5 words usually."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=50,
            temperature=0.3
        )
        
        search_terms = response.choices[0].message['content'].strip()
        print(f"Original input: '{user_input}'")
        print(f"Extracted terms: '{search_terms}'")
        return search_terms
    except Exception as e:
        print(f"Error extracting search terms with GPT: {e}")
        # Fall back to basic extraction if GPT fails
        return extract_search_terms_basic(user_input)

def extract_search_terms_basic(user_input):
    """Basic fallback extraction method"""
    
    # Convert input to lowercase for better matching
    processed_input = user_input.lower()
    
    # Remove extra whitespace and get final search terms
    search_terms = " ".join(processed_input.split())
    return search_terms

def search_open_library(query, max_results=5):
    """Search books using the Open Library API"""
    # Extract key search terms from the query using GPT
    search_terms = extract_search_terms_with_gpt(query)
    
    # If no search terms found, use original query
    if not search_terms:
        search_terms = query
    
    base_url = "http://openlibrary.org/search.json"
    response = requests.get(f"{base_url}?q={search_terms}&limit={max_results}")
    result = response.json()
    
    # If no results were found, try with the original query
    if result.get('numFound', 0) == 0 and search_terms != query or search_terms == "None":
        print(f"No results found with extracted terms. Trying original query: {query}")
        prompt = f"""
        Extract the main book, author, genre, year, or series title from this request. 
        If those do not exist, then extract other key words that are relevant.
        Only return a singular search term or phrase most related to the context of the request, nothing else.
        
        Request: "{search_terms}"
        
        Key search terms:"""

        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that extracts key search terms for a book recommendation system. Look for this priority: book title, genre. Give a one word term or one phrase by default."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=50,
            temperature=0.3
        )
        
        search_terms = response.choices[0].message['content'].strip()
        print(f"Original input: '{query}'")
        print(f"Extracted terms: '{search_terms}'")
        response = requests.get(f"{base_url}?q={search_terms}&limit={max_results}")
        result = response.json()
    
    return result

def get_book_cover_url(cover_id):
    """Get book cover URL from Open Library Covers API"""
    if cover_id:
        return f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg"  # Changed to large size

def get_book_descriptions(user_input, book_results):
    """Get book information with descriptions instead of AI recommendations"""
    books_info = []
    
    # Process the top books from the results
    docs = book_results.get('docs', [])[:50]  # Allow up to 20 results
    if not docs:
        return "No books found matching your interests.", []
    
    # Create a list of book information
    for doc in docs:
        # Extract the Open Library ID for fetching more details
        olid = doc.get('key', '').replace('/works/', '') if doc.get('key') else None
        
        # Check for ebook availability
        has_ebook = doc.get('has_fulltext', False)
        ia_id = doc.get('ia', [None])[0] if isinstance(doc.get('ia'), list) and doc.get('ia') else None
        
        # Construct reading URL if available
        reading_url = None
        if has_ebook and ia_id:
            reading_url = f"https://archive.org/details/{ia_id}"
        elif olid:
            # Even without direct IA link, some books might be readable through Open Library
            reading_url = f"https://openlibrary.org/works/{olid}"
        
        # Get ISBN for buy link
        isbn = None
        buy_link = None
        if doc.get('isbn'):
            if isinstance(doc.get('isbn'), list) and doc.get('isbn'):
                isbn = doc.get('isbn')[0]
            else:
                isbn = doc.get('isbn')
                
        # Create title and author for the book
        title = doc.get('title', 'Unknown Title')
        author = doc.get('author_name', ['Unknown Author'])[0] if doc.get('author_name') else 'Unknown Author'
        
        # Create Amazon buy link
        if isbn:
            buy_link = f"https://www.amazon.com/s?k={isbn}"
        else:
            # Format title and author for search
            search_query = f"{title} {author}".replace(" ", "+")
            buy_link = f"https://www.amazon.com/s?k={search_query}"
        
        book = {
            'title': title,
            'author': author,
            'year': doc.get('first_publish_year', 'Unknown'),
            'description': '',  # Will be populated with actual description
            'cover_url': get_book_cover_url(doc.get('cover_i')) if doc.get('cover_i') else None,
            'olid': olid,
            'has_ebook': has_ebook,
            'reading_url': reading_url,
            'isbn': isbn,
            'buy_link': buy_link
        }
        
        # Fetch additional details including description if we have an ID
        if olid:
            try:
                # Request work details
                work_url = f"https://openlibrary.org/works/{olid}.json"
                work_response = requests.get(work_url)
                
                if work_response.status_code == 200:
                    work_data = work_response.json()
                    
                    # Extract description
                    if 'description' in work_data:
                        if isinstance(work_data['description'], dict):
                            book['description'] = work_data['description'].get('value', '')
                        else:
                            book['description'] = work_data['description']
                    
                    # Check if the work has any ebook indicators
                    if not book['has_ebook']:
                        book['has_ebook'] = 'ebooks' in work_data and len(work_data['ebooks']) > 0
            except Exception as e:
                print(f"Error fetching details for {book['title']}: {e}")
        
        # Ensure there's always some description
        if not book['description'] or len(book['description'].strip()) == 0:
            book['description'] = f"'{book['title']}' is a book by {book['author']}, published in {book['year']}. "
        
        # Add a note about online readability to the description
        if book['has_ebook']:
            book['description'] += f"\n\n📚 **This book is available to read online through Open Library or Internet Archive.**"
        
        books_info.append(book)
    
    # For compatibility with the frontend, rename description to recommendation
    for book in books_info:
        book['recommendation'] = book['description']
    
    return "Books found based on your interests.", books_info

def get_gpt4_recommendations(user_input, book_results):
    """Legacy function - redirects to the description-based function"""
    return get_book_descriptions(user_input, book_results)

# Add Internet Archive search function after search_open_library function
def search_internet_archive(query, max_results=5):
    """Search research papers using the Internet Archive API"""
    # Extract key search terms from the query using GPT
    search_terms = extract_search_terms_with_gpt(query)
    print(f"Research Search terms: {search_terms}")
    
    # If no search terms found, use original query
    if not search_terms:
        search_terms = query
    
    base_url = "https://archive.org/advancedsearch.php"
    params = {
        "q": f"{search_terms} AND mediatype:texts",  # Filtering to only books and research papers
        "fl[]": "identifier,title,creator,description,date,subject",
        "rows": max_results,
        "output": "json"
    }
    
    response = requests.get(base_url, params=params)
    if response.status_code == 200:
        data = response.json()
        results = data['response']['docs']
        
        # If no results were found, try with the original query
        if len(results) == 0 and search_terms != query:
            print(f"No research results found with extracted terms. Trying original query: {query}")
            params["q"] = f"{query} AND mediatype:texts"
            response = requests.get(base_url, params=params)
            if response.status_code == 200:
                data = response.json()
                results = data['response']['docs']
        
        return results
    else:
        print(f"Error: {response.status_code}")
        return []

def get_research_details(results):
    """Get research paper details from Internet Archive results"""
    research_info = []
    
    for item in results:
        identifier = item.get('identifier', '')
        title = item.get('title', 'No title available')
        if isinstance(title, list) and len(title) > 0:
            title = title[0]
        
        creator = item.get('creator', 'Unknown author')
        if isinstance(creator, list) and len(creator) > 0:
            creator = creator[0]
        
        description = item.get('description', 'No description available')
        if isinstance(description, list) and len(description) > 0:
            description = description[0]
        
        # Get subjects for tags (if available)
        subjects = item.get('subject', [])
        if isinstance(subjects, str):
            subjects = [subjects]
        elif not isinstance(subjects, list):
            subjects = []
        subjects = subjects[:5]  # Limit to 5 subjects
        
        # Get year (if available)
        year = item.get('date', 'Unknown')
        if isinstance(year, list) and len(year) > 0:
            year = year[0]
        if isinstance(year, str):
            # Try to extract just the year
            year_match = re.search(r'\b\d{4}\b', year)
            if year_match:
                year = year_match.group(0)
        
        # Get download and view links
        normal_url = f"https://archive.org/details/{identifier}"
        thumbnail_url = f"https://archive.org/services/img/{identifier}"
        
        # Get metadata for file information
        metadata_url = f"https://archive.org/metadata/{identifier}"
        download_url = None
        
        try:
            metadata_response = requests.get(metadata_url)
            if metadata_response.status_code == 200:
                metadata = metadata_response.json()
                if "files" in metadata:
                    for file in metadata["files"]:
                        if file["name"].endswith(".pdf"):
                            download_url = f"https://archive.org/download/{identifier}/{file['name']}"
                            break
        except Exception as e:
            print(f"Error getting metadata: {e}")
        
        research_info.append({
            'title': title,
            'author': creator,
            'year': year,
            'subjects': subjects,
            'description': description[:300] + '...' if len(description) > 300 else description,
            'cover_url': thumbnail_url,
            'view_url': normal_url,
            'download_url': download_url,
            'identifier': identifier,
            'has_ebook': download_url is not None,
            'reading_url': normal_url,
            'buy_link': None  # Research papers don't have buy links
        })
    
    # For compatibility with the frontend, rename description to recommendation
    for paper in research_info:
        paper['recommendation'] = paper['description']
    
    return research_info

# Add Semantic Scholar API function after search_internet_archive function
def search_semantic_scholar(query, max_results=5):
    """Search recent research papers using the Semantic Scholar API"""
    try:
        # Extract key search terms from the query using GPT
        search_terms = extract_search_terms_with_gpt(query)
        
        # If no search terms found, use original query
        if not search_terms:
            search_terms = query
            
        print(f"Semantic Scholar search terms: {search_terms}")
        
        API_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
        FIELDS = "title,authors,year,url,abstract,isOpenAccess,openAccessPdf,venue,citationCount,influentialCitationCount"
        
        params = {
            "query": search_terms,
            "limit": max_results,
            "fields": FIELDS
        }
        
        try:
            response = requests.get(API_URL, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                papers = data.get("data", [])
                
                # If no results were found, try with the original query
                if len(papers) == 0 and search_terms != query:
                    print(f"No semantic scholar results found with extracted terms. Trying original query: {query}")
                    params["query"] = query
                    
                    try:
                        response = requests.get(API_URL, params=params, timeout=10)
                        if response.status_code == 200:
                            data = response.json()
                            papers = data.get("data", [])
                    except Exception as nested_e:
                        print(f"Error with Semantic Scholar API fallback request: {nested_e}")
                        return []
                        
                return papers
            else:
                print(f"Error with Semantic Scholar API: HTTP {response.status_code}")
                print(f"Response content: {response.text[:200]}...")
                return []
                
        except requests.exceptions.RequestException as req_e:
            print(f"Request error with Semantic Scholar API: {req_e}")
            return []
            
    except Exception as e:
        print(f"Unexpected error in search_semantic_scholar: {e}")
        return []

def get_semantic_scholar_details(papers):
    """Format Semantic Scholar papers for frontend display"""
    paper_info = []
    
    if not papers:
        print("Warning: No papers were returned from Semantic Scholar API")
        return paper_info
    
    for paper in papers:
        if not isinstance(paper, dict):
            print(f"Warning: Unexpected paper format: {paper}")
            continue
            
        title = paper.get("title", "No title available")
        
        # Get first author or "Unknown" if none
        authors = paper.get("authors", [])
        if authors and isinstance(authors, list) and len(authors) > 0 and isinstance(authors[0], dict):
            author = authors[0].get("name", "Unknown author")
        else:
            author = "Unknown author"
        
        # List all authors for detail view (safely)
        try:
            all_authors = ", ".join([a.get("name", "") for a in authors if isinstance(a, dict)]) if authors else "Unknown authors"
        except Exception as e:
            print(f"Error processing authors: {e}")
            all_authors = "Unknown authors"
        
        # Get year
        year = paper.get("year", "Unknown")
        
        # Get abstract
        abstract = paper.get("abstract", "No abstract available")
        
        # Get URL and PDF (safely)
        paper_url = paper.get("url", None)
        
        # Safely get PDF URL
        pdf_url = None
        openAccessPdf = paper.get("openAccessPdf", None)
        if openAccessPdf and isinstance(openAccessPdf, dict):
            pdf_url = openAccessPdf.get("url", None)
        
        is_open_access = paper.get("isOpenAccess", False)
        
        # Get venue/journal
        venue = paper.get("venue", "Unknown publication")
        
        # Get citation data
        citation_count = paper.get("citationCount", 0)
        influential_citation_count = paper.get("influentialCitationCount", 0)
        
        # Create a placeholder thumbnail
        try:
            paper_id = paper_url.split("/")[-1] if paper_url else "unknown"
        except Exception as e:
            print(f"Error extracting paper ID: {e}")
            paper_id = "unknown"
            
        thumbnail_url = f"/static/images/scholar-placeholder.svg"
        
        paper_info.append({
            'title': title,
            'author': author,
            'all_authors': all_authors,
            'year': year,
            'abstract': abstract[:300] + '...' if abstract and len(abstract) > 300 else abstract,
            'description': abstract,  # For compatibility with existing code
            'recommendation': abstract,  # For compatibility with existing code
            'cover_url': thumbnail_url,
            'view_url': paper_url,
            'download_url': pdf_url,
            'has_ebook': pdf_url is not None,
            'reading_url': paper_url,
            'venue': venue,
            'citation_count': citation_count,
            'influential_citation_count': influential_citation_count,
            'is_open_access': is_open_access,
            'type': 'semantic_scholar'  # Mark the source for UI differentiation
        })
    
    return paper_info

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/tracker')
def tracker():
    return render_template('tracker.html')

@app.route('/recommend', methods=['POST'])
def recommend():
    data = request.json
    user_input = data.get('user_input', '')
    max_results = data.get('max_results', 5)  # Default to 5 if not specified
    
    try:
        # First, determine if this is a book recommendation request, research paper request, or a general question
        intent_check = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": """You are an AI that determines if a user's message requires book recommendations, research papers, or just a text response.
                Respond with exactly ONE of these formats:
                - 'BOOKS' if the user is asking for fiction or general book recommendations
                - 'RESEARCH_RECENT' if the user is asking for recent/current academic papers, latest research, or new scholarly content
                - 'RESEARCH_ARCHIVE' if the user is asking for historical research, older papers, or classic academic works
                - 'TEXT' if the user is asking a general question or making a comment
                - 'BOOKS_WITH_COUNT X' if the user is specifically asking for X number of book recommendations
                - 'RESEARCH_RECENT_WITH_COUNT X' if the user is specifically asking for X number of recent research papers
                - 'RESEARCH_ARCHIVE_WITH_COUNT X' if the user is specifically asking for X number of older/archived research papers
                
                If you're unsure whether research is recent or archived, default to 'RESEARCH_RECENT'.
                Only respond with exactly one of these formats, nothing else."""},
                {"role": "user", "content": user_input}
            ],
            max_tokens=15,
            temperature=0.1
        ).choices[0].message['content'].strip()

        print(f"Intent detected: {intent_check}")

        # Parse the intent response
        if intent_check.startswith('BOOKS_WITH_COUNT'):
            response_type = 'BOOKS'
            try:
                max_results = int(intent_check.split()[1])
            except:
                max_results = 5
        elif intent_check.startswith('RESEARCH_RECENT_WITH_COUNT'):
            response_type = 'RESEARCH_RECENT'
            try:
                max_results = int(intent_check.split()[1])
            except:
                max_results = 5
        elif intent_check.startswith('RESEARCH_ARCHIVE_WITH_COUNT'):
            response_type = 'RESEARCH_ARCHIVE'
            try:
                max_results = int(intent_check.split()[1])
            except:
                max_results = 5
        else:
            response_type = intent_check

        # Generate appropriate response based on intent
        if response_type == 'BOOKS':
            # Get book recommendations
            book_results = search_open_library(user_input, max_results=max_results)
            _, books_info = get_book_descriptions(user_input, book_results)

            # Get AI response about the book recommendations
            ai_response = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a friendly and knowledgeable book recommendation assistant. Respond naturally to the user's request prompt. Keep responses concise (1-2 sentences) and conversational."},
                    {"role": "user", "content": f"User request: {user_input}\n Books: {book_results}\n Book Info: {books_info}\n You are a friendly and knowledgeable book recommendation assistant. Respond naturally to the user's request prompt. Keep responses to 1-2 sentences and conversational. Don't list the books out unless the user has a question about it."}
                ],
                max_tokens=150,
                temperature=0.7
            ).choices[0].message['content']
            
            return jsonify({
                'ai_response': ai_response,
                'books': books_info,
                'response_type': 'BOOKS'
            })
        elif response_type == 'RESEARCH_RECENT':
            try:
                # Get recent research papers from Semantic Scholar
                papers = search_semantic_scholar(user_input, max_results=max_results)
                
                # Check if papers is valid
                if papers is None:
                    papers = []
                    print("Warning: search_semantic_scholar returned None")
                
                # Process paper details
                research_info = get_semantic_scholar_details(papers)
                
                # If no results, provide a fallback message
                if not research_info or len(research_info) == 0:
                    ai_response = openai.ChatCompletion.create(
                        model="gpt-4o-mini",
                        messages=[
                            {"role": "system", "content": "You are a friendly and knowledgeable research assistant. The user asked for recent academic papers but none were found. Apologize and suggest they try a different search term."},
                            {"role": "user", "content": f"User request: {user_input}\n No research papers were found for this query. Please suggest alternative search terms."}
                        ],
                        max_tokens=150,
                        temperature=0.7
                    ).choices[0].message['content']
                    
                    return jsonify({
                        'ai_response': ai_response,
                        'books': [],
                        'response_type': 'TEXT'
                    })
                
                # Get AI response about the research recommendations
                ai_response = openai.ChatCompletion.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "You are a friendly and knowledgeable research assistant. Respond naturally about recent academic research. Keep responses concise (1-2 sentences) and conversational."},
                        {"role": "user", "content": f"User request: {user_input}\n Research Info: {research_info}\n You are a friendly and knowledgeable research assistant. Respond naturally about the recent academic papers you found. Keep responses to 1-2 sentences and conversational. Don't list the papers unless the user specifically asked about them."}
                    ],
                    max_tokens=150,
                    temperature=0.7
                ).choices[0].message['content']
                
                return jsonify({
                    'ai_response': ai_response,
                    'books': research_info,
                    'response_type': 'RESEARCH_RECENT'
                })
            except Exception as e:
                print(f"Error in RESEARCH_RECENT processing: {e}")
                # Fallback to archive research if Semantic Scholar fails
                fallback_msg = f"Note: Recent research search failed, falling back to archive research. Error: {str(e)}"
                print(fallback_msg)
                
                # Get research paper recommendations from Internet Archive as fallback
                research_results = search_internet_archive(user_input, max_results=max_results)
                research_info = get_research_details(research_results)
                
                ai_response = openai.ChatCompletion.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "You are a friendly research assistant. The user asked for recent papers but we had to use archive sources instead. Acknowledge this while being helpful."},
                        {"role": "user", "content": f"User request: {user_input}\n We couldn't find recent papers, but found some archive documents instead. Mention this politely and briefly describe what you found."}
                    ],
                    max_tokens=150,
                    temperature=0.7
                ).choices[0].message['content']
                
                return jsonify({
                    'ai_response': ai_response,
                    'books': research_info,
                    'response_type': 'RESEARCH_ARCHIVE'
                })
        elif response_type == 'RESEARCH_ARCHIVE':
            # Get research paper recommendations from Internet Archive
            research_results = search_internet_archive(user_input, max_results=max_results)
            research_info = get_research_details(research_results)
            
            # Get AI response about the research recommendations
            ai_response = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a friendly and knowledgeable research assistant specializing in historical documents and older research. Respond naturally to the user's request. Keep responses concise (1-2 sentences) and conversational."},
                    {"role": "user", "content": f"User request: {user_input}\n Research Info: {research_info}\n You are a friendly and knowledgeable research assistant. Respond naturally about the archived academic papers and historical documents you found. Keep responses to 1-2 sentences and conversational. Don't list the papers unless the user specifically asked about them."}
                ],
                max_tokens=150,
                temperature=0.7
            ).choices[0].message['content']
            
            return jsonify({
                'ai_response': ai_response,
                'books': research_info,  # Use the same 'books' field for frontend consistency
                'response_type': 'RESEARCH_ARCHIVE'
            })
        else:
            # Generate text-only response for general questions
            ai_response = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": """You are a friendly and knowledgeable book and research assistant. You can help with:
                    - Questions about books, authors, and reading in general
                    - Information about academic research and scholarly content
                    - Literary concepts and terminology
                    - Reading recommendations (but don't give specific titles unless asked)
                    - Book-related advice
                    Keep responses helpful and concise."""},
                    {"role": "user", "content": user_input}
                ],
                max_tokens=250,
                temperature=0.7
            ).choices[0].message['content']
            
            return jsonify({
                'ai_response': ai_response,
                'books': [],
                'response_type': 'TEXT'
            })
            
    except Exception as e:
        print(f"Error in recommend route: {e}")
        return jsonify({
            'ai_response': "I apologize, but I encountered an error while processing your request. Please try again.",
            'books': [],
            'response_type': 'ERROR'
        }), 500

@app.route('/search_books', methods=['GET'])
def search_books_tracker():
    """Search books by title using Open Library API and return results for the tracker"""
    query = request.args.get('query', '')
    if not query:
        return jsonify({'error': 'No query provided'}), 400
    
    # Use the basic search function without GPT processing
    search_terms = extract_search_terms_basic(query)
    
    base_url = "http://openlibrary.org/search.json"
    response = requests.get(f"{base_url}?q={search_terms}&limit=10")
    
    if response.status_code != 200:
        return jsonify({'error': 'Failed to retrieve data from Open Library'}), 500
    
    result = response.json()
    books = []
    
    for doc in result.get('docs', [])[:10]:  # Limit to 10 results
        # Check for ebook availability
        has_ebook = doc.get('has_fulltext', False)
        ia_id = doc.get('ia', [None])[0] if isinstance(doc.get('ia'), list) and doc.get('ia') else None
        olid = doc.get('key', '').replace('/works/', '') if doc.get('key') else None
        
        # Construct reading URL if available
        reading_url = None
        if has_ebook and ia_id:
            reading_url = f"https://archive.org/details/{ia_id}"
        elif olid:
            reading_url = f"https://openlibrary.org/works/{olid}"
        
        # Get ISBN for buy link
        isbn = None
        if doc.get('isbn'):
            if isinstance(doc.get('isbn'), list) and doc.get('isbn'):
                isbn = doc.get('isbn')[0]
            else:
                isbn = doc.get('isbn')
        
        # Create title and author for the book
        title = doc.get('title', 'Unknown Title')
        author = doc.get('author_name', ['Unknown Author'])[0] if doc.get('author_name') else 'Unknown Author'
        
        # Create Amazon buy link
        buy_link = None
        if isbn:
            buy_link = f"https://www.amazon.com/s?k={isbn}"
        else:
            # Format title and author for search
            search_query = f"{title} {author}".replace(" ", "+")
            buy_link = f"https://www.amazon.com/s?k={search_query}"
        
        book = {
            'title': title,
            'author': author,
            'cover_id': doc.get('cover_i'),
            'cover_url': get_book_cover_url(doc.get('cover_i')) if doc.get('cover_i') else None,
            'publish_year': doc.get('first_publish_year'),
            'isbn': isbn,
            'olid': olid,
            'has_ebook': has_ebook,
            'reading_url': reading_url,
            'buy_link': buy_link
        }
        books.append(book)
    
    return jsonify({'books': books})

@app.route('/book_details/<olid>', methods=['GET'])
def book_details(olid):
    """Get detailed information about a book from Open Library by its ID"""
    if not olid:
        return jsonify({'error': 'No book ID provided'}), 400
    
    # Request work details
    work_url = f"https://openlibrary.org/works/{olid}.json"
    work_response = requests.get(work_url)
    
    if work_response.status_code != 200:
        return jsonify({'error': 'Failed to retrieve work data from Open Library'}), 500
    
    work_data = work_response.json()
    
    # Extract description
    description = ""
    if 'description' in work_data:
        if isinstance(work_data['description'], dict):
            description = work_data['description'].get('value', '')
        else:
            description = work_data['description']
    
    # Check for ebook availability
    has_ebook = False
    reading_url = f"https://openlibrary.org/works/{olid}"
    
    # Check in work data for ebooks
    if 'ebooks' in work_data and len(work_data['ebooks']) > 0:
        has_ebook = True
    
    # Try to find Internet Archive ID for direct reading
    ia_id = None
    if 'identifiers' in work_data and 'ia' in work_data['identifiers']:
        ia_ids = work_data['identifiers']['ia']
        if ia_ids and len(ia_ids) > 0:
            ia_id = ia_ids[0]
            reading_url = f"https://archive.org/details/{ia_id}"
            has_ebook = True
    
    # Get the title and author
    title = work_data.get('title', 'Unknown Title')
    author = "Unknown Author"
    
    # Try to get author information
    if 'authors' in work_data and work_data['authors']:
        try:
            author_key = work_data['authors'][0]['author']['key']
            author_url = f"https://openlibrary.org{author_key}.json"
            author_response = requests.get(author_url)
            if author_response.status_code == 200:
                author_data = author_response.json()
                author = author_data.get('name', 'Unknown Author')
        except Exception:
            pass
    
    # Try to find ISBN by checking editions
    isbn = None
    
    # First check if we can find ISBN in identifiers
    if 'identifiers' in work_data:
        # Look for ISBN-13 first
        if 'isbn_13' in work_data['identifiers']:
            isbn = work_data['identifiers']['isbn_13'][0]
        # Then ISBN-10
        elif 'isbn_10' in work_data['identifiers']:
            isbn = work_data['identifiers']['isbn_10'][0]
    
    # Next try Internet Archive IDs
    if not isbn and 'ia' in work_data.get('identifiers', {}):
        ia_ids = work_data['identifiers']['ia']
        for ia_id in ia_ids:
            if ia_id.startswith('isbn_'):
                isbn = ia_id.replace('isbn_', '')
                break
    
    # Finally check editions
    if not isbn and 'editions_url' in work_data:
        try:
            editions_url = f"https://openlibrary.org{work_data['editions_url']}.json?limit=1"
            editions_response = requests.get(editions_url)
            if editions_response.status_code == 200:
                editions_data = editions_response.json()
                for entry in editions_data.get('entries', []):
                    if entry.get('isbn_13'):
                        isbn = entry['isbn_13'][0]
                        break
                    elif entry.get('isbn_10'):
                        isbn = entry['isbn_10'][0]
                        break
        except Exception as e:
            print(f"Error checking editions for ISBN: {e}")
    
    # Create Amazon buy link
    buy_link = None
    if isbn:
        buy_link = f"https://www.amazon.com/s?k={isbn}"
    else:
        # Format title and author for search
        search_query = f"{title} {author}".replace(" ", "+")
        buy_link = f"https://www.amazon.com/s?k={search_query}"
    
    # Get the book details
    book_details = {
        'title': title,
        'author': author,
        'description': description,
        'cover_id': work_data.get('covers', [None])[0],
        'cover_url': get_book_cover_url(work_data.get('covers', [None])[0]) if work_data.get('covers') else None,
        'subjects': work_data.get('subjects', []),
        'has_ebook': has_ebook,
        'reading_url': reading_url,
        'isbn': isbn,
        'buy_link': buy_link
    }
    
    # If description is empty, add a default one
    if not book_details['description'] or len(book_details['description'].strip()) == 0:
        book_details['description'] = f"'{book_details['title']}' is a book by {author}. " + \
                               "Unfortunately, a detailed description is not available for this title."
    
    # Add a note about online readability to the description
    if book_details['has_ebook']:
        book_details['description'] += f"\n\n📚 **This book is available to read online through Open Library or Internet Archive.**"
    
    return jsonify(book_details)

@app.route('/quick_search')
def quick_search():
    return render_template('quick_search.html', active_page='quick_search')

@app.route('/quick_search/results')
def quick_search_results():
    source = request.args.get('source')
    query = request.args.get('query', '')
    max_results = int(request.args.get('max_results', '10'))

    if not source or not query:
        return jsonify([])

    try:
        if source == 'books':
            # Build Open Library search query
            book_results = search_open_library(query, max_results=max_results)
            _, books_info = get_book_descriptions(query, book_results)
            return jsonify(books_info)

        elif source == 'recent_research':
            # Search Semantic Scholar
            papers = search_semantic_scholar(query, max_results=max_results)
            research_info = get_semantic_scholar_details(papers)
            return jsonify(research_info)

        elif source == 'archive':
            # Search Internet Archive
            research_results = search_internet_archive(query, max_results=max_results)
            research_info = get_research_details(research_results)
            return jsonify(research_info)

        return jsonify([])

    except Exception as e:
        print(f"Error in quick search: {str(e)}")
        return jsonify([])

if __name__ == '__main__':
    app.run(debug=True)

