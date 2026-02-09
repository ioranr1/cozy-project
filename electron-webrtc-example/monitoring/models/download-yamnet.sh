#!/bin/bash
# Download YAMNet TF.js model files locally
# Run this script from the electron-webrtc-example directory:
#   bash monitoring/models/download-yamnet.sh

MODEL_DIR="monitoring/models/yamnet"
mkdir -p "$MODEL_DIR"

BASE_URL="https://storage.googleapis.com/tfhub-modules/google/tfjs-model/yamnet/tfjs/1"

echo "Downloading YAMNet model files to $MODEL_DIR..."

# Download model.json
curl -L -o "$MODEL_DIR/model.json" "$BASE_URL/model.json?tfjs-format=file"

if [ $? -ne 0 ]; then
  echo "❌ Failed to download from GCS. Trying alternative..."
  # Alternative: download from tfhub directly
  ALT_URL="https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1"
  curl -L -o "$MODEL_DIR/model.json" "$ALT_URL/model.json?tfjs-format=file"
fi

# Check if model.json was downloaded
if [ ! -f "$MODEL_DIR/model.json" ]; then
  echo "❌ Could not download model.json from any source"
  echo "Please manually download the YAMNet TF.js model:"
  echo "  https://www.kaggle.com/models/google/yamnet/tfJs/tfjs/1"
  exit 1
fi

# Parse weight shard filenames from model.json and download them
echo "Downloading weight shards..."
SHARDS=$(grep -oP '"[^"]*\.bin"' "$MODEL_DIR/model.json" | tr -d '"' | sort -u)

for shard in $SHARDS; do
  echo "  Downloading $shard..."
  curl -L -o "$MODEL_DIR/$shard" "$BASE_URL/$shard"
done

echo "✅ YAMNet model downloaded to $MODEL_DIR/"
echo "Files:"
ls -lh "$MODEL_DIR/"
