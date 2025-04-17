use axum::{
    routing::get,
    Json, Router,
    extract::State,
};
use serde::Serialize;
use std::sync::Arc;
use headless_chrome::Browser;

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    browser_available: bool,
}

async fn health_check(State(browser): State<Arc<Browser>>) -> Json<HealthResponse> {
    // Check if the browser is available by attempting to get its version
    let browser_status = browser.get_version().is_ok();
    
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        browser_available: browser_status,
    })
}

pub fn routes() -> Router<Arc<Browser>> {
    Router::new()
        .route("/api/health", get(health_check))
}
