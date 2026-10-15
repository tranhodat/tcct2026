const { timingSafeEqual } = require('node:crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const fail = (status, message) => res.status(status).json({ message });
  if (!['GET', 'PUT'].includes(req.method)) return fail(405, 'Method not allowed');
  const token = (process.env.GITHUB_TOKEN || '').trim();
  const repo = process.env.GITHUB_REPO || 'tranhodat/tcct2026';
  const branch = process.env.GITHUB_BRANCH || 'main';
  const password = process.env.EDIT_PASSWORD;
  if (req.method === 'GET' && req.query.action === 'config') {
    return res.status(200).json({ repo, branch, configured: Boolean(token && password) });
  }
  if (!token || !password) return fail(503, 'Vercel cần GITHUB_TOKEN và EDIT_PASSWORD.');
  const supplied = Buffer.from(String(req.headers['x-edit-password'] || ''));
  const expected = Buffer.from(password);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return fail(401, 'Mật khẩu Edit mode không đúng.');
  const path = String(req.query.path || '');
  if (!(path === 'data/solop-static.json' || /^uploads\/[a-z0-9_./-]+$/.test(path)) || path.split('/').some(p => !p || p === '.' || p === '..')) return fail(400, 'Đường dẫn không hợp lệ.');
  const url = 'https://api.github.com/repos/' + repo + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  const headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  try {
    let body;
    if (req.method === 'PUT') {
      const input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!input || typeof input.content !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.content)) return fail(400, 'Nội dung không hợp lệ.');
      if (input.content.length > 4 * 1024 * 1024) return fail(413, 'Tệp quá lớn (tối đa 3 MB).');
      body = JSON.stringify({ content: input.content, message: path === 'data/solop-static.json' ? 'Update notebook data' : 'Upload ' + path, branch, ...(input.sha ? { sha: input.sha } : {}) });
    }
    const upstream = await fetch(url + (req.method === 'GET' ? '?ref=' + encodeURIComponent(branch) : ''), { method: req.method, headers, ...(body ? { body } : {}) });
    const data = await upstream.json();
    if (!upstream.ok) return fail(upstream.status, upstream.status === 401 ? 'GitHub từ chối GITHUB_TOKEN trên Vercel. Kiểm tra token và Redeploy.' : 'GitHub (' + upstream.status + '): ' + (data.message || 'Request failed'));
    return res.status(upstream.status).json(req.method === 'GET' ? { sha: data.sha } : { content: { path: data.content?.path, download_url: data.content?.download_url } });
  } catch { return fail(502, 'Không kết nối được GitHub hoặc yêu cầu không hợp lệ.'); }
};
