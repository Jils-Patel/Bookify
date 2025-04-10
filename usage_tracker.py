from firebase_admin import firestore
from datetime import datetime, timedelta
import pytz

# Usage limits for free plan
FREE_PLAN_LIMITS = {
    'ai_queries': 3,  # per day
    'quick_searches': 3,  # per day
    'max_quick_search_results': 5,
    'max_tracked_books': 5
}

def get_user_plan(email):
    """Get user's subscription plan from Settings collection"""
    db = firestore.client()
    settings_ref = db.collection('Settings').where('email', '==', email).limit(1)
    settings_docs = settings_ref.get()
    
    if len(settings_docs) > 0:
        return settings_docs[0].to_dict().get('subscription_plan', 'free')
    return 'free'

def get_user_usage(email):
    """Get user's current usage stats"""
    db = firestore.client()
    usage_ref = db.collection('Usage').where('email', '==', email).limit(1)
    usage_docs = usage_ref.get()
    
    if len(usage_docs) > 0:
        return usage_docs[0].to_dict()
    return None

def update_user_usage(email, action_type):
    """Update user's usage stats for a specific action"""
    db = firestore.client()
    usage_ref = db.collection('Usage').where('email', '==', email).limit(1)
    usage_docs = usage_ref.get()
    
    # Get current date in UTC
    current_date = datetime.now(pytz.UTC).date()
    
    if len(usage_docs) > 0:
        # Update existing usage document
        usage_doc = usage_docs[0]
        usage_data = usage_doc.to_dict()
        
        # Check if we need to reset daily counters
        last_update = usage_data.get('last_update')
        if last_update:
            last_update_date = last_update.date()
            if last_update_date < current_date:
                # Reset daily counters
                usage_data['ai_queries_today'] = 0
                usage_data['quick_searches_today'] = 0
        
        # Update the specific counter
        if action_type == 'ai_query':
            usage_data['ai_queries_today'] = usage_data.get('ai_queries_today', 0) + 1
        elif action_type == 'quick_search':
            usage_data['quick_searches_today'] = usage_data.get('quick_searches_today', 0) + 1
        
        usage_data['last_update'] = firestore.SERVER_TIMESTAMP
        
        usage_doc.reference.update(usage_data)
        return usage_data
    else:
        # Create new usage document
        usage_data = {
            'email': email,
            'ai_queries_today': 1 if action_type == 'ai_query' else 0,
            'quick_searches_today': 1 if action_type == 'quick_search' else 0,
            'last_update': firestore.SERVER_TIMESTAMP
        }
        
        db.collection('Usage').add(usage_data)
        return usage_data

def check_usage_limit(email, action_type):
    """Check if user has reached their usage limit for a specific action"""
    plan = get_user_plan(email)
    
    # Pro users have unlimited access
    if plan == 'pro':
        return True
    
    # Get current usage
    usage = get_user_usage(email)
    if not usage:
        return True  # No usage record yet, allow first action
    
    # Check daily limits
    if action_type == 'ai_query':
        return usage.get('ai_queries_today', 0) < FREE_PLAN_LIMITS['ai_queries']
    elif action_type == 'quick_search':
        return usage.get('quick_searches_today', 0) < FREE_PLAN_LIMITS['quick_searches']
    
    return True

def check_book_tracking_limit(email):
    """Check if user has reached their book tracking limit"""
    plan = get_user_plan(email)
    
    # Pro users have unlimited access
    if plan == 'pro':
        return True
    
    # Count current tracked books
    db = firestore.client()
    books_ref = db.collection('Documents').where('user_id', '==', email)
    books_count = len(books_ref.get())
    
    return books_count < FREE_PLAN_LIMITS['max_tracked_books']

def get_quick_search_limit(email):
    """Get the maximum number of results for quick search based on user's plan"""
    plan = get_user_plan(email)
    return FREE_PLAN_LIMITS['max_quick_search_results'] if plan == 'free' else 50 