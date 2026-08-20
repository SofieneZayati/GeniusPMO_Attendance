import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets
} from "react-native-safe-area-context";
import { HrmsApiError, hrmsApi } from "./src/api/hrms";
import { sessionStore } from "./src/auth/session";
import { colors } from "./src/theme";
import type { CurrentUser, MobileTodayResponse, WorkMode } from "./src/types";

type Tab = "today" | "profile";
type AvatarSize = "small" | "medium" | "large";

const workModeCopy: Record<WorkMode, { icon: string; label: string; detail: string }> = {
  office: {
    icon: "🏢",
    label: "Office",
    detail: "Office attendance requires company-network verification in production."
  },
  remote: {
    icon: "🏠",
    label: "Remote",
    detail: "Your HRMS schedule marks today as remote work."
  },
  externalSite: {
    icon: "📍",
    label: "External site",
    detail: "Your HRMS schedule marks today as external-site work."
  },
  leave: {
    icon: "🌴",
    label: "Leave",
    detail: "You are on approved leave today."
  },
  notScheduled: {
    icon: "—",
    label: "Not scheduled",
    detail: "No working schedule is assigned for today."
  }
};

function ensureEmployeeMobileAccess(user: CurrentUser) {
  if (user.must_change_password) {
    throw new Error(
      "Complete your first password setup in the HRMS web app before using mobile attendance."
    );
  }
  if (user.employee_id === null || !user.permissions.includes("self.read")) {
    throw new Error("This mobile app is available only to active employee accounts.");
  }
}

function displayError(error: unknown) {
  if (error instanceof HrmsApiError) {
    if (error.status === 401) return "Invalid e-mail or password.";
    if (error.status === 403) return error.message;
    return `HRMS connection failed: ${error.message}`;
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const [booting, setBooting] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [tab, setTab] = useState<Tab>("today");
  const [data, setData] = useState<MobileTodayResponse | null>(null);

  useEffect(() => {
    void restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const storedToken = await sessionStore.getAccessToken();
      if (!storedToken) return;
      const user = await hrmsApi.me(storedToken);
      ensureEmployeeMobileAccess(user);
      const today = await hrmsApi.today(storedToken);
      setAccessToken(storedToken);
      setData(today);
    } catch (error) {
      await sessionStore.clearAccessToken();
      setLoginError(
        error instanceof HrmsApiError && error.status === 401
          ? "Your saved session expired. Sign in again."
          : displayError(error)
      );
    } finally {
      setBooting(false);
    }
  }

  async function signIn() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setLoginError("Enter your work e-mail and password.");
      return;
    }

    setLoginLoading(true);
    setLoginError("");
    try {
      const result = await hrmsApi.login(normalizedEmail, password);
      ensureEmployeeMobileAccess(result.user);
      const today = await hrmsApi.today(result.access_token);
      await sessionStore.setAccessToken(result.access_token);
      setAccessToken(result.access_token);
      setData(today);
      setPassword("");
    } catch (error) {
      setLoginError(displayError(error));
    } finally {
      setLoginLoading(false);
    }
  }

  async function refreshToday() {
    if (!accessToken) return;
    setRefreshing(true);
    setAttendanceError("");
    try {
      setData(await hrmsApi.today(accessToken));
    } catch (error) {
      if (error instanceof HrmsApiError && error.status === 401) {
        await signOut();
        setLoginError("Your session expired. Sign in again.");
      } else {
        setAttendanceError(displayError(error));
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function recordAttendance() {
    if (!accessToken || !data) return;
    const action = data.attendance.canCheckOut
      ? "check_out"
      : data.attendance.canCheckIn
        ? "check_in"
        : null;
    if (!action) return;

    setAttendanceLoading(true);
    setAttendanceError("");
    try {
      await hrmsApi.recordAttendance(accessToken, action);
      setData(await hrmsApi.today(accessToken));
    } catch (error) {
      if (error instanceof HrmsApiError && error.status === 401) {
        await signOut();
        setLoginError("Your session expired. Sign in again.");
      } else {
        setAttendanceError(displayError(error));
      }
    } finally {
      setAttendanceLoading(false);
    }
  }

  async function signOut() {
    await sessionStore.clearAccessToken();
    setAccessToken(null);
    setData(null);
    setTab("today");
    setAttendanceError("");
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "right", "bottom", "left"]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.workspace} />
        <View style={styles.loadingPage}>
          <ActivityIndicator size="large" color={colors.navy} />
          <Text style={styles.loadingText}>Connecting to HRMS…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!accessToken || !data) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "right", "bottom", "left"]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.workspace} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
          style={styles.flexOne}
        >
          <ScrollView
            style={styles.loginScroll}
            contentContainerStyle={styles.loginScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.loginBody}>
              <BrandLockup />
              <Text style={styles.loginTitle}>Attendance</Text>
              <Text style={styles.loginSubtitle}>
                Sign in with your existing HRMS employee account.
              </Text>

              <View style={styles.loginCard}>
                <Field
                  label="Work email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!loginLoading}
                  returnKeyType="next"
                />
                <Field
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!loginLoading}
                  returnKeyType="go"
                  onSubmitEditing={() => void signIn()}
                />
                {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={loginLoading}
                  onPress={() => void signIn()}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    loginLoading && styles.disabledButton,
                    pressed && !loginLoading && styles.pressed
                  ]}
                >
                  {loginLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Sign in</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "right", "left"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <View style={styles.appShell}>
        <View style={styles.topBar}>
          <View style={styles.topBrandBlock}>
            <BrandLockup compact />
            <Text style={styles.topTitle}>Attendance</Text>
          </View>
          <EmployeeAvatar employee={data.employee} accessToken={accessToken} size="small" />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === "today" ? (
            <TodayScreen
              data={data}
              accessToken={accessToken}
              refreshing={refreshing}
              attendanceLoading={attendanceLoading}
              attendanceError={attendanceError}
              onRefresh={() => void refreshToday()}
              onAttendance={() => void recordAttendance()}
            />
          ) : (
            <ProfileScreen
              data={data}
              accessToken={accessToken}
              onSignOut={() => void signOut()}
            />
          )}
        </ScrollView>

        <View
          style={[
            styles.tabBar,
            {
              minHeight: 62 + insets.bottom,
              paddingBottom: Math.max(insets.bottom, 10)
            }
          ]}
        >
          <TabButton label="Today" active={tab === "today"} onPress={() => setTab("today")} />
          <TabButton label="Profile" active={tab === "profile"} onPress={() => setTab("profile")} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <Image
      accessibilityLabel="LeadX logo"
      source={require("./assets/leadx-logo-blue.png")}
      resizeMode="contain"
      style={compact ? styles.brandWordmarkCompact : styles.brandWordmark}
    />
  );
}

