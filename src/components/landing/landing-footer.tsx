import { faGithub, faInstagram } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Copyright, Mail } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";

const GITHUB_ORG_URL = "https://github.com/AnvilNote";

export function LandingFooter({
  rights,
  privacy,
  terms,
}: {
  rights: string;
  privacy: string;
  terms: string;
}) {
  return (
    <footer>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start">
          <span className="flex items-center gap-1.5">
            <Copyright className="size-4" />
            {rights}
          </span>
          <nav aria-label="Legal" className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-foreground">
              {privacy}
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              {terms}
            </Link>
          </nav>
        </div>
        <nav aria-label="Contact" className="flex items-center justify-center gap-4 sm:justify-end">
          <a
            href={GITHUB_ORG_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="transition-colors hover:text-foreground"
          >
            <FontAwesomeIcon icon={faGithub} className="size-4" />
          </a>
          <a
            href="https://www.instagram.com/anvilnoteapp"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
            className="transition-colors hover:text-foreground"
          >
            <FontAwesomeIcon icon={faInstagram} className="size-4" />
          </a>
          <a
            href="mailto:contact@anvilnote.org"
            aria-label="Email"
            className="transition-colors hover:text-foreground"
          >
            <Mail className="size-4" />
          </a>
        </nav>
      </div>
    </footer>
  );
}
