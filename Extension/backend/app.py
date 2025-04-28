from quart import Quart
from quart_cors import cors
from Views.gmail_view import gmail_blueprint
from Views.free_text_view import free_text_blueprint
from Views.contacts_view import contacts_blueprint

app = Quart(__name__)
app = cors(app, allow_origin="*")

app.register_blueprint(gmail_blueprint, url_prefix="")
app.register_blueprint(free_text_blueprint, url_prefix="")
app.register_blueprint(contacts_blueprint, url_prefix="")

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
