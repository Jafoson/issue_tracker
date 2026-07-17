import NavGroupGlobal from './Global'
import styles from "../../sidebar.module.scss"
import NavGroupProjects from './Projects'
import NavGroupWorkspace from './Workspace'

interface NavGroupProps {
    isAdminRoute: boolean
}

function NavGroup({isAdminRoute = false}:NavGroupProps) {
  return (
    <div className={styles.navGroup}>
      <NavGroupGlobal/>
      <NavGroupProjects/>
      <NavGroupWorkspace/>
    </div>
  )
}

export default NavGroup