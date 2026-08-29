import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { NavLink } from "@/components/ui/layout/NavLink/NavLink";
import {
  type SettingsNavSubject,
  SettingsSubjectMenu,
} from "./SettingsSubjectMenu";
import styles from "./settingsNav.module.scss";

export type { SettingsNavSubject };

export interface SettingsNavItem {
  href: string;
  label: string;
  icon: string;
}

interface Props {
  /** Whose settings — name of the workspace or the project. */
  subject: string;
  /** Color dot before the name. Without it, the name stands alone. */
  color?: string;
  /** Uploaded image instead of the color dot, e.g. a workspace avatar. */
  image?: string;
  /**
   * Turns the header into a switcher: siblings whose equivalent section you
   * can jump to from here. With fewer than two entries, the name stays put
   * — a trigger with no destination would be a promise the list doesn't keep.
   */
  siblings?: SettingsNavSubject[];
  /** Heading above the switch list, e.g. "Project". */
  siblingsLabel?: string;
  /** Heading of the nav, e.g. "Settings". */
  title: string;
  /**
   * Already filtered: the layout removes whatever permission is missing
   * for. This component checks nothing — it renders whatever it receives.
   */
  items: SettingsNavItem[];
}

/**
 * The second navigation level of the settings — for the workspace, for a
 * project, and for one's own account.
 *
 * Switching between these three happens one level up, in the header above
 * (`components/ui/layout/SettingsHeader`) — the switcher there also swaps
 * out this nav, so it can't live inside it.
 *
 * It sits next to the sidebar, not inside it: General, Members, Roles, and
 * Labels belong together and would otherwise bloat the sidebar list by a
 * handful of rows per entry.
 *
 * The rows are the same as in the sidebar (`NavLink`) — two levels of the
 * same navigation shouldn't feel different, and the active marking
 * therefore follows the same rule too (`isNavActive`, so without a pattern
 * it's the whole path, not just its prefix). That keeps this component a
 * Server Component: the row reads the path itself.
 */
export function SettingsNav({
  subject,
  color,
  image,
  siblings,
  siblingsLabel,
  title,
  items,
}: Props) {
  // The header only becomes a switcher when there's something to switch
  // between: one's own account has no siblings, and a single project isn't
  // a choice.
  const switchable =
    siblingsLabel && color && siblings && siblings.length > 1 ? siblings : null;

  return (
    <nav className={styles.nav} aria-label={title}>
      {switchable && color && siblingsLabel ? (
        <SettingsSubjectMenu
          name={subject}
          color={color}
          image={image}
          siblings={switchable}
          label={siblingsLabel}
        />
      ) : (
        <div className={styles.head}>
          {color && (
            <Avatar
              avatar={{ name: subject, color, image }}
              shape="square"
              size={20}
            />
          )}
          <span className={styles.subject} title={subject}>
            {subject}
          </span>
        </div>
      )}
      <p className={styles.title}>{title}</p>

      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.href}>
            <NavLink href={item.href} icon={item.icon} label={item.label} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
