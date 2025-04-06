from flask import Flask, request, jsonify, render_template, redirect, session, url_for
import openai
import requests
import re
from urllib.parse import quote
from functools import wraps
import os
import firebase_admin
from firebase_admin import credentials, auth
from firebase_admin import firestore
import firebase_admin.firestore as firestore_utils
from dotenv import load_dotenv

# Load environment variables from .env file in development
if os.path.exists('.env'):
    load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', '')  # Get from environment variable
openai.api_key = os.environ.get('OPENAI_API_KEY', '')  # Get from environment variable

# Initialize Firebase Admin SDK
if not firebase_admin._apps:
    if os.path.exists('firebase-adminsdk.json'):
        cred = credentials.Certificate('firebase-adminsdk.json') #local
    else:
        firebase_config = { #deployed
            "type": "service_account",
            "project_id": os.environ.get("FIREBASE_PROJECT_ID", ""),
            "private_key_id": os.environ.get("FIREBASE_PRIVATE_KEY_ID", ""),
            "private_key": os.environ.get("FIREBASE_PRIVATE_KEY", "").replace('\\n', '\n'),
            "client_email": os.environ.get("FIREBASE_CLIENT_EMAIL", ""),
            "client_id": os.environ.get("FIREBASE_CLIENT_ID", ""),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": os.environ.get("FIREBASE_CLIENT_CERT_URL", "")
        }
        cred = credentials.Certificate(firebase_config)
    
    firebase_admin.initialize_app(cred)

db = firestore.client()


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def extract_search_terms_with_gpt(user_input):
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

        processed_input = user_input.lower()
    
        # Remove extra whitespace and get final search terms
        search_terms = " ".join(processed_input.split())
        return search_terms

def search_open_library(query, max_results=5):

    search_terms = extract_search_terms_with_gpt(query)
    
    if not search_terms:
        search_terms = query
    
    base_url = "http://openlibrary.org/search.json"
    response = requests.get(f"{base_url}?q={search_terms}&limit={max_results}")
    result = response.json()
    
    if result.get('numFound', 0) == 0 and search_terms != query or search_terms == "None":
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
    if cover_id:
        return f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg"  # Changed to large size

def get_book_descriptions(user_input, book_results):
    books_info = []
    
    docs = book_results.get('docs', [])[:50]
    if not docs:
        return "No books found matching your interests.", []
    
    for doc in docs:
        olid = doc.get('key', '').replace('/works/', '') if doc.get('key') else None
        has_ebook = doc.get('has_fulltext', False)
        ia_id = doc.get('ia', [None])[0] if isinstance(doc.get('ia'), list) and doc.get('ia') else None
        
        reading_url = None
        if has_ebook and ia_id:
            reading_url = f"https://archive.org/details/{ia_id}"
        elif olid:
            reading_url = f"https://openlibrary.org/works/{olid}"
        
        isbn = None
        buy_link = None
        if doc.get('isbn'):
            if isinstance(doc.get('isbn'), list) and doc.get('isbn'):
                isbn = doc.get('isbn')[0]
            else:
                isbn = doc.get('isbn')
                
        title = doc.get('title', 'Unknown Title')
        author = doc.get('author_name', ['Unknown Author'])[0] if doc.get('author_name') else 'Unknown Author'
        
        if isbn:
            buy_link = f"https://www.amazon.com/s?k={isbn}"
        else:
            search_query = f"{title} {author}".replace(" ", "+")
            buy_link = f"https://www.amazon.com/s?k={search_query}"
        
        book = {
            'title': title,
            'author': author,
            'year': doc.get('first_publish_year', 'Unknown'),
            'description': '',
            'cover_url': get_book_cover_url(doc.get('cover_i')) if doc.get('cover_i') else None,
            'olid': olid,
            'has_ebook': has_ebook,
            'reading_url': reading_url,
            'isbn': isbn,
            'buy_link': buy_link
        }
        
        if olid:
            try:
                work_url = f"https://openlibrary.org/works/{olid}.json"
                work_response = requests.get(work_url)
                
                if work_response.status_code == 200:
                    work_data = work_response.json()
                    
                    if 'description' in work_data:
                        if isinstance(work_data['description'], dict):
                            book['description'] = work_data['description'].get('value', '')
                        else:
                            book['description'] = work_data['description']
                    
                    if not book['has_ebook']:
                        book['has_ebook'] = 'ebooks' in work_data and len(work_data['ebooks']) > 0
            except Exception as e:
                print(f"Error fetching details for {book['title']}: {e}")
        
        if not book['description'] or len(book['description'].strip()) == 0:
            book['description'] = f"'{book['title']}' is a book by {book['author']}, published in {book['year']}. "
        
        if book['has_ebook']:
            book['description'] += f"\n\n📚 **This book is available to read online through Open Library or Internet Archive.**"
        
        books_info.append(book)
    
    # For compatibility with the frontend, rename description to recommendation
    for book in books_info:
        book['recommendation'] = book['description']
    
    return "Books found based on your interests.", books_info

