import type { Event, Group, POI, EventStatus, GroupMemberRole } from "./types";

const API_BASE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

/**
 * REST API client functions (not using oRPC)
 * Authentication is handled via session cookies (Better Auth).
 * The `token` parameter is kept for backwards compatibility but ignored.
 */
async function restFetch<T>(
  endpoint: string,
  options: RequestInit & {
    token?: string | null;
    credentials?: RequestCredentials;
  } = {},
): Promise<T> {
  const { token: _token, credentials, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    credentials: credentials || "include",
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      if (
        errorData &&
        typeof errorData === "object" &&
        "message" in errorData &&
        typeof errorData.message === "string"
      ) {
        errorMessage = errorData.message;
      } else if (
        errorData &&
        typeof errorData === "object" &&
        "error" in errorData &&
        typeof errorData.error === "string"
      ) {
        errorMessage = errorData.error;
      }
    } catch {
      // Ignore JSON parse error
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Admin API functions - all require a Clerk token
export const adminApi = {
  // Stats
  async getStats(token: string | null) {
    return restFetch<{
      totalUsers: number;
      newUsers24h: number;
      newUsers7d: number;
      totalGroups: number;
      totalEvents: number;
      eventsToday: number;
      eventsThisWeek: number;
      activeUsers7d: number;
      eventsByStatus: {
        DRAFT: number;
        PUBLISHED: number;
        CANCELLED: number;
        ARCHIVED: number;
      };
      topGroupsByFollowers: Array<{
        id: string;
        name: string;
        followerCount: number;
        [key: string]: unknown;
      }>;
      topGroupsByEvents: Array<{
        id: string;
        name: string;
        eventCount: number;
        [key: string]: unknown;
      }>;
      userGrowthTrend: Array<{ date: string; count: number }>;
      eventCreationTrend: Array<{ date: string; count: number }>;
      newGroups7d: number;
      eventsHappeningToday: Array<unknown>;
      recentlyCreatedAccounts: Array<unknown>;
      recentlyCreatedGroups: Array<unknown>;
    }>("/v1/stats", {
      method: "GET",
      token,
    });
  },

  // Posts
  async getPendingPosts(token: string | null) {
    return restFetch<{ posts: Array<unknown> }>("/v1/posts/admin/pending", {
      method: "GET",
      token,
    });
  },

  async approvePost(token: string | null, postId: number) {
    return restFetch<{ success: boolean; post: unknown }>(`/v1/posts/${postId}/approve`, {
      method: "POST",
      token,
    });
  },

  async rejectPost(token: string | null, postId: number) {
    return restFetch<{ success: boolean; post: unknown }>(`/v1/posts/${postId}/reject`, {
      method: "POST",
      token,
    });
  },

  async deletePost(token: string | null, postId: number) {
    return restFetch<{ success: boolean }>(`/v1/posts/${postId}`, {
      method: "DELETE",
      token,
    });
  },

  async getPosts(token: string | null, search?: string, status?: string) {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (status) params.append("status", status);
    const query = params.toString();
    return restFetch<{ posts: Array<unknown> }>(`/v1/posts/admin${query ? `?${query}` : ""}`, {
      method: "GET",
      token,
    });
  },

  // Comments
  async getComments(token: string | null, search?: string) {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    const query = params.toString();
    return restFetch<{ comments: Array<unknown> }>(
      `/v1/comments/admin${query ? `?${query}` : ""}`,
      {
        method: "GET",
        token,
      },
    );
  },

  async deleteComment(token: string | null, commentId: number) {
    return restFetch<{ success: boolean }>(`/v1/comments/${commentId}`, {
      method: "DELETE",
      token,
    });
  },

  // Users
  async getUsers(token: string | null, search?: string, limit?: number) {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (limit) params.append("limit", limit.toString());
    const query = params.toString();
    return restFetch<{
      users: Array<{
        id: string;
        email: string;
        name: string | null;
        gradYear: string | null;
        majors: string[];
        isBanned: boolean;
        createdAt: string;
        updatedAt: string;
      }>;
    }>(`/v1/profile/admin/users${query ? `?${query}` : ""}`, {
      method: "GET",
      token,
    });
  },

  async updateUser(
    token: string | null,
    userId: string,
    data: { name?: string; gradYear?: string; major?: string },
  ) {
    return restFetch<{ success: boolean; profile: unknown }>(`/v1/profile/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      token,
    });
  },

  async deleteUser(token: string | null, userId: string) {
    return restFetch<{ success: boolean }>(`/v1/profile/admin/users/${userId}`, {
      method: "DELETE",
      token,
    });
  },

  async banUser(token: string | null, userId: string, isBanned: boolean) {
    return restFetch<{ success: boolean; user: unknown }>(`/v1/profile/admin/users/${userId}/ban`, {
      method: "POST",
      body: JSON.stringify({ isBanned }),
      token,
    });
  },

  async getUserDetails(token: string | null, userId: string) {
    return restFetch<{
      user: unknown;
      follows: Array<unknown>;
      memberships: Array<unknown>;
      events: Array<unknown>;
    }>(`/v1/profile/admin/users/${userId}`, {
      method: "GET",
      token,
    });
  },

  async updateUserFollows(token: string | null, userId: string, groupIds: string[]) {
    return restFetch<{ success: boolean }>(`/v1/profile/admin/users/${userId}/follows`, {
      method: "PATCH",
      body: JSON.stringify({ groupIds }),
      token,
    });
  },

  async updateUserMemberships(
    token: string | null,
    userId: string,
    memberships: Array<{ groupId: string; role: GroupMemberRole }>,
  ) {
    return restFetch<{ success: boolean }>(`/v1/profile/admin/users/${userId}/memberships`, {
      method: "PATCH",
      body: JSON.stringify({ memberships }),
      token,
    });
  },

  // Groups
  async getGroups(token: string | null, search?: string) {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    const query = params.toString();
    return restFetch<{ groups: Array<unknown> }>(
      `/v1/groups/admin/all${query ? `?${query}` : ""}`,
      {
        method: "GET",
        token,
      },
    );
  },

  async getGroup(token: string | null, groupId: string) {
    return restFetch<{
      group: {
        id: string;
        name: string;
        bio?: string | null;
        logoUrl?: string | null;
        bannerUrl?: string | null;
        instagram?: string | null;
        website?: string | null;
        createdAt: string;
        updatedAt: string;
      };
      upcomingEvents: Array<unknown>;
      isFollowing?: boolean;
    }>(`/v1/groups/${groupId}`, {
      method: "GET",
      token,
    });
  },

  async getGroupFollowers(token: string | null, groupId: string) {
    return restFetch<{
      followers: Array<{
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
      }>;
    }>(`/v1/groups/${groupId}/followers`, {
      method: "GET",
      token,
    });
  },

  async getGroupMembers(token: string | null, groupId: string) {
    return restFetch<{
      members: Array<{
        member: {
          userId: string;
          groupId: string;
          role: GroupMemberRole;
          createdAt: string;
        };
        user: {
          id: string;
          name: string;
          email: string;
        };
      }>;
    }>(`/v1/groups/${groupId}/members`, {
      method: "GET",
      token,
    });
  },

  async addGroupMember(
    token: string | null,
    groupId: string,
    userIdOrEmail: string,
    role: GroupMemberRole,
    useEmail: boolean = false,
  ) {
    const body = useEmail ? { email: userIdOrEmail, role } : { userId: userIdOrEmail, role };

    return restFetch<{ success: boolean; member: unknown; invitationSent?: boolean }>(
      `/v1/groups/${groupId}/members`,
      {
        method: "POST",
        body: JSON.stringify(body),
        token,
      },
    );
  },

  async updateGroupMemberRole(
    token: string | null,
    groupId: string,
    userId: string,
    role: GroupMemberRole,
  ) {
    return restFetch<{ success: boolean; member: unknown }>(
      `/v1/groups/${groupId}/members/${userId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role }),
        token,
      },
    );
  },

  async removeGroupMember(token: string | null, groupId: string, userId: string) {
    return restFetch<{ success: boolean }>(`/v1/groups/${groupId}/members/${userId}`, {
      method: "DELETE",
      token,
    });
  },

  // Events
  async getEventAttendees(token: string | null, eventId: string) {
    return restFetch<{ eventId: string; attendeeCount: number }>(
      `/v1/events/${eventId}/attendees`,
      {
        method: "GET",
        token,
      },
    );
  },

  async bulkDeleteEvents(token: string | null, eventIds: string[]) {
    return restFetch<{
      success: boolean;
      deletedCount: number;
      events: Array<unknown>;
    }>("/v1/events/admin/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ eventIds }),
      token,
    });
  },

  async bulkUpdateEventStatus(token: string | null, eventIds: string[], status: EventStatus) {
    return restFetch<{
      success: boolean;
      updatedCount: number;
      events: Array<unknown>;
    }>("/v1/events/admin/bulk-update", {
      method: "POST",
      body: JSON.stringify({ eventIds, status }),
      token,
    });
  },

  // Push Notifications
  async getDeviceTokens(token: string | null) {
    return restFetch<{
      tokens: Array<{
        id: string;
        userId: string;
        token: string;
        createdAt: string;
        updatedAt: string;
        userName: string | null;
        userEmail: string | null;
      }>;
    }>("/v1/push/admin/device-tokens", {
      method: "GET",
      token,
    });
  },

  async sendTestPush(
    token: string | null,
    data: {
      userId: string;
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ) {
    return restFetch<{
      success: boolean;
      sent: number;
      failed: number;
      errors?: string[];
    }>("/v1/push/admin/send", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    });
  },

  async broadcastPush(
    token: string | null,
    data: { title: string; body: string; data?: Record<string, string> },
  ) {
    return restFetch<{
      success: boolean;
      sent: number;
      failed: number;
      errors?: string[];
    }>("/v1/push/admin/broadcast", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    });
  },

  async getWaitlistSignups(token: string | null) {
    return restFetch<{
      signups: Array<{
        id: string;
        email: string;
        school: string;
        createdAt: string;
      }>;
    }>("/v1/waitlist/admin/all", {
      method: "GET",
      token,
    });
  },
};

