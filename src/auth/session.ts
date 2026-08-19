import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "geniuspmo.hrms.access-token";

export const sessionStore = {
  getAccessToken: () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string) => SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token),
  clearAccessToken: () => SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY)
};
