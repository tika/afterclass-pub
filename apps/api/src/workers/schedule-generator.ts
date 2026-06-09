import { createServiceContext } from "@afterclass/core";
import { generateWeeklySchedule } from "@afterclass/core/services/discovery";

/**
 * Lambda handler: Generate discovery notification schedule for all users.
 * Triggered by EventBridge once per week (Sunday midnight campus-local time).
 *
 * For each user with a registered device token, creates 2 random send slots
 * for the upcoming week (Mon–Sat, 10 AM – 8 PM campus time).
 */
export const scheduleGeneratorHandler = async (_event?: unknown): Promise<{ created: number }> => {
  const ctx = await createServiceContext();
  const result = await generateWeeklySchedule(ctx);

  console.log(`[ScheduleGenerator] Created ${result.created} discovery slots for the week`);

  return result;
};
