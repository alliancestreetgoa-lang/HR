#!/bin/bash
# HR Management System — Start Server
# Double-click this file to launch the HR system.

cd "$(dirname "$0")"

echo "======================================"
echo "  HR Management System"
echo "======================================"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "⚠️  Dependencies not installed yet."
  echo "   Please run setup.command first."
  read -p "Press Enter to close..."
  exit 1
fi

echo "🚀 Starting HR Management System..."
echo "   Open this URL in your browser:"
echo ""
echo "   👉  http://localhost:3000"
echo ""
echo "   Press Ctrl+C to stop the server."
echo "======================================"
echo ""

# Open browser after 2 seconds
sleep 2 && open "http://localhost:3000" &

node server.js

echo ""
echo "Server stopped."
read -p "Press Enter to close..."
