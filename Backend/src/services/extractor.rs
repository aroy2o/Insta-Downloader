use fantoccini::{ClientBuilder, Client};
use serde_json::{Map, Value};
use crate::services::downloader::DownloadError;
use std::result::Result as StdResult;
use tokio::time::{sleep, Duration};
use tokio::task;
use rusqlite::{Connection};
use std::path::PathBuf;

type Result<T> = StdResult<T, DownloadError>;

// Default loading timeout in seconds
const LOAD_TIMEOUT: u64 = 8;
const MAX_EXTRACTION_RETRIES: usize = 2;

/// Extract Instagram cookies from the default Chrome profile on Linux
#[allow(dead_code)]
pub async fn get_instagram_cookies_from_chrome() -> Option<Vec<(String, String)>> {
    task::spawn_blocking(|| {
        let mut cookie_db = PathBuf::from(std::env::var("HOME").ok()?);
        cookie_db.push(".config/google-chrome/Default/Cookies");
        if !cookie_db.exists() {
            cookie_db = PathBuf::from(std::env::var("HOME").ok()?);
            cookie_db.push(".config/chromium/Default/Cookies");
            if !cookie_db.exists() {
                println!("❌ Chrome/Chromium cookie DB not found");
                return None;
            }
        }
        let conn = Connection::open(cookie_db).ok()?;
        let mut stmt = conn.prepare(
            "SELECT name, value FROM cookies WHERE host_key LIKE '%instagram.com'"
        ).ok()?;
        let cookies_iter = stmt
            .query_map([], |row| {
                let name: String = row.get(0)?;
                let value: String = row.get(1)?;
                Ok((name, value))
            })
            .ok()?;
        let mut cookies = Vec::new();
        for cookie in cookies_iter.flatten() {
            cookies.push(cookie);
        }
        if cookies.is_empty() {
            println!("❌ No Instagram cookies found in Chrome DB");
            None
        } else {
            Some(cookies)
        }
    }).await.map_err(|e| DownloadError(format!("JoinError: {}", e))).ok().flatten()
}

pub async fn create_browser_client(_browser: &str) -> Result<Client> {
    println!("🌐 Creating browser client...");
    
    // Set custom user agent to mimic a real mobile browser
    let mut capabilities = Map::new();
    let mut chrome_options = Map::new();
    
    // Add arguments for stealth mode
    let args = serde_json::json!([
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-infobars",
        "--window-position=0,0",
        "--ignore-certificate-errors",
        "--ignore-certificate-errors-spki-list",
        "--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/110.0.5481.177 Mobile/15E148 Safari/604.1",
        "--disable-blink-features=AutomationControlled",
        "--headless=new",
        "--disable-gpu",
        "--disable-extensions",
        "--mute-audio",
        "--hide-scrollbars"
    ]);
    
    chrome_options.insert("args".to_string(), args);
    
    // Add essential preferences to avoid detection
    let prefs = serde_json::json!({
        "profile.default_content_setting_values.notifications": 2,
        "credentials_enable_service": false,
        "profile.password_manager_enabled": false
    });
    chrome_options.insert("prefs".to_string(), prefs);
    
    // Add excludeSwitches to avoid detection
    let exclude_switches = serde_json::json!([
        "enable-automation",
        "enable-logging"
    ]);
    chrome_options.insert("excludeSwitches".to_string(), exclude_switches);
    
    capabilities.insert("goog:chromeOptions".to_string(), Value::Object(chrome_options));
    
    // Try multiple WebDriver URLs with different ports
    let webdriver_urls = [
        "http://localhost:9515",  // Default ChromeDriver port
        "http://localhost:4444",  // Selenium standalone port
        "http://127.0.0.1:9515",  // Alternative ChromeDriver
        "http://127.0.0.1:4444",  // Alternative Selenium
    ];
    
    let mut last_error = None;
    
    // Try each WebDriver URL until one works
    for &webdriver_url in &webdriver_urls {
        println!("🔌 Attempting to connect to WebDriver at: {}", webdriver_url);
        
        match ClientBuilder::native()
            .capabilities(capabilities.clone())
            .connect(webdriver_url)
            .await
        {
            Ok(client) => {
                println!("✅ Successfully connected to WebDriver at: {}", webdriver_url);
                
                // Execute JavaScript to help avoid detection
                let stealth_script = r#"
                    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                    if (!('ontouchstart' in window)) {
                        Object.defineProperty(navigator, 'maxTouchPoints', {get: () => 5});
                        window.ontouchstart = function(){};
                    }
                    if (navigator.userAgentData) {
                        Object.defineProperty(navigator.userAgentData, 'mobile', {get: () => true});
                    }
                "#;
                
                let _ = client.execute(stealth_script, vec![]).await;
                
                return Ok(client);
            },
            Err(e) => {
                println!("⚠️ Failed to connect to WebDriver at {}: {}", webdriver_url, e);
                last_error = Some(e);
            }
        }
    }
    
    // If we get here, all connection attempts failed
    let error_msg = format!(
        "Failed to connect to WebDriver. Please ensure ChromeDriver is running.\n\
        Last error: {}", 
        last_error.map(|e| e.to_string()).unwrap_or_else(|| "Unknown error".to_string())
    );
    
    println!("❌ {}", error_msg);
    Err(DownloadError(error_msg))
}

