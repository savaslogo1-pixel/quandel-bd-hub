import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The /prototype folder is a standalone HTML artifact, not part of the app.
  // Workbook uploads go through server actions; allow files up to 15 MB.
  experimental: { serverActions: { bodySizeLimit: "15mb" } },
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
