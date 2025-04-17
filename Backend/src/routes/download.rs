use axum::{
    extract::{Json, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get as axum_get, post as axum_post},
    Router, body::Body,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use headless_chrome::Browser;
use crate::services::extractor::{
    create_browser_client, 
    extract_post_media, 
    extract_stories, 
    extract_media_from_metadata,
    is_story_url, 
    is_reel_url,
    extract_reel_video_with_headless_chrome,
};
use chrono::Utc;
use crate::handlers::story;
use crate::handlers::insta_post;
use crate::handlers::reel;

// Define MediaItem and PreviewResponse here since they're missing from handlers
#[derive(Debug, Deserialize, Serialize)]
pub struct MediaItem {
    pub url: String,
    pub media_type: String,
    pub thumbnail_url: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PreviewResponse {
    pub success: bool,
    pub content_type: Option<String>,
    pub media_items: Option<Vec<MediaItem>>,
    pub error: Option<String>,
    pub debug_info: Option<serde_json::Map<String, serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
pub struct DownloadRequest {
    // We don't need to mark url as unused since we'll directly handle it in the improved handler
    #[allow(dead_code)]
    pub url: String,
    #[allow(dead_code)]
    pub browser: Option<String>,
    #[allow(dead_code)]
    pub use_ytdlp_first: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct PreviewRequest {
    pub url: String,
    #[allow(dead_code)]
    pub browser: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MediaProxyParams {
    url: String,
    download: Option<bool>,
    filename: Option<String>,
}

// Helper function to extract Instagram media
async fn extract_instagram_media(url: &str, _browser_state: Arc<Browser>) -> PreviewResponse {
    let mut content_type = "post";
    let mut error_message = None;
    let mut media_items: Option<Vec<MediaItem>> = None;
    let mut debug_info = serde_json::Map::new();
    
    // Detect content type from URL
    debug_info.insert("url".to_string(), serde_json::Value::String(url.to_string()));
    
    // Extract content based on URL pattern
    if url.contains("/stories/") {
        content_type = "story";
        debug_info.insert("detected_type".to_string(), serde_json::Value::String("story".to_string()));
    } else if url.contains("/reel/") || url.contains("/reels/") {
        content_type = "reel";
        debug_info.insert("detected_type".to_string(), serde_json::Value::String("reel".to_string()));
    } else if url.contains("/p/") {
        content_type = "post";
        debug_info.insert("detected_type".to_string(), serde_json::Value::String("post".to_string()));
    } else {
        error_message = Some("Unsupported URL format".to_string());
        debug_info.insert("error".to_string(), serde_json::Value::String("unsupported_url_format".to_string()));
        
        return PreviewResponse {
            success: false,
            content_type: Some(content_type.to_string()),
            media_items: None,
            error: error_message,
            debug_info: Some(debug_info),
        };
    }
    
    // Use the extractor service to get media
    println!("📥 Extracting media from URL: {}", url);
    match create_browser_client("chrome").await {
        Ok(mut client) => {
            debug_info.insert("browser_client_created".to_string(), serde_json::Value::Bool(true));
            
            // Capture user agent for debugging
            match client.execute("return navigator.userAgent", vec![]).await {
                Ok(agent) => {
                    if let Some(agent_str) = agent.as_str() {
                        debug_info.insert("user_agent".to_string(), serde_json::Value::String(agent_str.to_string()));
                    }
                },
                Err(_) => {}
            }
            
            // Set a longer timeout for navigation to handle slow connections
            match client.goto(url).await {
                Ok(_) => {
                    debug_info.insert("navigation_success".to_string(), serde_json::Value::Bool(true));
                    
                    // Check if we hit a login wall
                    let login_check_script = r#"
                        (function() {
                            // Check for login wall elements
                            const loginButtons = document.querySelectorAll('button, a');
                            for (const button of loginButtons) {
                                if (button.textContent && 
                                    (button.textContent.includes('Log In') || 
                                     button.textContent.includes('Sign Up'))) {
                                    return {
                                        loginRequired: true,
                                        buttonText: button.textContent.trim()
                                    };
                                }
                            }

                            // Check for content blocking messages
                            const contentBlocked = 
                                document.body.textContent.includes('This content isn't available') ||
                                document.body.textContent.includes('content is not available') ||
                                document.body.textContent.includes('restricted your access');

                            if (contentBlocked) {
                                return {
                                    loginRequired: true,
                                    reason: 'Content appears to be restricted'
                                };
                            }

                            // Check for Instagram's login screen
                            const metaOg = document.querySelector('meta[property="og:title"]');
                            if (metaOg && metaOg.content && metaOg.content.includes('Instagram')) {
                                const noImages = document.querySelectorAll('img[srcset]').length === 0;
                                const noVideos = document.querySelectorAll('video').length === 0;
                                
                                if (noImages && noVideos) {
                                    return {
                                        loginRequired: true,
                                        reason: 'No media elements found, likely login required'
                                    };
                                }
                            }
                            
                            return { loginRequired: false };
                        })();
                    "#;
                    
                    let login_result = client.execute(login_check_script, vec![]).await;
                    let login_required = if let Ok(result) = login_result {
                        if let Some(obj) = result.as_object() {
                            if let Some(required) = obj.get("loginRequired").and_then(|r| r.as_bool()) {
                                debug_info.insert("login_check".to_string(), serde_json::json!(obj));
                                required
                            } else {
                                false
                            }
                        } else {
                            false
                        }
                    } else {
                        false
                    };
                    
                    if login_required {
                        println!("⚠️ Login wall detected, trying alternative extraction methods");
                        debug_info.insert("login_required".to_string(), serde_json::Value::Bool(true));
                    }
                    
                    // Give the page more time to load fully, especially for reels/stories
                    let wait_time = if content_type == "reel" || content_type == "story" {
                        10 // longer wait for reels and stories
                    } else {
                        5 // standard wait for posts
                    };
                    
                    debug_info.insert("initial_wait_time".to_string(), serde_json::Value::Number(serde_json::Number::from(wait_time)));
                    tokio::time::sleep(std::time::Duration::from_secs(wait_time)).await;
                    
                    // Try both mobile and desktop view if needed
                    let set_mobile_view = r#"
                        const meta = document.querySelector('meta[name="viewport"]');
                        if (!meta) {
                            const viewport = document.createElement('meta');
                            viewport.name = 'viewport';
                            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
                            document.head.appendChild(viewport);
                        } else {
                            meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
                        }
                    "#;
                    
                    // Try changing to mobile view if login is required
                    if login_required {
                        let _ = client.execute(set_mobile_view, vec![]).await;
                        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                    }
                    
                    // Take a screenshot for debugging
                    let screenshot_result = client.screenshot().await;
                    if let Ok(screenshot_data) = screenshot_result {
                        // Save the screenshot to a debug file with timestamp
                        let timestamp = chrono::Utc::now().timestamp();
                        let screenshot_path = format!("debug_screenshot_{}.png", timestamp);
                        if let Ok(_) = std::fs::write(&screenshot_path, &screenshot_data) {
                            debug_info.insert("debug_screenshot".to_string(), serde_json::Value::String(screenshot_path));
                        }
                    }
                    
                    // Try specific extraction based on content type and login status
                    let extraction_result = if login_required && content_type == "reel" {
                        // For reels behind login, try metadata extraction
                        extract_media_from_metadata(&mut client).await
                    } else if content_type == "story" {
                        // Special handling for stories
                        extract_stories(&mut client).await
                    } else {
                        // Standard extraction for posts and public reels
                        extract_post_media(&mut client).await
                    };
                    
                    match extraction_result {
                        Ok(extracted_media) => {
                            if !extracted_media.is_empty() {
                                let items = extracted_media.into_iter()
                                    .map(|(url, media_type)| MediaItem {
                                        url,
                                        media_type,
                                        thumbnail_url: None,
                                    })
                                    .collect::<Vec<_>>();
                                
                                println!("✅ Successfully extracted {} media items", items.len());
                                debug_info.insert("extracted_count".to_string(), serde_json::Value::Number(serde_json::Number::from(items.len())));
                                media_items = Some(items);
                            } else {
                                // Try once more with a longer wait if no media found
                                debug_info.insert("first_attempt_failed".to_string(), serde_json::Value::Bool(true));
                                debug_info.insert("retry".to_string(), serde_json::Value::Bool(true));
                                
                                tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                                
                                // Try to scroll the page to trigger lazy-loaded content
                                let _ = client.execute("window.scrollTo(0, document.body.scrollHeight / 2);", vec![]).await;
                                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                                
                                // Try alternate extraction method using OpenGraph and JSON-LD
                                let alt_script = r#"
                                    function findMedia() {
                                        const media = [];
                                        
                                        // Try JSON-LD metadata (most reliable for login-restricted content)
                                        document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
                                            try {
                                                const data = JSON.parse(script.textContent);
                                                // Video content in JSON-LD
                                                if(data.contentUrl && data.contentUrl.includes('.mp4')) {
                                                    media.push({url: data.contentUrl, type: 'video'});
                                                }
                                                // Image content in JSON-LD (direct)
                                                if(data.contentUrl && !data.contentUrl.includes('.mp4')) {
                                                    media.push({url: data.contentUrl, type: 'image'});
                                                }
                                                // Nested video content
                                                if(data.video && data.video.contentUrl) {
                                                    media.push({url: data.video.contentUrl, type: 'video'});
                                                }
                                                // Image arrays
                                                if(data.image) {
                                                    const images = Array.isArray(data.image) ? data.image : [data.image];
                                                    images.forEach(img => {
                                                        const imgUrl = typeof img === 'string' ? img : img.url;
                                                        if(imgUrl) media.push({url: imgUrl, type: 'image'});
                                                    });
                                                }
                                                // Thumbnails might be useful when real content is restricted
                                                if(data.thumbnailUrl) {
                                                    const thumbs = Array.isArray(data.thumbnailUrl) 
                                                        ? data.thumbnailUrl : [data.thumbnailUrl];
                                                    thumbs.forEach(thumb => {
                                                        if(thumb) media.push({url: thumb, type: 'image'});
                                                    });
                                                }
                                            } catch(e) {
                                                console.error('JSON-LD parse error:', e);
                                            }
                                        });
                                        
                                        // Try Open Graph metadata (works even with login walls)
                                        const ogVideo = document.querySelector('meta[property="og:video"]')?.content;
                                        const ogVideoUrl = document.querySelector('meta[property="og:video:url"]')?.content;
                                        const ogVideoSecureUrl = document.querySelector('meta[property="og:video:secure_url"]')?.content;
                                        
                                        // OG Video tags
                                        [ogVideo, ogVideoUrl, ogVideoSecureUrl].filter(Boolean).forEach(url => {
                                            media.push({url, type: 'video'});
                                        });
                                        
                                        // OG Image tags
                                        const ogImage = document.querySelector('meta[property="og:image"]')?.content;
                                        const ogImageUrl = document.querySelector('meta[property="og:image:url"]')?.content;
                                        const ogImageSecureUrl = document.querySelector('meta[property="og:image:secure_url"]')?.content;
                                        
                                        [ogImage, ogImageUrl, ogImageSecureUrl].filter(Boolean).forEach(url => {
                                            media.push({url, type: 'image'});
                                        });
                                        
                                        return media.filter((item, index, self) => {
                                            // Filter out duplicates
                                            return index === self.findIndex(t => t.url === item.url);
                                        });
                                    }
                                    return findMedia();
                                "#;
                                
                                match client.execute(alt_script, vec![]).await {
                                    Ok(alt_result) => {
                                        if let Some(arr) = alt_result.as_array() {
                                            let items = arr.iter().filter_map(|item| {
                                                if let Some(obj) = item.as_object() {
                                                    let url = obj.get("url")?.as_str()?.to_string();
                                                    let media_type = obj.get("type")?.as_str()?.to_string();
                                                    Some(MediaItem {
                                                        url,
                                                        media_type,
                                                        thumbnail_url: None,
                                                    })
                                                } else {
                                                    None
                                                }
                                            }).collect::<Vec<_>>();
                                            
                                            if !items.is_empty() {
                                                println!("✅ Alternate extraction successful: found {} items", items.len());
                                                debug_info.insert("alternate_extraction_success".to_string(), serde_json::Value::Bool(true));
                                                debug_info.insert("alternate_extracted_count".to_string(), 
                                                    serde_json::Value::Number(serde_json::Number::from(items.len())));
                                                media_items = Some(items);
                                            } else {
                                                error_message = Some("No media found in the page after retry".to_string());
                                                debug_info.insert("alternate_extraction_empty".to_string(), serde_json::Value::Bool(true));
                                                println!("No media found in the page after retry");
                                            }
                                        } else {
                                            error_message = Some("Invalid response format from alternate extraction".to_string());
                                            debug_info.insert("alternate_extraction_invalid_format".to_string(), serde_json::Value::Bool(true));
                                        }
                                    },
                                    Err(e) => {
                                        error_message = Some(format!("Failed to extract media on retry: {}", e));
                                        debug_info.insert("alternate_extraction_error".to_string(), serde_json::Value::String(e.to_string()));
                                        println!("Extraction error on retry: {}", e);
                                    }
                                }
                            }
                        },
                        Err(e) => {
                            error_message = Some(format!("Failed to extract media: {}", e));
                            debug_info.insert("extraction_error".to_string(), serde_json::Value::String(e.to_string()));
                            println!("Extraction error: {}", e);
                        }
                    }
                },
                Err(e) => {
                    error_message = Some(format!("Failed to navigate to URL: {}", e));
                    debug_info.insert("navigation_error".to_string(), serde_json::Value::String(e.to_string()));
                    println!("Navigation error: {}", e);
                }
            }
            
            // Always close the client when done
            let _ = client.close().await;
        },
        Err(e) => {
            error_message = Some(format!("Failed to create browser client: {}", e));
            debug_info.insert("browser_client_error".to_string(), serde_json::Value::String(e.to_string()));
            println!("Browser client error: {}", e);
        }
    }

    // After all other extraction attempts for reels fail:
    if content_type == "reel" && (media_items.is_none() || media_items.as_ref().unwrap().is_empty()) {
        // Fallback: use headless_chrome direct extraction
        let timestamp = Utc::now().timestamp();
        let folder_name = format!("insta_reel_preview_{}", timestamp);
        match extract_reel_video_with_headless_chrome(url, &folder_name).await {
            Ok(Some(video_path)) => {
                // Return the file path as a media item (the frontend should handle file serving or you can serve it via a proxy endpoint)
                let mut items = Vec::new();
                items.push(MediaItem {
                    url: video_path,
                    media_type: "video".to_string(),
                    thumbnail_url: None,
                });
                debug_info.insert("headless_chrome_fallback".to_string(), serde_json::Value::Bool(true));
                debug_info.insert("headless_chrome_video_found".to_string(), serde_json::Value::Bool(true));
                return PreviewResponse {
                    success: true,
                    content_type: Some(content_type.to_string()),
                    media_items: Some(items),
                    error: None,
                    debug_info: Some(debug_info),
                };
            },
            Ok(None) => {
                debug_info.insert("headless_chrome_fallback".to_string(), serde_json::Value::Bool(true));
                debug_info.insert("headless_chrome_video_found".to_string(), serde_json::Value::Bool(false));
            },
            Err(e) => {
                debug_info.insert("headless_chrome_fallback".to_string(), serde_json::Value::Bool(true));
                debug_info.insert("headless_chrome_error".to_string(), serde_json::Value::String(e.to_string()));
            }
        }
    }
    
    PreviewResponse {
        success: media_items.is_some(),
        content_type: Some(content_type.to_string()),
        media_items,
        error: error_message,
        debug_info: Some(debug_info),
    }
}

// Preview handler
async fn preview_handler(
    State(browser_state): State<Arc<Browser>>,
    Json(payload): Json<PreviewRequest>,
) -> impl IntoResponse {
    println!("Received preview request for URL: {}", payload.url);
    // Now use the browser option if provided
    let preview_result = extract_instagram_media(&payload.url, browser_state).await;
    
    (StatusCode::OK, Json(preview_result))
}

async fn media_proxy_handler(
    Query(params): Query<MediaProxyParams>,
) -> impl IntoResponse {
    let url = params.url;
    println!("Proxying media from URL: {}", url);
    
    // Process URL to get best quality - handle video/image cases
    let processed_url = if url.contains(".mp4") {
        // It's already a direct video URL
        url
    } else if url.contains("/v/") && !url.ends_with(".mp4") {
        // Instagram reel URL, ensure we get the video
        format!("{}/video/index.mp4", url.trim_end_matches('/'))
    } else if !url.contains(".jpg") && !url.contains(".mp4") {
        // URL without extension, try to get the video if it exists
        if url.contains("/reel/") {
            format!("{}/video/index.mp4", url.trim_end_matches('/'))
        } else {
            // Default to original URL if we can't determine type
            url
        }
    } else {
        // Return original URL for other cases
        url
    };
    println!("Processed URL for proxy: {}", processed_url);
    
    let download = params.download.unwrap_or(false);
    
    // Create a client with appropriate headers to access Instagram
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/96.0.4664.110 Mobile/15E148 Safari/604.1")
        .build()
        .unwrap();
    // Make the request
    match client.get(&processed_url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                // Get content type before consuming the response
                let content_type = response.headers()
                    .get(reqwest::header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("application/octet-stream")
                    .to_string();
                // Now get the bytes
                match response.bytes().await {
                    Ok(bytes) => {
                        // Determine content type based on URL extension or the header we saved earlier
                        let content_type = if processed_url.ends_with(".mp4") {
                            "video/mp4"
                        } else if processed_url.ends_with(".jpg") || processed_url.ends_with(".jpeg") {
                            "image/jpeg"
                        } else if processed_url.ends_with(".png") {
                            "image/png"
                        } else {
                            // Use the content type we extracted earlier
                            &content_type
                        };
                        let mut response_builder = Response::builder()
                            .header("Content-Type", content_type)
                            .status(StatusCode::OK);
                        // Add content disposition header for downloads
                        if download {
                            // Extract filename from URL or generate one
                            let filename = params.filename.unwrap_or_else(|| {
                                processed_url.split('/').last()
                                    .unwrap_or("instagram_media")
                                    .split('?').next()
                                    .unwrap_or("instagram_media")
                                    .to_string()
                            });
                            response_builder = response_builder.header(
                                "Content-Disposition",
                                format!("attachment; filename=\"{}\"", filename)
                            );
                        }
                        // Build and return the response
                        match response_builder.body(Body::from(bytes)) {
                            Ok(response) => response,
                            Err(_) => {
                                Response::builder()
                                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                                    .body(Body::from("Failed to create response"))
                                    .unwrap()
                            }
                        }
                    },
                    Err(e) => {
                        println!("Error fetching bytes: {}", e);
                        Response::builder()
                            .status(StatusCode::INTERNAL_SERVER_ERROR)
                            .body(Body::from(format!("Failed to fetch media bytes: {}", e)))
                            .unwrap()
                    }
                }
            } else {
                println!("Upstream server error: {}", response.status());
                Response::builder()
                    .status(StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY))
                    .body(Body::from(format!("Upstream server returned: {}", response.status())))
                    .unwrap()
            }
        },
        Err(e) => {
            println!("Request error: {}", e);
            Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .body(Body::from(format!("Error fetching from upstream server: {}", e)))
                .unwrap()
        }
    }
}

// Routes for this module
pub fn routes() -> Router<Arc<Browser>> {
    Router::new()
        .route("/api/download", axum_post(handle_download))
        .route("/api/preview", axum_post(preview_handler))
        .route("/api/media", axum_get(media_proxy_handler))
}

// Improved handler that intelligently routes to the correct extractor based on URL
async fn handle_download(payload: axum::extract::Json<serde_json::Value>) -> axum::extract::Json<String> {
    // Extract URL from the request
    let url = match payload.get("url").and_then(|v| v.as_str()) {
        Some(url) => url,
        None => return axum::extract::Json("❌ URL is required".to_string()),
    };

    // Get browser preference
    let browser = payload.get("browser")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
        
    // Get yt-dlp preference
    let use_ytdlp_first = payload.get("use_ytdlp_first")
        .and_then(|v| v.as_bool());

    // Create the appropriate request object
    match (is_story_url(url), is_reel_url(url)) {
        (true, _) => {
            // Story URL
            println!("🔍 Detected story URL: {}", url);
            let story_request = story::StoryDownloadRequest {
                url: url.to_string(),
                browser,
            };
            return story::download(axum::extract::Json(story_request)).await;
        }
        (_, true) => {
            // Reel URL
            println!("🎬 Detected reel URL: {}", url);
            let reel_request = reel::ReelDownloadRequest {
                url: url.to_string(),
                browser,
                use_ytdlp_first,
            };
            return reel::download(axum::extract::Json(reel_request)).await;
        }
        _ => {
            // Regular post URL
            println!("📸 Detected post URL: {}", url);
            let post_request = insta_post::PostDownloadRequest {
                url: url.to_string(),
                browser,
            };
            return insta_post::download(axum::extract::Json(post_request)).await;
        }
    }
}