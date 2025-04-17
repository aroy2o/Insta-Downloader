# Instagram Downloader Backend

A robust Rust backend for downloading Instagram media (posts, reels, and stories) using browser automation and `yt-dlp` as a fallback. This backend is designed for reliability, modularity, and easy extension.

---

## Features

- Download Instagram posts, reels, and stories by URL.
- Modular handler structure for each media type: posts, reels, stories, and generic post types.
- Fallback to `yt-dlp` if browser automation fails, ensuring high download success rates.
- Extract high-quality media URLs using headless Chrome via `chromedriver`.
- Custom error handling and retry mechanisms for robustness.
- Easily extensible route and handler structure for future endpoints.

---

## Prerequisites

- Rust (latest stable version)
- `chromedriver` (for headless Chrome automation)
- `yt-dlp` (for fallback media downloading)
- SQLite (for Diesel ORM, if needed)

---

## Installation & Running

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd Backend
   ```
2. Install Rust dependencies:
   ```bash
   cargo build
   ```
3. Ensure `chromedriver` is running:
   ```bash
   chromedriver --port=9515
   ```
4. Run the backend server:
   ```bash
   cargo run
   ```

---

## API Endpoints

### POST `/download`
Downloads Instagram media (post, reel, or story) based on the provided URL.

**Request Body:**
```json
{
  "url": "https://www.instagram.com/reel/xyz123/"
}
```

**Response:**
- On success:
  ```json
  "✅ Reel downloaded successfully to insta_reel_<timestamp>/reel.mp4"
  ```
- On failure:
  ```json
  "❌ Unsupported URL format"
  ```

#### Example URLs
- Reel: `https://www.instagram.com/reel/xyz123/`
- Story: `https://www.instagram.com/stories/username/123456789/`
- Post: `https://www.instagram.com/p/abc123/`

### GET `/health`
Health check endpoint to verify the backend is running.

---

## Code Structure

- `src/main.rs`: Entry point, server setup, and route mounting.
- `src/routes/`: Route definitions.
  - `download.rs`: `/download` endpoint logic.
  - `health.rs`: `/health` endpoint logic.
- `src/handlers/`: Media-specific download logic.
  - `reel.rs`: Reel downloads.
  - `story.rs`: Story downloads.
  - `post.rs`: Post downloads.
  - `insta_post.rs`: Generic Instagram post handler.
- `src/services/`: Utility functions for extraction and downloading.
  - `extractor.rs`: Uses headless Chrome to extract media URLs.
  - `downloader.rs`: Downloads media using `reqwest` or `yt-dlp` fallback.
- `src/utils/`: Utilities and error handling.
  - `error.rs`: Custom error types (`NotFound`, `InternalServerError`, `BadRequest`).

---

## Error Handling

Custom error types are defined in `src/utils/error.rs` to handle various error scenarios, including:
- `NotFound`: Resource not found or invalid URL.
- `InternalServerError`: Unexpected server errors.
- `BadRequest`: Malformed requests or missing parameters.

All errors are returned as structured JSON responses with appropriate HTTP status codes.

---

## Dependencies

- [Axum](https://crates.io/crates/axum): Web framework
- [Tokio](https://crates.io/crates/tokio): Async runtime
- [Serde](https://crates.io/crates/serde): Serialization
- [Reqwest](https://crates.io/crates/reqwest): HTTP client
- [Fantoccini](https://crates.io/crates/fantoccini): WebDriver client
- [Diesel](https://crates.io/crates/diesel): ORM (optional)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp): CLI video downloader

---

## Running Tests

You can test the backend endpoints using tools like `curl` or Postman.

Example:
```bash
curl -X POST http://127.0.0.1:8080/download \
-H "Content-Type: application/json" \
-d '{"url": "https://www.instagram.com/reel/xyz123/"}'
```

---

## Notes
- Ensure `chromedriver` is running on port `9515` before starting the backend.
- The backend uses `yt-dlp` as a fallback for downloads. Make sure it is installed and available in your system's PATH.
- The backend is modular and can be extended to support additional endpoints or media types.

---

## License
MIT License. See the LICENSE file for details.
