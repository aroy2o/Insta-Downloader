use std::fs::{self, File};
use std::io::copy;
use std::path::Path;
use std::process::Command;
use std::time::Duration;
use reqwest::Client;
use tokio::time::sleep;
use tracing::{info, warn, error};
use rand::random;

// Define DownloadError here instead of importing it from crate root
#[derive(Debug)]
pub struct DownloadError(pub String);

impl std::fmt::Display for DownloadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for DownloadError {} // Implement Error trait for better error handling

// Update the Result type to include the Error type
type Result<T = ()> = std::result::Result<T, DownloadError>;

// Constants
const MAX_RETRY: usize = 5; // Increased from 3
const BASE_BACKOFF_MS: u64 = 300; // Base backoff time in milliseconds
#[allow(dead_code)]
const CHUNK_SIZE: usize = 1024 * 1024; // 1MB chunks for better memory management

/// Download media from a direct URL with retries.
pub async fn download_media_with_retry(client: &Client, url: &str, filename: &str) -> Result<()> {
    let mut retry_count = 0;
    let mut last_error = None;
    
    // Create the directory if it doesn't exist
    if let Some(parent) = Path::new(filename).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| DownloadError(format!("Failed to create directory: {}", e)))?;
        }
    }
    
    while retry_count < MAX_RETRY {
        match download_media_with_client(client, url, filename).await {
            Ok(_) => {
                info!("✅ Successfully downloaded media from {}", url);
                return Ok(());
            },
            Err(e) => {
                retry_count += 1;
                last_error = Some(e);
                
                // Exponential backoff with jitter for better retry strategy
                let backoff = BASE_BACKOFF_MS * 2u64.pow(retry_count as u32);
                let jitter = (backoff as f64 * (random::<f64>() * 0.3)).round() as u64;
                let sleep_time = backoff + jitter;
                
                warn!("Download attempt {} failed, retrying in {}ms: {:?}", 
                    retry_count, sleep_time, last_error);
                
                sleep(Duration::from_millis(sleep_time)).await;
            }
        }
    }
    
    error!("Failed to download after {} retries: {:?}", MAX_RETRY, last_error);
    Err(DownloadError(format!("Failed after {} retries: {:?}", MAX_RETRY, last_error)))
}

/// Actual HTTP media download function with streaming support for large files.
async fn download_media_with_client(client: &Client, url: &str, filename: &str) -> Result<()> {
    // Set proper headers to avoid detection
    let response = client.get(url)
        .header("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/110.0.5481.177 Mobile/15E148 Safari/604.1")
        .header("Referer", "https://www.instagram.com/")
        .header("Accept", "*/*")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Connection", "keep-alive")
        .send()
        .await
        .map_err(|e| DownloadError(format!("HTTP request failed: {}", e)))?;
    
    if !response.status().is_success() {
        return Err(DownloadError(format!("HTTP error: {}", response.status())));
    }

    // Get the content length if available
    let content_length = response.content_length();
    if let Some(len) = content_length {
        info!("Downloading file: {}MB", len / 1024 / 1024);
    }

    // Open the file for writing
    let mut file = File::create(filename)
        .map_err(|e| DownloadError(format!("Failed to create file: {}", e)))?;
    
    // Stream the download in chunks to handle large files efficiently
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    
    let mut downloaded: u64 = 0;
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result
            .map_err(|e| DownloadError(format!("Error while downloading file: {}", e)))?;
        
        // Write chunk to file
        copy(&mut chunk.as_ref(), &mut file)
            .map_err(|e| DownloadError(format!("Failed to write data to file: {}", e)))?;
        
        // Update progress for large files
        downloaded += chunk.len() as u64;
        if let Some(len) = content_length {
            if len > 5_000_000 && downloaded % 2_000_000 < 100_000 { // Log every ~2MB for files > 5MB
                info!("Download progress: {:.1}%", (downloaded as f64 / len as f64) * 100.0);
            }
        }
    }
    
    // Verify the file was successfully written
    let file_size = fs::metadata(filename)
        .map_err(|e| DownloadError(format!("Failed to read file metadata: {}", e)))?
        .len();
    
    if let Some(len) = content_length {
        if file_size != len {
            return Err(DownloadError(format!("File size mismatch. Expected: {}, Got: {}", len, file_size)));
        }
    }
    
    if file_size == 0 {
        return Err(DownloadError("Downloaded file is empty".to_string()));
    }

    Ok(())
}

