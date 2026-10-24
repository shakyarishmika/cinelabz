/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  serverExternalPackages: ['firebase-admin'],
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  // 🔹 CORS Block වෙන එක නවත්වන්න Rewrites එකතු කර ඇත
  async rewrites() {
    return [
      {
        source: '/api/proxy/baiscope/:path*',
        destination: 'https://media.baiscopewatch.com/file/Movies01-Baiscopelk/:path*',
      },
    ];
  },
};

export default nextConfig;