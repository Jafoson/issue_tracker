import styles from "../../sidebar.module.scss";
import NavGroupAdmin from "./Admin";
import NavGroupGlobal from "./Global";
import NavGroupProjects from "./Projects";
import NavGroupWorkspace from "./Workspace";
import NavGroupWorkspaceDashboard from "./WorkspaceDashboard";

interface NavGroupProps {
  isAdminRoute: boolean;
}

function NavGroup({ isAdminRoute = true }: NavGroupProps) {
  return (
    <div className={styles.navGroup}>
      {!isAdminRoute && (
        <>
          <NavGroupWorkspaceDashboard />
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