// Robust post media extraction with retries
pub async fn extract_post_media(client: &mut Client) -> Result<Vec<(String, String)>> {
    for attempt in 0..=MAX_EXTRACTION_RETRIES {
        let result = extract_post_media_once(client).await;
        match &result {
            Ok(items) if !items.is_empty() => return result,
            Ok(_) | Err(_) if attempt < MAX_EXTRACTION_RETRIES => {
                println!("🔁 Extraction attempt {} failed, retrying...", attempt + 1);
                sleep(Duration::from_secs(2)).await;
            }
            _ => return result,
        }
    }
    Err(DownloadError("All extraction attempts failed".to_string()))
}

// The original extraction logic, now private
async fn extract_post_media_once(client: &mut Client) -> Result<Vec<(String, String)>> {
    // --- Try Reels first: only use direct video.src if not blob and not empty ---
    let reel_script = r#"
        let debug = { elements: {}, errors: [] };
        try {
            debug.elements.video = document.querySelector('video') ? true : false;
            let video = document.querySelector('video');
            if (video) {
                debug.elements.videoSrc = video.src || 'none';
                debug.elements.videoHasBlob = video.src?.startsWith('blob:') || false;
                if (video && video.src && !video.src.startsWith('blob:') && video.src.match(/\.mp4($|\?)/)) {
                    return { media: [{ url: video.src, type: 'video' }], debug };
                }
            }
            
            debug.elements.videoSource = document.querySelector('video > source') ? true : false;
            let source = document.querySelector('video > source');
            if (source) {
                debug.elements.sourceSrc = source.src || 'none';
                debug.elements.sourceHasBlob = source.src?.startsWith('blob:') || false;
                if (source && source.src && !source.src.startsWith('blob:') && source.src.match(/\.mp4($|\?)/)) {
                    return { media: [{ url: source.src, type: 'video' }], debug };
                }
            }
            
            // Additional data points for debugging
            debug.elements.hasArticle = document.querySelector('article') ? true : false;
            debug.elements.hasImage = document.querySelector('img') ? true : false;
            debug.elements.hasSrcset = document.querySelector('img[srcset]') ? true : false;
        } catch (e) {
            debug.errors.push('Error in reel extraction: ' + e.toString());
        }
        
        return { media: [], debug };
    "#;

    // Execute the enhanced script
    let reel_result = client
        .execute(reel_script, vec![])
        .await
        .map_err(|e| DownloadError(format!("Failed to execute reel script: {}", e)))?;

    // Process the result with debug info
    if let Some(result_obj) = reel_result.as_object() {
        // Extract debug info for logging
        if let Some(debug) = result_obj.get("debug") {
            println!("🔍 Debug info: {}", serde_json::to_string_pretty(debug).unwrap_or_default());
        }
        
        // Process media items if available
        if let Some(media_arr) = result_obj.get("media").and_then(|m| m.as_array()) {
            let items = media_arr.iter().filter_map(|item| {
                if let Some(obj) = item.as_object() {
                    let url = obj.get("url")?.as_str()?;
                    let media_type = obj.get("type")?.as_str()?;
                    if !url.is_empty() && !url.starts_with("blob:") && url.ends_with(".mp4") {
                        return Some((url.to_string(), media_type.to_string()));
                    }
                }
                None
            }).collect::<Vec<_>>();

            if !items.is_empty() {
                println!("✅ Reel video found");
                return Ok(items);
            }
        }
    }

    // --- Post + Carousel Fallback ---
    println!("ℹ️ No reel video. Trying post + carousel logic...");

    // Similarly enhance the post script for better debugging
    let post_script = r#"
        const media = [];
        const debug = { elements: {}, errors: [] };

        function push(url, type) {
            if (url && !url.startsWith("blob:") && !media.some(m => m.url === url)) {
                media.push({ url, type });
            }
        }

        try {
            const article = document.querySelector('article');
            debug.elements.hasArticle = !!article;
            if (!article) return { media, debug };

            debug.elements.videoCount = article.querySelectorAll('video').length;
            article.querySelectorAll('video').forEach((v, i) => {
                debug.elements[`video_${i}_src`] = v.src || 'none';
                push(v.src, 'video');
            });

            debug.elements.imgCount = article.querySelectorAll('img[srcset], img').length;
            article.querySelectorAll('img[srcset], img').forEach((img, i) => {
                const src = img.src;
                const srcset = img.srcset;
                const alt = img.alt || "";
                debug.elements[`img_${i}_hasSrcset`] = !!srcset;
                
                if (src && !src.startsWith("data:") &&
                    (alt.toLowerCase().includes("photo") || img.width > 150)) {

                    if (srcset) {
                        // Original srcset processing logic...
                        const sets = srcset.split(',').map(s => s.trim());
                        let highestQuality = '';
                        let highestWidth = 0;
                        
                        sets.forEach(set => {
                            const parts = set.split(' ');
                            if (parts.length >= 2) {
                                const url = parts[0];
                                const width = parseInt(parts[1].replace('w', ''));
                                if (width > highestWidth) {
                                    highestWidth = width;
                                    highestQuality = url;
                                }
                            }
                        });
                        
                        if (highestQuality) {
                            push(highestQuality, 'image');
                        } else {
                            // Fallback to previous method
                            const best = sets[sets.length - 1];
                            const url = best.split(' ')[0];
                            push(url, 'image');
                        }
                    } else {
                        push(src, 'image');
                    }
                }
            });

            // Try advanced media extraction techniques
            // Look for JSON-LD data
            try {
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                debug.elements.jsonLdScripts = scripts.length;
                
                scripts.forEach((script, idx) => {
                    try {
                        const data = JSON.parse(script.textContent);
                        debug.elements[`jsonLd_${idx}_type`] = data["@type"] || 'unknown';
                        
                        if (data.contentUrl) {
                            push(data.contentUrl, data.contentUrl.includes('.mp4') ? 'video' : 'image');
                        }
                        
                        if (data.video && data.video.contentUrl) {
                            push(data.video.contentUrl, 'video');
                        }
                        
                        // Handle image array
                        if (data.image && Array.isArray(data.image)) {
                            data.image.forEach(img => {
                                if (typeof img === 'string') {
                                    push(img, 'image');
                                } else if (img.url) {
                                    push(img.url, 'image');
                                }
                            });
                        }
                    } catch (parseErr) {
                        debug.errors.push(`Error parsing JSON-LD ${idx}: ${parseErr.toString()}`);
                    }
                });
            } catch (jsonErr) {
                debug.errors.push(`JSON-LD extraction error: ${jsonErr.toString()}`);
            }
            
            // Check Open Graph meta tags
            try {
                const ogImage = document.querySelector('meta[property="og:image"]')?.content;
                const ogVideo = document.querySelector('meta[property="og:video"]')?.content;
                debug.elements.hasOgImage = !!ogImage;
                debug.elements.hasOgVideo = !!ogVideo;
                
                if (ogImage) push(ogImage, 'image');
                if (ogVideo) push(ogVideo, 'video');
            } catch (ogErr) {
                debug.errors.push(`OG tag extraction error: ${ogErr.toString()}`);
            }

            // Check for carousel
            const carouselDots = article.querySelectorAll('div[role="button"] > div > div > div');
            const isCarousel = carouselDots.length > 1;
            debug.elements.isCarousel = isCarousel;
            debug.elements.carouselDots = carouselDots.length;

            if (isCarousel) {
                // Existing carousel logic...
                const nextButton = Array.from(article.querySelectorAll('button'))
                    .find(btn => btn.querySelector('svg[aria-label="Next"]'));

                debug.elements.hasNextButton = !!nextButton;
                
                if (nextButton) {
                    const totalSlides = carouselDots.length;
                    debug.elements.totalSlides = totalSlides;
                    
                    for (let i = 1; i < totalSlides; i++) {
                        try {
                            nextButton.click();
                            await new Promise(r => setTimeout(r, 500));
                            
                            // Process videos and images for each slide
                            // (Similar to above but for carousel slides)
                            article.querySelectorAll('video').forEach(v => push(v.src, 'video'));
                            article.querySelectorAll('img[srcset], img').forEach(img => {
                                const src = img.src;
                                const srcset = img.srcset;
                                const alt = img.alt || "";

                                if (src && !src.startsWith("data:") &&
                                    (alt.toLowerCase().includes("photo") || img.width > 150)) {

                                    if (srcset) {
                                        const sets = srcset.split(',').map(s => s.trim());
                                        let highestQuality = '';
                                        let highestWidth = 0;
                                        
                                        sets.forEach(set => {
                                            const parts = set.split(' ');
                                            if (parts.length >= 2) {
                                                const url = parts[0];
                                                const width = parseInt(parts[1].replace('w', ''));
                                                if (width > highestWidth) {
                                                    highestWidth = width;
                                                    highestQuality = url;
                                                }
                                            }
                                        });
                                        
                                        if (highestQuality) {
                                            push(highestQuality, 'image');
                                        } else {
                                            // Fallback to previous method
                                            const best = sets[sets.length - 1];
                                            const url = best.split(' ')[0];
                                            push(url, 'image');
                                        }
                                    } else {
                                        push(src, 'image');
                                    }
                                }
                            });
                        } catch (slideErr) {
                            debug.errors.push(`Error processing slide ${i}: ${slideErr.toString()}`);
                        }
                    }
                }
            }
        } catch (e) {
            debug.errors.push(`Main extraction failed: ${e.toString()}`);
        }

        return { media, debug };
    "#;

    let post_result = client
        .execute(post_script, vec![])
        .await
        .map_err(|e| DownloadError(format!("Failed to execute post script: {}", e)))?;

    // Process post results with debug info
    let media_array = if let Some(result_obj) = post_result.as_object() {
        // Extract and log debug info
        if let Some(debug) = result_obj.get("debug") {
            println!("📝 Post extraction debug: {}", serde_json::to_string_pretty(debug).unwrap_or_default());
        }
        
        // Process media items
        if let Some(media_arr) = result_obj.get("media").and_then(|m| m.as_array()) {
            media_arr.iter().filter_map(|item| {
                if let Some(obj) = item.as_object() {
                    let url = obj.get("url")?.as_str()?;
                    let media_type = obj.get("type")?.as_str()?;
                    if !url.is_empty() && !url.starts_with("blob:") {
                        // Return both videos and images for posts
                        return Some((url.to_string(), media_type.to_string()));
                    }
                }
                None
            }).collect::<Vec<_>>()
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    if media_array.is_empty() {
        println!("⚠️ No media found after all extraction attempts");
    } else {
        println!("✅ Found {} media items", media_array.len());
    }

    Ok(media_array)
}

// Robust story extraction with retries
pub async fn extract_stories(client: &mut Client) -> Result<Vec<(String, String)>> {
    for attempt in 0..=MAX_EXTRACTION_RETRIES {
        let result = extract_stories_once(client).await;
        match &result {
            Ok(items) if !items.is_empty() => return result,
            Ok(_) | Err(_) if attempt < MAX_EXTRACTION_RETRIES => {
                println!("🔁 Story extraction attempt {} failed, retrying...", attempt + 1);
                sleep(Duration::from_secs(2)).await;
            }
            _ => return result,
        }
    }
    Err(DownloadError("All story extraction attempts failed".to_string()))
}

// The original story extraction logic, now private
async fn extract_stories_once(client: &mut Client) -> Result<Vec<(String, String)>> {
    println!("🔍 Extracting stories...");
    
    // Wait for stories to load
    sleep(Duration::from_secs(LOAD_TIMEOUT)).await;
    
    // Story extraction script similar to fullcode.rs
    let extract_script = r#"
        function extractCurrentStory() {
            // Try to find video first
            let video = document.querySelector('video[src]');
            if (video && video.src && !video.src.startsWith('blob:')) {
                return { url: video.src, type: 'video' };
            }
            
            // Then look for image
            let img = document.querySelector('img[srcset]');
            if (img && img.srcset) {
                // Try to get highest quality from srcset
                const sets = img.srcset.split(',').map(s => s.trim());
                let highestQuality = '';
                let highestWidth = 0;
                
                sets.forEach(set => {
                    const parts = set.split(' ');
                    if (parts.length >= 2) {
                        const url = parts[0];
                        const width = parseInt(parts[1].replace('w', ''));
                        if (width > highestWidth) {
                            highestWidth = width;
                            highestQuality = url;
                        }
                    }
                });
                
                if (highestQuality) {
                    return { url: highestQuality, type: 'image' };
                }
            }
            
            // Fallback to basic image
            img = document.querySelector('img[src]');
            if (img && img.src && !img.src.startsWith("data:")) {
                return { url: img.src, type: 'image' };
            }
            
            return null;
        }
        
        return extractCurrentStory();
    "#;

    // First try to get the current story
    let story_data = client.execute(extract_script, vec![])
        .await
        .map_err(|e| DownloadError(format!("Failed to execute story script: {}", e)))?;
    
    let mut result = Vec::new();
    
    if let Some(obj) = story_data.as_object() {
        if let (Some(url), Some(media_type)) = (obj.get("url").and_then(|u| u.as_str()), 
                                               obj.get("type").and_then(|t| t.as_str())) {
            if !url.is_empty() && !url.starts_with("blob:") {
                result.push((url.to_string(), media_type.to_string()));
            }
        }
    }

    // Check if we have a next story button
    let next_story_script = r#"
        const nextButton = document.querySelector('button[aria-label="Next"]');
        if (nextButton) {
            nextButton.click();
            return true;
        }
        return false;
    "#;

    // Try to extract up to 20 stories to avoid infinite loop
    let max_stories = 20;
    let mut story_count = 1;
    
    // If the first story was found, try to find more
    if !result.is_empty() {
        while story_count < max_stories {
            // Try to navigate to next story
            sleep(Duration::from_millis(1000)).await;
            
            let next_result = client.execute(next_story_script, vec![])
                .await
                .map_err(|e| DownloadError(format!("Failed to execute next story script: {}", e)))?;
                
            let has_more = next_result.as_bool().unwrap_or(false);
            
            if !has_more {
                break;
            }
            
            // Wait for next story to load
            sleep(Duration::from_millis(1500)).await;
            
            // Extract current story media
            let story_data = client.execute(extract_script, vec![])
                .await
                .map_err(|e| DownloadError(format!("Failed to execute story script: {}", e)))?;
            
            if let Some(obj) = story_data.as_object() {
                if let (Some(url), Some(media_type)) = (obj.get("url").and_then(|u| u.as_str()), 
                                                       obj.get("type").and_then(|t| t.as_str())) {
                    if !url.is_empty() && !url.starts_with("blob:") {
                        story_count += 1;
                        result.push((url.to_string(), media_type.to_string()));
                    }
                }
            }
        }
    }

    if !result.is_empty() {
        println!("✅ Found {} stories", result.len());
    } else {
        println!("❌ No stories found");
    }
    
    Ok(result)
}

// --- New: Robust video extraction using headless_chrome network interception ---
pub async fn extract_reel_video_with_headless_chrome(
    url: &str,
    folder_name: &str,
) -> StdResult<Option<String>, DownloadError> {
    use headless_chrome::{Browser, LaunchOptionsBuilder};
    use headless_chrome::protocol::cdp::Page::CaptureScreenshotFormatOption;
    use std::sync::{Arc, Mutex};
    use std::time::Duration;
    
    // Clone string references to own the data before moving to other thread
    let url = url.to_string();
    let folder_name = folder_name.to_string();
    
    // Updated implementation with proper API usage
    let video_urls = Arc::new(Mutex::new(Vec::<String>::new()));
    
    let launch_options = LaunchOptionsBuilder::default()
        .headless(true)
        .window_size(Some((1280, 800)))
        .build()
        .map_err(|e| DownloadError(format!("Failed to build launch options: {}", e)))?;
    
    let browser = Browser::new(launch_options)
        .map_err(|e| DownloadError(format!("Failed to launch headless Chrome: {}", e)))?;

    // Create a new tab
    let tab = browser.new_tab()
        .map_err(|e| DownloadError(format!("Failed to create Chrome tab: {}", e)))?;
    
    // Define struct to return from blocking task to avoid type mismatches
    #[derive(Debug)]
    struct BlockingResult {
        video_path: Option<String>,
        screenshot_data: Option<(String, Vec<u8>)>,
    }
    
    let result = task::spawn_blocking(move || {
        // Prefix with underscore to fix the unused variable warning
        let _video_urls_clone = video_urls.clone();
        
        // Use DevTools Protocol directly to intercept network requests
        // This is a workaround for the private RequestIntercept type
        tab.navigate_to(&url) // Use &url since we now own url
            .map_err(|e| DownloadError(format!("Failed to navigate: {}", e)))?;
        tab.wait_until_navigated()
            .map_err(|e| DownloadError(format!("Failed to wait for navigation: {}", e)))?;
        
        // Wait for network requests and check for video URLs in the page's elements
        std::thread::sleep(Duration::from_secs(3));
        
        // Try to find video URLs using JavaScript execution instead
        let video_js_result = tab.evaluate(r#"
            function getVideoLinks() {
                const links = [];
                // Check video elements
                document.querySelectorAll('video').forEach(video => {
                    if (video.src && !video.src.startsWith('blob:'))
                        links.push(video.src);
                    
                    // Check source elements inside video tags
                    video.querySelectorAll('source').forEach(source => {
                        if (source.src && !source.src.startsWith('blob:'))
                            links.push(source.src);
                    });
                });
                
                // Look for mp4 links in JSON-LD script tags
                try {
                    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
                        const json = JSON.parse(script.textContent);
                        if (json.contentUrl && json.contentUrl.includes('.mp4'))
                            links.push(json.contentUrl);
                        if (json.video && json.video.contentUrl && json.video.contentUrl.includes('.mp4'))
                            links.push(json.video.contentUrl);
                    });
                } catch (e) {
                    console.error('Error parsing JSON-LD:', e);
                }
                
                // Look for Open Graph meta tags
                const ogVideoTag = document.querySelector('meta[property="og:video"]');
                if (ogVideoTag && ogVideoTag.content)
                    links.push(ogVideoTag.content);
                    
                return links.filter(url => url.includes('.mp4'));
            }
            getVideoLinks();
        "#, false)
            .map_err(|e| DownloadError(format!("Failed to execute JavaScript: {}", e)))?;
        
        let mut found_videos = Vec::new();
        let mut result = BlockingResult {
            video_path: None,
            screenshot_data: None,
        };
        
        // Fixed: Handle the value property correctly
        if let Some(value) = &video_js_result.value {
            if let Some(arr) = value.as_array() {
                for item in arr {
                    if let Some(url_str) = item.as_str() {
                        found_videos.push(url_str.to_string());
                    }
                }
            }
        }
        
        // If we found any videos, use the first one
        if !found_videos.is_empty() {
            let video_url = &found_videos[0];
            let filename = format!("{}/reel_video.mp4", folder_name); // folder_name is now owned
            
            match reqwest::blocking::get(video_url) {
                Ok(resp) => {
                    match resp.bytes() {
                        Ok(bytes) => {
                            // Write video file
                            if let Err(e) = std::fs::write(&filename, &bytes) {
                                println!("Failed to write video file: {}", e);
                            } else if bytes.len() > 200_000 {
                                result.video_path = Some(filename);
                            } else {
                                // File is too small, likely not a valid video
                                let _ = std::fs::remove_file(&filename);
                            }
                        }
                        Err(e) => println!("Failed to read video bytes: {}", e),
                    }
                }
                Err(e) => println!("Failed to GET video: {}", e),
            }
        }
        
        // Always capture a screenshot for debugging, even if we found a video
        let screenshot_path = format!("{}/debug_screenshot.png", folder_name); // folder_name is now owned
        if let Ok(data) = tab.capture_screenshot(
            CaptureScreenshotFormatOption::Png, 
            None, 
            None, 
            true
        ) {
            result.screenshot_data = Some((screenshot_path, data));
        }
        
        Ok(result)
    }).await.map_err(|e| DownloadError(format!("JoinError: {}", e)))?;
    
    // Handle screenshot if available
    let blocking_result = result?; // Unwrap the Result to get BlockingResult
    
    if let Some((path, data)) = blocking_result.screenshot_data {
        // Write screenshot in a separate blocking task
        let screenshot_path = path.clone();
        let _ = task::spawn_blocking(move || std::fs::write(&path, &data))
            .await
            .map_err(|e| println!("Failed to write screenshot: {}", e));
        println!("📸 Saved debug screenshot to {}", screenshot_path);
    }
    
    // Return video path if found
    Ok(blocking_result.video_path)
}

// Function to extract media from metadata (Open Graph, JSON-LD) when direct extraction fails
pub async fn extract_media_from_metadata(client: &mut Client) -> Result<Vec<(String, String)>> {
    println!("🧩 Trying metadata extraction for login-protected content...");
    
    // Execute script to extract data from meta tags and JSON-LD
    let metadata_script = r#"
        function extractMetadata() {
            const media = [];
            const debug = { elements: {}, errors: [] };
            
            try {
                // 1. Check Open Graph meta tags (these are often available even when login is required)
                const ogImage = document.querySelector('meta[property="og:image"]')?.content;
                const ogVideo = document.querySelector('meta[property="og:video"]')?.content;
                const ogVideoUrl = document.querySelector('meta[property="og:video:url"]')?.content;
                const ogVideoSecureUrl = document.querySelector('meta[property="og:video:secure_url"]')?.content;
                
                debug.elements.hasOgImage = !!ogImage;
                debug.elements.hasOgVideo = !!ogVideo;
                debug.elements.hasOgVideoUrl = !!ogVideoUrl;
                debug.elements.hasOgVideoSecureUrl = !!ogVideoSecureUrl;
                
                // Process video URLs
                [ogVideo, ogVideoUrl, ogVideoSecureUrl].filter(Boolean).forEach(url => {
                    if (url && !url.startsWith("blob:") && !media.some(m => m.url === url)) {
                        media.push({ url, type: 'video' });
                    }
                });
                
                // Process image URLs
                if (ogImage && !media.some(m => m.url === ogImage)) {
                    media.push({ url, type: 'image' });
                }
                
                // 2. Check JSON-LD data (often contains high-quality media references)
                const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
                debug.elements.jsonLdScriptCount = jsonLdScripts.length;
                
                jsonLdScripts.forEach((script, index) => {
                    try {
                        const data = JSON.parse(script.textContent);
                        debug.elements[`jsonLd_${index}_type`] = data["@type"] || 'unknown';
                        
                        // Check for video content URL
                        if (data.contentUrl && data.contentUrl.includes('.mp4')) {
                            const url = data.contentUrl;
                            if (!media.some(m => m.url === url)) {
                                media.push({ url, type: 'video' });
                            }
                        }
                        
                        // Check for nested video content
                        if (data.video && data.video.contentUrl) {
                            const url = data.video.contentUrl;
                            if (!media.some(m => m.url === url)) {
                                media.push({ url, type: 'video' });
                            }
                        }
                        
                        // Process image arrays or single images
                        if (data.image) {
                            const images = Array.isArray(data.image) ? data.image : [data.image];
                            images.forEach(img => {
                                const url = typeof img === 'string' ? img : (img.url || null);
                                if (url && !media.some(m => m.url === url)) {
                                    media.push({ url, type: 'image' });
                                }
                            });
                        }
                        
                        // Try to get thumbnails as a last resort
                        if (data.thumbnailUrl) {
                            const thumbs = Array.isArray(data.thumbnailUrl) ? data.thumbnailUrl : [data.thumbnailUrl];
                            thumbs.forEach(url => {
                                if (url && !media.some(m => m.url === url)) {
                                    media.push({ url, type: 'image' });
                                }
                            });
                        }
                    } catch (e) {
                        debug.errors.push(`Error parsing JSON-LD ${index}: ${e.toString()}`);
                    }
                });
                
                // 3. Check if there are any images with data-src attributes (sometimes Instagram uses these)
                const dataSrcImages = document.querySelectorAll('img[data-src]');
                debug.elements.dataSrcImageCount = dataSrcImages.length;
                
                dataSrcImages.forEach((img, index) => {
                    const url = img.getAttribute('data-src');
                    if (url && !url.startsWith("data:") && !media.some(m => m.url === url)) {
                        media.push({ url, type: 'image' });
                    }
                });
                
                // 4. For reels specifically, try to find preload links that might contain video URLs
                const preloadLinks = document.querySelectorAll('link[rel="preload"][as="video"]');
                debug.elements.preloadLinkCount = preloadLinks.length;
                
                preloadLinks.forEach((link, index) => {
                    const url = link.href;
                    if (url && !url.startsWith("blob:") && !media.some(m => m.url === url)) {
                        media.push({ url, type: 'video' });
                    }
                });
            } catch (e) {
                debug.errors.push(`Main extraction error: ${e.toString()}`);
            }
            
            return { media, debug };
        }
        
        return extractMetadata();
    "#;
    
    let result = client
        .execute(metadata_script, vec![])
        .await
        .map_err(|e| DownloadError(format!("Failed to execute metadata extraction script: {}", e)))?;
        
    // Process the result
    if let Some(result_obj) = result.as_object() {
        // Log debug info
        if let Some(debug) = result_obj.get("debug") {
            println!("🔍 Metadata extraction debug: {}", serde_json::to_string_pretty(debug).unwrap_or_default());
        }
        
        // Extract media items
        if let Some(media_arr) = result_obj.get("media").and_then(|m| m.as_array()) {
            // Only return the first video if this is a reel extraction
            let mut videos = media_arr.iter().filter_map(|item| {
                if let Some(obj) = item.as_object() {
                    let url = obj.get("url")?.as_str()?;
                    let media_type = obj.get("type")?.as_str()?;
                    if !url.is_empty() && !url.starts_with("blob:") && media_type == "video" && url.ends_with(".mp4") {
                        return Some((url.to_string(), media_type.to_string()));
                    }
                }
                None
            });
            if let Some(first_video) = videos.next() {
                println!("✅ Found reel video through metadata extraction");
                return Ok(vec![first_video]);
            }
            // Otherwise, fallback to all images (for non-reel cases)
            let items = media_arr.iter().filter_map(|item| {
                if let Some(obj) = item.as_object() {
                    let url = obj.get("url")?.as_str()?;
                    let media_type = obj.get("type")?.as_str()?;
                    if !url.is_empty() && !url.starts_with("blob:") {
                        return Some((url.to_string(), media_type.to_string()));
                    }
                }
                None
            }).collect::<Vec<_>>();
            if !items.is_empty() {
                println!("✅ Found {} media items through metadata extraction", items.len());
                return Ok(items);
            }
        }
    }
    
    println!("❌ No media found in metadata");
    Ok(Vec::new())
}

// Helper function to check if a URL is a story URL
pub fn is_story_url(url: &str) -> bool {
    url.contains("/stories/")
}

// Helper function to check if a URL is a reel URL
pub fn is_reel_url(url: &str) -> bool {
    url.contains("/reel/")
}