// REST API functions for events and groups
export const eventsApi = {
  /**
   * Create a new event
   * POST /v1/events
   */
  async createEvent(
    token: string | null,
    data: {
      title: string;
      description?: string;
      flyerImages: string[];
      startTime: string;
      endTime?: string;
      locationName: string;
      address?: string;
      lat?: number;
      lng?: number;
      status?: EventStatus;
      sourceUrl?: string;
      aiSummary?: string;
      metadata?: Record<string, unknown>;
      groupId: string;
    },
  ) {
    return restFetch<{ success: boolean; event: unknown }>("/v1/events", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    });
  },

  async getAllEvents(token: string | null, options?: { status?: EventStatus }) {
    const params = options?.status ? `?status=${encodeURIComponent(options.status)}` : "";
    return restFetch<{
      events: Array<{
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
      }>;
    }>(`/v1/events/admin/all${params}`, {
      method: "GET",
      token,
    });
  },

  /**
   * Get a single event by ID
   * GET /v1/events/:id
   */
  async getEvent(token: string | null, eventId: string) {
    return restFetch<{
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
    }>(`/v1/events/${eventId}`, {
      method: "GET",
      token,
    });
  },

  async updateEvent(
    token: string | null,
    eventId: string,
    data: {
      title?: string;
      description?: string;
      flyerImages?: string[];
      startTime?: string;
      endTime?: string;
      locationName?: string;
      address?: string;
      lat?: number;
      lng?: number;
      status?: EventStatus;
      sourceUrl?: string;
      aiSummary?: string;
      metadata?: Record<string, unknown>;
      groupId?: string;
    },
  ) {
    return restFetch<{ success: boolean; event: unknown }>(`/v1/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      token,
    });
  },

  async deleteEvent(token: string | null, eventId: string) {
    return restFetch<{ success: boolean }>(`/v1/events/${eventId}`, {
      method: "DELETE",
      token,
    });
  },

  /**
   * Get future events
   * GET /v1/events/future
   */
  async getFutureEvents(
    token: string | null,
    options?: {
      limit?: number;
      offset?: number;
    },
  ) {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.offset) params.append("offset", options.offset.toString());
    const query = params.toString();
    return restFetch<{
      events: Array<{
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
          logoUrl: string | null;
        } | null;
      }>;
      limit: number;
      offset: number;
    }>(`/v1/events/future${query ? `?${query}` : ""}`, {
      method: "GET",
      token,
    });
  },
};

export const groupsApi = {
  /**
   * Get list of groups
   * GET /v1/groups/admin/all
   */
  async getAllGroups(token: string | null) {
    return restFetch<{
      groups: Array<{
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
        [key: string]: unknown;
      }>;
    }>("/v1/groups/admin/all", {
      method: "GET",
      token,
    });
  },

  /**
   * Get group statistics
   * GET /v1/groups/:id/stats
   */
  async getGroupStats(token: string | null, groupId: string) {
    return restFetch<{
      followers: number;
      followersChange: number;
      engagement: number;
      engagementChange: number;
      campusRank: number;
      category: string;
    }>(`/v1/groups/${groupId}/stats`, {
      method: "GET",
      token,
    });
  },

  /**
   * Get trending groups
   * GET /v1/groups/trending
   */
  async getTrendingGroups(token: string | null, limit?: number) {
    const params = new URLSearchParams();
    if (limit) params.append("limit", limit.toString());
    const query = params.toString();
    return restFetch<{
      groups: Array<{
        id: string;
        name: string;
        engagementCount: number;
        [key: string]: unknown;
      }>;
    }>(`/v1/groups/trending${query ? `?${query}` : ""}`, {
      method: "GET",
      token,
    });
  },

  /**
   * Get campus rankings (top groups by engagement)
   * GET /v1/groups/rankings
   */
  async getCampusRankings(token: string | null, limit?: number) {
    const params = new URLSearchParams();
    if (limit) params.append("limit", limit.toString());
    const query = params.toString();
    return restFetch<{
      groups: Array<{
        id: string;
        name: string;
        engagementCount: number;
        rank: number;
        [key: string]: unknown;
      }>;
    }>(`/v1/groups/rankings${query ? `?${query}` : ""}`, {
      method: "GET",
      token,
    });
  },

  /**
   * Get group engagement details
   * GET /v1/groups/:id/engagement
   */
  async getGroupEngagementDetails(token: string | null, groupId: string) {
    return restFetch<{
      totalReminders: number;
      events: Array<{
        id: string;
        title: string;
        startTime: string;
        locationName: string | null;
        reminderCount: number;
      }>;
    }>(`/v1/groups/${groupId}/engagement`, {
      method: "GET",
      token,
    });
  },

  /**
   * Get events for a specific group
   * GET /v1/groups/:id/events
   */
  async getGroupEvents(
    token: string | null,
    groupId: string,
    options?: {
      status?: EventStatus;
      upcoming?: boolean;
      limit?: number;
      offset?: number;
    },
  ) {
    const params = new URLSearchParams();
    if (options?.status) params.append("status", options.status);
    if (options?.upcoming !== undefined) params.append("upcoming", options.upcoming.toString());
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.offset) params.append("offset", options.offset.toString());
    const query = params.toString();
    return restFetch<{
      events: Array<{
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
      }>;
    }>(`/v1/groups/${groupId}/events${query ? `?${query}` : ""}`, {
      method: "GET",
      token,
    });
  },

  /**
   * Get user's admin groups
   * GET /v1/groups/my/admins
   */
  async getMyAdminGroups(token: string | null) {
    return restFetch<{
      groups: Array<{
        group: {
          id: string;
          slug: string | null;
          name: string;
          bio?: string | null;
          logoUrl?: string | null;
          bannerUrl?: string | null;
          instagram?: string | null;
          website?: string | null;
          createdAt: string;
          updatedAt: string;
        };
        membership: {
          userId: string;
          groupId: string;
          role: GroupMemberRole;
          createdAt: string;
        };
      }>;
    }>("/v1/groups/my/admins", {
      method: "GET",
      token,
    });
  },

  async getGroupBySlug(token: string | null, slug: string) {
    return restFetch<{
      group: {
        id: string;
        slug: string | null;
        name: string;
        bio?: string | null;
        logoUrl?: string | null;
        bannerUrl?: string | null;
        instagram?: string | null;
        website?: string | null;
        createdAt: string;
        updatedAt: string;
      };
      upcomingEvents: Array<unknown>;
      isFollowing?: boolean;
    }>(`/v1/groups/by-slug/${encodeURIComponent(slug)}`, {
      method: "GET",
      token,
    });
  },

  async createGroup(
    token: string | null,
    data: {
      name: string;
      bio?: string;
      logoUrl?: string;
      bannerUrl?: string;
      instagram?: string;
      website?: string;
      isVerified?: boolean;
    },
  ) {
    // Remove empty strings and convert to undefined for optional fields
    const cleanedData = {
      ...data,
      bio: data.bio?.trim() || undefined,
      logoUrl: data.logoUrl?.trim() || undefined,
      bannerUrl: data.bannerUrl?.trim() || undefined,
      instagram: data.instagram?.trim() || undefined,
      website: data.website?.trim() || undefined,
    };
    return restFetch<{ success: boolean; group: unknown }>("/v1/groups", {
      method: "POST",
      body: JSON.stringify(cleanedData),
      token,
    });
  },

  async updateGroup(
    token: string | null,
    groupId: string,
    data: {
      name?: string;
      bio?: string;
      logoUrl?: string;
      bannerUrl?: string;
      instagram?: string;
      website?: string;
      isVerified?: boolean;
    },
  ) {
    // Remove empty strings and convert to undefined for optional fields
    const cleanedData = {
      ...data,
      bio: data.bio?.trim() || undefined,
      logoUrl: data.logoUrl?.trim() || undefined,
      bannerUrl: data.bannerUrl?.trim() || undefined,
      instagram: data.instagram?.trim() || undefined,
      website: data.website?.trim() || undefined,
    };
    return restFetch<{ success: boolean; group: unknown }>(`/v1/groups/${groupId}`, {
      method: "PATCH",
      body: JSON.stringify(cleanedData),
      token,
    });
  },

  async deleteGroup(token: string | null, groupId: string) {
    return restFetch<{ success: boolean }>(`/v1/groups/${groupId}`, {
      method: "DELETE",
      token,
    });
  },

  /**
   * Search groups with query, or get popular groups if no query
   * GET /v1/groups?search=xxx&limit=5 or GET /v1/groups/rankings?limit=5
   */
  async searchGroups(token: string | null, search?: string, limit: number = 5) {
    if (search && search.trim()) {
      const params = new URLSearchParams();
      params.append("search", search.trim());
      params.append("limit", limit.toString());
      return restFetch<{
        groups: Array<{
          id: string;
          name: string;
          bio?: string | null;
          logoUrl?: string | null;
          [key: string]: unknown;
        }>;
      }>(`/v1/groups?${params.toString()}`, {
        method: "GET",
        token,
      });
    }
    // No search query - return popular groups by engagement
    return restFetch<{
      groups: Array<{
        id: string;
        name: string;
        bio?: string | null;
        logoUrl?: string | null;
        engagementCount?: number;
        [key: string]: unknown;
      }>;
    }>(`/v1/groups/rankings?limit=${limit}`, {
      method: "GET",
      token,
    });
  },
};

// POIs API
export const poisApi = {
  /**
   * Get all POIs
   * GET /v1/pois
   */
  async getPOIs(token: string | null) {
    return restFetch<{
      pois: Array<{
        id: string;
        name: string;
        aliases: string[] | null;
        address: string | null;
        lat: number;
        lng: number;
        createdAt: string;
        updatedAt: string;
      }>;
    }>("/v1/pois", {
      method: "GET",
      token,
    });
  },

  /**
   * Get a single POI
   * GET /v1/pois/:id
   */
  async getPOI(token: string | null, poiId: string) {
    return restFetch<{
      poi: {
        id: string;
        name: string;
        description: string | null;
        address: string | null;
        lat: number;
        lng: number;
        category: string | null;
        createdAt: string;
        updatedAt: string;
      };
    }>(`/v1/pois/${poiId}`, {
      method: "GET",
      token,
    });
  },

  /**
   * Create a POI
   * POST /v1/pois
   */
  async createPOI(
    token: string | null,
    data: {
      name: string;
      description?: string | null;
      address?: string | null;
      lat: number;
      lng: number;
      category?: string | null;
    },
  ) {
    return restFetch<{
      poi: {
        id: string;
        name: string;
        description: string | null;
        address: string | null;
        lat: number;
        lng: number;
        category: string | null;
        createdAt: string;
        updatedAt: string;
      };
    }>("/v1/pois", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    });
  },

  /**
   * Update a POI
   * PATCH /v1/pois/:id
   */
  async updatePOI(
    token: string | null,
    poiId: string,
    data: {
      name?: string;
      description?: string | null;
      address?: string | null;
      lat?: number;
      lng?: number;
      category?: string | null;
    },
  ) {
    return restFetch<{
      poi: {
        id: string;
        name: string;
        description: string | null;
        address: string | null;
        lat: number;
        lng: number;
        category: string | null;
        createdAt: string;
        updatedAt: string;
      };
    }>(`/v1/pois/${poiId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      token,
    });
  },

  /**
   * Delete a POI
   * DELETE /v1/pois/:id
   */
  async deletePOI(token: string | null, poiId: string) {
    return restFetch<{ success: boolean }>(`/v1/pois/${poiId}`, {
      method: "DELETE",
      token,
    });
  },
};

