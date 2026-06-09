"use client";

import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ReloadIcon } from "mage-icons-react/stroke";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApi } from "@/lib/api-client";
import type { DeviceToken } from "@/lib/types/admin";

export default function PushNotificationsAdmin() {
  const { getToken } = useAuth();

  // Send form state
  const [selectedUserId, setSelectedUserId] = useState("");
  const [title, setTitle] = useState("Test Notification");
  const [body, setBody] = useState("This is a test push notification from the admin panel.");
  const [eventId, setEventId] = useState("");

  const { data: tokensData, isLoading } = useQuery({
    queryKey: ["admin-device-tokens"],
    queryFn: async () => {
      const token = await getToken();
      return adminApi.getDeviceTokens(token);
    },
  });
  const tokens = tokensData?.tokens || [];

  const sendMutation = useMutation({
    mutationFn: async ({
      userId,
      title,
      body,
      data,
    }: {
      userId: string;
      title: string;
      body: string;
      data?: Record<string, string>;
    }) => {
      const token = await getToken();
      return adminApi.sendTestPush(token, { userId, title, body, data });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send push notification");
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: async ({
      title,
      body,
      data,
    }: {
      title: string;
      body: string;
      data?: Record<string, string>;
    }) => {
      const token = await getToken();
      return adminApi.broadcastPush(token, { title, body, data });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to broadcast push notification");
    },
  });

  const handleSendToUser = (userId: string) => {
    if (!title.trim() || !body.trim()) return;
    const data: Record<string, string> = {};
    if (eventId.trim()) {
      data.eventId = eventId.trim();
    }
    sendMutation.mutate({
      userId,
      title: title.trim(),
      body: body.trim(),
      data: Object.keys(data).length > 0 ? data : undefined,
    });
  };

  const handleSendCustom = () => {
    if (!selectedUserId.trim()) {
      toast.error("Please enter a user ID");
      return;
    }
    handleSendToUser(selectedUserId.trim());
  };

  const handleBroadcast = () => {
    if (!title.trim() || !body.trim()) return;
    if (!window.confirm(`Broadcast to all ${tokens.length} registered device(s)?`)) return;
    const data: Record<string, string> = {};
    if (eventId.trim()) {
      data.eventId = eventId.trim();
    }
    broadcastMutation.mutate({
      title: title.trim(),
      body: body.trim(),
      data: Object.keys(data).length > 0 ? data : undefined,
    });
  };

  // Group tokens by user
  const userMap = new Map<
    string,
    {
      userId: string;
      userName: string | null;
      userEmail: string | null;
      tokens: DeviceToken[];
    }
  >();
  for (const t of tokens) {
    const existing = userMap.get(t.userId);
    if (existing) {
      existing.tokens.push(t);
    } else {
      userMap.set(t.userId, {
        userId: t.userId,
        userName: t.userName,
        userEmail: t.userEmail,
        tokens: [t],
      });
    }
  }
  const users = Array.from(userMap.values());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <ReloadIcon className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline">Push Notifications</h1>
        <p className="mt-2 text-muted-foreground">
          Test push notifications and view registered devices
        </p>
      </div>

      {/* Notification content */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Content</CardTitle>
          <CardDescription>
            Configure the notification to send. Use the &quot;Send&quot; button next to a user
            below, or enter a user ID manually.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-1 block">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">
                Event ID (optional, for deep link)
              </Label>
              <Input
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                placeholder="UUID of event to open on tap"
              />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium mb-1 block">Body</Label>
            <Input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Notification body"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-sm font-medium mb-1 block">Send to User ID</Label>
              <Input
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                placeholder="Paste a user UUID here"
              />
            </div>
            <Button
              onClick={handleSendCustom}
              disabled={
                !selectedUserId.trim() || !title.trim() || !body.trim() || sendMutation.isPending
              }
            >
              {sendMutation.isPending && sendMutation.variables?.userId === selectedUserId
                ? "Sending..."
                : "Send to User"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleBroadcast}
              disabled={
                !title.trim() ||
                !body.trim() ||
                sendMutation.isPending ||
                broadcastMutation.isPending ||
                tokens.length === 0
              }
            >
              {broadcastMutation.isPending
                ? "Broadcasting..."
                : `Broadcast to All (${tokens.length})`}
            </Button>
          </div>
          {broadcastMutation.data && (
            <div>
              <p
                className={`text-sm ${broadcastMutation.data.failed > 0 ? "text-red-600" : "text-green-600"}`}
              >
                Broadcast complete — Sent: {broadcastMutation.data.sent}, Failed:{" "}
                {broadcastMutation.data.failed}
              </p>
              {broadcastMutation.data.errors?.map((err: string) => (
                <p key={err} className="text-xs text-red-500">
                  {err}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registered devices */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Devices ({tokens.length})</CardTitle>
          <CardDescription>
            {users.length} user{users.length !== 1 ? "s" : ""} with registered push tokens
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No devices registered for push notifications yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.userName || "Unknown"}</span>
                      <span className="text-sm text-muted-foreground">{user.userEmail}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {user.tokens.length} device
                      {user.tokens.length !== 1 ? "s" : ""}
                      {" \u00B7 "}
                      Token: {user.tokens[0]?.token.slice(0, 16)}
                      ...
                    </p>
                    {sendMutation.data && sendMutation.variables?.userId === user.userId && (
                      <div className="mt-1">
                        <p
                          className={`text-xs ${sendMutation.data.failed > 0 ? "text-red-600" : "text-green-600"}`}
                        >
                          Sent: {sendMutation.data.sent}, Failed: {sendMutation.data.failed}
                        </p>
                        {sendMutation.data.errors?.map((err: string) => (
                          <p key={err} className="text-xs text-red-500">
                            {err}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendToUser(user.userId)}
                    disabled={sendMutation.isPending || !title.trim() || !body.trim()}
                  >
                    {sendMutation.isPending && sendMutation.variables?.userId === user.userId
                      ? "Sending..."
                      : "Send"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
