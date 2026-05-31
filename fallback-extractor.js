/**
 * Fallback video extractor — when yt-dlp fails, this module:
 * 1. Fetches the page like a real browser
 * 2. Extracts video stream URLs from page source (mp4, m3u8, mpd)
 * 3. Downloads the stream using ffmpeg or direct HTTP
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { URL } = require('url');

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Fetch a URL with browser-like headers, following redirects
 */
function fetchPage(url, cookies = '', maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));

    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;

    const headers = {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity',
      'Referer': parsed.origin + '/',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
    };

    if (cookies) headers['Cookie'] = cookies;

    const req = mod.get(url, { headers, rejectUnauthorized: true }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) redirectUrl = parsed.origin + redirectUrl;
        return fetchPage(redirectUrl, cookies, maxRedirects - 1).then(resolve).catch(reject);
      }

      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ body, url: res.responseUrl || url, headers: res.headers }));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Extract video info + stream URLs from page source
 */
function extractVideoData(html, pageUrl) {
  const result = {
    title: '',
    thumbnail: '',
    duration: '',
    streams: [] // { url, quality, format }
  };

  // ── Extract title ──
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) result.title = titleMatch[1].replace(/\s*[-|].*$/, '').trim();

  const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
  if (ogTitle) result.title = ogTitle[1].trim();

  // ── Extract thumbnail ──
  const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
  if (ogImage) result.thumbnail = ogImage[1];

  // ── Extract duration ──
  const durMatch = html.match(/"duration"\s*:\s*"?(\d+)"?/i) ||
                   html.match(/duration['"]\s*:\s*(\d+)/i);
  if (durMatch) {
    const secs = parseInt(durMatch[1]);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    result.duration = `${m}:${s.toString().padStart(2, '0')}`;
  }

  const parsed = new URL(pageUrl);

  // ── Strategy 1: Find direct .mp4 URLs ──
  const mp4Regex = /(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/gi;
  const mp4Matches = html.match(mp4Regex) || [];
  const seen = new Set();

  for (const rawUrl of mp4Matches) {
    let cleanUrl = rawUrl.replace(/\\u0026/g, '&').replace(/\\/g, '');
    // Remove trailing quotes/brackets
    cleanUrl = cleanUrl.replace(/['")\]}>]+$/, '');
    if (seen.has(cleanUrl)) continue;
    seen.add(cleanUrl);

    // Try to extract quality from URL
    let quality = 'unknown';
    const qMatch = cleanUrl.match(/(\d{3,4})p/i) || cleanUrl.match(/(\d{3,4})\.mp4/i);
    if (qMatch) quality = qMatch[1] + 'p';

    result.streams.push({ url: cleanUrl, quality, format: 'mp4', type: 'direct' });
  }

  // ── Strategy 2: Find .m3u8 HLS streams ──
  const m3u8Regex = /(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/gi;
  const m3u8Matches = html.match(m3u8Regex) || [];

  for (const rawUrl of m3u8Matches) {
    let cleanUrl = rawUrl.replace(/\\u0026/g, '&').replace(/\\/g, '');
    cleanUrl = cleanUrl.replace(/['")\]}>]+$/, '');
    if (seen.has(cleanUrl)) continue;
    seen.add(cleanUrl);

    result.streams.push({ url: cleanUrl, quality: 'auto', format: 'hls', type: 'hls' });
  }

  // ── Strategy 3: Find .mpd DASH streams ──
  const mpdRegex = /(https?:\/\/[^\s"'<>]+\.mpd[^\s"'<>]*)/gi;
  const mpdMatches = html.match(mpdRegex) || [];

  for (const rawUrl of mpdMatches) {
    let cleanUrl = rawUrl.replace(/\\u0026/g, '&').replace(/\\/g, '');
    cleanUrl = cleanUrl.replace(/['")\]}>]+$/, '');
    if (seen.has(cleanUrl)) continue;
    seen.add(cleanUrl);

    result.streams.push({ url: cleanUrl, quality: 'auto', format: 'dash', type: 'dash' });
  }

  // ── Strategy 4: Look in JSON data blobs ──
  // Many sites embed video data in JSON within script tags
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;

  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const scriptContent = scriptMatch[1];

    // Look for video URLs in JSON objects
    const jsonUrlRegex = /["'](https?:\/\/[^"']+\.(mp4|m3u8|webm)[^"']*)/gi;
    let jsonMatch;

    while ((jsonMatch = jsonUrlRegex.exec(scriptContent)) !== null) {
      let streamUrl = jsonMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/\\/g, '');
      if (seen.has(streamUrl)) continue;
      seen.add(streamUrl);

      const ext = jsonMatch[2];
      let quality = 'unknown';
      const qm = streamUrl.match(/(\d{3,4})p/i);
      if (qm) quality = qm[1] + 'p';

      const type = ext === 'm3u8' ? 'hls' : 'direct';
      result.streams.push({ url: streamUrl, quality, format: ext, type });
    }
  }

  // ── Strategy 5: Look for video/source tags ──
  const sourceRegex = /<source[^>]+src=["']([^"']+)["'][^>]*(?:type=["']([^"']+)["'])?/gi;
  let sourceMatch;
  while ((sourceMatch = sourceRegex.exec(html)) !== null) {
    let srcUrl = sourceMatch[1];
    if (srcUrl.startsWith('/')) srcUrl = parsed.origin + srcUrl;
    if (seen.has(srcUrl)) continue;
    seen.add(srcUrl);

    const mimeType = sourceMatch[2] || '';
    let quality = 'unknown';
    const qm = srcUrl.match(/(\d{3,4})p/i);
    if (qm) quality = qm[1] + 'p';

    result.streams.push({
      url: srcUrl,
      quality,
      format: mimeType.includes('mp4') ? 'mp4' : mimeType.includes('webm') ? 'webm' : 'mp4',
      type: srcUrl.includes('.m3u8') ? 'hls' : 'direct'
    });
  }

  // Sort streams: prefer higher quality, prefer direct over hls
  result.streams.sort((a, b) => {
    const getQNum = q => parseInt((q.match(/\d+/) || ['0'])[0]);
    const aQ = getQNum(a.quality);
    const bQ = getQNum(b.quality);
    if (bQ !== aQ) return bQ - aQ;
    if (a.type === 'direct' && b.type !== 'direct') return -1;
    if (b.type === 'direct' && a.type !== 'direct') return 1;
    return 0;
  });

  // Deduplicate by removing lower quality versions of same base URL
  const uniqueStreams = [];
  const baseUrls = new Set();
  for (const s of result.streams) {
    // Skip obviously bad URLs (too short, contain template vars, etc)
    if (s.url.length < 20) continue;
    if (s.url.includes('{') || s.url.includes('{{')) continue;
    if (s.url.includes('example.com')) continue;

    const baseKey = s.url.replace(/\d{3,4}p/, '').slice(0, 80);
    if (!baseUrls.has(baseKey)) {
      baseUrls.add(baseKey);
      uniqueStreams.push(s);
    }
  }

  result.streams = uniqueStreams;
  return result;
}

/**
 * Download a direct video URL to disk
 */
function downloadDirect(streamUrl, outputPath, referer, onProgress) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(streamUrl);
    const mod = parsed.protocol === 'https:' ? https : http;

    const headers = {
      'User-Agent': USER_AGENT,
      'Referer': referer,
      'Accept': '*/*',
    };

    const req = mod.get(streamUrl, { headers, rejectUnauthorized: true }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadDirect(res.headers.location, outputPath, referer, onProgress)
          .then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const totalSize = parseInt(res.headers['content-length'] || '0');
      let downloaded = 0;

      const file = fs.createWriteStream(outputPath);
      const startTime = Date.now();

      res.on('data', chunk => {
        downloaded += chunk.length;
        file.write(chunk);

        if (onProgress && totalSize > 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = downloaded / elapsed;
          const remaining = (totalSize - downloaded) / speed;

          onProgress({
            progress: (downloaded / totalSize) * 100,
            downloaded,
            totalSize,
            speed,
            eta: Math.ceil(remaining)
          });
        }
      });

      res.on('end', () => {
        file.end();
        resolve({ outputPath, size: downloaded });
      });

      res.on('error', err => {
        file.end();
        reject(err);
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Download HLS stream using ffmpeg
 */
function downloadHLS(m3u8Url, outputPath, referer, onProgress) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-headers', `User-Agent: ${USER_AGENT}\r\nReferer: ${referer}\r\n`,
      '-i', m3u8Url,
      '-c', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      '-movflags', '+faststart',
      '-progress', 'pipe:1',
      outputPath
    ];

    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let duration = 0;
    let currentTime = 0;

    proc.stderr.on('data', data => {
      const text = data.toString();
      const durMatch = text.match(/Duration:\s*(\d+):(\d+):(\d+)/);
      if (durMatch) {
        duration = parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseInt(durMatch[3]);
      }
    });

    proc.stdout.on('data', data => {
      const text = data.toString();
      const timeMatch = text.match(/out_time_ms=(\d+)/);
      if (timeMatch && duration > 0) {
        currentTime = parseInt(timeMatch[1]) / 1000000;
        const progress = Math.min((currentTime / duration) * 100, 99);
        if (onProgress) {
          onProgress({
            progress,
            downloaded: 0,
            totalSize: 0,
            speed: 0,
            eta: Math.ceil(duration - currentTime)
          });
        }
      }
    });

    proc.on('close', code => {
      if (code === 0) {
        try {
          const stat = fs.statSync(outputPath);
          resolve({ outputPath, size: stat.size });
        } catch {
          resolve({ outputPath, size: 0 });
        }
      } else {
        reject(new Error('ffmpeg failed with code ' + code));
      }
    });

    proc.on('error', reject);
  });
}

/**
 * Sanitize a filename
 */
function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) || 'video';
}

/**
 * Main: extract and download video from URL
 * Returns an object compatible with the server's download tracking
 */
async function extractAndDownload(pageUrl, outputDir, onProgress) {
  // Step 1: Fetch the page
  if (onProgress) onProgress({ status: 'fetching', progress: 0, message: 'Fetching page...' });

  const { body: html } = await fetchPage(pageUrl);

  // Step 2: Extract video data
  if (onProgress) onProgress({ status: 'extracting', progress: 5, message: 'Extracting video streams...' });

  const videoData = extractVideoData(html, pageUrl);

  if (videoData.streams.length === 0) {
    throw new Error('No video streams found on page');
  }

  // Step 3: Pick best stream
  const stream = videoData.streams[0];
  const title = sanitizeFilename(videoData.title || 'video');
  const ext = stream.format === 'hls' ? 'mp4' : (stream.format || 'mp4');
  const outputPath = path.join(outputDir, `${title}.${ext}`);

  // Avoid overwriting — add number suffix
  let finalPath = outputPath;
  let counter = 1;
  while (fs.existsSync(finalPath)) {
    finalPath = path.join(outputDir, `${title} (${counter}).${ext}`);
    counter++;
  }

  if (onProgress) onProgress({
    status: 'downloading',
    progress: 10,
    message: `Downloading ${stream.quality} ${stream.format}...`,
    filename: path.basename(finalPath)
  });

  // Step 4: Download
  const downloadProgress = (p) => {
    if (onProgress) {
      onProgress({
        status: 'downloading',
        progress: 10 + (p.progress * 0.9),
        speed: p.speed,
        totalSize: p.totalSize,
        eta: p.eta,
        filename: path.basename(finalPath)
      });
    }
  };

  let result;
  if (stream.type === 'hls' || stream.type === 'dash') {
    result = await downloadHLS(stream.url, finalPath, pageUrl, downloadProgress);
  } else {
    result = await downloadDirect(stream.url, finalPath, pageUrl, downloadProgress);
  }

  return {
    title: videoData.title,
    thumbnail: videoData.thumbnail,
    duration: videoData.duration,
    filename: path.basename(finalPath),
    filepath: finalPath,
    size: result.size,
    streams_found: videoData.streams.length,
    stream_used: stream
  };
}

/**
 * Get video info only (no download)
 */
async function extractInfo(pageUrl) {
  const { body: html } = await fetchPage(pageUrl);
  const videoData = extractVideoData(html, pageUrl);

  return {
    title: videoData.title || 'Unknown Video',
    thumbnail: videoData.thumbnail || '',
    duration: videoData.duration || '',
    streams: videoData.streams.length,
    qualities: [...new Set(videoData.streams.map(s => s.quality).filter(q => q !== 'unknown'))],
    formats: [...new Set(videoData.streams.map(s => s.format))]
  };
}

module.exports = { extractAndDownload, extractInfo, fetchPage, extractVideoData };
