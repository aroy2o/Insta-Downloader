# Insta - Instagram Media Downloader

A modern application to download Instagram reels, photos, and posts.

## Overview

This is a full-stack project with a Rust backend and a modern React frontend. Users can download Instagram media (reels, photos, posts) by providing URLs.

## Technology Stack

### Backend
- Rust (Axum web framework)
- Tokio async runtime
- Tower middleware
- Custom modules for downloading, extraction, and error handling

### Frontend
- React.js (with Vite)
- Redux for state management
- Axios for API requests
- Tailwind CSS for styling

## Project Structure

```
Insta/
├── Backend/                # Rust backend server
│   ├── src/                # Rust source code
│   │   ├── handlers/       # Request handlers (insta_post, post, reel, story)
│   │   ├── routes/         # API route definitions
│   │   ├── services/       # Business logic (downloader, extractor)
│   │   └── utils/          # Utility modules (error handling, helpers)
│   ├── Cargo.toml          # Rust dependencies
│   └── ...
│
├── frontend/               # React frontend
│   ├── src/                # React source code
│   │   ├── components/     # UI components
│   │   ├── store/          # Redux store and slices
│   │   └── utils/          # Utility JS functions
│   ├── public/             # Static assets
│   ├── package.json        # Frontend dependencies
│   └── ...
└── Readme.md               # Project documentation
```

## Installation

1. Clone the repository
    ```sh
    git clone <repo-url>
    cd Insta
    ```

### Backend Setup (Rust)

2. Install Rust (if not already): https://rustup.rs/
3. Build and run the backend:
    ```sh
    cd Backend
    cargo run
    ```

### Frontend Setup (React)

4. Install Node.js (if not already): https://nodejs.org/
5. Install frontend dependencies:
    ```sh
    cd frontend
    npm install
    ```
6. Start the frontend dev server:
    ```sh
    npm run dev
    ```

## Configuration

- Backend configuration can be set via environment variables or in the code (see `Backend/src/utils/`).
- Frontend configuration (API endpoints, etc.) can be set in the frontend source as needed.

## API Endpoints (Sample)

- `GET /health` - Health check
- `POST /download` - Download Instagram media (see backend routes for details)

## Deployment

- Backend: Deploy using Docker, or on any server supporting Rust binaries
- Frontend: Deploy static build to Netlify, Vercel, or similar

## License

MIT License