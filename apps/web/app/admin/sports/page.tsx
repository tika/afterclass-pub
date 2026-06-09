"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Sports Management</h1>
        <p className="mt-2 text-muted-foreground">Manage universities, teams, and sport events</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sports</CardTitle>
          <CardDescription>Manage universities, teams, and sports events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <span className="text-6xl block mb-4">⚽</span>
            <p className="text-muted-foreground mb-4">Sports management coming soon</p>
            <Button>Coming Soon</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
