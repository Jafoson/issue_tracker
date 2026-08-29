import styles from "./layout.module.scss";

// As with the project: each view renders its own topbar — only it knows the
// count of filtered issues shown in the title. This layout only holds the
// column together.
export default function MyLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.wrapper}>{children}</div>;
}
