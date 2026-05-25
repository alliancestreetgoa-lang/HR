#!/bin/bash
# HR Management System — First-Time Setup
# Double-click this file to install dependencies and set up the database.

cd "$(dirname "$0")"

echo "======================================"
echo "  HR Management System — Setup"
echo "======================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed."
  echo "   Please install it from: https://nodejs.org"
  echo "   Then run this setup again."
  read -p "Press Enter to close..."
  exit 1
fi

echo "✅ Node.js $(node -v) found."
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
  echo "❌ npm install failed. Check your internet connection."
  read -p "Press Enter to close..."
  exit 1
fi

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "======================================"
echo "  Setup Complete!"
echo "  Run start-server.command to launch."
echo "======================================"
echo ""
read -p "Press Enter to close..."
