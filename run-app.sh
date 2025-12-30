#!/bin/bash
cd "$(dirname "$0")/dist"
echo ""
echo "🚀 Starting FinApp..."
echo "📱 Open this URL in your browser:"
echo ""
echo "    http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""
python3 -m http.server 3000
