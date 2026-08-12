import styles from "./layout.module.scss";

// Wie beim Projekt: die Topbar rendert jede View selbst — nur sie kennt die
// Anzahl der gefilterten Issues, die im Titel steht. Das Layout hält nur die
// Spalte zusammen.
export default function MyLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.wrapper}>{children}</div>;
}
