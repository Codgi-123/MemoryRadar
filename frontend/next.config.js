/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    const apiBase =
      process.env.API_INTERNAL_URL ||
      process.env.INTERNAL_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000";

    const dest = apiBase.replace(/\/$/, "");

    return [
      // Skill 文件直链（供 Agent curl 使用）
      {
        source: "/agent-memory-daily-report/:file*",
        destination: `${dest}/api/skill/:file*`,
      },
      // API 代理
      {
        source: "/api/:path*",
        destination: `${dest}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
