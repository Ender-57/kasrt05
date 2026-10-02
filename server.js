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

// Ensure dist exists before serving
if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  console.log('Build directory not found. Executing npm run build...');
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

// Health check endpoint for Cloud Run
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Single Page Application routing fallback
app.get('*', (req, res) => {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send('Application build in progress or not found. Please reload in a moment.');
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
