import type { InputHTMLAttributes, ReactNode } from "react";
import Image from "next/image";

/** Shared card shell for the login / signup screens. */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-6">
      <div className="w-full max-w-sm rounded-3xl bg-white px-6 py-8 shadow-xl shadow-neutral-900/5 ring-1 ring-neutral-200 sm:px-8">
        <div className="mx-auto mb-5 w-fit overflow-hidden rounded-2xl">
          <Image
            src="/logo.webp"
            alt="Chowk logo"
            width={72}
            height={72}
            className="h-[72px] w-[72px] object-cover"
            priority
          />
        </div>
        <h1 className="text-center text-2xl font-bold text-[#211D33]">
          {title}
        </h1>
        <p className="mt-1.5 text-center text-sm text-[#6F6B80]">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

type TextFieldProps = {
  label: string;
  fieldError?: string;
} & InputHTMLAttributes<HTMLInputElement>;

/** Labeled input with big tap target and inline validation message. */
export function TextField({ label, fieldError, id, ...props }: TextFieldProps) {
  const fieldId = id ?? props.name;
  return (
    <div>
      <label
        htmlFor={fieldId}
        className="mb-1.5 block text-sm font-medium text-[#211D33]"
      >
        {label}
      </label>
      <input
        id={fieldId}
        {...props}
        className={`w-full rounded-xl border px-4 py-3 text-base text-[#211D33] placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
          fieldError
            ? "border-red-400 focus:ring-red-200"
            : "border-neutral-300 focus:border-[#4F46E5] focus:ring-[#4F46E5]/30"
        }`}
      />
      {fieldError ? (
        <p className="mt-1.5 text-sm text-red-600">{fieldError}</p>
      ) : null}
    </div>
  );
}

/** Full-width form-level error banner. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-xl bg-red-50 p-3.5 text-sm font-medium text-red-700 ring-1 ring-red-200">
      {message}
    </div>
  );
}

/** Full-width success / info banner. */
export function FormNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-xl bg-blue-50 p-3.5 text-sm font-medium text-[#4338CA] ring-1 ring-blue-200">
      {message}
    </div>
  );
}

/** Big blue submit button. */
export function SubmitButton({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full cursor-pointer rounded-xl bg-[#4F46E5] px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? "Please wait..." : children}
    </button>
  );
}
