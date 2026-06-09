import { NextResponse } from "next/server";

export async function GET() {
  const association = {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: ["B4KQ95LR37.rsvp.afterclass.ios"],
          paths: ["/e/*"],
        },
      ],
    },
  };

  return NextResponse.json(association, {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
