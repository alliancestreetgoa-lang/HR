#!/bin/bash
# HR Management System - Local Server Launcher (macOS)
# Double-click this file to start the system on http://localhost:8765

cd "$(dirname "$0")"

PORT=8765
URL="http://localhost:$PORT/hr-system.html"

echo "================================================"
echo "  HR Management System - Local Server"
echo "================================================"
echo ""
echo "  Serving from: $(pwd)"
echo "  URL:          $URL"
echo ""
echo "  Open this in your browser:"
echo "  $URL"
echo ""
echo "  Press Ctrl+C in this window to stop the server."
echo "================================================"
echo ""

# Open browser after 1 second
( sleep 1 && open "$URL" ) &

# Start Python HTTP server (Python 3 ships with macOS)
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server $PORT
elif command -v python >/dev/null 2>&1; then
  python -m SimpleHTTPServer $PORT
else
  echo "Python not found. Please install Python 3 or just open hr-system.html directly in your browser."
  read -p "Press Enter to close..."
fi
