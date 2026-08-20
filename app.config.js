module.exports = ({ config }) => {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? "";
  const lanDiscoveryEnabled = process.env.EXPO_PUBLIC_ENABLE_LAN_DISCOVERY === "true";
  const allowCleartextTraffic = lanDiscoveryEnabled || apiBaseUrl.startsWith("http://");

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
