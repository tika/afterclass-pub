import { eq } from "drizzle-orm";
import type { ServiceContext } from "./context";
import { appConfig } from "@afterclass/core/db/schema";

const DEFAULT_CONFIG = {
  ios: {
    latestVersion: "0.2.0",
    minimumVersion: "0.1.0",
    appStoreUrl: "https://apps.apple.com/app/idXXXXXXXX",
  },
} as const;

export type AppConfigResponse = {
  ios: {
    latestVersion: string;
    minimumVersion: string;
    appStoreUrl: string;
  };
  announcement?: {
    enabled: boolean;
    title: string;
    message: string;
  };
};

/**
 * Fetch app config from DB for update prompts and announcements
 */
export const getAppConfig = async (ctx: ServiceContext): Promise<AppConfigResponse> => {
  const [row] = await ctx.db.select().from(appConfig).where(eq(appConfig.id, "default")).limit(1);

  if (!row) {
    return DEFAULT_CONFIG;
  }

  const result: AppConfigResponse = {
    ios: {
      latestVersion: row.iosLatestVersion,
      minimumVersion: row.iosMinimumVersion,
      appStoreUrl: row.iosAppStoreUrl,
    },
  };

  if (row.announcementEnabled && row.announcementTitle && row.announcementMessage) {
    result.announcement = {
      enabled: true,
      title: row.announcementTitle,
      message: row.announcementMessage,
    };
  }

  return result;
};

export type UpdateAppConfigInput = {
  iosLatestVersion?: string;
  iosMinimumVersion?: string;
  iosAppStoreUrl?: string;
  announcementEnabled?: boolean;
  announcementTitle?: string;
  announcementMessage?: string;
};
