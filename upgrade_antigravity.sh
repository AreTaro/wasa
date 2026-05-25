#!/bin/bash
# Script to upgrade Google Antigravity to 2.0 on Linux (x86_64)

# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================="
echo "      Google Antigravity 2.0 Upgrade      "
echo "=========================================="

# 1. Verify architecture
ARCH=$(uname -m)
if [ "$ARCH" != "x86_64" ]; then
    echo "Error: Detected system architecture is $ARCH."
    echo "This script is configured for x86_64. If you are running an ARM64 system,"
    echo "please use the ARM64 download url instead."
    exit 1
fi
echo "[+] Verified system architecture: $ARCH"

# 2. Download the 2.0 Hub Tarball
URL="https://storage.googleapis.com/antigravity-public/antigravity-hub/2.0.1-6566078776737792/linux-x64/Antigravity.tar.gz"
echo "[+] Downloading Antigravity 2.0.1..."
curl -L -o Antigravity.tar.gz "$URL"

# 3. Extract it
TARGET_DIR="$HOME/Antigravity-v2"
echo "[+] Extracting Antigravity 2.0 to $TARGET_DIR..."
mkdir -p "$TARGET_DIR"
tar -xzf Antigravity.tar.gz -C "$TARGET_DIR" --strip-components=1

# 4. Clean up archive
echo "[+] Cleaning up downloaded archive..."
rm Antigravity.tar.gz

# 5. Install/Upgrade CLI
echo "[+] Installing/upgrading the Antigravity CLI..."
curl -fsSL https://antigravity.google/cli/install.sh | bash

echo ""
echo "=========================================="
echo "          Upgrade Successful              "
echo "=========================================="
echo "You can launch the new Antigravity Hub with:"
echo "  $TARGET_DIR/Antigravity"
echo "=========================================="
