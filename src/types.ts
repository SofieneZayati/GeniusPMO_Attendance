export type WorkMode = "office" | "remote" | "externalSite" | "leave" | "notScheduled";
export type AttendanceState = "notCheckedIn" | "working" | "completed";

export type EmployeeProfile = {
  id: number;
  employeeNo: string;
  name: string;
  hasProfilePhoto: boolean;
  email: string;
  phone: string;
  position: string;
  department: string;
  team: string;
  manager: string;
  contractType: string;
  startDate: string;
};

export type TodayAttendance = {
  date: string;
  start: string;
  end: string;
  workMode: WorkMode;
  state: AttendanceState;
  status: string;
  checkIn?: string;
  checkOut?: string;
  officeNetworkVerified: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  developmentOfficeAction: boolean;
};

export type MobileTodayResponse = {
  employee: EmployeeProfile;
  attendance: TodayAttendance;
};

export type CurrentUser = {
  id: number;
  email: string;
  is_active: boolean;
  must_change_password: boolean;
  employee_id: number | null;
  permissions: string[];
};

export type MobileLoginResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: CurrentUser;
};

export type SelfServiceProfileResponse = {
  id: number;
  employee_no: string;
  name: string;
  initials: string;
  has_profile_photo: boolean;
  email: string;
  phone: string;
  job_title: string;
  department: string;
  primary_team: string;
  manager: string;
  start_date: string;
  contract_type: string;
};

export type AttendanceReadinessResponse = {
  simulator_enabled: boolean;
  work_date: string;
  scheduled: boolean;
  schedule_start: string | null;
  schedule_end: string | null;
  work_mode: WorkMode;
  status: string;
  entry_time: string | null;
  exit_time: string | null;
  next_action: "check_in" | "check_out" | null;
  can_simulate_scan: boolean;
};

export type AttendanceSimulatorScanResponse = {
  event_id: number;
  event_type: "entry" | "exit";
  event_time: string;
  result: string;
  state: AttendanceReadinessResponse;
};
