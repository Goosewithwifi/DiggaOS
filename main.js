const repoFullName = 'Goosewithwifi/DiggaOS';

// State Management
let statsData = null;
let commitsList = [];
let contributorsList = [];

// File Explorer State
let currentExplorerPath = '';
let explorerContents = [];
let isExplorerLoading = false;
let explorerError = null;
let fileExplorerSearchQuery = '';
let selectedFileItem = null;

// DOM Elements Cache
const statsGrid = document.getElementById('stats-grid');
const breadcrumbsContainer = document.getElementById('breadcrumbs');
const explorerListContainer = document.getElementById('explorer-list');
const fileDetailsContainer = document.getElementById('file-details');
const fileSearchInput = document.getElementById('file-search');
const commitFeedContainer = document.getElementById('commit-feed-list');
const btnRefreshCommits = document.getElementById('btn-refresh-commits');
const refreshIcon = document.getElementById('refresh-icon');
const contributorsGrid = document.getElementById('contributors-grid');
const btnScrollTop = document.getElementById('btn-scroll-top');
const btnExplore = document.getElementById('btn-explore');
const btnLock = document.getElementById('btn-lock');
const downloadMessage = document.getElementById('download-message');

/* ==========================================================================
   Utility Helpers
   ========================================================================== */

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIconSVG(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'css':
    case 'html':
      return `
        <svg class="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"></path>
        </svg>
      `;
    case 'json':
    case 'yaml':
    case 'yml':
      return `
        <svg class="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"></path>
        </svg>
      `;
    case 'md':
    case 'txt':
      return `
        <svg class="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"></path>
        </svg>
      `;
    default:
      return `
        <svg class="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5-3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"></path>
        </svg>
      `;
  }
}

/* ==========================================================================
   API Operations
   ========================================================================== */

// 1. Fetch Repository Metadata & update stats cards
async function fetchRepoMeta() {
  try {
    const res = await fetch(`https://api.github.com/repos/${repoFullName}`);
    if (!res.ok) throw new Error('API request failed');
    statsData = await res.json();
    renderStats();
  } catch (err) {
    console.error('Error fetching repo meta:', err);
    renderStatsError();
  }
}

// 2. Fetch Commits
async function fetchCommits() {
  if (refreshIcon) refreshIcon.classList.add('animate-spin');
  try {
    const res = await fetch(`https://api.github.com/repos/${repoFullName}/commits?per_page=15`);
    if (!res.ok) throw new Error('API request failed');
    commitsList = await res.json();
    renderCommits();
  } catch (err) {
    console.error('Error fetching commits:', err);
    renderCommitsError();
  } finally {
    if (refreshIcon) refreshIcon.classList.remove('animate-spin');
  }
}

// 3. Fetch Contributors
async function fetchContributors() {
  try {
    const res = await fetch(`https://api.github.com/repos/${repoFullName}/contributors`);
    if (!res.ok) throw new Error('API request failed');
    contributorsList = await res.json();
    renderContributors();
  } catch (err) {
    console.error('Error fetching contributors:', err);
    renderContributorsError();
  }
}

// 4. Fetch File Explorer Contents
async function fetchExplorerContents(path) {
  isExplorerLoading = true;
  explorerError = null;
  selectedFileItem = null;
  renderExplorer();
  renderFileDetails();

  try {
    const url = `https://api.github.com/repos/${repoFullName}/contents/${path}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch file contents (${res.status})`);
    
    const data = await res.json();
    if (Array.isArray(data)) {
      explorerContents = data;
    } else {
      explorerContents = [data];
    }
  } catch (err) {
    explorerError = err.message || 'Failed to connect to GitHub API';
  } finally {
    isExplorerLoading = false;
    renderExplorer();
    renderFileDetails();
  }
}

/* ==========================================================================
   Render UI Components
   ========================================================================== */

