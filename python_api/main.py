from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import mediapipe as mp
import numpy as np
from PIL import Image
import io

app = FastAPI()

# Allow CORS for development (Next.js frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mp_face_detection = mp.solutions.face_detection

@app.get("/")
def read_root():
    return {"status": "ok", "service": "VibraFrame Face Detection"}

@app.post("/detect-face")
async def detect_face(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        # Read image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Convert to RGB (MediaPipe requirement)
        if image.mode != "RGB":
            image = image.convert("RGB")
        
        img_np = np.array(image)
        height, width, _ = img_np.shape

        # Run detection
        with mp_face_detection.FaceDetection(
            model_selection=1, # 0 for close range, 1 for far range (more robust)
            min_detection_confidence=0.5
        ) as face_detection:
            results = face_detection.process(img_np)

            if not results.detections:
                return {"ok": True, "found": False}

            # Get the first detection (usually the most prominent face)
            # MediaPipe returns relative bounding box (0.0 to 1.0)
            detection = results.detections[0]
            bbox = detection.location_data.relative_bounding_box
            
            # Calculate center of the face
            face_cx = bbox.xmin + (bbox.width / 2)
            face_cy = bbox.ymin + (bbox.height / 2)
            
            # Simple zoom suggestion: if face is very small, suggest zoom?
            # For now, just return center.
            
            return {
                "ok": True,
                "found": True,
                "face": {
                    "x": face_cx, # 0.0 to 1.0
                    "y": face_cy, # 0.0 to 1.0
                    "w": bbox.width,
                    "h": bbox.height
                }
            }

    except Exception as e:
        print(f"Error processing image: {e}")
        return {"ok": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
