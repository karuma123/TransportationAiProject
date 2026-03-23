from flask import Flask, request, jsonify
from predict import predict_from_plt
from realtime_analyzer import analyze_realtime
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests


@app.route("/predict", methods=["POST"])
def predict():
    """Original endpoint — predict from a .plt file path."""
    data = request.get_json()
    file_path = data.get("file_path")

    if not file_path or not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 400

    prob, label, score = predict_from_plt(file_path)

    return jsonify({
        "anomaly_probability": prob,
        "anomaly_score": score,
        "anomaly": label
    })


@app.route("/predict/realtime", methods=["POST"])
def predict_realtime():
    """
    NEW endpoint — predict from a list of GPS data points (real-time).
    
    Expects JSON body:
    {
        "points": [
            {
                "latitude": 17.385,
                "longitude": 78.486,
                "altitude": 500,
                "timestamp": "2026-03-22T16:00:00Z",
                "speed": 45.0
            },
            ...
        ]
    }
    """
    data = request.get_json()
    points = data.get("points", [])

    if len(points) < 3:
        return jsonify({
            "error": "Need at least 3 GPS points for analysis",
            "anomaly_probability": 0.0,
            "anomaly": 0,
            "anomaly_score": 0.0
        }), 400

    result = analyze_realtime(points)
    return jsonify(result)


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "OK",
        "service": "ML Prediction Service",
        "endpoints": ["/predict", "/predict/realtime", "/health"]
    })


if __name__ == "__main__":
    print("=" * 50)
    print("  ML Prediction Service")
    print("  Endpoints:")
    print("    POST /predict          — file-based prediction")
    print("    POST /predict/realtime — real-time prediction")
    print("    GET  /health           — health check")
    print("=" * 50)
    app.run(port=5001, debug=True)
