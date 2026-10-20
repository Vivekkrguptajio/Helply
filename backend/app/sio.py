import socketio

# Adding both transports to avoid "closed before establishment" errors.
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    transports=["websocket", "polling"],
)
