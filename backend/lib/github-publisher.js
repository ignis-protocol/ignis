const { applyPatch, parsePatch } = require('diff');
const { normalizePatchPath } = require('./publication-policy');

class GitHubPublisher {
  constructor(env = process.env) {
    this.env = env;
  }

  status() {
    return {
      configured: Boolean(this.env.GITHUB_APP_ID && this.env.GITHUB_APP_INSTALLATION_ID && this.env.GITHUB_APP_PRIVATE_KEY),
      allowed_repositories: String(this.env.GITHUB_ALLOWED_REPOSITORIES || 'ignis-protocol/ignis').split(',').map(item => item.trim()).filter(Boolean),
      default_base_branch: this.env.GITHUB_DEFAULT_BASE_BRANCH || 'main',
    };
  }

  async publish({ repo, baseBranch, branchName, title, body, patch }) {
    if (!this.status().configured) throw new Error('GitHub App publication is not configured.');
    const [owner, repoName] = String(repo || '').split('/');
    if (!owner || !repoName) throw new Error('Repository must be in owner/name format.');
    const request = await this.request();
    const base = baseBranch || this.env.GITHUB_DEFAULT_BASE_BRANCH || 'main';
    const baseRef = await request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
      owner,
      repo: repoName,
      ref: `heads/${base}`,
    });
    const baseSha = baseRef.data.object.sha;
    const baseCommit = await request('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', {
      owner,
      repo: repoName,
      commit_sha: baseSha,
    });

    await this.createBranch(request, owner, repoName, branchName, baseSha);
    const tree = await this.createPatchedTree(request, owner, repoName, baseSha, baseCommit.data.tree.sha, patch);
    const commit = await request('POST /repos/{owner}/{repo}/git/commits', {
      owner,
      repo: repoName,
      message: title,
      tree: tree.data.sha,
      parents: [baseSha],
      author: this.author(),
      committer: this.author(),
    });
    await request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
      owner,
      repo: repoName,
      ref: `heads/${branchName}`,
      sha: commit.data.sha,
      force: false,
    });
    const pull = await request('POST /repos/{owner}/{repo}/pulls', {
      owner,
      repo: repoName,
      title,
      body,
      head: branchName,
      base,
      maintainer_can_modify: true,
    });
    return {
      branch: branchName,
      base_branch: base,
      commit_sha: commit.data.sha,
      pr_number: pull.data.number,
      pr_url: pull.data.html_url,
      pr_state: pull.data.state,
    };
  }

  async syncPullRequest({ repo, prNumber }) {
    if (!this.status().configured) throw new Error('GitHub App publication is not configured.');
    const [owner, repoName] = String(repo || '').split('/');
    const request = await this.request();
    const pull = await request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner,
      repo: repoName,
      pull_number: prNumber,
    });
    return {
      pr_number: pull.data.number,
      pr_url: pull.data.html_url,
      pr_state: pull.data.state,
      merged: Boolean(pull.data.merged),
      mergeable: pull.data.mergeable,
      head_sha: pull.data.head?.sha || null,
    };
  }

  async request() {
    const { createAppAuth } = await import('@octokit/auth-app');
    const { request } = await import('@octokit/request');
    return request.defaults({
      request: {
        hook: createAppAuth({
          appId: this.env.GITHUB_APP_ID,
          privateKey: String(this.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
          installationId: this.env.GITHUB_APP_INSTALLATION_ID,
        }).hook,
      },
    });
  }

  async createBranch(request, owner, repo, branchName, sha) {
    try {
      await request('POST /repos/{owner}/{repo}/git/refs', {
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha,
      });
    } catch (error) {
      if (error.status !== 422) throw error;
      throw new Error(`Publication branch already exists: ${branchName}`);
    }
  }

  async createPatchedTree(request, owner, repo, baseSha, baseTreeSha, patch) {
    const tree = [];
    for (const filePatch of parsePatch(patch)) {
      const path = normalizePatchPath(filePatch.newFileName === '/dev/null' ? filePatch.oldFileName : filePatch.newFileName);
      if (!path || path === '/dev/null') throw new Error('Patch contains an invalid file path.');
      const deletesFile = filePatch.newFileName === '/dev/null';
      if (deletesFile) {
        tree.push({ path, mode: '100644', type: 'blob', sha: null });
        continue;
      }
      const source = await this.readFile(request, owner, repo, path, baseSha);
      const next = applyPatch(source, filePatch);
      if (next === false) throw new Error(`Unable to apply patch for ${path}.`);
      const blob = await request('POST /repos/{owner}/{repo}/git/blobs', {
        owner,
        repo,
        content: next,
        encoding: 'utf-8',
      });
      tree.push({ path, mode: '100644', type: 'blob', sha: blob.data.sha });
    }
    return request('POST /repos/{owner}/{repo}/git/trees', {
      owner,
      repo,
      base_tree: baseTreeSha,
      tree,
    });
  }

  async readFile(request, owner, repo, path, ref) {
    try {
      const response = await request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path,
        ref,
      });
      if (Array.isArray(response.data) || response.data.type !== 'file') return '';
      return Buffer.from(response.data.content || '', 'base64').toString('utf8');
    } catch (error) {
      if (error.status === 404) return '';
      throw error;
    }
  }

  author() {
    return {
      name: this.env.GITHUB_BOT_NAME || 'IGNIS',
      email: this.env.GITHUB_BOT_EMAIL || 'ignis-protocol[bot]@users.noreply.github.com',
      date: new Date().toISOString(),
    };
  }
}

module.exports = { GitHubPublisher };
