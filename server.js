import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const DIST_DIR = path.join(__dirname, 'dist');
const indexPath = path.join(DIST_DIR, 'index.html');

// Ensure dist/index.html exists before starting to serve requests
if (!fs.existsSync(indexPath)) {
  console.log('Build directory or index.html not found. Executing npm run build...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to build application:', error);
  }
}

// Serve static assets from dist
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

// Health check endpoints for Cloud Run / GCP probes
app.get(['/healthz', '/health', '/_health'], (req, res) => {
  res.status(200).send('OK');
});

// Single Page Application routing fallback
app.get('*', (req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Attempt fallback build if index.html is missing
    try {
      execSync('npm run build', { stdio: 'inherit' });
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
    } catch (e) {
      console.error('On-demand build failed:', e);
    }
    res.status(500).send('Application build in progress or failed. Please refresh.');
  }
});

const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server is running and listening on http://0.0.0.0:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
