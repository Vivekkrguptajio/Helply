"""Entrypoint: `uvicorn main:sio_app` (see render.yaml)."""
from app.config import PORT
from app.server import app, sio_app  # noqa: F401

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:sio_app", host="0.0.0.0", port=PORT)
