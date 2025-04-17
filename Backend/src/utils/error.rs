use std::fmt;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use serde::Serialize;

#[derive(Debug)]
pub enum AppError {
    BadRequest(String),
    #[allow(dead_code)]
    NotFound(String),
    InternalServerError(String),
    #[allow(dead_code)]
    ValidationError(String),
    #[allow(dead_code)]
    BrowserError(String),
    #[allow(dead_code)]
    NetworkError(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Self::BadRequest(msg) => write!(f, "Bad request: {}", msg),
            Self::NotFound(msg) => write!(f, "Not found: {}", msg),
            Self::InternalServerError(msg) => write!(f, "Internal server error: {}", msg),
            Self::ValidationError(msg) => write!(f, "Validation error: {}", msg),
            Self::BrowserError(msg) => write!(f, "Browser error: {}", msg),
            Self::NetworkError(msg) => write!(f, "Network error: {}", msg),
        }
    }
}

#[derive(Serialize)]
#[allow(dead_code)]
struct ErrorResponse {
    error: String,
    success: bool,
    error_type: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message, error_type) = match self {
            Self::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg, "bad_request"),
            Self::NotFound(msg) => (StatusCode::NOT_FOUND, msg, "not_found"),
            Self::InternalServerError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg, "internal_server_error"),
            Self::ValidationError(msg) => (StatusCode::BAD_REQUEST, msg, "validation_error"),
            Self::BrowserError(msg) => (StatusCode::SERVICE_UNAVAILABLE, msg, "browser_error"),
            Self::NetworkError(msg) => (StatusCode::BAD_GATEWAY, msg, "network_error"),
        };

        let body = Json(json!({
            "error": error_message,
            "success": false,
            "error_type": error_type
        }));

        (status, body).into_response()
    }
}

// Standard error conversions
impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        Self::InternalServerError(format!("IO error: {}", err))
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        Self::BadRequest(format!("JSON error: {}", err))
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            Self::NetworkError(format!("Request timed out: {}", err))
        } else if err.is_connect() {
            Self::NetworkError(format!("Connection error: {}", err))
        } else {
            Self::InternalServerError(format!("Request error: {}", err))
        }
    }
}

// Helper for creating error responses
#[allow(dead_code)]
pub fn error_response(status: StatusCode, message: String) -> Response {
    let body = Json(json!({
        "error": message,
        "success": false,
    }));
    
    (status, body).into_response()
}

// Helper for creating detailed error logs
#[allow(dead_code)]
pub fn log_error(error: &AppError) -> String {
    format!("[ERROR] {}", error)
}

// Helper for handling browser-related errors
#[allow(dead_code)]
pub fn browser_error(message: &str) -> AppError {
    AppError::BrowserError(message.to_string())
}

// Helper for handling network-related errors
#[allow(dead_code)]
pub fn network_error(message: &str) -> AppError {
    AppError::NetworkError(message.to_string())
}
