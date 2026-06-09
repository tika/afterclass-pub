import { eq } from "drizzle-orm";
import { eventBus } from "@afterclass/core/events";
import type { GroupMemberAdded, ProfileCreated } from "@afterclass/core/schemas/domain-events";
import { groups, users } from "@afterclass/core/db/schema";
import { sendGroupInvitationEmail } from "@afterclass/core/lib/email";

/**
 * Event handlers for email side effects
 */
export const registerEmailHandlers = () => {
  /**
   * When a new member is added to a group, send an invitation/welcome email
   */
  eventBus.on<GroupMemberAdded>("GroupMemberAdded", async (event, ctx) => {
    const { groupId, userId, addedBy } = event.payload;

    // Don't email if the user added themselves (e.g., creator)
    if (userId === addedBy) return;

    try {
      const [user] = await ctx.db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const [group] = await ctx.db
        .select({ name: groups.name })
        .from(groups)
        .where(eq(groups.id, groupId))
        .limit(1);

      const [inviter] = await ctx.db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, addedBy))
        .limit(1);

      if (!user || !group) return;

      await sendGroupInvitationEmail({
        email: user.email,
        groupName: group.name,
        inviterName: inviter?.name || undefined,
      });

      console.log(
        `[EmailHandler] Sent group invitation email to ${user.email} for group "${group.name}"`,
      );
    } catch (error) {
      console.error(`[EmailHandler] Failed to send group invitation email:`, error);
    }
  });

  /**
   * When a new profile is created, send a welcome email
   * (placeholder - implement when welcome email template exists)
   */
  eventBus.on<ProfileCreated>("ProfileCreated", async (event, _ctx) => {
    const { email } = event.payload;
    console.log(`[EmailHandler] ProfileCreated for ${email} - welcome email not yet implemented`);
  });
};