def search_internet_archive(query, max_results=5):
    search_terms = extract_search_terms_with_gpt(query)
    
    if not search_terms:
        search_terms = query
    
    base_url = "https://archive.org/advancedsearch.php"
    params = {
        "q": f"{search_terms} AND mediatype:texts",
        "fl[]": "identifier,title,creator,description,date,subject",
        "rows": max_results,
        "output": "json"
    }
    
    response = requests.get(base_url, params=params)
    if response.status_code == 200:
        data = response.json()
        results = data['response']['docs']
        
        if len(results) == 0 and search_terms != query:
            params["q"] = f"{query} AND mediatype:texts"
            response = requests.get(base_url, params=params)
            if response.status_code == 200:
                data = response.json()
                results = data['response']['docs']
        
        return results
    else:
        return []

def get_research_details(results):
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
        
        subjects = item.get('subject', [])
        if isinstance(subjects, str):
            subjects = [subjects]
        elif not isinstance(subjects, list):
            subjects = []
        subjects = subjects[:5]
        
        year = item.get('date', 'Unknown')
        if isinstance(year, list) and len(year) > 0:
            year = year[0]
        if isinstance(year, str):
            year_match = re.search(r'\b\d{4}\b', year)
            if year_match:
                year = year_match.group(0)
        
        normal_url = f"https://archive.org/details/{identifier}"
        thumbnail_url = f"https://archive.org/services/img/{identifier}"
        
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
            'buy_link': None
        })
    
    for paper in research_info:
        paper['recommendation'] = paper['description']
    
    return research_info

def search_semantic_scholar(query, max_results=5):
    try:
        search_terms = extract_search_terms_with_gpt(query)
        
        if not search_terms:
            search_terms = query
        
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
                
                if len(papers) == 0 and search_terms != query:
                    params["query"] = query
                    
                    try:
                        response = requests.get(API_URL, params=params, timeout=10)
                        if response.status_code == 200:
                            data = response.json()
                            papers = data.get("data", [])
                    except Exception as nested_e:
                        return []
                        
                return papers
            else:
                return []
                
        except requests.exceptions.RequestException as req_e:
            return []
            
    except Exception as e:
        return []

