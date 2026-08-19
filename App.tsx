import { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { demoToday } from "./src/data/demo";
import { colors } from "./src/theme";
import type { MobileTodayResponse, WorkMode } from "./src/types";

type Tab = "today" | "profile";

const workModeCopy: Record<WorkMode, { icon: string; label: string; detail: string }> = {
  office: {
    icon: "🏢",
    label: "Office",
    detail: "Company network verification required"
  },
  remote: {
    icon: "🏠",
    label: "Remote",
    detail: "Remote attendance is authorized today"
  },
  externalSite: {
    icon: "📍",
    label: "External site",
    detail: "External attendance is authorized today"
  }
};

export default function App() {
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("sofiene.zayati@geniuspmo.com");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("today");
  const [data, setData] = useState<MobileTodayResponse>(demoToday);

  if (!signedIn) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loginPage}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>G</Text></View>
          <Text style={styles.loginEyebrow}>GENIUS PMO</Text>
          <Text style={styles.loginTitle}>Attendance</Text>
          <Text style={styles.loginSubtitle}>
            Sign in with your existing HRMS employee account.
          </Text>

          <View style={styles.loginCard}>
            <Field label="Work email" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
            <Pressable
              accessibilityRole="button"
              onPress={() => setSignedIn(true)}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>Sign in</Text>
            </Pressable>
            <Text style={styles.prototypeNote}>
              UI prototype: authentication will be connected to the HRMS mobile API next.
            </Text>
          </View>
        </View>
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
          <View style={styles.avatar}><Text style={styles.avatarText}>SZ</Text></View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === "today" ? (
            <TodayScreen data={data} onChange={setData} />
          ) : (
            <ProfileScreen data={data} onSignOut={() => setSignedIn(false)} />
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
  onChange
}: {
  data: MobileTodayResponse;
  onChange: (next: MobileTodayResponse) => void;
}) {
  const attendance = data.attendance;
  const mode = workModeCopy[attendance.workMode];
  const action = attendance.state === "notCheckedIn" ? "Check in" : "Check out";
  const actionEnabled = attendance.state === "notCheckedIn"
    ? attendance.canCheckIn
    : attendance.state === "working" && attendance.canCheckOut;

  const status = useMemo(() => {
    if (attendance.state === "working") return { label: "Working", tone: "success" as const };
    if (attendance.state === "completed") return { label: "Completed", tone: "success" as const };
    return { label: "Not checked in", tone: "muted" as const };
  }, [attendance.state]);

  function simulateAttendanceAction() {
    if (!actionEnabled) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    if (attendance.state === "notCheckedIn") {
      onChange({
        ...data,
        attendance: {
          ...attendance,
          state: "working",
          checkIn: time,
          canCheckIn: false,
          canCheckOut: true
        }
      });
      return;
    }

    onChange({
      ...data,
      attendance: {
        ...attendance,
        state: "completed",
        checkOut: time,
        canCheckOut: false
      }
    });
  }

  return (
    <>
      <View style={styles.welcomeRow}>
        <View style={styles.profileMiniAvatar}><Text style={styles.profileMiniAvatarText}>SZ</Text></View>
        <View style={styles.flexOne}>
          <Text style={styles.hello}>Hello, {data.employee.name.split(" ")[0]}</Text>
          <Text style={styles.employeeLine}>{data.employee.position} · {data.employee.department}</Text>
        </View>
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

        {attendance.workMode === "office" && (
          <View style={attendance.officeNetworkVerified ? styles.networkGood : styles.networkWarning}>
            <Text style={attendance.officeNetworkVerified ? styles.networkGoodText : styles.networkWarningText}>
              {attendance.officeNetworkVerified
                ? "● Company network verified"
                : "○ Connect to the company network to record office attendance"}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={!actionEnabled}
          onPress={simulateAttendanceAction}
          style={({ pressed }) => [
            styles.attendanceButton,
            !actionEnabled && styles.disabledButton,
            pressed && actionEnabled && styles.pressed
          ]}
        >
          <Text style={styles.attendanceButtonText}>
            {attendance.state === "completed" ? "Attendance completed" : action}
          </Text>
        </Pressable>

        <Text style={styles.prototypeNote}>
          Prototype button only. The production action will be authorized by the HRMS backend and office gateway rules.
        </Text>
      </View>
    </>
  );
}

function ProfileScreen({ data, onSignOut }: { data: MobileTodayResponse; onSignOut: () => void }) {
  const employee = data.employee;
  return (
    <>
      <View style={styles.profileHero}>
        <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>SZ</Text></View>
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
  primaryButton: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy, marginTop: 4 },
  primaryButtonText: { color: "white", fontWeight: "800", fontSize: 14 },
  pressed: { opacity: 0.86 },
  prototypeNote: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 12 },
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
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "800", marginTop: 5 },
  statusSuccess: { backgroundColor: colors.successSoft, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  statusSuccessText: { color: colors.success, fontSize: 10, fontWeight: "800" },
  statusMuted: { backgroundColor: "#F1F5F9", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  statusMutedText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  timeGrid: { flexDirection: "row", gap: 10, marginTop: 20 },
  timeBox: { flex: 1, borderRadius: 16, padding: 14, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: colors.line },
  timeValue: { color: colors.ink, fontSize: 22, fontWeight: "800", marginTop: 5 },
  networkWarning: { borderRadius: 13, backgroundColor: colors.warningSoft, padding: 11, marginTop: 12 },
  networkWarningText: { color: colors.warning, fontSize: 11, fontWeight: "700", lineHeight: 17 },
  networkGood: { borderRadius: 13, backgroundColor: colors.successSoft, padding: 11, marginTop: 12 },
  networkGoodText: { color: colors.success, fontSize: 11, fontWeight: "700" },
  attendanceButton: { minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.blue, marginTop: 14 },
  attendanceButtonText: { color: "white", fontSize: 15, fontWeight: "800" },
  disabledButton: { backgroundColor: "#94A3B8" },
  profileHero: { alignItems: "center", paddingVertical: 14 },
  profileAvatar: { width: 88, height: 88, borderRadius: 28, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  profileAvatarText: { color: "white", fontSize: 25, fontWeight: "800" },
  profileName: { color: colors.ink, fontSize: 24, fontWeight: "800" },
  employeeNumber: { color: colors.blue, fontSize: 11, fontWeight: "800", marginTop: 4 },
  profileRole: { color: colors.muted, fontSize: 13, marginTop: 6 },
  detailRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  detailRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  detailLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  detailValue: { color: colors.ink, fontSize: 13, fontWeight: "700", marginTop: 4 },
  secondaryButton: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  secondaryButtonText: { color: colors.danger, fontSize: 13, fontWeight: "800" },
  tabBar: { flexDirection: "row", gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  tabButton: { flex: 1, minHeight: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  tabButtonActive: { backgroundColor: colors.blueSoft },
  tabText: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  tabTextActive: { color: colors.blue, fontWeight: "800" }
});
