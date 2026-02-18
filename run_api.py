import uvicorn
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8502"))
    is_dev = os.getenv("ENV", "production") == "development"

    uvicorn.run(
        "src.api:app",
        host="0.0.0.0",
        port=port,
        reload=is_dev,
    )