// Render Stats Section
function renderStats() {
  if (!statsGrid || !statsData) return;
  statsGrid.innerHTML = `
    <!-- Stars -->
    <div class="bg-surface border border-outline-variant rounded-lg p-5 flex flex-col justify-between h-28 transition-all hover:border-on-surface-variant/40 duration-200">
      <span class="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Stars</span>
      <div class="flex items-baseline space-x-1.5">
        <span class="text-3xl font-extralight text-on-surface">${statsData.stargazers_count.toLocaleString()}</span>
        <svg class="w-3.5 h-3.5 text-yellow-500 fill-yellow-500/10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499c.172-.443.811-.443.98 0l2.224 5.711 6.168.914c.48.071.671.659.324.99l-4.464 4.316 1.054 6.103c.082.476-.419.84-.84.6l-5.518-2.883-5.518 2.883c-.42.24-.922-.123-.84-.6l1.054-6.103-4.464-4.316c-.347-.331-.156-.919.324-.99l6.168-.914 2.224-5.711z"></path>
        </svg>
      </div>
    </div>

    <!-- Forks -->
    <div class="bg-surface border border-outline-variant rounded-lg p-5 flex flex-col justify-between h-28 transition-all hover:border-on-surface-variant/40 duration-200">
      <span class="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Forks</span>
      <div class="flex items-baseline space-x-1.5">
        <span class="text-3xl font-extralight text-on-surface">${statsData.forks_count.toLocaleString()}</span>
        <svg class="w-3.5 h-3.5 text-on-surface-variant" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15.75V19.5M8.25 19.5H3.75M8.25 19.5H12.75M15.75 8.25V4.5M15.75 4.5H20.25M15.75 4.5H11.25M3.75 11.25H20.25"></path>
        </svg>
      </div>
    </div>

    <!-- Open Issues -->
    <div class="bg-surface border border-outline-variant rounded-lg p-5 flex flex-col justify-between h-28 transition-all hover:border-on-surface-variant/40 duration-200">
      <span class="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Open Issues</span>
      <div class="flex items-baseline space-x-1.5">
        <span class="text-3xl font-extralight text-on-surface">${statsData.open_issues_count.toLocaleString()}</span>
        <svg class="w-3.5 h-3.5 text-on-surface-variant" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
      </div>
    </div>

    <!-- Repo Size -->
    <div class="bg-surface border border-outline-variant rounded-lg p-5 flex flex-col justify-between h-28 transition-all hover:border-on-surface-variant/40 duration-200">
      <span class="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Repo Size</span>
      <div class="flex items-baseline space-x-1.5">
        <span class="text-3xl font-extralight text-on-surface">${formatBytes(statsData.size * 1024)}</span>
        <svg class="w-3.5 h-3.5 text-on-surface-variant" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 .622-.16 1.207-.44 1.721m-.567 3.128c-.28.163-.585.305-.91.424m-1.284.347c-.636.104-1.303.17-1.99.191m-1.284-.347c-.636-.104-1.303-.17-1.99-.191M3.75 6.375c0 .622.16 1.207.44 1.721m.567 3.128c.28.163.585.305.91.424M3.75 12h16.5m-16.5 5.25h16.5m-16.5-12h16.5M3.75 17.25c0-.622.16-1.207.44-1.721m.567-3.128c.28-.163.585-.305.91-.424m1.284-.347c.636-.104 1.303-.17 1.99-.191"></path>
        </svg>
      </div>
    </div>
  `;
}

function renderStatsError() {
  if (!statsGrid) return;
  statsGrid.innerHTML = `
    <div class="col-span-4 py-8 border border-outline-variant bg-surface rounded-lg text-center font-mono text-xs text-on-surface-variant">
      Failed to retrieve live GitHub metrics. Using offline state.
    </div>
  `;
}

