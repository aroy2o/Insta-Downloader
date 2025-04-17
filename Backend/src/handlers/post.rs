use axum::{Json, extract::Json as ExtractJson};
use chrono::Utc;
use serde::Deserialize;
use std::{fs::create_dir_all, sync::Arc};
use tokio::task;
use tokio::time::sleep;
use futures::future::join_all;
use crate::services::{
    extractor::{create_browser_client, extract_post_media},
    downloader::{download_media_with_retry, download_with_ytdlp},
};
use reqwest::Client;

#[derive(Deserialize)]
pub struct PostDownloadRequest {
    pub url: String,
    pub browser: Option<String>,
}

pub async fn download(Json(payload): ExtractJson<PostDownloadRequest>) -> Json<String> {
    let url = payload.url;
    let browser = payload.browser.unwrap_or_else(|| "chrome".to_string());
    let timestamp = Utc::now().timestamp();
    let folder_name = format!("insta_post_{}", timestamp);

    // Handle directory creation errors
    if let Err(e) = create_dir_all(&folder_name) {
        return Json(format!("Failed to create folder '{}': {}", folder_name, e));
    }

    // Connect to browser and go to post URL
    let mut client = match create_browser_client(&browser).await {
        Ok(client) => client,
        Err(e) => {
            if let Err(e) = download_with_ytdlp(&url, Some(&folder_name), Some(&browser), false).await {
                // Use {:?} for debug formatting of the error
                return Json(format!("yt-dlp fallback failed: {:?}", e));
            }
            // Use {:?} for debug formatting of the error
            return Json(format!("Browser error. Fallback to yt-dlp. Info: {:?}", e));
        }
    };

    if let Err(e) = client.goto(&url).await {
        return Json(format!("Failed to navigate to Instagram post: {}", e));
    }

    sleep(std::time::Duration::from_secs(8)).await;

    // Build reqwest client
    let reqwest_client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap();

    let media_items = match extract_post_media(&mut client).await { // Pass mutable reference
        Ok(m) if !m.is_empty() => m,
        Ok(_) => {
            let _ = download_with_ytdlp(&url, Some(&folder_name), Some(&browser), false).await;
            return Json("No valid media found, fallback to yt-dlp executed.".to_string());
        },
        Err(e) => {
            return Json(format!("Failed to extract media: {}", e));
        }
    };

    let semaphore = Arc::new(tokio::sync::Semaphore::new(10));
    let mut download_tasks = Vec::new();

    // Use into_iter() to take ownership of the Strings, allowing them to be moved into the async block.
    for (i, (url, media_type)) in media_items.clone().into_iter().enumerate() {
        let semaphore_clone = semaphore.clone(); // Clone semaphore
        let reqwest_client = reqwest_client.clone();
        let filename = format!("{}/media_{}.{}", &folder_name, i + 1, if media_type == "video" { "mp4" } else { "jpg" });

        let task = task::spawn(async move {
            let permit = semaphore_clone.acquire().await.unwrap(); // Acquire permit inside async block
            let _permit = permit; // Ensure permit is held for the duration of the task
            match download_media_with_retry(&reqwest_client, &url, &filename).await {
                Ok(_) => Ok((filename, "Download success".to_string())),
                Err(e) => Err((filename, format!("Download failed: {:?}", e))),
            }
        });

        download_tasks.push(task);
    }

    let results = join_all(download_tasks).await;
    let success_count = results.iter().filter(|res| match res {
        Ok(Ok((_, _))) => true, // Match Ok(Ok(...)) for successful task and successful download
        _ => false,
    }).count();

    if success_count == 0 {
        let _ = download_with_ytdlp(&url, Some(&folder_name), Some(&browser), false).await;
        return Json("All downloads failed. yt-dlp fallback executed.".to_string());
    }

    Json(format!(
        "✅ Downloaded {}/{} media items successfully to '{}'",
        success_count,
        media_items.len(),
        folder_name
    ))
}