// Admin POIs API (admin only)
export const adminPoisApi = {
  /**
   * Get all POIs (admin only)
   * GET /v1/pois/admin/all
   */
  async getAllPOIs(token: string | null) {
    return restFetch<{
      pois: Array<{
        id: string;
        name: string;
        aliases: string[] | null;
        address: string | null;
        lat: number;
        lng: number;
        createdAt: string;
        updatedAt: string;
      }>;
    }>("/v1/pois/admin/all", {
      method: "GET",
      token,
    });
  },

  /**
   * Create a POI (admin only)
   * POST /v1/pois/admin
   */
  async createPOI(
    token: string | null,
    data: {
      name: string;
      aliases?: string[];
      address?: string;
      lat: number;
      lng: number;
    },
  ) {
    return restFetch<{
      poi: {
        id: string;
        name: string;
        aliases: string[] | null;
        address: string | null;
        lat: number;
        lng: number;
        createdAt: string;
        updatedAt: string;
      };
    }>("/v1/pois/admin", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    });
  },

  /**
   * Update a POI (admin only)
   * PATCH /v1/pois/admin/:id
   */
  async updatePOI(
    token: string | null,
    poiId: string,
    data: {
      name?: string;
      aliases?: string[] | null;
      address?: string | null;
      lat?: number;
      lng?: number;
    },
  ) {
    return restFetch<{
      poi: {
        id: string;
        name: string;
        aliases: string[] | null;
        address: string | null;
        lat: number;
        lng: number;
        createdAt: string;
        updatedAt: string;
      };
    }>(`/v1/pois/admin/${poiId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      token,
    });
  },

  /**
   * Delete a POI (admin only)
   * DELETE /v1/pois/admin/:id
   */
  async deletePOI(token: string | null, poiId: string) {
    return restFetch<{ success: boolean }>(`/v1/pois/admin/${poiId}`, {
      method: "DELETE",
      token,
    });
  },
};

// Waitlist API functions
export const waitlistApi = {
  async signup(email: string, school: string) {
    return restFetch<{
      success: boolean;
      signup: {
        id: string;
        email: string;
        school: string;
        createdAt: string;
      };
    }>("/v1/waitlist/signup", {
      method: "POST",
      body: JSON.stringify({ email, school }),
      credentials: "include", // Important: include cookies in request
    });
  },

  async checkStatus() {
    return restFetch<{
      hasSignedUp: boolean;
    }>("/v1/waitlist/check", {
      method: "GET",
      credentials: "include", // Important: include cookies in request
    });
  },
};
