import styles from "./layout.module.scss";

// Die Topbar rendert jede View selbst — nur sie kennt die Anzahl der gefilterten
// Issues, die im Titel steht. Das Layout hält nur noch die Spalte zusammen.
export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={styles.wrapper}>{children}</div>;
}
