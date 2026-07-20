import { Icon } from "@iconify/react";
import styles from "./styles.module.scss";

export interface AdminOverviewCardProps {
  icon: string;
  label: string;
  value: number;
}

function AdminOverviewCard({ card }: { card: AdminOverviewCardProps }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.valueWrapper}>
        <Icon icon={card.icon} height={42} />
        <h4>{card.label}</h4>
      </div>
      <h3>{card.value}</h3>
    </div>
  );
}

export default AdminOverviewCard;
