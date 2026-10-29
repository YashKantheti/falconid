import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: [
    "@huggingface/transformers",
    "onnxruntime-node",
    "sharp",
  ],
  outputFileTracingIncludes: {
    "/api/identify": [
      "./models/dinov2-small/**/*",
      "./data/recognition-index.json",
      "./public/assets/components/**/*",
      "./public/catalog/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**/*",
    ],
  },
  outputFileTracingExcludes: {
    "/api/identify": [
      "./public/models/**/*",
      "./public/vendor/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v6/darwin/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v6/win32/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**/*",
      // This endpoint uses the CPU provider; CUDA libraries can exceed Vercel's bundle limit.
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/libonnxruntime_providers_*.so",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};
export default config;
