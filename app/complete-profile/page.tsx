"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  AuthCard,
  TextField,
  FormError,
  SubmitButton,
} from "@/components/auth-ui";

// 3-20 chars: lowercase letters, numbers, underscore (same as signup).
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/**
 * Shown once after a Google sign-in when the auth user has no Chowk
 * profile row yet. Collects a username (plus name) and creates it.
 * Requires a session: without one the user is bounced to /login.
 */
export default function CompleteProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        router.replace("/login");
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      // Already finished this step (e.g. back button)? Skip to the feed.
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (profile) {
        router.replace("/feed");
        return;
      }
      // Prefill the name from the Google account when available.
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const suggested =
        (meta.full_name as string) || (meta.name as string) || "";
      if (suggested) setFullName(suggested);
      setUserId(user.id);
      setChecking(false);
    })();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setUsernameError("");
    setFormError(null);

    const cleanUsername = username.trim().toLowerCase();
    if (!USERNAME_RE.test(cleanUsername)) {
      setUsernameError(
        "Username must be 3-20 characters: lowercase letters, numbers or underscore."
      );
      return;
    }
    if (fullName.trim().length === 0) {
      setFormError("Please enter your full name.");
      return;
    }
    if (!userId) {
      setFormError("Your session expired. Please log in again.");
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setFormError(
        "The app is not connected to the database yet. Please try again later."
      );
      return;
    }

    setBusy(true);
    try {
      // Username must be unique across all sign-in methods.
      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle();
      if (taken) {
        setFormError("This username is already taken. Try another one.");
        return;
      }

      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        username: cleanUsername,
        full_name: fullName.trim(),
      });
      if (profileError) {
        if (profileError.code === "23505") {
          setFormError(
            "This username was just taken. Please choose another one."
          );
        } else {
          setFormError("Something went wrong. Please try again.");
        }
        return;
      }

      router.push("/feed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <AuthCard title="One last step" subtitle="Setting up your profile.">
        <p className="py-6 text-center text-sm text-[#6F6B80]">Please wait...</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="One last step"
      subtitle="Pick a username for your Chowk profile."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormError message={formError} />
        <TextField
          label="Username"
          name="username"
          type="text"
          autoComplete="username"
          placeholder="e.g. salim_khan"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          fieldError={usernameError}
          maxLength={20}
        />
        <TextField
          label="Full name"
          name="fullName"
          type="text"
          autoComplete="name"
          placeholder="Your full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={80}
        />
        <SubmitButton busy={busy}>Continue</SubmitButton>
      </form>
    </AuthCard>
  );
}
