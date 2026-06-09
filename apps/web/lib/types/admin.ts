export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "ARCHIVED";
export type MemberRole = "ADMIN" | "MEMBER";

export interface AdminGroup {
  id: string;
  name: string;
  bio?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  instagram?: string | null;
  website?: string | null;
  isVerified?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  gradYear: string | null;
  majors: string[];
  isBanned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminEvent {
  event: {
    id: string;
    title: string;
    description: string | null;
    flyerImages: string[];
    startTime: string;
    endTime: string | null;
    locationName: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
    status: EventStatus;
    sourceUrl: string | null;
    aiSummary: string | null;
    metadata: Record<string, unknown> | null;
    groupId: string;
    createdAt: string;
    updatedAt: string;
  };
  group: {
    id: string;
    name: string;
  } | null;
}

export interface AdminPOI {
  id: string;
  name: string;
  aliases: string[] | null;
  address: string | null;
  lat: number;
  lng: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFollower {
  follow: {
    userId: string;
    groupId: string;
    createdAt: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface AdminMember {
  member: {
    userId: string;
    groupId: string;
    role: MemberRole;
    createdAt: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface AdminUserDetail {
  user: AdminUser;
  follows: Array<{
    userId: string;
    groupId: string;
    createdAt: string;
    group: {
      id: string;
      name: string;
    };
  }>;
  memberships: Array<{
    userId: string;
    groupId: string;
    role: MemberRole;
    createdAt: string;
    group: {
      id: string;
      name: string;
    };
  }>;
  events: Array<{
    userId: string;
    eventId: string;
    createdAt: string;
    event: {
      id: string;
      title: string;
      startTime: string;
      groupId: string;
    };
  }>;
}

export interface DeviceToken {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  userName: string | null;
  userEmail: string | null;
}

export interface WaitlistSignup {
  id: string;
  email: string;
  school: string;
  createdAt: string;
}
