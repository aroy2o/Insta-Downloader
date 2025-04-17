use axum::extract::Json;
use serde::{Deserialize};
use chrono::Utc;
use std::fs::{create_dir_all, File};
use std::io::Write;
use reqwest::Client;
use crate::services::downloader::{download_media_with_retry, download_with_ytdlp};
use crate::services::extractor::{create_browser_client, extract_stories};
use futures::future::join_all;
use tokio::sync::Semaphore;
use std::sync::Arc;

#[derive(Deserialize)]
pub struct StoryDownloadRequest {
    pub url: String,
    pub browser: Option<String>,
}

pub async fn download(Json(request): Json<StoryDownloadRequest>) -> Json<String> {
    let url = request.url;
    let browser = request.browser.unwrap_or_else(|| "chrome".to_string());
    let timestamp = Utc::now().timestamp();
    let folder_name = format!("insta_stories_{}", timestamp);

    if let Err(e) = create_dir_all(&folder_name) {
        return Json(format!("❌ Failed to create folder: {}", e));
    }

    let username = url.split("/stories/")
        .nth(1)
        .and_then(|s| s.split('/').next())
        .unwrap_or("unknown");

    // Always try yt-dlp first for best reliability and speed
    println!("🔍 Attempting to download stories with yt-dlp first...");
    match download_with_ytdlp(&url, Some(&folder_name), Some(&browser), true).await {
        Ok(_) => {
            if let Ok(entries) = std::fs::read_dir(&folder_name) {
                let story_count = entries
                    .filter(|entry| {
                        if let Ok(entry) = entry {
                            if let Some(name) = entry.file_name().to_str() {
                                return name.starts_with("story_");
                            }
                        }
                        false
                    })
                    .count();
                if story_count > 0 {
                    if let Ok(mut file) = File::create(format!("{}/metadata.txt", folder_name)) {
                        let _ = writeln!(file, "Downloaded from: {}", url);
                        let _ = writeln!(file, "User: {}", username);
                        let _ = writeln!(file, "Stories downloaded: {}", story_count);
                        let _ = writeln!(file, "Downloaded at: {}", chrono::Local::now());
                    }
                    return Json(format!("✅ Downloaded {} stories with yt-dlp. Saved to '{}'", story_count, folder_name));
                }
            }
            println!("⚠️ yt-dlp didn't download any stories. Trying browser extraction...");
        }
        Err(_) => {
            println!("⚠️ yt-dlp failed. Trying browser extraction...");
        }
    }

    // Fallback: browser-based extraction if yt-dlp fails
    let mut client = match create_browser_client(&browser).await {
        Ok(c) => c,
        Err(e) => {
            return Json(format!("❌ Failed to connect to browser: {}", e));
        }
    };

    if let Err(e) = client.goto(&url).await {
        return Json(format!("❌ Failed to navigate to URL: {}", e));
    }

    let stories = match extract_stories(&mut client).await {
        Ok(media_items) => media_items,
        Err(e) => {
            return Json(format!("❌ Failed to extract stories: {}", e));
        }
    };
    let _ = client.close().await;

    if stories.is_empty() {
        return Json(format!("❌ No stories found at URL: {}", url));
    }

    println!("✅ Found {} story items to download", stories.len());
    let reqwest_client = match Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .build() {
        Ok(client) => client,
        Err(e) => return Json(format!("❌ Failed to create HTTP client: {}", e))
    };

    let semaphore = Arc::new(Semaphore::new(8)); // Increased concurrency for speed
    let mut download_tasks = Vec::new();
    for (i, (media_url, media_type)) in stories.iter().enumerate() {
        let extension = if media_type == "video" { "mp4" } else { "jpg" };
        let filename = format!("{}/story_{:03}.{}", folder_name, i + 1, extension);
        let permit = Arc::clone(&semaphore).acquire_owned().await.unwrap();
        let reqwest_client = reqwest_client.clone();
        let media_url = media_url.clone();
        let task = tokio::spawn(async move {
            let result = download_media_with_retry(&reqwest_client, &media_url, &filename).await;
            drop(permit);
            (filename, result)
        });
        download_tasks.push(task);
    }
    let results = join_all(download_tasks).await;
    let mut success_count = 0;
    for result in results {
        match result {
            Ok((filename, Ok(_))) => {
                println!("⬇️ Downloaded: {}", filename);
                success_count += 1;
            },
            Ok((filename, Err(e))) => {
                println!("❌ Failed to download {}: {}", filename, e);
            },
            Err(e) => {
                println!("❌ Download task failed: {}", e);
            }
        }
    }
    if let Ok(mut file) = File::create(format!("{}/metadata.txt", folder_name)) {
        let _ = writeln!(file, "Downloaded from: {}", url);
        let _ = writeln!(file, "User: {}", username);
        let _ = writeln!(file, "Stories found: {}", stories.len());
        let _ = writeln!(file, "Stories successfully downloaded: {}", success_count);
        let _ = writeln!(file, "Downloaded at: {}", chrono::Local::now());
    }
    if success_count > 0 {
        Json(format!("✅ Downloaded {}/{} stories. Saved to '{}'", success_count, stories.len(), folder_name))
    } else {
        Json(format!("❌ Failed to download any stories. Check logs for details."))
    }
}
