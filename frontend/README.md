# Instagram Media Downloader

A modern web application for downloading photos, videos, reels, and stories from Instagram with an intuitive user interface and built-in diagnostics.

![Instagram Media Downloader](Screenshot%20from%202025-04-16%2023-45-42.png)

## Features

- Download photos and videos from Instagram posts
- Extract media from Instagram stories
- Save Instagram reels as videos
- Support for multiple browser emulation modes
- Modern, responsive UI with both light and dark themes
- Quick preview and fullscreen viewing options
- Built-in diagnostics and debugging tools
- Download history management

## User Flow Documentation

### 1. Paste Instagram URL

The application guides users through a 3-step process starting with entering an Instagram URL:

1. Copy a link to an Instagram post, reel, story, or profile
2. Paste it into the URL input field
3. The application validates the URL format in real-time

**Supported URL formats:**
- Posts: `https://www.instagram.com/p/XXXX/`
- Reels: `https://www.instagram.com/reel/XXXX/`
- Stories: `https://www.instagram.com/stories/username/XXXX/`
- Profiles: `https://www.instagram.com/username/`

### 2. Select Browser Mode

The application offers different browser emulation modes to optimize content extraction:

- **Chrome**: Default mode, works for most content
- **Firefox**: Alternative mode for content that may not work with Chrome
- **Chrome Mobile**: Simulates a mobile device, useful for certain stories and restricted content

Users can switch between modes if one doesn't work for their specific content.

### 3. Extract Media

After selecting a browser mode, users click the "Extract Media" button to:

1. The application connects to Instagram through the backend
2. It analyzes the provided URL and extracts available media
3. A visual status indicator shows progress during extraction

### 4. Preview and Download

Once extraction is complete:

1. **Quick Preview**: Shows a thumbnail view of extracted media
2. **Full Preview**: Expands to show all available media items
3. **Download Options**:
   - Download individual items by clicking the download button on each item
   - "Download All" button to save all extracted media at once
   - Downloaded files are saved to the user's device

### 5. View Downloaded Media

The "Downloads" tab maintains a history of all downloaded media files:

1. Media files are organized chronologically
2. Each item shows a thumbnail, filename, and media type
3. Users can manage their download history from this tab

## Debugging Features

The application includes comprehensive debugging tools accessible via the "Debug" button:

1. **Connection Status**: Shows backend and proxy connectivity
2. **System Information**: Displays OS, Node version, browser path, and memory info
3. **Connection Logs**: Real-time log of connection events and errors
4. **Test URL**: Allows users to test if the proxy is working correctly
5. **Raw Debug Data**: Provides detailed technical information for troubleshooting

## Theme Support

Toggle between light and dark themes using the theme switcher in the header or footer.

## Technical Requirements

- Modern web browser (Chrome, Firefox, Safari, or Edge)
- JavaScript enabled
- Connection to backend API service
  
## Development Setup

```bash
# Clone the repository
git clone https://github.com/abhijeetroyyy/Insta.git

# Navigate to project directory
cd Insta/frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

## Technologies Used

- React 
- Redux Toolkit for state management
- TailwindCSS for styling
- Vite for build tooling

## License

This project is intended for personal use only. Please respect Instagram's terms of service and copyright rules when using this tool.
