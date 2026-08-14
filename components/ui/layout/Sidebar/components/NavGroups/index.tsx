import styles from "../../sidebar.module.scss";
import NavGroupAdmin from "./Admin";
import NavGroupGlobal from "./Global";
import NavGroupPlatform from "./Platform";
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
          {/* Zuletzt und für die wenigsten: der Sprung über den Workspace
              hinaus. Er zeigt sich nur mit `platform.access` und bleibt sonst
              ganz weg. */}
          <NavGroupPlatform />
        </>
      )}
      {isAdminRoute && <NavGroupAdmin />}
    </div>
  );
}

export default NavGroup;
