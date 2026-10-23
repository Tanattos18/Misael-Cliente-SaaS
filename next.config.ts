import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sistema interno com dados por usuário: todas as páginas são dinâmicas,
  // então usamos o modelo de cache tradicional (sem Cache Components).
  serverExternalPackages: ["@electric-sql/pglite", "exceljs", "jspdf", "jspdf-autotable"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
