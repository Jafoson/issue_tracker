import styles from "./layout.module.scss";

// Each view renders its own topbar — only it knows the count of filtered
// issues shown in the title. This layout only holds the column together.
export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={styles.wrapper}>{children}</div>;
}
