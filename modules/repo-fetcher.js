/**
 * Repo Fetcher — GitHub API module for Archiview
 *
 * Fetches repo metadata, directory tree, and key file contents
 * via the GitHub REST API. No authentication needed for public repos.
 */

const https = require('https');
const GITHUB_API = 'https://api.github.com';

// File extensions to prioritize (source code, config, docs)
const PRIORITY_EXTS = new Set([
  '.js', '.ts', '.py', '.rs', '.go', '.rb', '.java', '.c', '.cpp', '.h', '.hpp',
  '.jsx', '.tsx', '.vue', '.svelte', '.swift', '.kt', '.scala', '.ex', '.exs',
  '.json', '.yaml', '.yml', '.toml', '.xml', '.ini', '.cfg', '.conf',
  '.md', '.rst', '.txt',
  '.sh', '.bash', '.zsh', '.fish',
  '.dockerfile', '.Dockerfile',
  '.css', '.scss', '.less', '.html',
  '.sql', '.graphql', '.proto',
  '.gradle', '.properties',
  '.env.example',
]);

// Files to always fetch
const ALWAYS_INCLUDE = new Set([
  'README.md', 'package.json', 'Cargo.toml', 'pyproject.toml', 'go.mod',
  'composer.json', 'Gemfile', 'build.gradle', 'Makefile', 'CMakeLists.txt',
  'Dockerfile', 'docker-compose.yml', '.env.example', 'tsconfig.json',
  '.gitignore', 'LICENSE', 'CONTRIBUTING.md', 'CHANGELOG.md',
]);

// Files/directories to skip
const SKIP_PATHS = new Set([
  'node_modules', '.git', '__pycache__', 'target', 'build', 'dist',
  '.next', '.nuxt', 'venv', '.venv', 'vendor', '.git',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  '.DS_Store', '*.min.js', '*.min.css',
]);

// Directories to prioritize (look here first)
const PRIORITY_DIRS = ['src', 'lib', 'app', 'core', 'api', 'routes', 'controllers', 'models', 'services', 'utils', 'components', 'pages'];

function githubFetch(path) {
  return new Promise((resolve, reject) => {
    const url = GITHUB_API + path;
    const headers = {
      'User-Agent': 'Archiview/1.0',
      'Accept': 'application/vnd.github.v3+json',
    };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const options = { headers };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`GitHub API ${path}: HTTP ${res.statusCode} — ${data.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Failed to parse GitHub response')); }
      });
    }).on('error', reject);
  });
}

function isImportantFile(path) {
  const name = path.split('/').pop();
  if (ALWAYS_INCLUDE.has(name)) return true;
  const ext = '.' + name.split('.').slice(1).join('.');
  return PRIORITY_EXTS.has(ext) || PRIORITY_EXTS.has('.' + name.split('.').pop());
}

function getImportance(path) {
  // Score files by importance for prioritization
  let score = 0;
  const name = path.split('/').pop();
  const ext = '.' + name.split('.').pop();

  // README and config files are most important
  if (name === 'README.md') score += 100;
  if (ALWAYS_INCLUDE.has(name)) score += 80;

  // Priority directories
  const dir = path.split('/')[0];
  if (PRIORITY_DIRS.includes(dir)) score += 40;

  // Source code over other files
  if (['.js', '.ts', '.py', '.rs', '.go', '.rb', '.java'].includes(ext)) score += 30;
  if (['.jsx', '.tsx', '.vue', '.svelte'].includes(ext)) score += 25;
  if (['.json', '.yaml', '.yml', '.toml'].includes(ext)) score += 20;
  if (['.md', '.rst'].includes(ext)) score += 10;

  // Penalize very large generated files
  if (name.includes('lock') || name.includes('bundle') || name.includes('chunk')) score -= 50;

  return score;
}

function shouldSkip(path) {
  const parts = path.split('/');
  for (const part of parts) {
    if (SKIP_PATHS.has(part)) return true;
    if (part.startsWith('.')) return true; // skip hidden dirs
  }
  return false;
}

function parseRepoUrl(url) {
  // Accept: user/repo, github.com/user/repo, https://github.com/user/repo, etc.
  const match = url.match(/(?:github\.com\/)?([^\/\s]+)\/([^\/\s#?]+)/);
  if (!match) throw new Error('Invalid GitHub URL: ' + url);
  return { owner: match[1].replace(/^@/, ''), repo: match[2].replace(/\.git$/, '') };
}

async function fetchRepo(repoUrl, options = {}) {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const maxFiles = options.maxFiles || 60;

  // Step 1: Get repo metadata
  const meta = await githubFetch(`/repos/${owner}/${repo}`);
  console.log(`Fetched metadata: ${meta.full_name} (${meta.stargazers_count}⭐, ${meta.language || 'unknown'})`);

  // Step 2: Get the default branch's recursive tree
  const branch = meta.default_branch || 'main';

  // Step 2: Get the recursive tree via Git Trees API
  const treeData = await githubFetch(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);

  // Step 3: Filter and score files
  const files = (treeData.tree || [])
    .filter(item => item.type === 'blob')
    .filter(item => !shouldSkip(item.path))
    .filter(item => isImportantFile(item.path))
    .map(item => ({
      path: item.path,
      size: item.size || 0,
      sha: item.sha,
      importance: getImportance(item.path),
    }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, maxFiles);

  console.log(`Found ${files.length} important files (of ${treeData.tree?.length || 0} total)`);

  // Step 4: Fetch file contents (in parallel, but rate-limited)
  const fileContents = [];
  const batchSize = 5;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(f =>
        githubFetch(`/repos/${owner}/${repo}/contents/${f.path}?ref=${branch}`)
          .then(data => ({
            path: f.path,
            content: Buffer.from(data.content || '', 'base64').toString('utf-8'),
            size: data.size || f.size,
            encoding: data.encoding || 'base64',
            html_url: data.html_url || '',
          }))
          .catch(err => ({ path: f.path, error: err.message }))
      )
    );
    for (const r of results) {
      if (r.status === 'fulfilled') fileContents.push(r.value);
    }
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < files.length) await new Promise(r => setTimeout(r, 200));
  }

  console.log(`Fetched ${fileContents.length} file contents`);

  return {
    metadata: {
      name: meta.name,
      full_name: meta.full_name,
      description: meta.description,
      language: meta.language,
      stars: meta.stargazers_count,
      forks: meta.forks_count,
      open_issues: meta.open_issues_count,
      default_branch: branch,
      topics: meta.topics || [],
      created_at: meta.created_at,
      updated_at: meta.updated_at,
      html_url: meta.html_url,
      license: meta.license?.spdx_id || null,
    },
    files: fileContents,
    total_files: treeData.tree?.length || 0,
    analyzed_files: fileContents.length,
  };
}

module.exports = { fetchRepo, parseRepoUrl };