function EmployeeAvatar({
  employee,
  accessToken,
  size
}: {
  employee: MobileTodayResponse["employee"];
  accessToken: string;
  size: AvatarSize;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    setPhotoFailed(false);
  }, [employee.id, employee.hasProfilePhoto, accessToken]);

  const containerStyle =
    size === "large"
      ? styles.profileAvatar
      : size === "medium"
        ? styles.profileMiniAvatar
        : styles.avatar;
  const textStyle =
    size === "large"
      ? styles.profileAvatarText
      : size === "medium"
        ? styles.profileMiniAvatarText
        : styles.avatarText;

  return (
    <View style={containerStyle}>
      {employee.hasProfilePhoto && !photoFailed ? (
        <Image
          source={hrmsApi.profilePhotoSource(accessToken)}
          resizeMode="cover"
          style={styles.avatarPhoto}
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <Text style={textStyle}>{initialsFor(employee.name)}</Text>
      )}
    </View>
  );
}

function TodayScreen({
  data,
  accessToken,
  refreshing,
  attendanceLoading,
  attendanceError,
  onRefresh,
  onAttendance
}: {
  data: MobileTodayResponse;
  accessToken: string;
  refreshing: boolean;
  attendanceLoading: boolean;
  attendanceError: string;
  onRefresh: () => void;
  onAttendance: () => void;
}) {
  const attendance = data.attendance;
  const mode = workModeCopy[attendance.workMode];
  const status = useMemo(() => {
    if (attendance.state === "working") return { label: "Working", tone: "success" as const };
    if (attendance.state === "completed") return { label: "Completed", tone: "success" as const };
    if (attendance.workMode === "leave") return { label: "On leave", tone: "muted" as const };
    if (attendance.workMode === "notScheduled") return { label: "Not scheduled", tone: "muted" as const };
    return { label: "Not checked in", tone: "muted" as const };
  }, [attendance.state, attendance.workMode]);
  const actionLabel = attendance.state === "working" ? "Check out" : "Check in";
  const canSubmit = attendance.canCheckIn || attendance.canCheckOut;
  const showAction =
    attendance.state !== "completed" &&
    attendance.workMode !== "leave" &&
    attendance.workMode !== "notScheduled";
  const officeVerificationPending =
    attendance.workMode === "office" && !attendance.officeNetworkVerified;

  return (
    <>
      <View style={styles.welcomeRow}>
        <EmployeeAvatar employee={data.employee} accessToken={accessToken} size="medium" />
        <View style={styles.flexOne}>
          <Text style={styles.hello}>Hello, {data.employee.name.split(" ")[0]}</Text>
          <Text style={styles.employeeLine}>
            {data.employee.position} · {data.employee.department}
          </Text>
        </View>
        <Pressable onPress={onRefresh} disabled={refreshing} style={styles.refreshButton}>
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.blue} />
          ) : (
            <Text style={styles.refreshText}>Refresh</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>TODAY</Text>
        <Text style={styles.dateTitle}>{formatDate(attendance.date)}</Text>
        <View style={styles.scheduleRow}>
          <View>
            <Text style={styles.mutedLabel}>Schedule</Text>
            <Text style={styles.scheduleValue}>
              {attendance.start} → {attendance.end}
            </Text>
          </View>
          <View style={styles.modePill}>
            <Text style={styles.modePillText}>
              {mode.icon} {mode.label}
            </Text>
          </View>
        </View>
        <Text style={styles.modeDetail}>{mode.detail}</Text>
      </View>

      <View style={[styles.card, styles.attendanceCard]}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardEyebrow}>ATTENDANCE</Text>
            <Text style={styles.cardTitle}>Today's presence</Text>
          </View>
          <StatusChip label={status.label} tone={status.tone} />
        </View>

        <View style={styles.timeGrid}>
          <TimeBox label="Check in" value={attendance.checkIn ?? "--:--"} />
          <TimeBox label="Check out" value={attendance.checkOut ?? "--:--"} />
        </View>

        {showAction ? (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={!canSubmit || attendanceLoading}
              onPress={onAttendance}
              style={({ pressed }) => [
                styles.attendanceActionButton,
                (!canSubmit || attendanceLoading) && styles.attendanceActionButtonDisabled,
                pressed && canSubmit && !attendanceLoading && styles.pressed
              ]}
            >
              {attendanceLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.attendanceActionText}>{actionLabel}</Text>
              )}
            </Pressable>
            {officeVerificationPending ? (
              <Text style={styles.actionHint}>
                Connect through the verified company network to use office attendance.
              </Text>
            ) : (
              <Text style={styles.actionHint}>This attendance action is recorded directly in HRMS.</Text>
            )}
          </>
        ) : attendance.state === "completed" ? (
          <Text style={styles.completedHint}>Today's attendance is complete.</Text>
        ) : null}

        {attendanceError ? <Text style={styles.attendanceError}>{attendanceError}</Text> : null}
      </View>
    </>
  );
}

