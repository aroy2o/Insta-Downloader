use axum::extract::Json;
use serde::{Deserialize}; // Removed unused Serialize

#[derive(Deserialize)]
pub struct PostDownloadRequest {
    pub url: String,
    #[allow(dead_code)]
    pub browser: Option<String>, // Marked as allowed dead code
}

pub async fn download(Json(request): Json<PostDownloadRequest>) -> Json<String> {
    // Implement post download logic here
    // For now, just return a placeholder response
    Json(format!("✅ Post download started for URL: {}", request.url))
}