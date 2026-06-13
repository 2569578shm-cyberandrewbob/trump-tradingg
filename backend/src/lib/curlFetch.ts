import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export interface CurlResponse {
  status: number;
  body: string;
}

/**
 * HTTP GET via the system `curl` binary.
 *
 * Why curl instead of Node's fetch: some upstreams (notably Truth Social, fronted
 * by Cloudflare) fingerprint and 403 Node's TLS/HTTP client regardless of headers,
 * while serving the SAME public, no-auth endpoint to curl with HTTP 200. curl is a
 * standard HTTP client and these are public read endpoints — no auth, no CAPTCHA
 * solving, no protection circumvention. Requires curl on PATH (present on Windows
 * 10+, macOS, most Linux; the backend Dockerfile installs it).
 */
export async function curlGet(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 20_000,
): Promise<CurlResponse> {
  const args = ['-s', '-S', '--compressed', '--max-time', String(Math.ceil(timeoutMs / 1000)), '-w', '\n__HTTP__:%{http_code}'];
  for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`);
  args.push(url);

  let stdout: string;
  try {
    ({ stdout } = await exec('curl', args, { maxBuffer: 32 * 1024 * 1024, windowsHide: true }));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') throw new Error('system curl not found on PATH (required for Truth Social ingestion)');
    // curl exits non-zero on network errors; surface its stderr.
    throw new Error(`curl failed: ${e.message}`);
  }

  const m = stdout.match(/\n__HTTP__:(\d+)\s*$/);
  const status = m ? Number(m[1]) : 0;
  const body = m ? stdout.slice(0, stdout.lastIndexOf('\n__HTTP__:')) : stdout;
  return { status, body };
}
