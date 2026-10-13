import Image from "next/image";
import { socialProfiles } from "../lib/site-brand";

export default function SocialLinks() {
  return (
    <nav aria-label="Follow Mekivo on social media" className="mx-auto mb-4 max-w-lg text-center">
      <p className="mb-2 text-xs font-semibold text-muted">Follow Mekivo</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {socialProfiles.map((profile) => (
          <a
            key={profile.id}
            href={profile.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Mekivo on ${profile.name} (opens in a new tab)`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-outline/15 bg-overlay/[0.04] px-3 py-2 text-xs font-semibold text-foreground transition hover:border-sky-300/50 hover:bg-overlay/[0.09] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white">
              <Image src={`/social/${profile.id}.svg`} alt="" width={18} height={18} />
            </span>
            <span>{profile.name}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
