from quart import Blueprint, request, jsonify
from DAL.gmail_dal import get_suggested_contacts

contacts_blueprint = Blueprint('contacts', __name__)

@contacts_blueprint.route('/contacts', methods=['POST'])
async def get_contacts():
    try:
        data = await request.get_json()
        user_email = data.get('user_email')
        query = data.get('query', '').lower()
        
        if not user_email:
            return jsonify({'error': 'user_email parameter is required'}), 400
        
        # Get contacts from database
        contacts = get_suggested_contacts(user_email)
        
        print(contacts)
        
        # Ensure contacts is a list of tuples (email, name)
        if not isinstance(contacts, list):
            raise ValueError("Unexpected contacts format from database")
            
        # Filter contacts based on query
        filtered_contacts = []
        for email in contacts:
            try:
                email_lower = email.lower()
                
                if not query or query in email_lower:
                    filtered_contacts.append({
                        'email': email,
                    })
            except AttributeError as e:
                # Skip malformed contact entries
                print(f"Skipping invalid contact entry: {email} Error: {str(e)}")
                continue
        
        return jsonify({
            'status': 'success',
            'contacts': filtered_contacts,
            'count': len(filtered_contacts)
        })
        
    except Exception as e:
        print(f"Error in /contacts endpoint: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': 'Failed to fetch contacts',
            'details': str(e)
        }), 500