function ProfileScreen({
  data,
  accessToken,
  onSignOut
}: {
  data: MobileTodayResponse;
  accessToken: string;
  onSignOut: () => void;
}) {
  const employee = data.employee;
  return (
    <>
      <View style={styles.profileHero}>
        <EmployeeAvatar employee={employee} accessToken={accessToken} size="large" />
        <Text style={styles.profileName}>{employee.name}</Text>
        <Text style={styles.employeeNumber}>{employee.employeeNo}</Text>
        <Text style={styles.profileRole}>{employee.position}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>WORK PROFILE</Text>
        <Detail label="Department" value={employee.department} />
        <Detail label="Team" value={employee.team} />
        <Detail label="Manager" value={employee.manager} />
        <Detail label="Work email" value={employee.email} />
        <Detail label="Phone" value={employee.phone} />
        <Detail label="Contract" value={employee.contractType} />
        <Detail label="Start date" value={employee.startDate} last />
      </View>

      <Pressable onPress={onSignOut} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Sign out</Text>
      </Pressable>
    </>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor="#94A3B8" style={styles.input} {...inputProps} />
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function TimeBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.timeBox}>
      <Text style={styles.mutedLabel}>{label}</Text>
      <Text style={styles.timeValue}>{value}</Text>
    </View>
  );
}

function StatusChip({ label, tone }: { label: string; tone: "success" | "muted" }) {
  return (
    <View style={tone === "success" ? styles.statusSuccess : styles.statusMuted}>
      <Text style={tone === "success" ? styles.statusSuccessText : styles.statusMutedText}>
        {label}
      </Text>
    </View>
  );
}

