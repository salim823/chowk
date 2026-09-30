"use client";

import { useChatSettings } from "@/lib/chatSettings";

function SpeakerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
  );
}

function PopupIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
      <path d="M12 8v4" />
      <path d="M12 15h.01" />
    </svg>
  );
}

function ContactsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ActiveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
        on ? "bg-[#4F46E5]" : "bg-neutral-300"
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

/**
 * Chowk-style "Chat settings" panel. Every toggle is functional and
 * persisted per-user via the chat settings context.
 */
export function ChatSettingsPanel() {
  const { settings, updateSettings } = useChatSettings();

  const rows: {
    key: "messageSounds" | "popupNewMessages" | "showContacts" | "activeStatus";
    icon: React.ReactNode;
    title: string;
    description?: string;
  }[] = [
    {
      key: "messageSounds",
      icon: <SpeakerIcon />,
      title: "Message sounds",
      description: "Play a sound for new messages.",
    },
    {
      key: "popupNewMessages",
      icon: <PopupIcon />,
      title: "Pop up new messages",
      description: "Automatically open new messages.",
    },
    {
      key: "showContacts",
      icon: <ContactsIcon />,
      title: "Show contacts",
      description: "Show the contacts list on desktop.",
    },
    {
      key: "activeStatus",
      icon: <ActiveIcon />,
      title: `Active Status: ${settings.activeStatus ? "ON" : "OFF"}`,
      description: "Let people know when you're active.",
    },
  ];

  return (
    <div className="w-72 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-neutral-200">
      <div className="border-b border-neutral-200 px-4 py-3">
        <p className="text-[15px] font-bold text-[#211D33]">Chat settings</p>
        <p className="text-xs text-[#6F6B80]">
          Customise your Messenger experience.
        </p>
      </div>
      <ul className="py-1">
        {rows.map(({ key, icon, title, description }) => (
          <li
            key={key}
            className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-neutral-100"
            onClick={() =>
              updateSettings({ [key]: !settings[key] } as Partial<
                typeof settings
              >)
            }
          >
            <span className="shrink-0 text-[#211D33]">{icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#211D33]">
                {title}
              </span>
              {description && (
                <span className="block text-xs text-[#6F6B80]">
                  {description}
                </span>
              )}
            </span>
            <span onClick={(e) => e.stopPropagation()}>
              <Toggle
                on={settings[key]}
                onChange={(next) =>
                  updateSettings({ [key]: next } as Partial<typeof settings>)
                }
                label={title}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