// Render File Explorer Section
function renderExplorer() {
  if (!breadcrumbsContainer || !explorerListContainer) return;

  // 1. Render Breadcrumbs
  const pathParts = currentExplorerPath ? ['', ...currentExplorerPath.split('/')] : [''];
  breadcrumbsContainer.innerHTML = pathParts
    .map((crumb, idx) => {
      const isLast = idx === pathParts.length - 1;
      return `
        <div class="flex items-center">
          ${idx > 0 ? '<span class="text-outline-variant font-mono mx-1">/</span>' : ''}
          <button
            data-breadcrumb-idx="${idx}"
            ${isLast ? 'disabled' : ''}
            class="font-mono text-[11px] px-1.5 py-0.5 rounded transition-all cursor-pointer ${
              isLast
                ? 'text-on-surface font-semibold bg-surface border border-outline-variant/40'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }"
          >
            ${idx === 0 ? 'root' : crumb}
          </button>
        </div>
      `;
    })
    .join('');

  // 2. Render List contents
  if (isExplorerLoading) {
    explorerListContainer.innerHTML = `
      <div class="flex-grow flex flex-col items-center justify-center py-24 space-y-3">
        <svg class="w-5 h-5 text-on-surface animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"></path>
        </svg>
        <p class="font-mono text-[11px] text-on-surface-variant">indexing files...</p>
      </div>
    `;
    return;
  }

  if (explorerError) {
    explorerListContainer.innerHTML = `
      <div class="flex-grow flex flex-col items-center justify-center py-16 text-center space-y-3 px-4">
        <svg class="w-7 h-7 text-on-surface-variant" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <div class="font-mono text-xs text-on-surface">FileSystem Error</div>
        <p class="font-mono text-[11px] text-on-surface-variant max-w-sm">${explorerError}</p>
        <button id="btn-explorer-retry" class="font-mono text-[11px] text-on-surface border border-outline-variant px-2.5 py-1 rounded bg-surface hover:bg-surface-container-high transition-colors cursor-pointer">
          Retry
        </button>
      </div>
    `;
    return;
  }

  // Filter & Sort: Directory first, then Files alphabetically
  const sorted = [...explorerContents].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'dir' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  const filtered = sorted.filter((item) =>
    item.name.toLowerCase().includes(fileExplorerSearchQuery.toLowerCase())
  );

  if (filtered.length === 0) {
    explorerListContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center py-20 text-center text-on-surface-variant">
        <svg class="w-6 h-6 mb-2 text-outline-variant" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"></path>
        </svg>
        <div class="font-mono text-xs text-on-surface">No entries found</div>
        <p class="font-mono text-[10px] text-on-surface-variant mt-0.5">No contents match your filter criteria.</p>
      </div>
    `;
    return;
  }

  let html = '';

  // Parent Directory Row
  if (currentExplorerPath) {
    html += `
      <button
        id="btn-parent-dir"
        class="w-full flex items-center space-x-2.5 py-2 hover:bg-surface rounded-md px-2 transition-all text-left text-on-surface-variant hover:text-on-surface border-b border-outline-variant/30 cursor-pointer"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
        </svg>
        <span class="text-[11px]">.. (parent directory)</span>
      </button>
    `;
  }

  // Content Rows
  filtered.forEach((item, index) => {
    const isSelected = selectedFileItem && selectedFileItem.sha === item.sha;
    html += `
      <button
        data-item-idx="${index}"
        class="w-full flex items-center justify-between py-2 px-2 hover:bg-surface rounded-md transition-all group text-left border-b border-outline-variant/30 cursor-pointer ${
          isSelected ? 'bg-surface border-l-2 border-l-primary pl-1.5' : ''
        }"
      >
        <div class="flex items-center space-x-3 overflow-hidden">
          ${
            item.type === 'dir'
              ? `
                <svg class="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.31c-.195 0-.388-.078-.53-.22L13.06 6.31z"></path>
                </svg>
              `
              : getFileIconSVG(item.name)
          }
          <span class="text-[11px] text-on-surface group-hover:text-primary truncate font-mono ${
            isSelected ? 'text-primary font-medium' : ''
          }">
            ${item.name}
          </span>
        </div>
        <div class="flex items-center space-x-3 text-[10px] text-on-surface-variant select-none font-mono">
          ${item.type === 'file' ? `<span>${formatBytes(item.size)}</span>` : ''}
          <svg class="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"></path>
          </svg>
        </div>
      </button>
    `;
  });

  explorerListContainer.innerHTML = html;
}

// Render File Details Side Card
function renderFileDetails() {
  if (!fileDetailsContainer) return;

  if (!selectedFileItem) {
    fileDetailsContainer.innerHTML = `
      <div class="flex-grow flex flex-col items-center justify-center text-center py-16 text-on-surface-variant">
        <svg class="w-8 h-8 mb-2 text-outline-variant" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"></path>
        </svg>
        <div class="font-mono text-xs text-on-surface">No File Selected</div>
        <p class="font-mono text-[10px] text-on-surface-variant max-w-[220px] mt-1 leading-relaxed">
          Click any file row in the index list to query its sizes, type signatures, and raw repository links.
        </p>
      </div>
    `;
    return;
  }

  const fileExt = selectedFileItem.name.split('.').pop() || 'FILE';

  fileDetailsContainer.innerHTML = `
    <div class="space-y-5 flex-grow flex flex-col justify-between">
      <div>
        <div class="flex items-center space-x-1.5 text-on-surface-variant mb-3 border-b border-outline-variant/50 pb-2">
          ${getFileIconSVG(selectedFileItem.name)}
          <span class="text-[10px] font-semibold uppercase tracking-wider font-mono">
            ${fileExt}
          </span>
        </div>

        <h3 class="font-mono text-xs font-bold text-on-surface break-all mb-2.5">
          ${selectedFileItem.name}
        </h3>
        
        <div class="bg-surface-container-low p-2 rounded border border-outline-variant/60 font-mono text-[10px] text-on-surface-variant break-all">
          path: ${selectedFileItem.path}
        </div>

        <div class="mt-4 space-y-2 text-[10px] font-mono border-t border-outline-variant/50 pt-3">
          <div class="flex justify-between">
            <span class="text-on-surface-variant">Size</span>
            <span class="text-on-surface font-semibold">
              ${formatBytes(selectedFileItem.size)}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-on-surface-variant">Type</span>
            <span class="text-on-surface">
              ${selectedFileItem.type}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-on-surface-variant">SHA</span>
            <span class="text-on-surface truncate max-w-[120px]" title="${selectedFileItem.sha}">
              ${selectedFileItem.sha.substring(0, 12)}
            </span>
          </div>
        </div>
      </div>

      <div class="space-y-2 pt-4 border-t border-outline-variant/50">
        ${
          selectedFileItem.download_url
            ? `
              <a
                href="${selectedFileItem.download_url}"
                target="_blank"
                rel="noopener noreferrer"
                class="w-full py-1.5 px-3 rounded border border-outline-variant bg-surface hover:bg-surface-container-high text-on-surface font-mono text-[11px] flex items-center justify-center space-x-1 transition-colors text-center cursor-pointer"
              >
                <span>Raw Content</span>
                <span>→</span>
              </a>
            `
            : ''
        }
        <a
          href="${selectedFileItem.html_url}"
          target="_blank"
          rel="noopener noreferrer"
          class="w-full py-1.5 px-3 rounded border border-outline-variant bg-surface hover:bg-surface-container-high text-on-surface font-mono text-[11px] flex items-center justify-center space-x-1.5 transition-colors text-center cursor-pointer"
        >
          <span>Open on GitHub</span>
          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"></path>
          </svg>
        </a>
      </div>
    </div>
  `;
}

// Render Commits
function renderCommits() {
  if (!commitFeedContainer) return;

  if (commitsList.length === 0) {
    commitFeedContainer.innerHTML = `
      <div class="py-12 text-center text-on-surface-variant font-mono text-xs">
        No recent commits retrieved.
      </div>
    `;
    return;
  }

  commitFeedContainer.innerHTML = commitsList
    .map((c) => {
      const commitAuthorName = c.commit.author.name;
      const avatarUrl = c.author ? c.author.avatar_url : `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60`;
      const commitDate = new Date(c.commit.author.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const shortSha = c.sha.substring(0, 7);

      return `
        <div class="bg-surface border border-outline-variant rounded-md p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-on-surface-variant/40 duration-150">
          <div class="flex items-start space-x-3.5">
            <img src="${avatarUrl}" alt="${commitAuthorName}" class="w-7 h-7 rounded-full border border-outline-variant object-cover shrink-0 mt-0.5" />
            <div>
              <p class="font-sans text-xs font-semibold text-on-surface leading-tight hover:text-primary transition-colors">
                <a href="${c.html_url}" target="_blank" rel="noopener noreferrer">${c.commit.message}</a>
              </p>
              <div class="flex flex-wrap items-center space-x-2 text-[10px] text-on-surface-variant font-mono mt-1 select-none">
                <span class="font-bold text-on-surface">${commitAuthorName}</span>
                <span class="text-outline-variant">|</span>
                <span>committed ${commitDate}</span>
              </div>
            </div>
          </div>
          <a
            href="${c.html_url}"
            target="_blank"
            rel="noopener noreferrer"
            class="self-start md:self-auto font-mono text-[10px] text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low border border-outline-variant rounded px-2 py-0.5 transition-colors shrink-0"
          >
            ${shortSha}
          </a>
        </div>
      `;
    })
    .join('');
}

function renderCommitsError() {
  if (!commitFeedContainer) return;
  commitFeedContainer.innerHTML = `
    <div class="py-12 text-center text-on-surface-variant font-mono text-xs border border-outline-variant bg-surface rounded">
      Unable to reach GitHub commits feed.
    </div>
  `;
}

// Render Contributors
function renderContributors() {
  if (!contributorsGrid) return;

  if (contributorsList.length === 0) {
    contributorsGrid.innerHTML = `
      <div class="col-span-5 py-12 text-center text-on-surface-variant font-mono text-xs">
        No contributor data found.
      </div>
    `;
    return;
  }

  contributorsGrid.innerHTML = contributorsList
    .map((contrib) => {
      return `
        <a
          href="${contrib.html_url}"
          target="_blank"
          rel="noopener noreferrer"
          class="bg-surface border border-outline-variant rounded-lg p-3.5 flex flex-col items-center text-center transition-all duration-150 hover:border-on-surface-variant/40 hover:-translate-y-0.5"
        >
          <img src="${contrib.avatar_url}" alt="${contrib.login}" class="w-10 h-10 rounded-full border border-outline-variant mb-2.5 object-cover" />
          <h3 class="font-sans text-xs font-semibold text-on-surface truncate w-full mb-0.5">
            ${contrib.login}
          </h3>
          <span class="font-mono text-[9px] text-on-surface-variant uppercase tracking-wider">
            ${contrib.contributions} contributions
          </span>
        </a>
      `;
    })
    .join('');
}

function renderContributorsError() {
  if (!contributorsGrid) return;
  contributorsGrid.innerHTML = `
    <div class="col-span-5 py-8 text-center text-on-surface-variant font-mono text-xs border border-outline-variant bg-surface rounded">
      Unable to query contributor listings.
    </div>
  `;
}

/* ==========================================================================
   Page Scrolling & Active Section Highlighting
   ========================================================================== */

function setupNavigationListeners() {
  // Smooth scroll links
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const targetId = link.getAttribute('data-nav');
      if (targetId) {
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  // Highlight links based on visible sections using Intersection Observer
  const sections = ['stats', 'explorer', 'commits', 'community', 'download'];
  sections.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          navLinks.forEach((lnk) => {
            if (lnk.getAttribute('data-nav') === id) {
              lnk.classList.add('bg-surface-container-high', 'text-on-surface');
              lnk.classList.remove('text-on-surface-variant');
            } else {
              lnk.classList.remove('bg-surface-container-high', 'text-on-surface');
              lnk.classList.add('text-on-surface-variant');
            }
          });
        }
      },
      { rootMargin: '-10% 0px -70% 0px' }
    );
    observer.observe(el);
  });
}

/* ==========================================================================
   Interactive Event Delegations & Dynamic Bindings
   ========================================================================== */

function setupInteractionBindings() {
  // Breadcrumbs click navigation
  if (breadcrumbsContainer) {
    breadcrumbsContainer.addEventListener('click', (e) => {
      const button = e.target.closest('[data-breadcrumb-idx]');
      if (!button) return;
      const idxStr = button.getAttribute('data-breadcrumb-idx');
      if (idxStr === null) return;
      const index = parseInt(idxStr, 10);

      if (index === 0) {
        currentExplorerPath = '';
      } else {
        const parts = currentExplorerPath.split('/');
        currentExplorerPath = parts.slice(0, index).join('/');
      }
      fetchExplorerContents(currentExplorerPath);
    });
  }

  // File explorer row selection
  if (explorerListContainer) {
    // Parent Directory navigate up
    explorerListContainer.addEventListener('click', (e) => {
      const parentBtn = e.target.closest('#btn-parent-dir');
      if (parentBtn) {
        const parts = currentExplorerPath.split('/');
        parts.pop();
        currentExplorerPath = parts.join('/');
        fetchExplorerContents(currentExplorerPath);
        return;
      }

      // File/folder row selection
      const rowBtn = e.target.closest('[data-item-idx]');
      if (!rowBtn) return;
      const idxStr = rowBtn.getAttribute('data-item-idx');
      if (idxStr === null) return;
      const index = parseInt(idxStr, 10);

      const sorted = [...explorerContents].sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'dir' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      const filtered = sorted.filter((item) =>
        item.name.toLowerCase().includes(fileExplorerSearchQuery.toLowerCase())
      );

      const clickedItem = filtered[index];
      if (!clickedItem) return;

      if (clickedItem.type === 'dir') {
        currentExplorerPath = clickedItem.path;
        fetchExplorerContents(currentExplorerPath);
      } else {
        selectedFileItem = clickedItem;
        renderExplorer(); // Refresh selection state in UI
        renderFileDetails();
      }
    });
  }

  // Retry explorer button
  document.addEventListener('click', (e) => {
    const retryBtn = e.target.closest('#btn-explorer-retry');
    if (retryBtn) {
      fetchExplorerContents(currentExplorerPath);
    }
  });

  // Search filter
  if (fileSearchInput) {
    fileSearchInput.addEventListener('input', () => {
      fileExplorerSearchQuery = fileSearchInput.value;
      renderExplorer();
    });
  }

  // Refresh commits
  if (btnRefreshCommits) {
    btnRefreshCommits.addEventListener('click', () => {
      fetchCommits();
    });
  }

  // Lock message toggle (Download section)
  if (btnLock && downloadMessage) {
    btnLock.addEventListener('click', () => {
      downloadMessage.classList.toggle('hidden');
    });
  }

  // Hero navigate explore button
  if (btnExplore) {
    btnExplore.addEventListener('click', () => {
      const targetEl = document.getElementById('explorer');
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // Back to Top button
  if (btnScrollTop) {
    btnScrollTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        btnScrollTop.classList.remove('hidden');
      } else {
        btnScrollTop.classList.add('hidden');
      }
    });
  }
}

/* ==========================================================================
   Initialization Execution
   ========================================================================== */

function init() {
  setupNavigationListeners();
  setupInteractionBindings();

  // Load Initial API Data
  fetchRepoMeta();
  fetchCommits();
  fetchContributors();
  fetchExplorerContents(currentExplorerPath);
}

// Kickoff
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
