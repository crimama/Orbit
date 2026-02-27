/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["node-pty", "ssh2"],
  },
};

export default nextConfig;
