import styles from "../../sidebar.module.scss";
import NavGroupAdmin from "./Admin";
import NavGroupGlobal from "./Global";
import NavGroupProjects from "./Projects";
import NavGroupWorkspace from "./Workspace";

interface NavGroupProps {
  isAdminRoute: boolean;
}

function NavGroup({ isAdminRoute = true }: NavGroupProps) {
  return (
    <div className={styles.navGroup}>
      {!isAdminRoute && (
        <>
          <NavGroupGlobal />
          <NavGroupProjects />
          <NavGroupWorkspace />
        </>
      )}
      {isAdminRoute && <NavGroupAdmin />}
    </div>
  );
}

export default NavGroup;