function Detail({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "—"}</Text>
    </View>
  );
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
}

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.workspace },
  appShell: { flex: 1, backgroundColor: colors.workspace },
  loadingPage: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: colors.muted, fontSize: 13 },
  loginScroll: { flex: 1, backgroundColor: colors.workspace },
  loginScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 28
  },
  loginBody: { width: "100%", maxWidth: 560, alignSelf: "center" },
  brandWordmark: { width: 164, height: 42, marginBottom: 18 },
  brandWordmarkCompact: { width: 118, height: 30 },
  loginTitle: { color: colors.ink, fontSize: 36, fontWeight: "800" },
  loginSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 24
  },
  loginCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line
  },
  fieldWrap: { gap: 7, marginBottom: 14 },
  fieldLabel: { color: colors.text, fontSize: 12, fontWeight: "700" },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: colors.ink,
    backgroundColor: "#FBFCFE"
  },
  errorText: { color: colors.danger, fontSize: 11, lineHeight: 16, marginBottom: 10 },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy,
    marginTop: 4
  },
  primaryButtonText: { color: "white", fontWeight: "800", fontSize: 14 },
  disabledButton: { opacity: 0.6 },
  pressed: { opacity: 0.86 },
  topBar: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface
  },
  topBrandBlock: { justifyContent: "center" },
  topTitle: { color: colors.ink, fontSize: 17, fontWeight: "800", marginTop: 3 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  avatarText: { color: colors.blue, fontSize: 12, fontWeight: "800" },
  avatarPhoto: { width: "100%", height: "100%" },
  content: { padding: 16, paddingBottom: 28, gap: 14 },
  welcomeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  profileMiniAvatar: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  profileMiniAvatarText: { color: "white", fontWeight: "800" },
  hello: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  employeeLine: { color: colors.muted, fontSize: 12, marginTop: 3 },
  refreshButton: {
    minWidth: 60,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  refreshText: { color: colors.blue, fontSize: 11, fontWeight: "800" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line
  },
  cardEyebrow: { color: colors.blue, fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  dateTitle: { color: colors.ink, fontSize: 23, fontWeight: "800", marginTop: 5 },
  scheduleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 22,
    gap: 12
  },
  mutedLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  scheduleValue: { color: colors.ink, fontSize: 18, fontWeight: "800", marginTop: 4 },
  modePill: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.blueSoft
  },
  modePillText: { color: colors.blue, fontSize: 11, fontWeight: "800" },
  modeDetail: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 14 },
  attendanceCard: { paddingBottom: 16 },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  cardTitle: { color: colors.ink, fontSize: 19, fontWeight: "800", marginTop: 4 },
  statusSuccess: {
    backgroundColor: colors.successSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  statusSuccessText: { color: colors.success, fontSize: 10, fontWeight: "800" },
  statusMuted: {
    backgroundColor: colors.workspace,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  statusMutedText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  timeGrid: { flexDirection: "row", gap: 10, marginTop: 20 },
  timeBox: { flex: 1, backgroundColor: colors.workspace, borderRadius: 16, padding: 14 },
  timeValue: { color: colors.ink, fontSize: 21, fontWeight: "800", marginTop: 4 },
  attendanceActionButton: {
    minHeight: 52,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy,
    marginTop: 16
  },
  attendanceActionButtonDisabled: { opacity: 0.4 },
  attendanceActionText: { color: "white", fontSize: 14, fontWeight: "800" },
  actionHint: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 9,
    paddingHorizontal: 6
  },
  completedHint: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 16
  },
  attendanceError: {
    color: colors.danger,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 10
  },
  profileHero: { alignItems: "center", paddingVertical: 16 },
  profileAvatar: {
    width: 82,
    height: 82,
    borderRadius: 27,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  profileAvatarText: { color: "white", fontSize: 24, fontWeight: "800" },
  profileName: { color: colors.ink, fontSize: 24, fontWeight: "800", marginTop: 12 },
  employeeNumber: { color: colors.blue, fontSize: 11, fontWeight: "800", marginTop: 3 },
  profileRole: { color: colors.muted, fontSize: 12, marginTop: 5 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  detailRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  detailLabel: { color: colors.muted, fontSize: 11, flex: 1 },
  detailValue: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
    flex: 1.5,
    textAlign: "right"
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface
  },
  tabButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center"
  },
  tabButtonActive: { backgroundColor: colors.blueSoft },
  tabText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  tabTextActive: { color: colors.blue }
});
