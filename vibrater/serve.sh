#!/bin/bash
# Simple script to serve Vibrater locally

echo "🎤 Starting Vibrater..."
echo ""
echo "Choose a server:"
echo "1) Python (if installed)"
echo "2) Node.js serve (if installed)"
echo ""

read -p "Enter choice (1 or 2): " choice

case $choice in
  1)
    if command -v python3 &> /dev/null; then
      echo "Starting Python server on http://localhost:8000"
      python3 -m http.server 8000
    elif command -v python &> /dev/null; then
      echo "Starting Python server on http://localhost:8000"
      python -m SimpleHTTPServer 8000
    else
      echo "Python not found!"
      exit 1
    fi
    ;;
  2)
    if command -v npx &> /dev/null; then
      echo "Starting Node server..."
      npx serve
    else
      echo "Node.js/npx not found!"
      exit 1
    fi
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac
