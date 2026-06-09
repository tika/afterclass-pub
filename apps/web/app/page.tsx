"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { waitlistApi } from "@/lib/api-client";

const platforms = [
  "Instagram Stories",
  "GroupMe",
  "Email Blasts",
  "Bulletin Boards",
  "WhatsApp Groups",
  "Discord Servers",
  "Flyers",
  "Word of Mouth",
];

const floatingCards = [
  {
    emoji: "🎸",
    title: "Open Mic Night",
    meta: "42 going",
    position: "left-[8%] top-[30%]",
    bg: "bg-amber-100",
    border: "border-amber-200",
    shape: "rounded-2xl",
    animation: "animate-[float_4s_ease-in-out_infinite]",
    delay: "0s",
  },
  {
    emoji: "⚽",
    title: "Tufts vs. Williams",
    meta: "Tomorrow",
    position: "right-[6%] top-[35%]",
    bg: "bg-emerald-100",
    border: "border-emerald-200",
    shape: "rounded-full px-6",
    animation: "animate-[float-drift_6s_ease-in-out_infinite]",
    delay: "1.5s",
  },
  {
    emoji: "📚",
    title: "Study Jam @ Tisch",
    meta: "18 going",
    position: "bottom-[28%] left-[12%]",
    bg: "bg-violet-100",
    border: "border-violet-200",
    shape: "rounded-tl-[24px] rounded-br-[24px] rounded-tr-lg rounded-bl-lg",
    animation: "animate-[float-bob_5s_ease-in-out_infinite]",
    delay: "0.8s",
  },
  {
    emoji: "🎤",
    title: "Spring Fling",
    meta: "127 going",
    position: "bottom-[32%] right-[10%]",
    bg: "bg-rose-100",
    border: "border-rose-200",
    shape: "rounded-2xl",
    animation: "animate-[float_4s_ease-in-out_infinite]",
    delay: "2.2s",
  },
];

export default function Home() {
  const [email, setEmail] = useState("");
  const [school, setSchool] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkSignupStatus = async () => {
      try {
        const result = await waitlistApi.checkStatus();
        if (result.hasSignedUp) setIsSignedUp(true);
      } catch {
        console.error("Failed to check waitlist status");
      }
    };
    checkSignupStatus();
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !school) {
      toast.error("Please fill in all fields");
      return;
    }
    setIsSubmitting(true);
    try {
      await waitlistApi.signup(email, school);
      setIsSignedUp(true);
      toast.success("Successfully joined the waitlist!");
      setEmail("");
      setSchool("");
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("already on the waitlist")) {
          const result = await waitlistApi.checkStatus();
          if (result.hasSignedUp) setIsSignedUp(true);
          toast.info("You're already on the waitlist!");
        } else {
          toast.error(error.message || "Failed to join waitlist");
        }
      } else {
        toast.error("Failed to join waitlist");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-ac-bg text-ac-ink">
      {/* Nav */}
      <nav className="fixed inset-x-0 top-0 z-100 flex items-center justify-between border-b border-ac-border/50 bg-ac-bg/85 px-4 py-3 backdrop-blur-[20px] md:px-10 md:py-4">
        <Link
          href="#"
          className="flex items-center gap-2.5 text-lg font-bold text-ac-ink no-underline font-headline md:text-xl"
        >
          <Logo className="h-6 w-6 md:h-7 md:w-7" />
          Afterclass
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="#problem"
            className="text-sm font-medium text-ac-steel no-underline transition-colors hover:text-ac-blue"
          >
            The Problem
          </Link>
          <Link
            href="#events"
            className="text-sm font-medium text-ac-steel no-underline transition-colors hover:text-ac-blue"
          >
            Events
          </Link>
          <Link
            href="#organizers"
            className="text-sm font-medium text-ac-steel no-underline transition-colors hover:text-ac-blue"
          >
            For Organizers
          </Link>
          <a
            href="https://instagram.com/afterclassrsvp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-ac-steel no-underline transition-colors hover:text-ac-blue"
          >
            @afterclassrsvp
          </a>
          <Link
            href="#cta"
            className="rounded-[14px] bg-ac-blue px-6 py-2.5 text-sm font-semibold text-white no-underline transition-all hover:bg-ac-blue-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(37,99,235,0.3)]"
          >
            Claim Your Spot
          </Link>
        </div>

        {/* Mobile: CTA + hamburger */}
        <div className="flex items-center gap-3 md:hidden">
          <Link
            href="#cta"
            className="rounded-xl bg-ac-blue px-4 py-2 text-sm font-semibold text-white no-underline transition-all hover:bg-ac-blue-dark active:scale-95"
          >
            Claim Your Spot
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ac-steel transition-colors hover:bg-ac-border/50 hover:text-ac-ink"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-[99] bg-ac-ink/20 backdrop-blur-[2px] md:hidden"
            aria-label="Close menu"
          />
          <div className="fixed inset-x-0 top-14 z-[99] flex flex-col gap-1 border-b border-ac-border bg-ac-bg/95 p-4 shadow-lg backdrop-blur-[20px] md:hidden">
            <Link
              href="#problem"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-xl px-4 py-3 text-base font-medium text-ac-ink no-underline transition-colors hover:bg-ac-blue-wash hover:text-ac-blue"
            >
              The Problem
            </Link>
            <Link
              href="#events"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-xl px-4 py-3 text-base font-medium text-ac-ink no-underline transition-colors hover:bg-ac-blue-wash hover:text-ac-blue"
            >
              Events
            </Link>
            <Link
              href="#organizers"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-xl px-4 py-3 text-base font-medium text-ac-ink no-underline transition-colors hover:bg-ac-blue-wash hover:text-ac-blue"
            >
              For Organizers
            </Link>
            <a
              href="https://instagram.com/afterclassrsvp"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-xl px-4 py-3 text-base font-medium text-ac-ink no-underline transition-colors hover:bg-ac-blue-wash hover:text-ac-blue"
            >
              @afterclassrsvp
            </a>
          </div>
        </>
      )}

      {/* Hero */}
      <section className="relative flex min-h-screen max-auto flex-col items-center justify-center overflow-hidden px-4 pb-20 pt-24 text-center md:px-10 md:pt-[140px]">
        {/* Dynamic gradient mesh background */}
        <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
          <div
            className="absolute -left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-ac-blue/20 blur-[100px] animate-[gradient-shift_12s_ease-in-out_infinite]"
            style={{ animationDelay: "0s" }}
          />
          <div
            className="absolute -right-1/4 bottom-1/4 h-[400px] w-[400px] rounded-full bg-amber-300/25 blur-[80px] animate-[gradient-shift_12s_ease-in-out_infinite]"
            style={{ animationDelay: "-4s" }}
          />
          <div
            className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-300/20 blur-[60px] animate-[gradient-shift_12s_ease-in-out_infinite]"
            style={{ animationDelay: "-8s" }}
          />
        </div>

        {/* Doodles & abstract shapes */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
          <svg
            className="absolute left-[5%] top-[25%] h-8 w-8 text-ac-blue/15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M12 2L15 8L21 9L16 14L17 21L12 18L7 21L8 14L3 9L9 8L12 2Z" />
          </svg>
          <svg
            className="absolute right-[8%] top-[20%] h-6 w-6 text-amber-400/20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="10" />
          </svg>
          <svg
            className="absolute bottom-[35%] left-[8%] h-5 w-5 text-violet-400/15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
          </svg>
          <div className="absolute right-[12%] bottom-[30%] h-3 w-12 rotate-12 rounded-full bg-ac-sky/10" />
          <div className="absolute left-[15%] top-[40%] h-2 w-8 -rotate-6 rounded-full bg-rose-300/15" />
        </div>

        <div
          className="animate-[fade-up_0.8s_ease_both] relative z-10"
          style={{ animationName: "fade-up" }}
        >
          <div
            className="mb-4 text-[18px] font-medium text-ac-steel"
            style={{ fontFamily: "var(--font-caveat), cursive" }}
          >
            FOMO is officially dead.
          </div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-ac-blue-wash px-4 py-2 text-[13px] font-semibold text-ac-blue">
            <span className="h-2 w-2 animate-pulse rounded-full bg-ac-blue" />
            Live at Tufts · Expanding to more campuses
          </div>
          <h1 className="mx-auto mb-6 max-w-[800px] font-headline text-[64px] font-bold leading-[1.05] tracking-[-2px] text-ac-ink">
            Everything happening at your university.{" "}
            <span className="bg-gradient-to-r from-ac-blue to-ac-sky bg-clip-text text-transparent">
              One app.
            </span>
          </h1>
          <p className="mx-auto mb-9 max-w-[560px] text-lg leading-[1.7] text-ac-steel">
            Afterclass brings every club event, sports game, and campus gathering into one place.
          </p>
          <p className="mx-auto mb-10 text-xl font-semibold text-ac-ink">
            Stop searching. Start showing up.
          </p>
          <div className="mb-10 flex items-center justify-center gap-3.5">
            <Link
              href="#cta"
              className="inline-flex items-center gap-2 rounded-[14px] bg-ac-blue px-8 py-3.5 text-[15px] font-semibold text-white no-underline transition-all duration-200 hover:bg-ac-blue-dark hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(37,99,235,0.3)]"
            >
              Claim Your Spot
            </Link>
            <Link
              href="#organizers"
              className="inline-flex items-center gap-2 rounded-[14px] border-[1.5px] border-ac-border bg-white px-8 py-3.5 text-[15px] font-semibold text-ac-ink no-underline transition-all duration-200 hover:border-ac-blue hover:text-ac-blue"
            >
              I Run a Club →
            </Link>
          </div>
        </div>

        {/* Floating event cards — vibrant, interactive, varied animations */}
        {floatingCards.map((card) => (
          <div
            key={card.title}
            className={`group absolute ${card.position} hidden cursor-grab active:cursor-grabbing whitespace-nowrap ${card.shape} border-2 ${card.border} ${card.bg} px-5 py-4 text-[13px] font-semibold shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 hover:scale-105 hover:rotate-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] lg:flex lg:items-center lg:gap-2 ${card.animation}`}
            style={{ animationDelay: card.delay }}
          >
            <span className="text-2xl transition-transform duration-300 group-hover:scale-125">
              {card.emoji}
            </span>
            <span>
              {card.title} · <span className="text-ac-blue font-bold">{card.meta}</span>
            </span>
            <span className="ml-1 hidden rounded-full bg-ac-blue/20 px-2.5 py-0.5 text-[11px] font-bold text-ac-blue opacity-0 transition-all duration-300 group-hover:opacity-100">
              Join
            </span>
          </div>
        ))}
      </section>

      {/* The Problem */}
      <section id="problem" className="mx-auto max-w-[1280px] px-10 py-[100px]">
        <div className="mb-4 text-xs font-bold uppercase tracking-[2.5px] text-ac-blue">
          The Problem
        </div>
        <h2 className="mb-4 max-w-[700px] font-headline text-5xl font-bold leading-tight tracking-[-1.5px] text-ac-ink">
          Campus life is everywhere. <span className="text-ac-blue">Except one place.</span>
        </h2>
        <p className="mb-12 max-w-[600px] text-[17px] leading-[1.7] text-ac-steel">
          There isn&apos;t one central place to see what&apos;s going on around campus. Events get
          posted on Instagram stories, buried in GroupMe chats, sent through email blasts, or taped
          to random bulletin boards. Most of the time, you only find out about something if you
          already know the right people.
        </p>

        {/* Scrolling ticker of scattered platforms */}
        <div className="relative mb-16 overflow-hidden rounded-[20px] border border-ac-border bg-white py-5">
          <div
            className="flex animate-[marquee_25s_linear_infinite]"
            style={{ width: "max-content" }}
          >
            {[...platforms, ...platforms].map((p, i) => (
              <span
                key={`${p}-${i}`}
                className="mx-4 shrink-0 rounded-full border border-ac-border bg-ac-bg px-5 py-2.5 text-sm font-medium text-ac-steel"
              >
                {p}
              </span>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-white to-transparent" />
          <div className="mt-4 text-center text-sm font-medium text-ac-mist">
            ...and somehow you&apos;re supposed to check all of these?
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-[28px] border border-red-200 bg-red-50 p-10">
            <h3 className="mb-5 text-sm font-bold uppercase tracking-[1.5px] text-red-400">
              😵 Without Afterclass
            </h3>
            <ul className="flex flex-col gap-3.5 list-none">
              {[
                ["📱", "Check 5 different group chats to find weekend plans"],
                ["📧", "Miss the one email about the event you'd actually love"],
                ["🏫", "Walk past a club fair once, never hear from them again"],
                ["📌", "See a flyer on a board, forget the date immediately"],
                ["🤷", '"I didn\'t know that was happening" — every weekend'],
              ].map(([icon, text]) => (
                <li
                  key={String(icon)}
                  className="flex items-start gap-2.5 text-[15px] leading-[1.5]"
                >
                  <span className="mt-0.5 shrink-0 text-base">{icon}</span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[28px] bg-gradient-to-br from-ac-blue to-ac-sky p-10 text-white">
            <h3 className="mb-5 text-sm font-bold uppercase tracking-[1.5px] text-white/85">
              ✨ With Afterclass
            </h3>
            <ul className="flex flex-col gap-3.5 list-none">
              {[
                ["📍", "One feed of every event at your school, right now"],
                ["🔔", "Get notified about events from clubs you follow"],
                ["👥", "See what friends are going to before you decide"],
                ["🎯", "Discover clubs and orgs you never knew existed"],
                ["⚡", "Spontaneous plans? Post it and people show up"],
              ].map(([icon, text]) => (
                <li
                  key={String(icon)}
                  className="flex items-start gap-2.5 text-[15px] leading-[1.5] text-white/92"
                >
                  <span className="mt-0.5 shrink-0 text-base">{icon}</span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* What You'll Find */}
      <section id="events" className="mx-auto max-w-[1280px] px-10 py-[100px]">
        <div className="mb-4 text-xs font-bold uppercase tracking-[2.5px] text-ac-blue">
          What You&apos;ll Find
        </div>
        <h2 className="mb-4 font-headline text-5xl font-bold leading-tight tracking-[-1.5px] text-ac-ink">
          Every kind of event, <span className="text-ac-blue">one place</span>
        </h2>
        <p className="mb-12 max-w-[600px] text-[17px] leading-[1.7] text-ac-steel">
          From packed athletic games to club meetings and schoolwide events, Afterclass brings
          everything together in one place. We pull directly from athletics schedules, student
          organizations, and campus calendars — so nothing slips through the cracks.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            {
              banner: "from-[#F97395] to-[#FBBF24]",
              emoji: "🎸",
              month: "FEB",
              day: "21",
              org: "Tufts Concert Board",
              orgColor: "#2563eb",
              name: "Battle of the Bands",
              details: "📍 Dewick · 🕗 8:00 PM · Free entry",
              avatars: ["A", "R", "P"],
              count: "+89 going",
            },
            {
              banner: "from-ac-blue to-ac-sky",
              emoji: "🧠",
              month: "FEB",
              day: "18",
              org: "JumboCode",
              orgColor: "#059669",
              name: "Demo Day: Spring Projects",
              details: "📍 Joyce Cummings · 🕗 6:00 PM",
              avatars: ["T", "S"],
              count: "+34 going",
            },
            {
              banner: "from-[#34D399] to-[#059669]",
              emoji: "⚽",
              month: "FEB",
              day: "22",
              org: "Tufts Athletics",
              orgColor: "#2563EB",
              name: "Men's Soccer vs. Williams",
              details: "📍 Bello Field · 🕗 1:00 PM",
              avatars: ["M", "K", "D"],
              count: "+56 going",
            },
          ].map((card) => (
            <div
              key={card.name}
              className="group cursor-pointer overflow-hidden rounded-[20px] border border-ac-border bg-white transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(37,99,235,0.12)] hover:border-ac-blue-wash"
            >
              <div
                className={`flex h-[140px] items-center justify-center bg-gradient-to-br ${card.banner} text-5xl relative`}
              >
                <span className="transition-transform duration-300 group-hover:scale-125">
                  {card.emoji}
                </span>
                <div className="absolute right-3 top-3 rounded-xl bg-white px-2.5 py-1.5 text-center shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-ac-blue">
                    {card.month}
                  </div>
                  <div className="text-lg font-extrabold leading-none text-ac-ink">{card.day}</div>
                </div>
              </div>
              <div className="px-5 pb-5 pt-4">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-ac-mist">
                  <div
                    className="flex h-[18px] w-[18px] items-center justify-center rounded-md text-[9px] font-extrabold text-white"
                    style={{ backgroundColor: card.orgColor }}
                  >
                    {card.org[0]}
                  </div>
                  {card.org}
                </div>
                <div className="mb-1.5 text-base font-bold leading-snug font-headline">
                  {card.name}
                </div>
                <div className="mb-3.5 text-[13px] leading-[1.5] text-ac-mist">{card.details}</div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1.5">
                      {card.avatars.map((l, i) => (
                        <div
                          key={`${card.name}-${i}`}
                          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white"
                          style={{
                            marginLeft: i === 0 ? 0 : "-6px",
                            backgroundColor: [
                              "#60a5fa",
                              "#38bdf8",
                              "#34d399",
                              "#2563eb",
                              "#fbbf24",
                              "#f97316",
                            ][i % 6],
                          }}
                        >
                          {l}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-ac-steel">{card.count}</span>
                  </div>
                  <button
                    type="button"
                    className="rounded-full bg-ac-blue-wash px-4 py-1.5 text-xs font-semibold text-ac-blue transition-all hover:bg-ac-blue hover:text-white hover:scale-105"
                  >
                    RSVP
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Powered By Everything */}
      <section className="mx-auto max-w-[1280px] px-10 py-[100px]">
        <div className="rounded-[28px] border border-ac-border bg-white p-16">
          <div className="text-xs font-bold uppercase tracking-[2.5px] text-ac-blue">
            Powered By Everything
          </div>
          <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-[-1.5px] text-ac-ink">
            Your hub, not a <span className="text-ac-blue">replacement</span>
          </h2>
          <p className="mt-4 max-w-[600px] text-[17px] leading-[1.7] text-ac-steel">
            Afterclass works alongside the platforms you already use. It&apos;s not here to replace
            Instagram or your group chat — it&apos;s the central place that brings everything
            together. Organizers can post once, and it shows up where students are already looking,
            without having to copy and paste the same event ten different times.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-12 md:grid-cols-2 md:items-center">
            <div className="flex flex-col gap-4">
              {[
                ["#DBEAFE", "🎟", "JumboTickets", "Ticketed events auto-imported"],
                ["#E0F2FE", "📸", "Instagram", "Club posts embedded in feed"],
                ["#FEF3C7", "📅", "Campus Calendars", "Official university events synced"],
                ["#D1FAE5", "📰", "Club Newsletters", "Events extracted automatically"],
                ["#DBEAFE", "🏟", "Athletics (RSS)", "Every game, every sport"],
              ].map(([bg, icon, name, desc]) => (
                <div
                  key={name}
                  className="flex cursor-default items-center gap-3.5 rounded-[14px] px-5 py-4 transition-all hover:translate-x-1.5 hover:shadow-[0_4px_12px_rgba(37,99,235,0.08)]"
                  style={{ backgroundColor: bg }}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-lg"
                    style={{ backgroundColor: bg }}
                  >
                    {icon}
                  </div>
                  <div>
                    <div className="text-sm font-bold">{name}</div>
                    <div className="text-xs text-ac-mist">{desc}</div>
                  </div>
                </div>
              ))}
              <div className="py-2 text-center text-2xl text-ac-mist">↓</div>
              <div className="rounded-[14px] bg-gradient-to-br from-ac-blue to-ac-sky p-5 text-center text-base font-bold text-white">
                ✨ Afterclass Feed
              </div>
            </div>

            <div className="flex flex-col gap-6">
              {[
                [
                  "🔄",
                  "Auto-sync, zero effort",
                  "Events from ticketing platforms, university APIs, and athletic RSS feeds are pulled in automatically. No double-posting required.",
                ],
                [
                  "🔗",
                  "Instagram embeds, not replacements",
                  "Club Instagram posts can be embedded directly in the feed. We complement social media — we don't compete with it.",
                ],
                [
                  "📬",
                  "Newsletter intelligence",
                  "We read club newsletters and automatically surface events mentioned in them, so nothing gets buried in an inbox.",
                ],
                [
                  "⚡",
                  "Spontaneous events too",
                  "Not everything is planned. Anyone can post a pickup game, study group, or last-minute hangout that goes live instantly.",
                ],
              ].map(([icon, title, p]) => (
                <div key={title} className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ac-blue-wash text-xl">
                    {icon}
                  </div>
                  <div>
                    <h4 className="mb-1 text-[15px] font-bold">{title}</h4>
                    <p className="text-[13px] leading-[1.6] text-ac-steel">{p}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* For Club Leaders */}
      <section id="organizers" className="mx-auto mt-5 max-w-[1280px] px-10 py-[100px]">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:items-center">
          <div>
            <div className="mb-4 text-xs font-bold uppercase tracking-[2.5px] text-ac-blue">
              For Club Leaders
            </div>
            <h2 className="mb-4 font-headline text-5xl font-bold leading-tight tracking-[-1.5px] text-ac-ink">
              Reach your campus,
              <br />
              not just your followers
            </h2>
            <p className="mb-12 max-w-[560px] text-[17px] leading-[1.7] text-ac-steel">
              Afterclass is free for every club — whether you have 10 members or 200. It gives every
              organization equal visibility across campus, along with built-in insights and event
              stats so you can see what&apos;s working. No algorithms deciding who gets seen more.
              Just a level playing field and a better way to reach students.
            </p>

            <div className="flex flex-col gap-7">
              {[
                [
                  1,
                  "Create events in seconds",
                  "Upload a flyer, set the time and place, and you're live. No forms, no approval queues.",
                ],
                [
                  2,
                  "Real RSVP data",
                  "See who's coming, who's maybe, and plan accordingly. No more guessing headcount from a group chat poll.",
                ],
                [
                  3,
                  "Organizer dashboard",
                  "Manage your team, track event performance, and grow your club's reach — all from one place.",
                ],
                [
                  4,
                  "Works for anyone",
                  "Professors posting office hours, departments running info sessions, or students throwing a spontaneous cookout. Same platform, same ease.",
                ],
              ].map(([num, title, p]) => (
                <div
                  key={String(num)}
                  className="flex gap-4 rounded-[20px] p-5 transition-all hover:bg-white hover:shadow-[0_4px_16px_rgba(37,99,235,0.08)]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-ac-blue-wash text-sm font-extrabold text-ac-blue">
                    {num}
                  </div>
                  <div>
                    <h4 className="mb-1 text-base font-bold">{title}</h4>
                    <p className="text-sm leading-[1.6] text-ac-steel">{p}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="overflow-hidden rounded-[20px] border border-ac-border bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="flex items-center gap-3 border-b border-ac-border bg-ac-bg px-5 py-3.5">
                <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                <span className="ml-3 text-xs font-bold text-ac-mist">
                  Afterclass · Organizer Dashboard
                </span>
              </div>
              <div className="grid grid-cols-1 gap-5 p-5 min-h-[300px] md:grid-cols-[180px_1fr]">
                <div className="flex flex-col gap-1 md:flex-row md:flex-wrap">
                  {["📊 Overview", "📅 Events", "👥 Members", "📣 Promote", "⚙️ Settings"].map(
                    (item, i) => (
                      <div
                        key={item}
                        className={`flex items-center gap-2 rounded-[10px] px-3 py-2 text-xs font-medium ${
                          i === 0 ? "bg-ac-blue-wash font-bold text-ac-blue" : "text-ac-steel"
                        }`}
                      >
                        {item}
                      </div>
                    ),
                  )}
                </div>
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ["Total RSVPs", "1,247", "↑ 23% this month"],
                      ["Events", "18", "3 upcoming"],
                      ["Followers", "342", "↑ 12% this month"],
                    ].map(([label, val, change]) => (
                      <div key={label} className="rounded-xl bg-ac-bg p-4">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ac-mist">
                          {label}
                        </div>
                        <div className="text-2xl font-extrabold">{val}</div>
                        <div className="text-[10px] font-semibold text-[#059669]">{change}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs font-bold text-ac-steel">Upcoming Events</div>
                  <div className="flex flex-col gap-2">
                    {[
                      ["🎤 Open Mic Night", "Feb 21", "42 RSVPs"],
                      ["🍕 GBM + Pizza", "Feb 25", "28 RSVPs"],
                      ["🎬 Movie Night", "Mar 1", "19 RSVPs"],
                    ].map(([name, date, rsvps]) => (
                      <div
                        key={name}
                        className="flex items-center justify-between rounded-[10px] bg-ac-bg px-3.5 py-2.5 text-xs"
                      >
                        <span className="font-bold">{name}</span>
                        <span className="text-ac-mist">{date}</span>
                        <span className="font-bold text-ac-blue">{rsvps}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="mx-auto mt-5 max-w-[1280px] px-10 py-[100px] text-center">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-ac-blue via-ac-blue-light to-ac-sky px-10 py-20 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent_60%)] before:pointer-events-none">
          <h2 className="relative mb-4 font-headline text-[52px] font-bold tracking-[-1.5px] text-white">
            Stop Missing Out
          </h2>
          <p className="relative mx-auto mb-9 max-w-[500px] text-lg leading-[1.6] text-white/85">
            Join the waitlist to get early access when Afterclass launches at your school. Already
            at Tufts? You&apos;re in.
          </p>
          {isSignedUp ? (
            <div className="relative mb-5 rounded-[14px] bg-white/20 px-5 py-5">
              <p className="m-0 font-semibold text-white">
                You&apos;re on the waitlist! We&apos;ll notify you when we launch.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="relative mb-5 flex flex-wrap justify-center gap-3"
            >
              <input
                type="text"
                className="w-[240px] rounded-[14px] border-2 border-white/30 bg-white/15 px-6 py-4 text-[15px] text-white outline-none backdrop-blur-[10px] transition-all placeholder:text-white/60 focus:border-white focus:bg-white/20"
                placeholder="Your school (e.g., Tufts)"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                disabled={isSubmitting}
              />
              <input
                type="email"
                className="w-[240px] rounded-[14px] border-2 border-white/30 bg-white/15 px-6 py-4 text-[15px] text-white outline-none backdrop-blur-[10px] transition-all placeholder:text-white/60 focus:border-white focus:bg-white/20"
                placeholder="Your .edu email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setIsSignedUp(false);
                }}
                disabled={isSubmitting}
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-[14px] border-none bg-white px-9 py-4 text-[15px] font-bold text-ac-blue transition-all hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)] disabled:opacity-70"
              >
                {isSubmitting ? "Joining..." : "Get on the List →"}
              </button>
            </form>
          )}
          <p className="relative text-[13px] text-white/60">
            We&apos;ll notify you when we launch at your campus. No spam, ever.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-[20px] border border-ac-border bg-white p-9 text-left transition-all hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(37,99,235,0.1)]">
            <div className="mb-3 text-[32px]">🏫</div>
            <h3 className="mb-2 text-xl font-bold font-headline">Running a club or org?</h3>
            <p className="mb-5 text-sm leading-[1.6] text-ac-steel">
              Get your organizer dashboard set up and start reaching students beyond your existing
              followers.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-[14px] bg-ac-blue px-6 py-3 text-sm font-semibold text-white no-underline transition-all hover:bg-ac-blue-dark hover:-translate-y-0.5"
            >
              Organizer Sign In →
            </Link>
          </div>
          <div className="rounded-[20px] border border-ac-border bg-white p-9 text-left transition-all hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(37,99,235,0.1)]">
            <div className="mb-3 text-[32px]">🤝</div>
            <h3 className="mb-2 text-xl font-bold font-headline">
              Want Afterclass at your school?
            </h3>
            <p className="mb-5 text-sm leading-[1.6] text-ac-steel">
              We&apos;re expanding campus by campus. If you want to bring Afterclass to your
              university, let&apos;s talk.
            </p>
            <a
              href="mailto:organizers@afterclass.rsvp?subject=Request Campus Access"
              className="inline-flex items-center gap-2 rounded-[14px] border-[1.5px] border-ac-border bg-white px-6 py-3 text-sm font-semibold text-ac-ink no-underline transition-all hover:border-ac-blue hover:text-ac-blue"
            >
              Request Your Campus →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto mt-[100px] flex max-w-[1280px] items-end justify-between border-t border-ac-border px-10 pb-10 pt-[60px]">
        <div className="flex flex-col gap-2">
          <div className="text-lg font-bold font-headline">Afterclass</div>
          <div className="text-[13px] text-ac-mist">
            Everything happening at your university. One app.
          </div>
        </div>
        <div className="flex gap-8">
          <a
            href="https://instagram.com/afterclassrsvp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-ac-steel no-underline transition-colors hover:text-ac-blue"
          >
            Instagram
          </a>
          <a
            href="https://afterclass.rsvp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-ac-steel no-underline transition-colors hover:text-ac-blue"
          >
            afterclass.rsvp
          </a>
          <Link
            href="/privacy"
            className="text-[13px] text-ac-steel no-underline transition-colors hover:text-ac-blue"
          >
            Privacy
          </Link>
          <Link
            href="/tos"
            className="text-[13px] text-ac-steel no-underline transition-colors hover:text-ac-blue"
          >
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
