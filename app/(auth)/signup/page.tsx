"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  AuthCard,
  TextField,
  FormError,
  FormNotice,
  SubmitButton,
} from "@/components/auth-ui";

// 3-20 chars: lowercase letters, numbers, underscore.
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function friendlySignupError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "This username is already taken. Try another one.";
  }
  if (lower.includes("password")) {
    return "Password must be at least 6 characters long.";
  }
  return message || "Something went wrong. Please try again.";
}

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setUsernameError("");
    setFormError(null);
    setNotice(null);

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
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters long.");
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
      // 1. Username must be unique.
      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle();
      if (taken) {
        setFormError("This username is already taken. Try another one.");
        return;
      }

      // 2. Create the auth account. Email is derived from the username,
      //    so users only ever see and type their username.
      const email = `${cleanUsername}@chowk.app`;
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setFormError(friendlySignupError(error.message));
        return;
      }
      const user = data.user;
      if (!user) {
        setFormError("Something went wrong. Please try again.");
        return;
      }

      // 3. Create the profile row.
      const { error: profileError } = await supabase.from("profiles").insert({
        id: user.id,
        username: cleanUsername,
        full_name: fullName.trim(),
      });
      if (profileError) {
        if (profileError.code === "23505") {
          setFormError(
            "This username was just taken. Please choose another one."
          );
        } else {
          setFormError(
            "Account created, but we could not save your profile. Please log in and try again."
          );
        }
        return;
      }

      // 4. Done. With "Confirm email" off this returns a session at once;
      //    if it is ever on, fall back to asking the user to log in.
      if (data.session) {
        router.push("/feed");
        router.refresh();
      } else {
        setNotice("Account created. Please log in to continue.");
        window.setTimeout(() => router.push("/login"), 1500);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Create account"
      subtitle="Where your street comes together."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
        <FormError message={formError} />
        <FormNotice message={notice} />
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
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <SubmitButton busy={busy}>Create account</SubmitButton>
      </form>
      <p className="mt-5 text-center text-sm text-[#6F6B80]">
        Already have an account?{" "}
        <Link href="/login" className="cursor-pointer font-medium text-[#4F46E5] underline transition-colors hover:text-blue-900">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
