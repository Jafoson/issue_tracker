import { Topbar } from "@/components/ui/layout/Topbar/Topbar";
import styles from "./layout.module.scss";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.wrapper}>
      <Topbar />
      <div className={styles.body}>{children}</div>
    </div>
  );
}