def get_semantic_scholar_details(papers):
    paper_info = []
    
    if not papers:
        return paper_info
    
    for paper in papers:
        if not isinstance(paper, dict):
            continue
            
        title = paper.get("title", "No title available")
        
        authors = paper.get("authors", [])
        if authors and isinstance(authors, list) and len(authors) > 0 and isinstance(authors[0], dict):
            author = authors[0].get("name", "Unknown author")
        else:
            author = "Unknown author"
        
        try:
            all_authors = ", ".join([a.get("name", "") for a in authors if isinstance(a, dict)]) if authors else "Unknown authors"
        except Exception as e:
            print(f"Error processing authors: {e}")
            all_authors = "Unknown authors"
        
        year = paper.get("year", "Unknown")
        abstract = paper.get("abstract", "No abstract available")
        paper_url = paper.get("url", None)
        pdf_url = None
        openAccessPdf = paper.get("openAccessPdf", None)
        if openAccessPdf and isinstance(openAccessPdf, dict):
            pdf_url = openAccessPdf.get("url", None)
        
        is_open_access = paper.get("isOpenAccess", False)
        venue = paper.get("venue", "Unknown publication")
        citation_count = paper.get("citationCount", 0)
        influential_citation_count = paper.get("influentialCitationCount", 0)
        
        try:
            paper_id = paper_url.split("/")[-1] if paper_url else "unknown"
        except Exception as e:
            paper_id = "unknown"
            
        thumbnail_url = f"/static/images/scholar-placeholder.svg"
        
        paper_info.append({
            'title': title,
            'author': author,
            'all_authors': all_authors,
            'year': year,
            'abstract': abstract[:300] + '...' if abstract and len(abstract) > 300 else abstract,
            'description': abstract,
            'recommendation': abstract,
            'cover_url': thumbnail_url,
            'view_url': paper_url,
            'download_url': pdf_url,
            'has_ebook': pdf_url is not None,
            'reading_url': paper_url,
            'venue': venue,
            'citation_count': citation_count,
            'influential_citation_count': influential_citation_count,
            'is_open_access': is_open_access,
            'type': 'semantic_scholar'
        })
    
    return paper_info

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/process_firebase_token', methods=['POST'])
def process_firebase_token():
    try:
        id_token = request.json.get('id_token')
        
        if not id_token:
            return jsonify({'error': 'No ID token provided'}), 400
        
        decoded_token = auth.verify_id_token(id_token)
        user_id = decoded_token['uid']
        firebase_user = auth.get_user(user_id)
        
        session['user'] = {
            'id': user_id,
            'email': firebase_user.email,
            'name': firebase_user.display_name or firebase_user.email.split('@')[0],
            'avatar_url': firebase_user.photo_url,
        }
        try:
            user_email = firebase_user.email
            
            # Check if user already has settings in Firestore
            settings_ref = db.collection('Settings').where('email', '==', user_email).limit(1)
            settings_docs = settings_ref.get()
            
            if len(settings_docs) == 0:
                default_settings = {
                    'email': user_email,
                    'subscription_plan': 'free',
                    'reading_preferences': '',
                    'created_at': firestore.SERVER_TIMESTAMP
                }
                
                # Add to Firestore
                db.collection('Settings').document().set(default_settings)
            else:
                print(f"User {user_email} already has settings in Firestore")
        except Exception as e:
            print(f"Error initializing settings for user: {str(e)}")
        
        return jsonify({'success': True, 'redirect': url_for('home')})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))

@app.route('/')
def home():
    if 'user' in session:
        return render_template('index.html', user=session['user'])
    else:
        return render_template('index.html')

@app.route('/homepage')
@login_required
def homepage():
    return render_template('homepage.html', user=session['user'])

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html', user=session['user'])

@app.route('/tracker')
@login_required
def tracker():
    return render_template('tracker.html')

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/privacy')
def privacy():
    return render_template('privacy.html')

@app.route('/settings')
@login_required
def settings():
    return render_template('settings.html')

