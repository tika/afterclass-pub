export const API_ROUTES = {
  // General
  ping: "/ping",

  // Onboarding
  onboarding: {
    validateEmailDomain: "/api/v1/onboarding/validate-email-domain",
    status: "/api/v1/onboarding/status",
    complete: "/api/v1/onboarding/complete",
    reset: "/api/v1/onboarding/reset",
  },

  // Feed
  feed: "/api/v1/feed",

  // Posts
  posts: {
    root: "/api/v1/posts",
    uploadImage: "/api/v1/posts/upload-image",
    detail: (postId: string) => `/api/v1/posts/${postId}`,
    comments: (postId: string) => `/api/v1/posts/${postId}/comments`,
    commentById: (postId: string, commentId: string) =>
      `/api/v1/posts/${postId}/comments/${commentId}`,
  },

  // Events
  events: {
    future: "/api/v1/events/future",
    byId: (id: string) => `/api/v1/events/${id}`,
    byLocation: (locationId: string) => `/api/v1/events/location/${locationId}`,
    map: "/api/v1/events/map",
  },

  // Organizations
  organizations: {
    list: "/api/v1/organizations",
    detail: (id: string) => `/api/v1/organizations/${id}`,
  },

  // Profile
  profile: {
    me: "/api/v1/profile/me",
    byUserId: (userId: string) => `/api/v1/profile/${userId}`,
  },

  // Admin
  admin: {
    posts: {
      pending: "/api/v1/admin/posts/pending",
      list: "/api/v1/admin/posts",
      approve: (id: string) => `/api/v1/admin/posts/${id}/approve`,
      reject: (id: string) => `/api/v1/admin/posts/${id}/reject`,
      update: (id: string) => `/api/v1/admin/posts/${id}`,
      delete: (id: string) => `/api/v1/admin/posts/${id}`,
      detail: (id: string) => `/api/v1/admin/posts/${id}`,
    },
    comments: {
      list: "/api/v1/admin/comments",
      delete: (id: string) => `/api/v1/admin/comments/${id}`,
    },
    users: {
      list: "/api/v1/admin/users",
      detail: (id: string) => `/api/v1/admin/users/${id}`,
      ban: (id: string) => `/api/v1/admin/users/${id}/ban`,
      update: (id: string) => `/api/v1/admin/users/${id}`,
    },
    organizations: {
      list: "/api/v1/admin/organizations",
      create: "/api/v1/admin/organizations",
      update: (id: string) => `/api/v1/admin/organizations/${id}`,
      delete: (id: string) => `/api/v1/admin/organizations/${id}`,
    },
    events: {
      list: "/api/v1/admin/events",
      create: "/api/v1/admin/events",
      update: (id: string) => `/api/v1/admin/events/${id}`,
      delete: (id: string) => `/api/v1/admin/events/${id}`,
    },
    locations: {
      list: "/api/v1/admin/locations",
      create: "/api/v1/admin/locations",
      update: (id: string) => `/api/v1/admin/locations/${id}`,
      delete: (id: string) => `/api/v1/admin/locations/${id}`,
    },
    universities: {
      list: "/api/v1/admin/universities",
      create: "/api/v1/admin/universities",
    },
    sportTeams: {
      list: "/api/v1/admin/sport-teams",
      create: "/api/v1/admin/sport-teams",
    },
    sportEvents: {
      create: "/api/v1/admin/sport-events",
    },
    stats: "/api/v1/admin/stats",
  },
};
