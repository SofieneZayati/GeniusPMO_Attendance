module.exports = ({ config }) => {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? "";
  const lanDiscoveryEnabled = process.env.EXPO_PUBLIC_ENABLE_LAN_DISCOVERY === "true";
  const allowCleartextTraffic = lanDiscoveryEnabled || apiBaseUrl.startsWith("http://");

  if (process.env.EAS_BUILD_PROFILE === "production") {
    let productionUrl;
    try {
      productionUrl = new URL(apiBaseUrl);
    } catch {
      throw new Error(
        "Production builds require EXPO_PUBLIC_API_BASE_URL to be a valid HTTPS URL ending in /api/v1."
      );
    }
    if (productionUrl.protocol !== "https:" || !productionUrl.pathname.endsWith("/api/v1")) {
      throw new Error(
        "Production builds require EXPO_PUBLIC_API_BASE_URL to be an HTTPS URL ending in /api/v1."
      );
    }
  }

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic: allowCleartextTraffic
          }
        }
      ]
    ]
  };
};
