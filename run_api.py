import uvicorn
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

if __name__ == "__main__":
    uvicorn.run(
        "src.api:app",
        host="0.0.0.0",
        port=8502,
        reload=True
    )
    