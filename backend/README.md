# Background AI PDF Extraction Backend

This is the Node.js + Express backend for the NEET Test App. It manages secure file uploads and handles CPU-intensive AI PDF extraction in the background using BullMQ, Redis, and WebSockets (Socket.io).

## Requirements

1. **Node.js**: v18 or newer
2. **Redis**: BullMQ strictly requires Redis to function. You must have Redis running locally or have a cloud Redis URL.
3. **Supabase**: Access to your Supabase project with the appropriate `jobs`, `uploads`, and `questions` tables created.

## Installation

```bash
cd backend
npm install
```

## Setup

1. Copy `.env.example` to `.env` inside the `backend` folder:
   ```bash
   cp .env.example .env
   ```
2. Fill out your `.env` file:
   - Provide your `REDIS_HOST` (e.g., `127.0.0.1` for local, or a cloud URL).
   - Provide your `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   - Provide your `VITE_GEMINI_API_KEY`.
3. Apply the Database Migration:
   - Go to your Supabase SQL Editor.
   - Run the contents of `backend_migration.sql` (found in the project root) to set up the necessary tables.

## Starting the Server

To start the backend in development mode with hot-reloading:

```bash
npm run dev
```

To start in production mode:

```bash
npm start
```

## Architecture

1. **API (`routes/api.js`)**: 
   - Receives the PDF upload via Multer (`/api/upload`).
   - Immediately saves it to the local `/uploads` directory (or Supabase Storage).
   - Enqueues a job in BullMQ (`pdf-extraction`) and returns the `jobId` to the frontend instantly.
2. **Worker (`queue/worker.js`)**: 
   - Picks up the job from Redis.
   - Uses `pdf-lib` to split the PDF into manageable chunks.
   - Sends the chunks to Gemini AI.
   - Saves the extracted questions and images directly to Supabase (`questions` and `question_images` tables).
3. **WebSockets (`server.js`)**:
   - The backend runs a Socket.io server on the same port.
   - As the worker progresses through the PDF chunks, it emits real-time progress events (`job-progress`, `job-completed`) directly to the connected frontend client.

## Troubleshooting

- **"Could not connect to Redis"**: Ensure your Redis instance is running. On Windows, you can use WSL (`sudo service redis-server start`) or Docker (`docker run -d -p 6379:6379 redis`).
- **Jobs failing immediately**: Check that your `SUPABASE_SERVICE_ROLE_KEY` is correct. The worker needs database access to create job and question records.
