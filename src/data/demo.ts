import type { MobileTodayResponse } from "../types";

// Temporary UI-only data. Remove when the HRMS mobile endpoints are connected.
export const demoToday: MobileTodayResponse = {
  employee: {
    id: 50,
    employeeNo: "GPMO-050",
    name: "Sofiene Zayati",
    email: "sofiene.zayati@geniuspmo.com",
    phone: "+216 -- --- ---",
    position: "Junior Consultant",
    department: "PMO",
    team: "Internship Program",
    manager: "Yassine Trabelsi",
    contractType: "Internship",
    startDate: "2026-07-01"
  },
  attendance: {
    date: "2026-08-20",
    start: "09:00",
    end: "18:00",
    workMode: "remote",
    locationLabel: "Remote",
    state: "notCheckedIn",
    officeNetworkVerified: false,
    canCheckIn: true,
    canCheckOut: false
  }
};
