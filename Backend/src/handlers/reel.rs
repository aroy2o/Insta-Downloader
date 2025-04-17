use axum::extract::Json;
use serde::Deserialize;
use chrono::Utc;
use std::fs::create_dir_all;
use reqwest::Client;
use tokio::time::sleep;
use std::time::Duration;
use crate::services::downloader::{download_media_with_retry, download_with_ytdlp};

#[derive(Debug, Deserialize)]
pub struct ReelDownloadRequest {
    pub url: String,
    pub browser: Option<String>,
    #[allow(dead_code)]
    pub use_ytdlp_first: Option<bool>, // Added option to use yt-dlp as primary method
}

pub async fn download(Json(request): Json<ReelDownloadRequest>) -> Json<String> {
    let url = request.url;
    let browser = request.browser.unwrap_or_else(|| "chrome".to_string());
    let timestamp = Utc::now().timestamp();
    let folder_name = format!("insta_reel_{}", timestamp);
    let metadata_path = format!("{}/metadata.txt", folder_name);
    
    if let Err(e) = create_dir_all(&folder_name) {
        return Json(format!("❌ Failed to create folder: {}", e));
    }
    
    // Log metadata
    let metadata = format!(
        "Source URL: {}\nTimestamp: {}\nBrowser: {}\n",
        url, timestamp, browser
    );
    if let Err(e) = std::fs::write(&metadata_path, metadata) {
        println!("⚠️ Failed to write metadata: {}", e);
    }

    // Always use yt-dlp with Chrome cookies as the first method
    println!("🔄 Using yt-dlp as primary download method (with Chrome cookies)...");
    if let Ok(_) = download_with_ytdlp(&url, Some(&folder_name), Some(&browser), true).await {
        return Json(format!("✅ Reel downloaded with yt-dlp. Saved to '{}'", folder_name));
    }
    println!("⚠️ yt-dlp download failed, falling back to browser extraction...");

    // Try browser automation first, as in fullcode.rs
    let mut caps = serde_json::Map::new();
    caps.insert("browserName".to_string(), serde_json::Value::String("chrome".to_string()));
    let mut chrome_opts = serde_json::Map::new();
    chrome_opts.insert("args".to_string(), serde_json::Value::Array(vec![
        "--disable-blink-features=AutomationControlled".into(),
        "--no-sandbox".into(),
        "--disable-dev-shm-usage".into(),
        "--headless=new".into(),
        "--disable-gpu".into(),
        "--disable-extensions".into(),
    ]));
    caps.insert("goog:chromeOptions".to_string(), serde_json::Value::Object(chrome_opts));

    let client_res = fantoccini::ClientBuilder::native()
        .capabilities(caps)
        .connect("http://localhost:9515")
        .await;

    let client = match client_res {
        Ok(c) => c,
        Err(e) => {
            println!("⚠️ Failed to connect to chromedriver: {}. Falling back to yt-dlp...", e);
            if let Err(e) = download_with_ytdlp(&url, Some(&folder_name), Some(&browser), false).await {
                return Json(format!("❌ yt-dlp failed: {}", e));
            }
            return Json(format!("✅ Reel downloaded with yt-dlp. Saved to '{}'", folder_name));
        }
    };

    println!("📲 Opening Instagram URL: {}", url);
    if let Err(e) = client.goto(&url).await {
        let _ = client.close().await;
        println!("❌ Navigation error: {}. Falling back to yt-dlp...", e);
        if let Err(e) = download_with_ytdlp(&url, Some(&folder_name), Some(&browser), false).await {
            return Json(format!("❌ yt-dlp failed: {}", e));
        }
        return Json(format!("✅ Reel downloaded with yt-dlp. Saved to '{}'", folder_name));
    }
    
    // Dynamic waiting and extraction with multiple methods
    println!("⏳ Waiting for content to load (up to 10s)...");
    let mut video_src = String::new();
    let mut attempts = 0;
    
    // Try multiple extraction methods with dynamic waiting
    while attempts < 20 && (video_src.is_empty() || video_src.starts_with("blob:")) {
        // Method 1: Direct video src
        let video_src_result = client
            .execute(
                r#"
                let video = document.querySelector('video');
                return video && video.src ? video.src : null;
                "#,
                vec![],
            )
            .await;
            
        if let Ok(val) = video_src_result {
            if let Some(src) = val.as_str() {
                if !src.is_empty() && !src.starts_with("blob:") {
                    video_src = src.to_string();
                    println!("✅ Found video.src: {}", video_src);
                    break;
                }
            }
        }
        
        // Method 2: Video source tag
        let source_src_result = client
            .execute(
                r#"
                let source = document.querySelector('video > source');
                return source && source.src ? source.src : null;
                "#,
                vec![],
            )
            .await;
            
        if let Ok(val) = source_src_result {
            if let Some(src) = val.as_str() {
                if !src.is_empty() && !src.starts_with("blob:") {
                    video_src = src.to_string();
                    println!("✅ Found video>source: {}", video_src);
                    break;
                }
            }
        }
        
        // Method 3: JSON-LD metadata extraction
        let json_ld_result = client
            .execute(
                r#"
                try {
                    const script = document.querySelector('script[type="application/ld+json"]');
                    if (script) {
                        const json = JSON.parse(script.innerText);
                        if (json.contentUrl) {
                            return json.contentUrl;
                        } else if (json.video && json.video.contentUrl) {
                            return json.video.contentUrl;
                        }
                    }
                    return null;
                } catch (e) {
                    console.error("Error parsing JSON-LD:", e);
                    return null;
                }
                "#,
                vec![],
            )
            .await;
            
        if let Ok(val) = json_ld_result {
            if let Some(src) = val.as_str() {
                if !src.is_empty() && !src.starts_with("blob:") {
                    video_src = src.to_string();
                    println!("✅ Found video URL in JSON-LD: {}", video_src);
                    break;
                }
            }
        }
        
        // Method 4: Open Graph meta tags
        let og_video_result = client
            .execute(
                r#"
                const ogVideo = document.querySelector('meta[property="og:video"]')?.content;
                return ogVideo || null;
                "#,
                vec![],
            )
            .await;
            
        if let Ok(val) = og_video_result {
            if let Some(src) = val.as_str() {
                if !src.is_empty() && !src.starts_with("blob:") {
                    video_src = src.to_string();
                    println!("✅ Found video URL in Open Graph meta: {}", video_src);
                    break;
                }
            }
        }
        
        attempts += 1;
        sleep(Duration::from_millis(500)).await;
    }

    if video_src.is_empty() || video_src.starts_with("blob:") {
        let _ = client.close().await;
        println!("⚠️ Direct video URL not available. Using yt-dlp fallback...");
        if let Err(e) = download_with_ytdlp(&url, Some(&folder_name), Some(&browser), false).await {
            return Json(format!("❌ yt-dlp failed: {}", e));
        }
        return Json(format!("✅ Reel downloaded with yt-dlp. Saved to '{}'", folder_name));
    } else {
        let output_path = format!("{}/reel.mp4", folder_name);
        println!("✅ Found video URL: {}\n⬇️ Downloading to {}", video_src, output_path);
        let reqwest_client = Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36")
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap();
        match download_media_with_retry(&reqwest_client, &video_src, &output_path).await {
            Ok(_) => {
                // Verify the file size to make sure it's not just a thumbnail
                if let Ok(metadata) = std::fs::metadata(&output_path) {
                    if metadata.len() < 200_000 { // Less than 200KB, likely a thumbnail
                        println!("⚠️ Downloaded file is too small ({}KB), likely a thumbnail. Falling back to yt-dlp...", 
                                metadata.len() / 1024);
                        let _ = client.close().await;
                        if let Err(e) = download_with_ytdlp(&url, Some(&folder_name), Some(&browser), false).await {
                            return Json(format!("❌ yt-dlp fallback also failed: {}", e));
                        }
                        return Json(format!("✅ Reel downloaded with yt-dlp. Saved to '{}'", folder_name));
                    }
                }
                
                // Save a screenshot for debugging purposes
                if let Ok(_) = client.screenshot().await.map(|png_data| {
                    std::fs::write(format!("{}/debug_screenshot.png", folder_name), png_data)
                }) {
                    println!("📷 Saved debug screenshot");
                }
                
                let _ = client.close().await;
                return Json(format!("🎉 Download complete: {}", output_path));
            },
            Err(e) => {
                let _ = client.close().await;
                println!("❌ Download failed: {}. Trying yt-dlp fallback...", e);
                if let Err(e) = download_with_ytdlp(&url, Some(&folder_name), Some(&browser), false).await {
                    return Json(format!("❌ yt-dlp fallback also failed: {}", e));
                }
                return Json(format!("✅ Reel downloaded with yt-dlp. Saved to '{}'", folder_name));
            }
        }
    }
}
