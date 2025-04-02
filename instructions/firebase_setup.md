# Firebase Firestore Security Rules Setup

You're encountering a "Missing or insufficient permissions" error because your Firestore security rules are restricting access to your data. This is actually a good security feature, but we need to configure it correctly to allow your application to work properly.

## Fixing the Issue

Follow these steps to fix the permissions error:

1. **Log in to Firebase Console**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project (bookify-ee9d0)

2. **Navigate to Firestore Database**
   - In the left sidebar, click on "Firestore Database"

3. **Update Security Rules**
   - Click on the "Rules" tab
   - Replace the current rules with the following:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read/write their own documents only
    match /Documents/{document=**} {
      allow read, write: if request.auth != null && request.auth.token.email == resource.data.user_id;
      
      // Allow creating new documents if the user is authenticated and sets their email as user_id
      allow create: if request.auth != null && request.auth.token.email == request.resource.data.user_id;
    }
  }
}
```

4. **Publish the Rules**
   - Click on the "Publish" button to apply these rules

## What These Rules Do

These security rules ensure that:
1. Users can only read and update documents where the `user_id` field matches their email address
2. Users can create new documents as long as they set the `user_id` field to their own email address
3. No one can access documents that don't belong to them

## Testing the Fix

After updating the rules:
1. Refresh your Bookify application
2. Try adding a new book to your collection
3. Visit the Book Tracker page to verify that your books appear

The error should now be resolved, and you should be able to add, view, edit, and delete your books without any permission issues.

## Contact for Further Help

If you continue to experience issues after updating the rules, please contact the developer for assistance. 