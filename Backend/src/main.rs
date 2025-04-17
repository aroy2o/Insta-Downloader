use axum::{Router, routing::get, response::Html};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::trace::{self, TraceLayer};
use tracing::{info, Level};
use http::header::{AUTHORIZATION, CONTENT_TYPE};
use http::Method;
use tokio::runtime::Builder; // Add for custom runtime
use tower::ServiceBuilder;
use tower_http::timeout::TimeoutLayer;
use std::time::Duration;

mod routes;
mod handlers;
mod services;
mod utils;

// Root handler that returns a basic HTML page with API status
async fn root_handler() -> Html<&'static str> {
    Html("<html><head><title>Instagram Downloader API</title></head><body>
        <h1>Instagram Downloader API</h1>
        <p>Status: ✅ Running</p>
        <p>Available endpoints:</p>
        <ul>
            <li><code>POST /api/preview</code> - Preview Instagram content before downloading</li>
            <li><code>POST /api/download</code> - Download Instagram media (reels, stories, posts)</li>
            <li><code>GET /api/media</code> - Proxy for media content</li>
        </ul>
        </body></html>")
}

// Remove unused function or mark with #[allow(dead_code)]
#[allow(dead_code)]
fn build_runtime() -> tokio::runtime::Runtime {
    // Increase worker threads for high concurrency
    Builder::new_multi_thread()
        .worker_threads(8) // Adjust based on your CPU
        .enable_all()
        .build()
        .expect("Failed to build Tokio runtime")
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();
    info!("Starting Instagram Downloader Service");
    use std::ffi::OsStr;
    let browser_args: Vec<&OsStr> = vec![
        OsStr::new("--no-sandbox"),
        OsStr::new("--disable-setuid-sandbox"),
        OsStr::new("--disable-gpu"),
        OsStr::new("--disable-infobars"),
        OsStr::new("--window-position=0,0"),
        OsStr::new("--ignore-certificate-errors"),
        OsStr::new("--disable-extensions"),
        OsStr::new("--disable-dev-shm-usage"),
        OsStr::new("--disable-blink-features=AutomationControlled"),
        OsStr::new("--hide-scrollbars"),
        OsStr::new("--mute-audio"),
        OsStr::new("--start-maximized"),
        OsStr::new("--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/110.0.5481.177 Mobile/15E148 Safari/604.1")
    ];
    let browser_options = headless_chrome::LaunchOptions {
        headless: true,
        disable_default_args: false,
        window_size: Some((1280, 800)),
        args: browser_args,
        ..Default::default()
    };
    let browser = match headless_chrome::Browser::new(browser_options) {
        Ok(browser) => {
            info!("✅ Browser initialized successfully");
            Arc::new(browser)
        },
        Err(e) => {
            eprintln!("❌ Failed to initialize browser: {}", e);
            std::process::exit(1);
        }
    };
    info!("Initializing API routes...");
    let cors = CorsLayer::new()
        // Fix: Don't use wildcard "*" with credentials
        .allow_origin([
            "http://localhost:5173".parse::<http::HeaderValue>().unwrap(),
            "http://localhost:3000".parse::<http::HeaderValue>().unwrap(),
            "http://127.0.0.1:5173".parse::<http::HeaderValue>().unwrap(),
            "http://127.0.0.1:3000".parse::<http::HeaderValue>().unwrap(),
        ])
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([AUTHORIZATION, CONTENT_TYPE])
        .allow_credentials(true);
    let app = Router::new()
        .route("/", get(root_handler))
        .merge(routes::download::routes())
        .merge(routes::health::routes())
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http()
                    .make_span_with(trace::DefaultMakeSpan::new().level(Level::INFO))
                    .on_response(trace::DefaultOnResponse::new().level(Level::INFO))
                )
                .layer(cors)
                .layer(TimeoutLayer::new(Duration::from_secs(30))) // Add request timeout
        )
        .with_state(browser);
    let addr = SocketAddr::from(([0, 0, 0, 0], 9090));
    info!("🚀 Server running at http://{}", addr);
    // Use hyper server with keep-alive and TCP_NODELAY
    let server = axum::Server::bind(&addr)
        .tcp_nodelay(true)
        .http1_keepalive(true)
        .serve(app.into_make_service());
    match server.await {
        Ok(_) => info!("Server shutdown gracefully"),
        Err(e) => eprintln!("Server error: {}", e)
    }
}
