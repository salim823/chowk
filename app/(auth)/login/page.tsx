"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  AuthCard,
  TextField,
  FormError,
  SubmitButton,
} from "@/components/auth-ui";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length === 0 || password.length === 0) {
      setFormError("Please enter your username and password.");
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
      const { error } = await supabase.auth.signInWithPassword({
        email: `${cleanUsername}@chowk.app`,
        password,
      });
      if (error) {
        // Keep it generic on purpose: do not reveal which part was wrong.
        setFormError("Incorrect username or password. Please try again.");
        return;
      }
      router.push("/feed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Log in" subtitle="Where your street comes together.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
        <FormError message={formError} />
        <TextField
          label="Username"
          name="username"
          type="text"
          autoComplete="username"
          placeholder="Your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={20}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <SubmitButton busy={busy}>Log in</SubmitButton>
      </form>
      <p className="mt-5 text-center text-sm text-[#6F6B80]">
        New here?{" "}
        <Link href="/signup" className="cursor-pointer font-medium text-[#4F46E5] underline transition-colors hover:text-blue-900">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
