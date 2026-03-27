"""
main.py

FastAPI app entrypoint placeholder. This should expose REST routes consumed by
the React frontend (e.g., /tenders, /tenders/{id}, /alerts, /settings).
"""

from fastapi import FastAPI


app = FastAPI(title="ATIS Backend API")


@app.get("/")
def root():
    return {"status": "ok", "message": "ATIS backend placeholder"}


# Define routes to match frontend expectations (implement these):
# GET /tenders
# GET /tenders/{id}
# GET /tenders/{id}/summary
# PATCH /tenders/{id}/status
# GET /alerts
# GET /settings
