export type WorkMode = "office" | "remote" | "externalSite";
export type AttendanceState = "notCheckedIn" | "working" | "completed";

export type EmployeeProfile = {
  id: number;
  employeeNo: string;
  name: string;
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
  locationLabel?: string;
  state: AttendanceState;
  checkIn?: string;
  checkOut?: string;
  officeNetworkVerified: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
};

export type MobileTodayResponse = {
  employee: EmployeeProfile;
  attendance: TodayAttendance;
};
