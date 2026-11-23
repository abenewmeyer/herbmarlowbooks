import { ensureProject } from "./unpack-bundle.mjs";
await ensureProject(); // restores src/ from app-bundle.zip if the folder did not upload

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["unpdf", "mammoth"],
  typescript: { ignoreBuildErrors: false },
};
export default nextConfig;
