# face-service/main.py
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from insightface.app import FaceAnalysis
import insightface
import numpy as np
import cv2
import os
import base64
from sklearn.cluster import DBSCAN

app = FastAPI(title="Face & Body Recognition Service")

print("Loading Models...")
# Load model Face (nhận diện khuôn mặt)
face_app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
face_app.prepare(ctx_id=0, det_size=(640, 640))

# Load model ReID (nhận diện dáng người)
# Sử dụng mô hình có sẵn của insightface để trích xuất đặc điểm cơ thể
try:
    from insightface.model_zoo import get_model
    reid_model = get_model('models/OSNet_x1_0.onnx', providers=['CPUExecutionProvider'])
    reid_model.prepare(ctx_id=0)
    print("ReID model loaded.")
except Exception as e:
    print(f"Cannot load ReID model, fallback to face only. Error: {e}")
    reid_model = None

print("Models loaded.")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/detect")
async def detect_faces(file: UploadFile = File(...)):
    content = await file.read()
    nparr = np.frombuffer(content, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return JSONResponse({"error": "Invalid image"}, status_code=400)

    faces = face_app.get(img, det_thresh=0.3)
    results = []
    h, w = img.shape[:2]

    # Xử lý khuôn mặt
    for face in faces:
        bbox = face.bbox.astype(int)
        x1, y1, x2, y2 = bbox
        if (x2 - x1) < 40 or (y2 - y1) < 40: continue

        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        if x2 <= x1 or y2 <= y1: continue

        crop = img[y1:y2, x1:x2]
        ch, cw = crop.shape[:2]
        scale = min(200 / cw, 200 / ch, 1.0)
        if scale < 1.0: crop = cv2.resize(crop, (int(cw * scale), int(ch * scale)))

        _, buffer = cv2.imencode('.jpg', crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
        
        results.append({
            "type": "face",
            "embedding": face.normed_embedding.tolist(),
            "bbox": {"x": int(x1), "y": int(y1), "w": int(x2 - x1), "h": int(y2 - y1)},
            "det_score": float(face.det_score),
            "thumbnail": base64.b64encode(buffer).decode(),
        })

    # Xử lý toàn thân (nếu không có mặt hoặc có ít mặt)
    # Bounding box toàn thân: giả định chiếm 80% chiều cao ảnh
    if reid_model is not None and len(faces) == 0:
        # Cắt toàn bộ ảnh làm dáng người
        body_img = cv2.resize(img, (256, 128)) # Resize chuẩn cho ReID
        body_img = cv2.cvtColor(body_img, cv2.COLOR_BGR2RGB)
        body_embedding = reid_model.get_feat(body_img)
        
        if body_embedding is not None:
            _, buffer = cv2.imencode('.jpg', cv2.resize(img, (200, 200)))
            results.append({
                "type": "body",
                "embedding": body_embedding.flatten().tolist(),
                "bbox": {"x": 0, "y": 0, "w": w, "h": h},
                "det_score": 0.5, # Điểm mặc định cho body
                "thumbnail": base64.b64encode(buffer).decode(),
            })

    return {"objects": results}

@app.post("/cluster")
async def cluster_faces(payload: dict):
    embeddings = payload.get("embeddings", [])
    types = payload.get("types", [])
    
    if len(embeddings) < 2:
        return {"clusters": [[i] for i in range(len(embeddings))]}

    # Tách riêng vector face và body để gom cụm riêng
    face_indices = [i for i, t in enumerate(types) if t == 'face']
    body_indices = [i for i, t in enumerate(types) if t == 'body']
    
    clusters_result = []

    # Gom cụm Face
    if len(face_indices) >= 2:
        X_face = np.array([embeddings[i] for i in face_indices], dtype=np.float32)
        X_face = X_face / np.linalg.norm(X_face, axis=1, keepdims=True)
        clustering = DBSCAN(eps=0.45, min_samples=2, metric='cosine').fit(X_face)
        for label in set(clustering.labels_):
            if label != -1:
                clusters_result.append([face_indices[i] for i, l in enumerate(clustering.labels_) if l == label])

    # Gom cụm Body
    if len(body_indices) >= 2:
        X_body = np.array([embeddings[i] for i in body_indices], dtype=np.float32)
        X_body = X_body / np.linalg.norm(X_body, axis=1, keepdims=True)
        # Body thường kém chính xác hơn nên eps cao hơn (0.6)
        clustering = DBSCAN(eps=0.6, min_samples=2, metric='cosine').fit(X_body)
        for label in set(clustering.labels_):
            if label != -1:
                clusters_result.append([body_indices[i] for i, l in enumerate(clustering.labels_) if l == label])

    return {"clusters": clusters_result}