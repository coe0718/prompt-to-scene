/**
 * Repo Fetcher — GitHub API module for Archiview
 *
 * Fetches repo metadata, directory tree, and key file contents
 * via the GitHub REST API. No authentication needed for public repos.
 *
 * Modes:
 *   balanced    — Prioritize docs + config for general repo understanding (default)
 *   source-first — Prioritize source code files for PR generation (demo-friendly)
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
  '.next', '.nuxt', 'venv', '.venv', 'vendor',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  '.DS_Store', '*.min.js', '*.min.css',
  '.vscode', '.idea', '.cursor',
]);

// Directories to prioritize (look here first)
const PRIORITY_DIRS = ['src', 'lib', 'app', 'core', 'api', 'routes', 'controllers', 'models', 'services', 'utils', 'components', 'pages'];

// Source-first: directories that get max priority boost
const SOURCE_FIRST_DIRS = ['src', 'lib', 'app', 'packages', 'crates'];
const SOURCE_EXTS = new Set(['.js', '.ts', '.py', '.rs', '.go', '.rb', '.java', '.c', '.cpp', '.h', '.hpp', '.jsx', '.tsx', '.vue', '.svelte']);
const TEST_EXTS = new Set(['.test.js', '.test.ts', '.spec.js', '.spec.ts', '.test.py']);

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

function getImportance(path, mode) {
  let score = 0;
  const name = path.split('/').pop();
  const ext = '.' + name.split('.').pop();

  if (mode === 'source-first') {
    // ─── Source-first scoring ────────────────────────────────────
    // Source code in priority directories gets top scores
    const topDir = path.split('/')[0];
    const fullPath = path.toLowerCase();

    // HARD penalize generated/vendor/docs
    if (/\.mdx?$|\.txt$|\.rst$/.test(ext)) score -= 100;
    if (name.includes('lock') || name.includes('bundle') || name.includes('chunk')) score -= 999;
    if (/^docs\//.test(fullPath) || /^examples\//.test(fullPath)) score -= 100;

    // Source files in priority directories (src/, lib/, app/, packages/, crates/)
    if (SOURCE_FIRST_DIRS.includes(topDir) && SOURCE_EXTS.has(ext)) score += 100;
    // Source files anywhere
    if (SOURCE_EXTS.has(ext) && !fullPath.includes('/test') && !fullPath.includes('.test.')) score += 80;
    // Test files (lower priority but still wanted)
    if (TEST_EXTS.has(ext) || fullPath.includes('/test/') || fullPath.includes('__tests__/')) score += 40;
    // Config / build files
    if (['.json', '.yaml', '.yml', '.toml', '.sh'].includes(ext)) score += 20;
    // README — include at most 1 (score low so it comes last among code)
    if (name === 'README.md' || name === 'CONTRIBUTING.md') score += 10;
    // LICENSE — barely count
    if (name === 'LICENSE') score += 1;
  } else {
    // ─── Balanced scoring (default, original behavior) ───────────
    if (name === 'README.md') score += 100;
    if (ALWAYS_INCLUDE.has(name)) score += 80;

    const dir = path.split('/')[0];
    if (PRIORITY_DIRS.includes(dir)) score += 40;

    if (['.js', '.ts', '.py', '.rs', '.go', '.rb', '.java'].includes(ext)) score += 30;
    if (['.jsx', '.tsx', '.vue', '.svelte'].includes(ext)) score += 25;
    if (['.json', '.yaml', '.yml', '.toml'].includes(ext)) score += 20;
    if (['.md', '.rst'].includes(ext)) score += 10;

    if (name.includes('lock') || name.includes('bundle') || name.includes('chunk')) score -= 50;
  }

  return score;
}

function shouldSkip(path) {
  const parts = path.split('/');
  for (const part of parts) {
    if (SKIP_PATHS.has(part)) return true;
  }
  return false;
}

function parseRepoUrl(url) {
  const match = url.match(/(?:github\.com\/)?([^\/\s]+)\/([^\/\s#?]+)/);
  if (!match) throw new Error('Invalid GitHub URL: ' + url);
  return { owner: match[1].replace(/^@/, ''), repo: match[2].replace(/\.git$/, '') };
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

async function fetchRepo(repoUrl, options = {}) {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const maxFiles = options.maxFiles || 60;
  const mode = options.mode || 'balanced';
  const fetchConcurrency = Math.max(1, parseInt(process.env.AUDIT_FETCH_CONCURRENCY || '8', 10) || 8);

  // Step 1: Get repo metadata and tree. These API calls are independent.
  const [meta, treeData] = await Promise.all([
    githubFetch(`/repos/${owner}/${repo}`),
    githubFetch(`/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`),
  ]);

  // Step 3: Filter and prioritize files
  const files = treeData.tree
    .filter(item => item.type === 'blob' && isImportantFile(item.path) && !shouldSkip(item.path))
    .map(item => ({
      path: item.path,
      sha: item.sha,
      importance: getImportance(item.path, mode),
    }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, maxFiles);

  console.log(`Found ${files.length} important files (of ${treeData.tree?.length || 0} total)`);

  // Step 4: Fetch file contents with bounded concurrency.
  await mapLimit(files, fetchConcurrency, async (file) => {
    try {
      const content = await githubFetch(`/repos/${owner}/${repo}/contents/${file.path}`);
      file.content = Buffer.from(content.content, 'base64').toString('utf-8');
    } catch(e) {
      console.warn(`  Failed to fetch ${file.path}: ${e.message.slice(0, 100)}`);
      file.content = '(unavailable)';
    }
  });

  return {
    metadata: {
      full_name: meta.full_name,
      description: meta.description,
      language: meta.language,
      stars: meta.stargazers_count,
      forks: meta.forks_count,
      topics: meta.topics || [],
    },
    total_files: treeData.tree.filter(i => i.type === 'blob').length,
    files: files.map(f => ({ path: f.path, content: f.content })),
  };
}

module.exports = { fetchRepo };
