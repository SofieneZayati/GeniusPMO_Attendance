import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { HrmsApiError, hrmsApi } from "./src/api/hrms";
import { sessionStore } from "./src/auth/session";
import { colors } from "./src/theme";
import type { CurrentUser, MobileTodayResponse, WorkMode } from "./src/types";

type Tab = "today" | "profile";

const workModeCopy: Record<WorkMode, { icon: string; label: string; detail: string }> = {
  office: {
    icon: "🏢",
    label: "Office",
    detail: "Office attendance will require company-network verification."
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
    throw new Error("Complete your first password setup in the HRMS web app before using mobile attendance.");
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
  const [booting, setBooting] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState("sofiene.zayati@geniuspmo.com");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
    try {
      setData(await hrmsApi.today(accessToken));
    } catch (error) {
      if (error instanceof HrmsApiError && error.status === 401) {
        await signOut();
        setLoginError("Your session expired. Sign in again.");
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function signOut() {
    await sessionStore.clearAccessToken();
    setAccessToken(null);
    setData(null);
    setTab("today");
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingPage}>
          <ActivityIndicator size="large" color={colors.navy} />
          <Text style={styles.loadingText}>Connecting to HRMS…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!accessToken || !data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.loginPage}
        >
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>G</Text></View>
          <Text style={styles.loginEyebrow}>GENIUS PMO</Text>
          <Text style={styles.loginTitle}>Attendance</Text>
          <Text style={styles.loginSubtitle}>Sign in with your existing HRMS employee account.</Text>

          <View style={styles.loginCard}>
            <Field
              label="Work email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!loginLoading}
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loginLoading}
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.appShell}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.topEyebrow}>GENIUS PMO</Text>
            <Text style={styles.topTitle}>Attendance</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsFor(data.employee.name)}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === "today" ? (
            <TodayScreen data={data} refreshing={refreshing} onRefresh={() => void refreshToday()} />
          ) : (
            <ProfileScreen data={data} onSignOut={() => void signOut()} />
          )}
        </ScrollView>

        <View style={styles.tabBar}>
          <TabButton label="Today" active={tab === "today"} onPress={() => setTab("today")} />
          <TabButton label="Profile" active={tab === "profile"} onPress={() => setTab("profile")} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function TodayScreen({
  data,
  refreshing,
  onRefresh
}: {
  data: MobileTodayResponse;
  refreshing: boolean;
  onRefresh: () => void;
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

  return (
    <>
      <View style={styles.welcomeRow}>
        <View style={styles.profileMiniAvatar}>
          <Text style={styles.profileMiniAvatarText}>{initialsFor(data.employee.name)}</Text>
        </View>
        <View style={styles.flexOne}>
          <Text style={styles.hello}>Hello, {data.employee.name.split(" ")[0]}</Text>
          <Text style={styles.employeeLine}>{data.employee.position} · {data.employee.department}</Text>
        </View>
        <Pressable onPress={onRefresh} disabled={refreshing} style={styles.refreshButton}>
          {refreshing ? <ActivityIndicator size="small" color={colors.blue} /> : <Text style={styles.refreshText}>Refresh</Text>}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>TODAY</Text>
        <Text style={styles.dateTitle}>{formatDate(attendance.date)}</Text>
        <View style={styles.scheduleRow}>
          <View>
            <Text style={styles.mutedLabel}>Schedule</Text>
            <Text style={styles.scheduleValue}>{attendance.start} → {attendance.end}</Text>
          </View>
          <View style={styles.modePill}>
            <Text style={styles.modePillText}>{mode.icon} {mode.label}</Text>
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

        <View style={styles.integrationNotice}>
          <Text style={styles.integrationNoticeText}>
            Your profile, schedule and attendance status are now loaded from HRMS. Check-in/out submission is the next integration step.
          </Text>
        </View>
      </View>
    </>
  );
}

function ProfileScreen({ data, onSignOut }: { data: MobileTodayResponse; onSignOut: () => void }) {
  const employee = data.employee;
  return (
    <>
      <View style={styles.profileHero}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>{initialsFor(employee.name)}</Text>
        </View>
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
      <Text style={tone === "success" ? styles.statusSuccessText : styles.statusMutedText}>{label}</Text>
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
  safeArea: { flex: 1, backgroundColor: colors.workspace },
  appShell: { flex: 1, backgroundColor: colors.workspace },
  loadingPage: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: colors.muted, fontSize: 13 },
  loginPage: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.workspace },
  brandMark: { width: 54, height: 54, borderRadius: 17, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  brandMarkText: { color: "white", fontSize: 26, fontWeight: "800" },
  loginEyebrow: { color: colors.blue, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  loginTitle: { color: colors.ink, fontSize: 36, fontWeight: "800", marginTop: 4 },
  loginSubtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 24 },
  loginCard: { backgroundColor: colors.surface, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: colors.line },
  fieldWrap: { gap: 7, marginBottom: 14 },
  fieldLabel: { color: colors.text, fontSize: 12, fontWeight: "700" },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 14, color: colors.ink, backgroundColor: "#FBFCFE" },
  errorText: { color: colors.danger, fontSize: 11, lineHeight: 16, marginBottom: 10 },
  primaryButton: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy, marginTop: 4 },
  primaryButtonText: { color: "white", fontWeight: "800", fontSize: 14 },
  disabledButton: { opacity: 0.6 },
  pressed: { opacity: 0.86 },
  topBar: { minHeight: 72, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface },
  topEyebrow: { color: colors.blue, fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  topTitle: { color: colors.ink, fontSize: 17, fontWeight: "800", marginTop: 2 },
  avatar: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.blue, fontSize: 12, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 28, gap: 14 },
  welcomeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  profileMiniAvatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  profileMiniAvatarText: { color: "white", fontWeight: "800" },
  flexOne: { flex: 1 },
  hello: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  employeeLine: { color: colors.muted, fontSize: 12, marginTop: 3 },
  refreshButton: { minWidth: 60, minHeight: 34, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  refreshText: { color: colors.blue, fontSize: 11, fontWeight: "800" },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: colors.line },
  cardEyebrow: { color: colors.blue, fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  dateTitle: { color: colors.ink, fontSize: 23, fontWeight: "800", marginTop: 5 },
  scheduleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 22, gap: 12 },
  mutedLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  scheduleValue: { color: colors.ink, fontSize: 18, fontWeight: "800", marginTop: 4 },
  modePill: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.blueSoft },
  modePillText: { color: colors.blue, fontSize: 11, fontWeight: "800" },
  modeDetail: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 14 },
  attendanceCard: { paddingBottom: 16 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  cardTitle: { color: colors.ink, fontSize: 19, fontWeight: "800", marginTop: 4 },
  statusSuccess: { backgroundColor: colors.successSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  statusSuccessText: { color: colors.success, fontSize: 10, fontWeight: "800" },
  statusMuted: { backgroundColor: colors.workspace, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  statusMutedText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  timeGrid: { flexDirection: "row", gap: 10, marginTop: 20 },
  timeBox: { flex: 1, backgroundColor: colors.workspace, borderRadius: 16, padding: 14 },
  timeValue: { color: colors.ink, fontSize: 21, fontWeight: "800", marginTop: 4 },
  integrationNotice: { marginTop: 14, borderRadius: 14, padding: 12, backgroundColor: colors.blueSoft },
  integrationNoticeText: { color: colors.blue, fontSize: 10, lineHeight: 15, fontWeight: "600" },
  profileHero: { alignItems: "center", paddingVertical: 16 },
  profileAvatar: { width: 78, height: 78, borderRadius: 26, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  profileAvatarText: { color: "white", fontSize: 24, fontWeight: "800" },
  profileName: { color: colors.ink, fontSize: 24, fontWeight: "800", marginTop: 12 },
  employeeNumber: { color: colors.blue, fontSize: 11, fontWeight: "800", marginTop: 3 },
  profileRole: { color: colors.muted, fontSize: 12, marginTop: 5 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 20, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  detailRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  detailLabel: { color: colors.muted, fontSize: 11, flex: 1 },
  detailValue: { color: colors.text, fontSize: 11, fontWeight: "700", flex: 1.5, textAlign: "right" },
  secondaryButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  tabBar: { flexDirection: "row", padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  tabButton: { flex: 1, minHeight: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  tabButtonActive: { backgroundColor: colors.blueSoft },
  tabText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  tabTextActive: { color: colors.blue }
});
