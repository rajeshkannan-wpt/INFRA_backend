/** @type {import('next').NextConfig} */
const nextConfig = {
  // packages/* are consumed as TS source directly (see tsconfig "paths"
  // via workspace symlinks) — no transpilePackages needed as long as
  // @wpt/shared, @wpt/api-client, @wpt/crypto stay TS-source-only.
  transpilePackages: ["@wpt/shared", "@wpt/api-client", "@wpt/crypto"],
};

export default nextConfig;