@app.route('/recommend', methods=['POST'])
@login_required
def recommend():
    data = request.json
    user_input = data.get('user_input', '')
    max_results = data.get('max_results', 5)  # Default to 5 if not specified
    conversation_context = data.get('conversation_context', [])  # Get conversation history if provided
    
    try:
        # Process conversation context
        messages = [
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
            Only respond with exactly one of these formats, nothing else."""}
        ]
        
        # Add conversation history if available (up to last 5 messages)
        if conversation_context:
            # Limit to last 5 messages for context window efficiency
            recent_context = conversation_context[-5:] if len(conversation_context) > 5 else conversation_context
            messages.extend(recent_context)
        
        # Add the current user message
        messages.append({"role": "user", "content": user_input})

        intent_check = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=15,
            temperature=0.1
        ).choices[0].message['content'].strip()

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

        if response_type == 'BOOKS':
            # Get book recommendations
            book_results = search_open_library(user_input, max_results=max_results)
            _, books_info = get_book_descriptions(user_input, book_results)

            # Prepare messages for AI response
            ai_messages = [
                {"role": "system", "content": "You are a friendly and knowledgeable book recommendation assistant. Respond naturally to the user's request prompt. Keep responses concise (1-2 sentences) and conversational."}
            ]
            
            # Add conversation history if available
            if conversation_context:
                ai_messages.extend(conversation_context[-5:])
            
            # Add current context and books
            ai_messages.append({"role": "user", "content": f"User request: {user_input}\n Books: {book_results}\n Book Info: {books_info}\n You are a friendly and knowledgeable book recommendation assistant. Respond naturally to the user's request prompt. Keep responses to 1-2 sentences and conversational. Don't list the books out unless the user has a question about it."})

            ai_response = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=ai_messages,
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
                papers = search_semantic_scholar(user_input, max_results=max_results)
                
                if papers is None:
                    papers = []
                    print("Warning: search_semantic_scholar returned None")
                
                research_info = get_semantic_scholar_details(papers)
                
                if not research_info or len(research_info) == 0:
                    # Prepare messages for AI response
                    ai_messages = [
                        {"role": "system", "content": "You are a friendly and knowledgeable research assistant. The user asked for recent academic papers but none were found. Apologize and suggest they try a different search term."}
                    ]
                    
                    # Add conversation history if available
                    if conversation_context:
                        ai_messages.extend(conversation_context[-5:])
                    
                    # Add current context
                    ai_messages.append({"role": "user", "content": f"User request: {user_input}\n No research papers were found for this query. Please suggest alternative search terms."})

                    ai_response = openai.ChatCompletion.create(
                        model="gpt-4o-mini",
                        messages=ai_messages,
                        max_tokens=150,
                        temperature=0.7
                    ).choices[0].message['content']
                    
                    return jsonify({
                        'ai_response': ai_response,
                        'books': [],
                        'response_type': 'TEXT'
                    })
                
                # Prepare messages for AI response
                ai_messages = [
                    {"role": "system", "content": "You are a friendly and knowledgeable research assistant. Respond naturally about recent academic research. Keep responses concise (1-2 sentences) and conversational."}
                ]
                
                # Add conversation history if available
                if conversation_context:
                    ai_messages.extend(conversation_context[-5:])
                
                # Add current context and research
                ai_messages.append({"role": "user", "content": f"User request: {user_input}\n Research Info: {research_info}\n You are a friendly and knowledgeable research assistant. Respond naturally about the recent academic papers you found. Keep responses to 1-2 sentences and conversational. Don't list the papers unless the user specifically asked about them."})

                ai_response = openai.ChatCompletion.create(
                    model="gpt-4o-mini",
                    messages=ai_messages,
                    max_tokens=150,
                    temperature=0.7
                ).choices[0].message['content']
                
                return jsonify({
                    'ai_response': ai_response,
                    'books': research_info,
                    'response_type': 'RESEARCH_RECENT'
                })
            except Exception as e:
                fallback_msg = f"Note: Recent research search failed, falling back to archive research. Error: {str(e)}"
                print(fallback_msg)
                
                research_results = search_internet_archive(user_input, max_results=max_results)
                research_info = get_research_details(research_results)
                
                # Prepare messages for AI response
                ai_messages = [
                    {"role": "system", "content": "You are a friendly research assistant. The user asked for recent papers but we had to use archive sources instead. Acknowledge this while being helpful."}
                ]
                
                # Add conversation history if available
                if conversation_context:
                    ai_messages.extend(conversation_context[-5:])
                
                # Add current context
                ai_messages.append({"role": "user", "content": f"User request: {user_input}\n We couldn't find recent papers, but found some archive documents instead. Mention this politely and briefly describe what you found."})

                ai_response = openai.ChatCompletion.create(
                    model="gpt-4o-mini",
                    messages=ai_messages,
                    max_tokens=150,
                    temperature=0.7
                ).choices[0].message['content']
                
                return jsonify({
                    'ai_response': ai_response,
                    'books': research_info,
                    'response_type': 'RESEARCH_ARCHIVE'
                })
            
        elif response_type == 'RESEARCH_ARCHIVE':
            research_results = search_internet_archive(user_input, max_results=max_results)
            research_info = get_research_details(research_results)
            
            # Prepare messages for AI response
            ai_messages = [
                {"role": "system", "content": "You are a friendly and knowledgeable research assistant specializing in historical documents and older research. Respond naturally to the user's request. Keep responses concise (1-2 sentences) and conversational."}
            ]
            
            # Add conversation history if available
            if conversation_context:
                ai_messages.extend(conversation_context[-5:])
            
            # Add current context and research
            ai_messages.append({"role": "user", "content": f"User request: {user_input}\n Research Info: {research_info}\n You are a friendly and knowledgeable research assistant. Respond naturally about the archived academic papers and historical documents you found. Keep responses to 1-2 sentences and conversational. Don't list the papers unless the user specifically asked about them."})

            ai_response = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=ai_messages,
                max_tokens=150,
                temperature=0.7
            ).choices[0].message['content']
            
            return jsonify({
                'ai_response': ai_response,
                'books': research_info,
                'response_type': 'RESEARCH_ARCHIVE'
            })
        else:
            # Prepare messages for AI general response
            ai_messages = [
                {"role": "system", "content": """You are a friendly and knowledgeable book and research assistant. You can help with:
                - Questions about books, authors, and reading in general
                - Information about academic research and scholarly content
                - Literary concepts and terminology
                - Reading recommendations (but don't give specific titles unless asked)
                - Book-related advice
                Keep responses helpful and concise."""}
            ]
            
            # Add conversation history if available
            if conversation_context:
                ai_messages.extend(conversation_context[-5:])
            
            # Add current user query
            ai_messages.append({"role": "user", "content": user_input})

            ai_response = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=ai_messages,
                max_tokens=250,
                temperature=0.7
            ).choices[0].message['content']
            
            return jsonify({
                'ai_response': ai_response,
                'books': [],
                'response_type': 'TEXT'
            })
            
    except Exception as e:
        return jsonify({
            'ai_response': "I apologize, but I encountered an error while processing your request. Please try again.",
            'books': [],
            'response_type': 'ERROR'
        }), 500

@app.route('/search_books', methods=['GET'])
def search_books_tracker():
    query = request.args.get('query', '')
    if not query:
        return jsonify({'error': 'No query provided'}), 400
    
    search_terms = extract_search_terms_basic(query)
    
    base_url = "http://openlibrary.org/search.json"
    response = requests.get(f"{base_url}?q={search_terms}&limit=10")
    
    if response.status_code != 200:
        return jsonify({'error': 'Failed to retrieve data from Open Library'}), 500
    
    result = response.json()
    books = []
    
    for doc in result.get('docs', [])[:10]:
        has_ebook = doc.get('has_fulltext', False)
        ia_id = doc.get('ia', [None])[0] if isinstance(doc.get('ia'), list) and doc.get('ia') else None
        olid = doc.get('key', '').replace('/works/', '') if doc.get('key') else None
        
        reading_url = None
        if has_ebook and ia_id:
            reading_url = f"https://archive.org/details/{ia_id}"
        elif olid:
            reading_url = f"https://openlibrary.org/works/{olid}"
        
        isbn = None
        if doc.get('isbn'):
            if isinstance(doc.get('isbn'), list) and doc.get('isbn'):
                isbn = doc.get('isbn')[0]
            else:
                isbn = doc.get('isbn')
        
        title = doc.get('title', 'Unknown Title')
        author = doc.get('author_name', ['Unknown Author'])[0] if doc.get('author_name') else 'Unknown Author'
        
        buy_link = None
        if isbn:
            buy_link = f"https://www.amazon.com/s?k={isbn}"
        else:
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
@login_required
def book_details(olid):
    if not olid:
        return jsonify({'error': 'No book ID provided'}), 400
    
    work_url = f"https://openlibrary.org/works/{olid}.json"
    work_response = requests.get(work_url)
    
    if work_response.status_code != 200:
        return jsonify({'error': 'Failed to retrieve work data from Open Library'}), 500
    
    work_data = work_response.json()
    
    description = ""
    if 'description' in work_data:
        if isinstance(work_data['description'], dict):
            description = work_data['description'].get('value', '')
        else:
            description = work_data['description']
    
    has_ebook = False
    reading_url = f"https://openlibrary.org/works/{olid}"
    
    if 'ebooks' in work_data and len(work_data['ebooks']) > 0:
        has_ebook = True
    
    ia_id = None
    if 'identifiers' in work_data and 'ia' in work_data['identifiers']:
        ia_ids = work_data['identifiers']['ia']
        if ia_ids and len(ia_ids) > 0:
            ia_id = ia_ids[0]
            reading_url = f"https://archive.org/details/{ia_id}"
            has_ebook = True
    
    title = work_data.get('title', 'Unknown Title')
    author = "Unknown Author"
    
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
    isbn = None
    
    if 'identifiers' in work_data:
        if 'isbn_13' in work_data['identifiers']:
            isbn = work_data['identifiers']['isbn_13'][0]
        elif 'isbn_10' in work_data['identifiers']:
            isbn = work_data['identifiers']['isbn_10'][0]
    
    if not isbn and 'ia' in work_data.get('identifiers', {}):
        ia_ids = work_data['identifiers']['ia']
        for ia_id in ia_ids:
            if ia_id.startswith('isbn_'):
                isbn = ia_id.replace('isbn_', '')
                break
    
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
    
    buy_link = None
    if isbn:
        buy_link = f"https://www.amazon.com/s?k={isbn}"
    else:
        search_query = f"{title} {author}".replace(" ", "+")
        buy_link = f"https://www.amazon.com/s?k={search_query}"
    
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
    
    if not book_details['description'] or len(book_details['description'].strip()) == 0:
        book_details['description'] = f"'{book_details['title']}' is a book by {author}. " + \
                               "Unfortunately, a detailed description is not available for this title."
    
    if book_details['has_ebook']:
        book_details['description'] += f"\n\n📚 **This book is available to read online through Open Library or Internet Archive.**"
    
    return jsonify(book_details)

@app.route('/quick_search')
@login_required
def quick_search():
    return render_template('quick_search.html', active_page='quick_search')

@app.route('/quick_search/results')
@login_required
def quick_search_results():
    source = request.args.get('source')
    query = request.args.get('query', '')
    max_results = int(request.args.get('max_results', '10'))

    if not source or not query:
        return jsonify([])

    try:
        if source == 'books':
            book_results = search_open_library(query, max_results=max_results)
            _, books_info = get_book_descriptions(query, book_results)
            return jsonify(books_info)

        elif source == 'recent_research':
            papers = search_semantic_scholar(query, max_results=max_results)
            research_info = get_semantic_scholar_details(papers)
            return jsonify(research_info)

        elif source == 'archive':
            research_results = search_internet_archive(query, max_results=max_results)
            research_info = get_research_details(research_results)
            return jsonify(research_info)

        return jsonify([])

    except Exception as e:
        print(f"Error in quick search: {str(e)}")
        return jsonify([])

@app.route('/get_settings', methods=['GET'])
def get_settings():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        id_token = request.cookies.get('userIdToken')
        if not id_token:
            return jsonify({'error': 'Unauthorized - No valid authentication provided'}), 401
    else:
        id_token = auth_header.split('Bearer ')[1]

    try:
        decoded_token = auth.verify_id_token(id_token)
        user_id = decoded_token['uid']
        email = decoded_token.get('email', '')
        
        settings_ref = db.collection('Settings').where('email', '==', email).limit(1)
        settings_docs = settings_ref.get()

        if len(settings_docs) > 0:
            settings = settings_docs[0].to_dict()
            settings['id'] = settings_docs[0].id
            return jsonify(settings)
        else:
            default_settings = {
                'email': email,
                'subscription_plan': 'free',
                'reading_preferences': '',
                'created_at': firestore.SERVER_TIMESTAMP
            }
            
            new_settings_ref = db.collection('Settings').document()
            new_settings_ref.set(default_settings)
            
            default_settings['id'] = new_settings_ref.id
            return jsonify(default_settings)

    except Exception as e:
        print(f"Error in get_settings: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/update_settings', methods=['POST'])
def update_settings():
    auth_header = request.headers.get('Authorization')
    
    if not auth_header or not auth_header.startswith('Bearer '):
        id_token = request.cookies.get('userIdToken')
        if not id_token:
            return jsonify({'error': 'Unauthorized - No valid authentication provided'}), 401
    else:
        id_token = auth_header.split('Bearer ')[1]

    try:
        decoded_token = auth.verify_id_token(id_token)
        user_id = decoded_token['uid']
        email = decoded_token.get('email', '')
        data = request.json
        
        data['email'] = email
        data['updated_at'] = firestore.SERVER_TIMESTAMP
        settings_ref = db.collection('Settings').where('email', '==', email).limit(1)
        settings_docs = settings_ref.get()
        
        if len(settings_docs) > 0:
            document_id = settings_docs[0].id
            db.collection('Settings').document(document_id).update(data)
            return jsonify({'success': True, 'message': 'Settings updated successfully', 'id': document_id})
        else:
            data['created_at'] = firestore.SERVER_TIMESTAMP
            new_settings_ref = db.collection('Settings').document()
            new_settings_ref.set(data)
            return jsonify({'success': True, 'message': 'Settings created successfully', 'id': new_settings_ref.id})

    except Exception as e:
        print(f"Error in update_settings: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)