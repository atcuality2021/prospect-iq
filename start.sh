#!/bin/bash
# ProspectIQ - Start Script
# Prerequisites: MongoDB and Redis must be running
# Copy backend/.env.example to backend/.env and fill in your API keys

echo "Starting ProspectIQ..."
echo ""
echo "Make sure you have:"
echo "  1. MongoDB running (default: localhost:27017)"
echo "  2. Redis running (default: localhost:6379)"
echo "  3. backend/.env configured with ANTHROPIC_API_KEY"
echo ""

# Terminal 1: Backend API
echo "Start the backend in one terminal:"
echo "  cd backend && npm run dev"
echo ""

# Terminal 2: Worker
echo "Start the BullMQ worker in another terminal:"
echo "  cd backend && npm run worker"
echo ""

# Terminal 3: Frontend
echo "Start the frontend in a third terminal:"
echo "  cd frontend && npm run dev"
echo ""

echo "Then open http://localhost:3000"
