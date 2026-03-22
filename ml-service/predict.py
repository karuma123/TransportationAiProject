import numpy as np
import joblib
from tensorflow.keras.models import load_model
from feature_extractor import extract_features, load_plt

# ✅ LOCAL paths
MODEL_PATH = "model/cnn_bilstm_attention_geolife1.h5"
SCALER_PATH = "scaler/scaler1.pkl"

# load model & scaler safely
try:
    model = load_model(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
except Exception as e:
    print("Error loading model or scaler:", e)
    model = None
    scaler = None

# anomaly confidence threshold
ANOMALY_SCORE_THRESHOLD = 0.05


def predict_from_plt(file_path):

    if model is None or scaler is None:
        return 0.0, 0, 0.0

    df = load_plt(file_path)

    if df is None or len(df) < 10:
        return 0.0, 0, 0.0

    features = extract_features(df)

    if features is None:
        return 0.0, 0, 0.0

    # ✅ maintain same feature order as training
    X_raw = np.array([features])

    # scale features
    X_scaled = scaler.transform(X_raw)
   # safety check
    if X_scaled.shape[1] != 10:
        print("Feature mismatch! Expected 10 features.")
        return 0.0, 0, 0.0

    # reshape for CNN-LSTM → (batch, timesteps, channels)
    X = X_scaled.reshape(1, X_scaled.shape[1], 1)

    # prediction
    prob = model.predict(X, verbose=0)[0][0]

    # anomaly confidence score
    anomaly_score = abs(prob - 0.5) * 2

    # classification
    label = int(anomaly_score >= ANOMALY_SCORE_THRESHOLD)

    return float(prob), label, float(anomaly_score)