/// Downloads media using `yt-dlp`, optionally with browser cookies.
pub async fn download_with_ytdlp(
    url: &str,
    folder: Option<&str>,
    browser: Option<&str>,
    is_story: bool,
) -> Result<()> {
    info!("Downloading with yt-dlp: {}", url);
    
    let output = match folder {
        Some(f) => format!("{}/%(title)s_%(id)s.%(ext)s", f), // Better naming convention
        None => "downloaded_media_%(id)s.%(ext)s".to_string(),
    };

    let browser_arg = browser.unwrap_or("chrome");

    // Common arguments for all yt-dlp commands
    let mut args = vec![
        "--no-warnings",
        "--concurrent-fragments", "5", // Download in 5 parallel fragments
        "--add-metadata",              // Add metadata to the file
        "--retry-sleep", "3",          // Sleep 3 seconds between retries
        "--retries", "10",             // Retry up to 10 times
        "--no-playlist",               // Don't download playlists
        "--progress",
        "-o", &output,
    ];

    // Add cookies for authenticated content
    if is_story {
        args.push("--cookies-from-browser");
        args.push(browser_arg);
    }

    // Add URL as the last argument
    args.push(url);

    // Create a command builder with improved error messages
    let command_result = tokio::process::Command::new("yt-dlp")
        .args(&args)
        .output()
        .await;

    match command_result {
        Ok(output) => {
            if output.status.success() {
                info!("✅ yt-dlp download complete for {}", url);
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);
                error!("yt-dlp failed: {} \nStdout: {} \nStderr: {}", 
                       output.status, stdout, stderr);
                
                // Error contains useful debugging info
                Err(DownloadError(format!(
                    "yt-dlp execution failed ({}): {}", 
                    output.status, stderr
                )))
            }
        },
        Err(e) => {
            error!("Failed to execute yt-dlp: {}", e);
            
            // Check if yt-dlp is installed
            if let Err(_) = Command::new("which").arg("yt-dlp").output() {
                return Err(DownloadError(
                    "yt-dlp is not installed. Please install it with 'pip install yt-dlp' or your system's package manager.".to_string()
                ));
            }
            
            Err(DownloadError(format!("Failed to execute yt-dlp: {}", e)))
        }
    }
}

/// Fallback download function that tries multiple methods
#[allow(dead_code)]
pub async fn download_with_fallback(
    url: &str, 
    folder: &str, 
    client: &Client
) -> Result<String> {
    info!("Attempting fallback download for: {}", url);
    
    // Create target folder if it doesn't exist
    if !Path::new(folder).exists() {
        fs::create_dir_all(folder)
            .map_err(|e| DownloadError(format!("Failed to create directory: {}", e)))?;
    }
    
    // First try: direct download with reqwest
    let file_ext = if url.contains(".mp4") { "mp4" } else { "jpg" };
    let filename = format!("{}/direct_download.{}", folder, file_ext);
    
    if let Ok(_) = download_media_with_retry(client, url, &filename).await {
        info!("✅ Direct download successful");
        return Ok(filename);
    }
    
    // Second try: use yt-dlp as fallback
    info!("Direct download failed, trying yt-dlp...");
    if let Ok(_) = download_with_ytdlp(url, Some(folder), Some("chrome"), false).await {
        // Find the downloaded file (yt-dlp might have renamed it)
        if let Ok(entries) = fs::read_dir(folder) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_file() && path.to_string_lossy() != format!("{}/direct_download.{}", folder, file_ext) {
                    info!("✅ yt-dlp download successful: {:?}", path);
                    return Ok(path.to_string_lossy().to_string());
                }
            }
        }
    }
    
    error!("All download attempts failed for {}", url);
    Err(DownloadError("All download methods failed".to_string()))
}